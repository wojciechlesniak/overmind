import { lstatSync, realpathSync } from "node:fs";
import { gitText } from "./git.ts";
import { TaskToolError } from "./errors.ts";
import { loadTasks } from "./load.ts";
import type { CommandInput } from "./arguments.ts";
import {
  ensureClean,
  fetchClaim,
  integrationRef,
  managedPath,
  refresh,
  remoteClaims,
  worktrees,
} from "./repository.ts";
import type { Repository } from "./repository.ts";

export async function localClaim(repo: Repository, id: string, sha: string) {
  const path = managedPath(repo, id);
  const branch = `refs/heads/task/${id}`;
  const inventory = await worktrees(repo.git);
  const attached = inventory.find((worktree) => worktree.branch === branch);
  if (attached && attached.path !== path) {
    throw new TaskToolError(2, "Claim is attached outside the managed worktree directory");
  }
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat) {
    if (stat.isSymbolicLink() || realpathSync(path) !== path || !attached) {
      throw new TaskToolError(2, "Managed path is not the registered real worktree");
    }
    await ensureClean(repo.git.at(path));
  }
  const local = await repo.git.run("rev-parse", "--verify", branch);
  if (local.exitCode === 0 && local.stdout.trim() !== sha) {
    throw new TaskToolError(2, "Local branch has unpushed or different work");
  }
  if (local.exitCode !== 0 && local.exitCode !== 128) {
    throw new TaskToolError(4, "Cannot inspect local claim");
  }
  return { path, branch, sha, attached: Boolean(attached), local: local.exitCode === 0 };
}

export async function removeLocalClaim(
  repo: Repository,
  state: Awaited<ReturnType<typeof localClaim>>,
) {
  if (state.attached) {
    const work = repo.git.at(state.path);
    if ((await gitText(work, "rev-parse", "HEAD")).trim() !== state.sha) {
      throw new TaskToolError(2, "Worktree head changed; preserve concurrent work");
    }
    await ensureClean(work);
    await gitText(repo.git, "worktree", "remove", state.path);
  }
  if (state.local) {
    await gitText(repo.git, "update-ref", "--no-deref", "-d", state.branch, state.sha);
  }
}

async function isMaintainer(repo: Repository): Promise<boolean> {
  const config = await repo.git.run("config", "--bool", "overmind.maintainer");
  if (config.exitCode === 0 && config.stdout.trim() === "true") {
    return true;
  }
  const permission = await repo.runner.run(
    "gh",
    ["api", "repos/{owner}/{repo}", "--jq", ".permissions.admin or .permissions.maintain"],
    repo.root,
  );
  return permission.exitCode === 0 && permission.stdout.trim() === "true";
}

export async function release(repo: Repository, input: CommandInput) {
  const id = input.id;
  if (!id) {
    throw new TaskToolError(4, "Task ID is required");
  }
  await refresh(repo);
  const sha = (await remoteClaims(repo.git)).get(id);
  if (!sha) {
    throw new TaskToolError(2, "Task has no remote claim");
  }
  await fetchClaim(repo, sha);
  const parents = (await gitText(repo.git, "show", "-s", "--format=%P", sha)).trim().split(" ");
  const parent = parents[0];
  if (parents.length !== 1 || !parent) {
    throw new TaskToolError(2, "Branch is not a single claim commit");
  }
  const ancestor = await repo.git.run("merge-base", "--is-ancestor", parent, integrationRef);
  if (ancestor.exitCode === 1) {
    throw new TaskToolError(2, "Branch contains unmerged work before the claim; preserve it");
  }
  if (ancestor.exitCode !== 0) {
    throw new TaskToolError(4, "Cannot establish the claim's integration ancestry");
  }
  const before = (await loadTasks(parent, { root: repo.root, git: repo.git })).get(id);
  const after = (await loadTasks(sha, { root: repo.root, git: repo.git })).get(id);
  const files = (await gitText(repo.git, "diff", "--name-only", "-z", parent, sha))
    .split("\0")
    .filter(Boolean);
  const message = await gitText(repo.git, "show", "-s", "--format=%B", sha);
  if (
    !before ||
    !after ||
    before.status !== "todo" ||
    after.status !== "in_progress" ||
    files.length !== 1 ||
    files[0] !== after.path ||
    before.text.replace(/^status: todo$/mu, "status: in_progress") !== after.text ||
    !message.startsWith(`chore(${after.area.toLowerCase()}): claim ${id}\n`) ||
    !message.includes(`\nRefs: ${id}\n`) ||
    !message.includes("\nClaimed-By: ")
  ) {
    throw new TaskToolError(2, "Branch contains more than a claim; open a PR or ask a maintainer");
  }
  const name = (await gitText(repo.git, "config", "user.name")).trim();
  const email = (await gitText(repo.git, "config", "user.email")).trim();
  const author = await gitText(repo.git, "show", "-s", "--format=%an%x00%ae", sha);
  if (author.trim() !== `${name}\0${email}` && !(input.forceOwner && (await isMaintainer(repo)))) {
    throw new TaskToolError(2, "Claim belongs to another identity; ask its owner or a maintainer");
  }
  const local = await localClaim(repo, id, sha);
  const removed = await repo.git.run(
    "push",
    `--force-with-lease=refs/heads/task/${id}:${sha}`,
    "origin",
    `:refs/heads/task/${id}`,
  );
  if (removed.exitCode !== 0) {
    throw new TaskToolError(3, "Remote claim changed or deletion failed; local work preserved");
  }
  await removeLocalClaim(repo, local);
  return { schemaVersion: 1 as const, command: "release" as const, id, worktree: local.path };
}
