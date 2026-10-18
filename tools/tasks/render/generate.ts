// SPDX-License-Identifier: Apache-2.0
import {
  constants,
  closeSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import {
  areaCodes,
  confinedPath,
  createGit,
  createRunner,
  loadTasks,
  nodeFiles,
  topologicalLayers,
  TaskToolError,
} from "../lib/index.ts";
import { renderIndex, escapeCell, sorted } from "./index.ts";
import { renderDependencies, capabilityLinks, reverseEdges } from "./dependencies.ts";
import { applyBlocks } from "./blocks.ts";
import { isolatedGitEnvironment } from "../../hooks/git-test-environment.ts";

async function requireTaskOnlyDirty(root: string) {
  const git = createGit(root, createRunner(isolatedGitEnvironment()));
  const read = async (...args: string[]) => {
    const result = await git.run(
      "--no-optional-locks",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.untrackedCache=false",
      ...args,
    );
    const value = result.stdout;
    if (
      result.exitCode ||
      Buffer.byteLength(value) > 16 * 1024 * 1024 ||
      value.includes("\ufffd") ||
      (value && !value.endsWith("\0"))
    ) {
      throw new TaskToolError(4, "Cannot safely inspect repository state");
    }
    return value ? value.slice(0, -1).split("\0") : [];
  };
  const names = await read("config", "--null", "--name-only", "--list");
  if (names.some((name) => /^filter\.[\s\S]*\.(?:clean|smudge|process)$/iu.test(name))) {
    throw new TaskToolError(4, "Repository filters prevent safe inspection");
  }
  const stages = await read("ls-files", "--stage", "-z");
  if (
    stages.some(
      (stage) => !/^(?:100644|100755) (?:[a-f0-9]{40}|[a-f0-9]{64}) 0\t[^\0]+$/u.test(stage),
    )
  ) {
    throw new TaskToolError(4, "Nonregular or unresolved Git entries prevent safe inspection");
  }
  const changes = await read("status", "--porcelain=v1", "-z", "--untracked-files=all");
  for (let index = 0; index < changes.length; index++) {
    const change = changes[index] ?? "";
    if (!/^[ MADRCUT?!]{2} /u.test(change)) {
      throw new TaskToolError(4, "Malformed Git status");
    }
    const paths = [change.slice(3)];
    if (/[RC]/u.test(change.slice(0, 2))) {
      paths.push(changes[++index] ?? "");
    }
    if (
      paths.some(
        (path) =>
          !path.startsWith("tasks/") ||
          path.split("/").some((part) => !part || part === "." || part === ".."),
      )
    ) {
      throw new TaskToolError(4, "Dirty files outside tasks prevent blocks updates");
    }
  }
}

function destination(root: string, path: string) {
  const parent = dirname(path);
  if (realpathSync(parent) !== parent || lstatSync(parent).dev !== lstatSync(root).dev) {
    throw new TaskToolError(4, "Output directory is not a canonical repository directory");
  }
  const before = lstatSync(path, { throwIfNoEntry: false });
  if (
    before &&
    (!before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.dev !== lstatSync(root).dev)
  ) {
    throw new TaskToolError(4, "Output must be a regular unlinked repository file");
  }
  if (!path.startsWith(join(root, "tasks") + sep)) {
    throw new TaskToolError(4, "Output escapes tasks");
  }
  return before;
}
function unchangedTask(path: string, original: string | undefined) {
  if (original !== undefined && nodeFiles.readText(path) !== original) {
    throw new TaskToolError(4, "Task source changed while generating");
  }
}
function replace(root: string, path: string, text: string, original?: string) {
  const before = destination(root, path);
  unchangedTask(path, original);
  const temporary = join(dirname(path), `.task-index-${randomUUID()}.tmp`);
  const fd = openSync(
    temporary,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    before ? before.mode & 0o777 : 0o644,
  );
  let failure: Error | undefined;
  try {
    writeFileSync(fd, text, "utf8");
    fsyncSync(fd);
    const now = destination(root, path);
    if (
      before?.ino !== now?.ino ||
      before?.mtimeMs !== now?.mtimeMs ||
      before?.ctimeMs !== now?.ctimeMs ||
      fstatSync(fd).nlink !== 1 ||
      lstatSync(temporary).ino !== fstatSync(fd).ino ||
      lstatSync(temporary).dev !== fstatSync(fd).dev
    ) {
      throw new TaskToolError(4, "Output changed while generating");
    }
    unchangedTask(path, original);
    renameSync(temporary, path);
  } catch (error) {
    failure = error instanceof Error ? error : new TaskToolError(4, "Atomic replacement failed");
  } finally {
    try {
      closeSync(fd);
    } catch (error) {
      failure ??= error instanceof Error ? error : new TaskToolError(4, "Atomic cleanup failed");
    }
    try {
      unlinkSync(temporary);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        failure ??= error instanceof Error ? error : new TaskToolError(4, "Atomic cleanup failed");
      }
    }
  }
  if (failure !== undefined) {
    throw failure;
  }
}
export async function generate(directory: string, args: readonly string[]): Promise<number> {
  if (
    args.length > 1 ||
    (args.length === 1 && !["--check", "--suggest-links", "--write-blocks"].includes(args[0] ?? ""))
  ) {
    throw new TaskToolError(4, "Unknown generator option");
  }
  const root = realpathSync(resolve(directory));
  const tasks = await loadTasks("WORKTREE", { root });
  topologicalLayers(tasks);
  for (const task of tasks.values()) {
    if (task.text.includes("\r")) {
      throw new TaskToolError(4, "Unix line endings required");
    }
    for (const dependency of task.soft_depends_on) {
      if (!tasks.has(dependency)) {
        throw new TaskToolError(4, `Task ${task.id} has missing dependency ${dependency}`);
      }
    }
  }
  if (args[0] === "--suggest-links") {
    const links = capabilityLinks(tasks);
    for (const task of sorted(tasks)) {
      for (const name of [...new Set(task.needs)].sort()) {
        const providers = links.find((link) => link.name === name)?.providers ?? [];
        if (
          providers.includes(task.id) ||
          (providers.length === 1 && task.depends_on.includes(providers[0] ?? ""))
        ) {
          continue;
        }
        console.log(
          `${task.id} needs ${escapeCell(name)} -> ${providers.length === 1 ? `add ${providers[0] ?? ""}` : providers.length ? `ambiguous providers: ${providers.join(", ")}` : "unresolved"}`,
        );
      }
    }
    return 0;
  }
  const areas = [
    ...areaCodes(nodeFiles.readText(confinedPath(nodeFiles, root, join(root, "tasks/PLAN.md")))),
  ];
  const outputs = [
    ["INDEX.md", renderIndex(tasks, areas)],
    ["DEPENDENCIES.md", renderDependencies(tasks, areas)],
  ] as const;
  if (args[0] === "--check") {
    let mismatch = false;
    for (const [name, text] of outputs) {
      const path = join(root, "tasks", name);
      const before = destination(root, path) ? nodeFiles.readText(path, 16 * 1024 * 1024) : "";
      if (before === text) {
        continue;
      }
      mismatch = true;
      const oldLines = before ? before.split("\n") : [];
      if (before.endsWith("\n")) {
        oldLines.pop();
      }
      const newLines = text.split("\n").slice(0, -1);
      let start = 0;
      let end = 0;
      while (
        start < oldLines.length &&
        start < newLines.length &&
        oldLines[start] === newLines[start] &&
        !(start === oldLines.length - 1 && !before.endsWith("\n"))
      ) {
        start++;
      }
      while (
        end < oldLines.length - start &&
        end < newLines.length - start &&
        oldLines[oldLines.length - 1 - end] === newLines[newLines.length - 1 - end] &&
        (end > 0 || before.endsWith("\n"))
      ) {
        end++;
      }
      console.log(
        [
          `--- tasks/${name}`,
          `+++ tasks/${name}`,
          `@@ -${String(oldLines.length ? start + 1 : 0)},${String(oldLines.length - start - end)} +${String(start + 1)},${String(newLines.length - start - end)} @@`,
          ...oldLines.slice(start, oldLines.length - end).map((line) => `-${line}`),
          ...(before && !before.endsWith("\n") ? ["\\ No newline at end of file"] : []),
          ...newLines.slice(start, newLines.length - end).map((line) => `+${line}`),
        ].join("\n"),
      );
    }
    return mismatch ? 1 : 0;
  }
  const updates: [string, string, string?][] = outputs.map(([name, text]) => [
    join(root, "tasks", name),
    text,
  ]);
  if (args[0] === "--write-blocks") {
    await requireTaskOnlyDirty(root);
    const blocks = reverseEdges(tasks);
    for (const task of sorted(tasks)) {
      updates.push([
        join(root, task.path),
        applyBlocks(task.text, blocks.get(task.id) ?? []),
        task.text,
      ]);
    }
  }
  for (const [path, , original] of updates) {
    destination(root, path);
    unchangedTask(path, original);
  }
  for (const [path, text, original] of updates) {
    if (
      !lstatSync(path, { throwIfNoEntry: false }) ||
      nodeFiles.readText(path, 16 * 1024 * 1024) !== text
    ) {
      replace(root, path, text, original);
    }
  }
  return 0;
}
