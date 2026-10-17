import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { nodeFiles } from "./files.ts";

it("reads bounded regular inputs and rejects oversized files", () => {
  const directory = mkdtempSync("/private/tmp/ove-task-files-");
  try {
    const path = join(directory, "TASK.md");
    writeFileSync(path, "bounded input");
    expect(nodeFiles.readText(path)).toBe("bounded input");
    expect(() => nodeFiles.readText(path, 4)).toThrow("bounded regular file");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("refuses a FIFO without waiting for a writer", () => {
  const directory = mkdtempSync("/private/tmp/ove-task-fifo-");
  try {
    const path = join(directory, "TASK.md");
    expect(spawnSync("mkfifo", [path]).status).toBe(0);
    const files = pathToFileURL(join(import.meta.dirname, "files.ts")).href;
    const errors = pathToFileURL(join(import.meta.dirname, "errors.ts")).href;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `import {nodeFiles} from ${JSON.stringify(files)};
         import {TaskToolError} from ${JSON.stringify(errors)};
         try {nodeFiles.readText(process.argv[1]); process.exit(0);}
         catch (error) {process.exit(error instanceof TaskToolError ? error.exitCode : 5);}`,
        path,
      ],
      { encoding: "utf8", timeout: 3000 },
    );
    expect(result.status).toBe(4);
    expect(result.stderr).toBe("");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
