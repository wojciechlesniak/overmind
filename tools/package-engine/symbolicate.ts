import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  type BigIntStats,
} from "node:fs";
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
function identity(metadata: BigIntStats): string {
  return [
    metadata.dev,
    metadata.ino,
    metadata.mode,
    metadata.uid,
    metadata.gid,
    metadata.nlink,
    metadata.size,
    metadata.mtimeNs,
    metadata.ctimeNs,
  ].join(":");
}
function readInput(path: string, limit: number): string {
  let descriptor: number | undefined;
  try {
    const before = lstatSync(path, { bigint: true });
    if (!before.isFile() || before.size > BigInt(limit)) {
      throw new Error("Invalid input");
    }
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || identity(opened) !== identity(before)) {
      throw new Error("Input changed before read");
    }
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(descriptor, buffer, length, buffer.length - length, null);
      if (!count) {
        break;
      }
      length += count;
    }
    if (
      length > limit ||
      BigInt(length) !== before.size ||
      identity(fstatSync(descriptor, { bigint: true })) !== identity(before) ||
      identity(lstatSync(path, { bigint: true })) !== identity(before)
    ) {
      throw new Error("Input changed during read");
    }
    return buffer.subarray(0, length).toString("utf8");
  } catch {
    throw new Error("Symbolication input is unsafe, changed or exceeds its limit");
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { map: { type: "string" }, stack: { type: "string" } },
      strict: true,
    });
    if (!values.map || !values.stack) {
      throw new Error("Provide bounded --map and --stack files");
    }
    process.stdout.write(
      symbolicateStack(
        readInput(values.stack, 1024 * 1024),
        json(readInput(values.map, 16 * 1024 * 1024)),
      ),
    );
  } catch (error) {
    process.stderr.write(`${diagnostic(error)}\n`);
    process.exitCode = 1;
  }
}
