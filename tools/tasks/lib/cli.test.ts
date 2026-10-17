import { chmodSync, existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { createRunner } from "./git.ts";
import { errorSchema } from "./output.ts";
import { isolatedGitEnvironment } from "../../hooks/git-test-environment.ts";
import { readJsonRecord } from "../../test-support/json.parse-boundary.ts";

it("rejects hostile command IDs before starting Git and emits the stable error schema", async () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "ove-task-cli-")));
  const marker = join(directory, "git-was-called");
  writeFileSync(join(directory, "git"), `#!/bin/sh\ntouch '${marker}'\nexit 91\n`);
  chmodSync(join(directory, "git"), 0o700);
  const runner = createRunner({
    ...isolatedGitEnvironment(),
    PATH: `${directory}:${process.env["PATH"] ?? ""}`,
  });
  try {
    const result = await runner.run(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve(import.meta.dirname, "../claim.ts"),
        "OVE_FIX001;touch sentinel",
        "--json",
      ],
      resolve(import.meta.dirname, "../../.."),
    );
    expect(result.exitCode).toBe(4);
    const outputPath = join(directory, "output.json");
    writeFileSync(outputPath, result.stdout);
    expect(errorSchema.parse(readJsonRecord(outputPath))).toMatchObject({
      schemaVersion: 1,
      command: "claim",
      ok: false,
      exitCode: 4,
    });
    expect(existsSync(marker)).toBe(false);
    expect(result.stdout).not.toContain("sentinel");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
