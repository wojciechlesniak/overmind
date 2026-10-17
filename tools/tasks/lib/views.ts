import { gitText } from "./git.ts";
import { readiness, topologicalLayers } from "./graph.ts";
import { ownsOverlap } from "./glob.ts";
import type { CommandInput } from "./arguments.ts";
import { TaskToolError } from "./errors.ts";
import type { Task } from "./model.ts";
import { loadClaimedTask, refresh, remoteClaims } from "./repository.ts";
import type { Repository } from "./repository.ts";

async function inventory(repo: Repository) {
  const tasks = await refresh(repo);
  const remote = await remoteClaims(repo.git);
  const claims = [];
  for (const [id, sha] of remote) {
    const integrated = tasks.get(id);
    if (integrated?.status === "done") {
      continue;
    }
    const task = await loadClaimedTask(repo, id, sha);
    const fields = (await gitText(repo.git, "show", "-s", "--format=%an%x00%ae%x00%ct", sha))
      .trim()
      .split("\0");
    const [author, email, date] = fields;
    if (!author || !email || !date || !/^\d+$/u.test(date)) {
      throw new TaskToolError(4, "Invalid claimed task metadata");
    }
    claims.push({ id, sha, author, email, committedAt: Number(date), task, integrated });
  }
  return { tasks, claims };
}

export async function next(repo: Repository, input: CommandInput) {
  const { tasks, claims } = await inventory(repo);
  const layer = new Map(
    topologicalLayers(tasks).flatMap((ids, index) => ids.map((id) => [id, index] as const)),
  );
  const sizes = { XS: 0, S: 1, M: 2 };
  const candidates = [...tasks.values()].filter(
    (task) =>
      readiness(task, tasks).ready &&
      !claims.some((claim) => claim.id === task.id) &&
      (!input.area || input.area === task.area),
  );
  const rows = candidates.map((task) => ({
    id: task.id,
    title: task.title,
    area: task.area,
    priority: task.priority,
    size: task.size,
    layer: layer.get(task.id) ?? 0,
    unblocks: [...tasks.values()].filter(
      (other) => other.status === "todo" && other.depends_on.includes(task.id),
    ).length,
    provides: task.provides,
    conflicts: claims.flatMap((claim) =>
      ownsOverlap(task.owns, claim.task.owns).map((path) => ({ id: claim.id, path })),
    ),
  }));
  rows.sort(
    (a, b) =>
      Number(a.conflicts.length > 0) - Number(b.conflicts.length > 0) ||
      a.priority.localeCompare(b.priority) ||
      a.layer - b.layer ||
      b.unblocks - a.unblocks ||
      sizes[a.size] - sizes[b.size] ||
      a.id.localeCompare(b.id),
  );
  return { schemaVersion: 1 as const, command: "next" as const, tasks: rows.slice(0, input.limit) };
}

export async function status(repo: Repository, input: CommandInput) {
  const { tasks, claims } = await inventory(repo);
  const email = input.mine ? (await gitText(repo.git, "config", "user.email")).trim() : undefined;
  const counts = new Map<string, Record<Task["status"], number> & { area: string }>();
  for (const task of tasks.values()) {
    const count = counts.get(task.area) ?? {
      area: task.area,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      cancelled: 0,
    };
    count[task.status]++;
    counts.set(task.area, count);
  }
  return {
    schemaVersion: 1 as const,
    command: "status" as const,
    counts: [...counts.values()].sort((a, b) => a.area.localeCompare(b.area)),
    ready: [...tasks.values()]
      .filter(
        (task) => readiness(task, tasks).ready && !claims.some((claim) => claim.id === task.id),
      )
      .map((task) => task.id)
      .sort(),
    claims: claims
      .filter((claim) => !email || claim.email === email)
      .map((claim) => ({
        id: claim.id,
        author: claim.author,
        committedAt: claim.committedAt,
        ageDays: Math.max(0, (Date.now() / 1000 - claim.committedAt) / 86400),
        stale: Date.now() / 1000 - claim.committedAt > input.staleDays * 86400,
        status: claim.task.status,
        integrationStatus: claim.integrated?.status ?? "missing",
        blockedBy: claim.task.depends_on.filter((id) => tasks.get(id)?.status !== "done"),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
