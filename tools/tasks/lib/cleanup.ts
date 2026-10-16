import { parseMergedPrs } from "./github.parse-boundary.ts";
import { gitText } from "./git.ts";
import { TaskToolError } from "./errors.ts";
import type { CommandInput } from "./arguments.ts";
import { taskIdPattern } from "./model.ts";
import { localClaim, removeLocalClaim } from "./release.ts";
import {
  integration,
  integrationRef,
  managedPath,
  refresh,
  remoteClaims,
  worktrees,
} from "./repository.ts";
import type { Repository } from "./repository.ts";

async function merged(repo: Repository, id: string, sha: string): Promise<boolean> {
  const ancestor = await repo.git.run("merge-base", "--is-ancestor", sha, integrationRef);
  if (ancestor.exitCode === 0) {
    return true;
  }
  if (ancestor.exitCode !== 1) {
    throw new TaskToolError(4, "Cannot establish merge ancestry");
  }
  const response = await repo.runner.run(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "merged",
      "--head",
      `task/${id}`,
      "--base",
      integration,
      "--json",
      "headRefOid,baseRefName,mergeCommit",
    ],
    repo.root,
  );
  if (response.exitCode !== 0) {
    return false;
  }
  for (const pr of parseMergedPrs(response.stdout)) {
    if (pr.headRefOid !== sha || pr.baseRefName !== integration || !pr.mergeCommit) {
      continue;
    }
    if (
      (await repo.git.run("merge-base", "--is-ancestor", pr.mergeCommit.oid, integrationRef))
        .exitCode === 0
    ) {
      return true;
    }
  }
  return false;
}

export async function cleanup(repo: Repository, input: CommandInput) {
  await refresh(repo);
  const remote = await remoteClaims(repo.git);
  const inventory = await worktrees(repo.git);
  const candidates = inventory.filter((worktree) => {
    const id = worktree.branch.replace(/^refs\/heads\/task\//u, "");
    return (
      taskIdPattern.test(id) &&
      worktree.path === managedPath(repo, id) &&
      (!input.id || input.id === id)
    );
  });
  if (input.id && !candidates.length) {
    throw new TaskToolError(2, "No registered managed worktree for this task");
  }
  const removed: string[] = [];
  const refused: { id: string; reason: string }[] = [];
  for (const worktree of candidates) {
    const id = worktree.branch.slice("refs/heads/task/".length);
    try {
      const remoteSha = remote.get(id);
      if (remoteSha && remoteSha !== worktree.head) {
        throw new TaskToolError(2, "Worktree is not fully pushed at the remote head");
      }
      if (!(await merged(repo, id, worktree.head))) {
        throw new TaskToolError(2, "Exact worktree head is not merged into DEVELOP");
      }
      const state = await localClaim(repo, id, worktree.head);
      await removeLocalClaim(repo, state);
      removed.push(id);
    } catch (error) {
      if (input.id || !(error instanceof TaskToolError) || error.exitCode !== 2) {
        throw error;
      }
      refused.push({ id, reason: error.message });
    }
  }
  await gitText(repo.git, "worktree", "prune");
  return {
    schemaVersion: 1 as const,
    command: "cleanup" as const,
    removed,
    refused,
    message: "Remote branches are retained; cleanup never deletes them",
  };
}
