import { readFileSync, statSync } from "node:fs";
import { SourceMap } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { diagnostic } from "./context.ts";
import { json, sourceMapSchema } from "./input.parse-boundary.ts";

export function symbolicateStack(stack: string, payload: unknown): string {
  if (stack.length > 1024 * 1024) {
    throw new Error("Stack exceeds symbolication limit");
  }
  const parsed = sourceMapSchema.parse(payload);
  const map = new SourceMap({
    ...parsed,
    file: parsed.file ?? "engine.cjs",
    sourcesContent: parsed.sourcesContent.map((content) => content ?? ""),
  });
  return stack.replace(
    /(?:[^\s(]*\/)?(?:engine\.cjs|overmind-engine(?:-aarch64-apple-darwin)?):(\d+):(\d+)/gu,
    (text: string, line: string, column: string) => {
      const origin: unknown = map.findOrigin(Number(line), Number(column));
      if (
        typeof origin === "object" &&
        origin !== null &&
        "fileName" in origin &&
        typeof origin.fileName === "string" &&
        "lineNumber" in origin &&
        typeof origin.lineNumber === "number" &&
        "columnNumber" in origin &&
        typeof origin.columnNumber === "number"
      ) {
        return `${origin.fileName}:${String(origin.lineNumber)}:${String(origin.columnNumber)}`;
      }
      return text;
    },
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { map: { type: "string" }, stack: { type: "string" } },
      strict: true,
    });
    if (
      !values.map ||
      !values.stack ||
      statSync(values.map).size > 16 * 1024 * 1024 ||
      statSync(values.stack).size > 1024 * 1024
    ) {
      throw new Error("Provide bounded --map and --stack files");
    }
    process.stdout.write(
      symbolicateStack(readFileSync(values.stack, "utf8"), json(readFileSync(values.map, "utf8"))),
    );
  } catch (error) {
    process.stderr.write(`${diagnostic(error)}\n`);
    process.exitCode = 1;
  }
}
