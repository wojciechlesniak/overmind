import { constants, closeSync, openSync, writeFileSync } from "node:fs";
import { nodeFiles } from "./files.ts";
import { TaskToolError } from "./errors.ts";
import type { TaskFrontMatter } from "./model.ts";

export function changeStatus(path: string, status: TaskFrontMatter["status"]): void {
  const text = nodeFiles.readText(path);
  const front = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(text)?.[0];
  if (!front || (front.match(/^status: /gmu)?.length ?? 0) !== 1) {
    throw new TaskToolError(4, "Task status must be a single plain front-matter line");
  }
  const updated =
    front.replace(/^status: [^\r\n]+/mu, `status: ${status}`) + text.slice(front.length);
  const descriptor = openSync(path, constants.O_WRONLY | constants.O_TRUNC | constants.O_NOFOLLOW);
  try {
    writeFileSync(descriptor, updated, "utf8");
  } finally {
    closeSync(descriptor);
  }
}
