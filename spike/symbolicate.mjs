import { SourceMap } from "node:module";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
const iteration = Number(process.argv[2] ?? "0");
if (!Number.isInteger(iteration) || iteration < 0 || iteration > 10) {
  throw new Error("Invalid iteration");
}
const base = resolve(import.meta.dirname, "dist/A", String(iteration));
const payload = JSON.parse(readFileSync(resolve(base, "entry.cjs.map"), "utf8"));
const map = new SourceMap(payload);
const result = spawnSync(resolve(base, "Contents/MacOS/overmind-engine"), ["--mode", "stack"], {
  encoding: "utf8",
  timeout: 5000,
});
const mapped = result.stderr.replace(
  /(?:file:\/\/\/overmind\/engine\.cjs|entry\.cjs):(\d+):(\d+)/gu,
  (text, line, column) => {
    const origin = map.findOrigin(Number(line), Number(column));
    return origin.fileName
      ? `${origin.fileName}:${String(origin.lineNumber)}:${String(origin.columnNumber)}`
      : text;
  },
);
if (result.status !== 1 || !mapped.includes("spike/entry.ts:15:")) {
  throw new Error("Offline symbolication did not recover the actual throw site");
}
process.stdout.write(mapped);
