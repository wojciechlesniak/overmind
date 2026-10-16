import { randomUUID } from "node:crypto";
import { lstatSync } from "node:fs";
import { join } from "node:path";
import { gitText } from "./git.ts";
import { TaskToolError } from "./errors.ts";
import { readiness } from "./graph.ts";
import { ownsOverlap } from "./glob.ts";
import {
  ensureClean,
  fetchClaim,
  loadClaimedTask,
  integrationRef,
  managedPath,
  refresh,
  remoteClaims,
} from "./repository.ts";
import type { Repository } from "./repository.ts";
import type { CommandInput } from "./arguments.ts";
import { changeStatus } from "./transitions.ts";

export async function claim(repo: Repository, input: CommandInput) {
  const id = input.id;
  if (!id) {
    throw new TaskToolError(4, "Task ID is required");
  }
  const tasks = await refresh(repo);
  const task = tasks.get(id);
  if (!task) {
    throw new TaskToolError(2, `Task ${id} is not on DEVELOP`);
  }
  const ready = readiness(task, tasks);
  if (!ready.ready) {
    throw new TaskToolError(
      2,
      `Task is not ready: ${[...ready.blockedBy, ...ready.reasons].join(", ")}`,
    );
  }
  const claims = await remoteClaims(repo.git);
  const existing = claims.get(id);
  if (existing) {
    await fetchClaim(repo, existing);
    const author = (await gitText(repo.git, "show", "-s", "--format=%an", existing)).trim();
    throw new TaskToolError(2, `Task already claimed by ${author}`);
  }
  const branch = `task/${id}`;
  const local = await repo.git.run("show-ref", "--verify", "--quiet", `refs/heads/${branch}`);
  const path = managedPath(repo, id);
  if (local.exitCode === 0 || lstatSync(path, { throwIfNoEntry: false })) {
    throw new TaskToolError(2, "Local claim branch or worktree exists; inspect it first");
  }
  if (local.exitCode !== 1) {
    throw new TaskToolError(4, "Cannot inspect local branch");
  }
  const warnings: string[] = [];
  const current = (await gitText(repo.git.at(repo.root), "branch", "--show-current")).trim();
  if (current !== "DEVELOP") {
    warnings.push("Current checkout is not DEVELOP; claim still uses the integration commit");
  }
  for (const [other, sha] of claims) {
    if (tasks.get(other)?.status === "done") {
      continue;
    }
    const claimedTask = await loadClaimedTask(repo, other, sha);
    const overlap = ownsOverlap(task.owns, claimedTask.owns);
    if (overlap.length) {
      warnings.push(`conflict-risk ${other}: ${overlap.join(", ")}`);
    }
  }
  managedPath(repo, id, true);
  await gitText(repo.git, "worktree", "add", "-b", branch, path, integrationRef);
  const work = repo.git.at(path);
  if (input.install) {
    const installed = await repo.runner.run("pnpm", ["install", "--frozen-lockfile"], path);
    if (installed.exitCode !== 0) {
      throw new TaskToolError(4, `Frozen install failed; inspect ${path}`);
    }
  }
  changeStatus(join(path, task.path), "in_progress");
  const identity = (await gitText(work, "config", "user.name")).trim();
  const message = `chore(${task.area.toLowerCase()}): claim ${id}\n\nClaimed at ${new Date().toISOString()}\nClaim nonce ${randomUUID()}\n\nRefs: ${id}\nClaimed-By: ${input.agent ?? identity}\n`;
  await gitText(work, "add", "--", task.path);
  await gitText(work, "commit", "-m", message);
  const commit = (await gitText(work, "rev-parse", "HEAD")).trim();
  const pushed = await work.run(
    "push",
    `--force-with-lease=refs/heads/${branch}:`,
    "origin",
    `HEAD:refs/heads/${branch}`,
  );
  if (pushed.exitCode !== 0) {
    const remote = (await remoteClaims(work)).get(id);
    if (remote && remote !== commit) {
      await ensureClean(work, input.install);
      if ((await gitText(work, "rev-parse", "HEAD")).trim() !== commit) {
        throw new TaskToolError(2, "Claim worktree changed; preserve it after lost race");
      }
      await gitText(repo.git, "worktree", "remove", path);
      await gitText(repo.git, "update-ref", "--no-deref", "-d", `refs/heads/${branch}`, commit);
      throw new TaskToolError(3, "Lost the race; remote claim belongs to another invocation");
    }
    if (remote !== commit) {
      throw new TaskToolError(4, `Claim push failed; preserve and inspect ${path}`);
    }
  }
  return {
    schemaVersion: 1 as const,
    command: "claim" as const,
    id,
    worktree: path,
    title: task.title,
    owns: task.owns,
    warnings,
    next: "Read TASK.md fully, then implement",
  };
}
