import { parseDocument } from "yaml";
import { taskFrontMatterSchema } from "./model.ts";
import type { ParseError, Result, Task } from "./model.ts";

export function parseTask(path: string, text: string): Result<Task, ParseError> {
  const fail = (reason: string): Result<Task, ParseError> => ({
    ok: false,
    error: { path, reason },
  });
  if (Buffer.byteLength(text, "utf8") > 256 * 1024) {
    return fail("Task exceeds 256 KiB");
  }
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);
  if (!front?.[1]) {
    return fail("Missing YAML front matter");
  }
  try {
    const document = parseDocument(front[1], {
      schema: "core",
      customTags: [],
      uniqueKeys: true,
      strict: true,
    });
    if (document.errors.length || document.warnings.length) {
      return fail("Invalid or unsafe YAML front matter");
    }
    const raw: unknown = document.toJS({ maxAliasCount: 0 });
    const parsed = taskFrontMatterSchema.safeParse(raw);
    if (!parsed.success) {
      return fail("Invalid task front matter fields");
    }
    if (path !== `tasks/${parsed.data.id}/TASK.md`) {
      return fail("Task ID and file path disagree");
    }
    return {
      ok: true,
      value: { ...parsed.data, path, text, body: text.slice(front[0].length) },
    };
  } catch {
    return fail("Invalid or unsafe YAML front matter");
  }
}
