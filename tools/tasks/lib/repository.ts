import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createGit, gitText } from "./git.ts";
import type { Git, Runner } from "./git.ts";
import { loadTasks } from "./load.ts";
import { TaskToolError } from "./errors.ts";
import { taskIdPattern } from "./model.ts";
import { parseTask } from "./task.parse-boundary.ts";

export const integration = "DEVELOP";
export const integrationRef = "refs/remotes/origin/DEVELOP";
export interface Worktree {
  path: string;
  branch: string;
  head: string;
}
export interface Repository {
  root: string;
  primary: string;
  common: string;
  git: Git;
  runner: Runner;
}

export async function worktrees(git: Git): Promise<Worktree[]> {
  const records = (await gitText(git, "worktree", "list", "--porcelain", "-z")).split("\0\0");
  return records.filter(Boolean).map((record) => {
    const fields = record.split("\0");
    const path = fields.find((field) => field.startsWith("worktree "))?.slice(9);
    const branch = fields.find((field) => field.startsWith("branch "))?.slice(7) ?? "";
    const head = fields.find((field) => field.startsWith("HEAD "))?.slice(5) ?? "";
    if (!path) {
      throw new TaskToolError(4, "Invalid Git worktree inventory");
    }
    return { path, branch, head };
  });
}

export async function repository(root: string, runner: Runner): Promise<Repository> {
  if (process.platform === "win32") {
    throw new TaskToolError(4, "Windows is unsupported");
  }
  const git = createGit(root, runner);
  const actual = (await gitText(git, "rev-parse", "--show-toplevel")).trim();
  const common = realpathSync(
    (await gitText(git, "rev-parse", "--path-format=absolute", "--git-common-dir")).trim(),
  );
  const primary = (await worktrees(git))[0]?.path;
  if (!primary) {
    throw new TaskToolError(4, "Primary worktree is unavailable");
  }
  return {
    root: realpathSync(actual),
    primary: realpathSync(primary),
    common,
    git: git.at(primary),
    runner,
  };
}

export async function refresh(repo: Repository) {
  await gitText(
    repo.git,
    "fetch",
    "--no-tags",
    "origin",
    `+refs/heads/${integration}:${integrationRef}`,
  );
  return loadTasks(integrationRef, { root: repo.root, git: repo.git });
}

export async function remoteClaims(git: Git): Promise<Map<string, string>> {
  const text = await gitText(git, "ls-remote", "--heads", "origin", "refs/heads/task/*");
  const claims = new Map<string, string>();
  for (const line of text.trim().split("\n").filter(Boolean)) {
    const match = /^([a-f0-9]{40}|[a-f0-9]{64})\trefs\/heads\/task\/(OVE_[A-Z]{2,7}\d{3})$/u.exec(
      line,
    );
    if (!match?.[1] || !match[2]) {
      throw new TaskToolError(4, "Invalid remote claim inventory");
    }
    claims.set(match[2], match[1]);
  }
  return claims;
}

export function managedPath(repo: Repository, id: string, createParent = false): string {
  if (!taskIdPattern.test(id)) {
    throw new TaskToolError(4, "Invalid task ID");
  }
  const parent = join(dirname(repo.primary), "wt");
  const stat = lstatSync(parent, { throwIfNoEntry: false });
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) {
    throw new TaskToolError(4, "Managed worktree parent must be a real directory");
  }
  if (createParent) {
    mkdirSync(parent, { recursive: true });
  }
  if (existsSync(parent) && realpathSync(parent) !== resolve(parent)) {
    throw new TaskToolError(4, "Managed worktree parent contains a symlink");
  }
  return join(parent, id);
}

export async function ensureClean(
  git: Git,
  allowInstalledDependencies = false,
  inspectIgnored = true,
): Promise<void> {
  const status = await gitText(
    git,
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    ...(inspectIgnored ? ["--ignored"] : []),
  );
  const entries = status.split("\0").filter(Boolean);
  if (entries.some((entry) => !(allowInstalledDependencies && entry === "!! node_modules/"))) {
    throw new TaskToolError(
      2,
      "Worktree contains changes or ignored files; preserve and inspect it",
    );
  }
}

export async function fetchClaim(repo: Repository, sha: string): Promise<Git> {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(sha)) {
    throw new TaskToolError(4, "Invalid claim commit");
  }
  await gitText(repo.git, "fetch", "--no-tags", "origin", sha);
  return repo.git;
}

export async function loadClaimedTask(repo: Repository, id: string, sha: string) {
  if (!/^OVE_[A-Z]{2,7}\d{3}$/u.test(id)) {
    throw new TaskToolError(4, "Invalid claimed task ID");
  }
  await fetchClaim(repo, sha);
  const path = `tasks/${id}/TASK.md`;
  const parsed = parseTask(path, await gitText(repo.git, "show", `${sha}:${path}`));
  if (!parsed.ok) {
    throw new TaskToolError(4, "Invalid claimed task metadata");
  }
  return parsed.value;
}
