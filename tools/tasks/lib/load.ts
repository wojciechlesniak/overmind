import { join, resolve } from "node:path";
import { areaCodes } from "./areas.ts";
import { createGit, gitText } from "./git.ts";
import { confinedPath, nodeFiles } from "./files.ts";
import { parseTask } from "./task.parse-boundary.ts";
import { TaskToolError } from "./errors.ts";
import type { Git } from "./git.ts";
import type { FileSystem } from "./files.ts";
import type { Task } from "./model.ts";

export interface TaskSources {
  root?: string;
  git?: Git;
  files?: FileSystem;
}

export async function loadTasks(
  ref: string,
  sources: TaskSources = {},
): Promise<Map<string, Task>> {
  const root = resolve(sources.root ?? process.cwd());
  const files = sources.files ?? nodeFiles;
  const git = sources.git ?? createGit(root);
  let paths: string[];
  let read: (path: string) => Promise<string>;
  if (ref === "WORKTREE") {
    const directory = join(root, "tasks");
    if (files.isSymlink(directory)) {
      throw new TaskToolError(4, "Task directories cannot be symlinks");
    }
    confinedPath(files, root, directory);
    paths = [];
    for (const entry of files.entries(directory)) {
      if (entry.name.startsWith("_")) {
        continue;
      }
      if (entry.symlink) {
        throw new TaskToolError(4, "Task directories cannot be symlinks");
      }
      if (entry.directory) {
        paths.push(`tasks/${entry.name}/TASK.md`);
      }
    }
    read = (path) => {
      const source = join(root, path);
      if (files.isSymlink(source)) {
        throw new TaskToolError(4, "Task input files cannot be symlinks");
      }
      return Promise.resolve(files.readText(confinedPath(files, root, source)));
    };
  } else {
    if (!ref || ref.length > 240 || /[\0\r\n]/u.test(ref)) {
      throw new TaskToolError(4, "Invalid Git task reference");
    }
    const oid = (
      await gitText(git, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`)
    ).trim();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(oid)) {
      throw new TaskToolError(4, "Invalid resolved Git task reference");
    }
    paths = (await gitText(git, "ls-tree", "-r", "-z", "--name-only", oid, "--", "tasks"))
      .split("\0")
      .filter((path) => path.endsWith("/TASK.md") && !path.startsWith("tasks/_"));
    read = (path) => gitText(git, "show", `${oid}:${path}`);
  }
  const areas = areaCodes(await read("tasks/PLAN.md"));
  const tasks = new Map<string, Task>();
  for (const path of paths.sort()) {
    const parsed = parseTask(path, await read(path));
    if (!parsed.ok) {
      throw new TaskToolError(4, `${path}: ${parsed.error.reason}`);
    }
    const task = parsed.value;
    if (!areas.has(task.area) || tasks.has(task.id)) {
      throw new TaskToolError(4, "Unknown task area or duplicate task ID");
    }
    tasks.set(task.id, task);
  }
  return tasks;
}
