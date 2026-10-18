// SPDX-License-Identifier: Apache-2.0
import { taskFrontMatterSchema, TaskToolError } from "../lib/index.ts";
import { blockFields } from "./blocks.parse-boundary.ts";

export function applyBlocks(text: string, blocks: readonly string[]): string {
  if (!taskFrontMatterSchema.shape.depends_on.safeParse(blocks).success) {
    throw new TaskToolError(4, "Invalid generated blocks input");
  }
  const fields = blockFields(text);
  const value = `[${[...new Set(blocks)].sort().join(", ")}]`;
  let edited: string;
  if (!fields.blocks) {
    edited =
      text.slice(0, fields.adr.nodeEnd) + `blocks: ${value}\n` + text.slice(fields.adr.nodeEnd);
  } else {
    const range = fields.blocks;
    let replacement: string;
    if (range.flow && !text.slice(range.valueStart, range.valueEnd).includes("\n")) {
      replacement =
        text.slice(range.keyStart, range.valueStart) +
        value +
        text.slice(range.valueEnd, range.nodeEnd);
    } else {
      const source = text.slice(range.keyStart, range.nodeEnd);
      const comments = [...source.matchAll(/#[^\n]*/gu)];
      replacement = `blocks: ${value}`;
      for (const comment of comments) {
        const prefix = source.slice(0, comment.index).split("\n").at(-1) ?? "";
        const sameLine = !source.slice(0, comment.index).includes("\n");
        replacement += sameLine
          ? (/[ \t]+$/u.exec(prefix)?.[0] ?? " ") + comment[0]
          : "\n" + (/^[ \t]*/u.exec(prefix)?.[0] ?? "") + comment[0];
      }
      replacement += "\n";
    }
    const remaining = text.slice(0, range.keyStart) + text.slice(range.nodeEnd);
    const at =
      range.keyStart < fields.adr.keyStart ? blockFields(remaining).adr.nodeEnd : range.keyStart;
    edited = remaining.slice(0, at) + replacement + remaining.slice(at);
  }
  blockFields(edited);
  return edited;
}
