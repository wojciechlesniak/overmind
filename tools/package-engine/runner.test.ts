import { mkdtempSync, mkdirSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { NodeRunner } from "./runner.ts";
import { safeDirectory } from "./files.ts";

test("Runner bounds real children and refuses symlink or escaping working directories", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ove017-runner-")));
  try {
    mkdirSync(join(root, "real"));
    symlinkSync(join(root, "real"), join(root, "link"));
    expect(() => safeDirectory(root, join(root, "link"))).toThrow();
    expect(() => safeDirectory(root, join(root, "..", "outside"))).toThrow();
    const runner = new NodeRunner(root);
    await expect(
      runner.run(process.execPath, ["--version"], {
        cwd: root,
        env: { NODE_OPTIONS: "--require=/missing-ove017-probe" },
      }),
    ).rejects.toThrow("Unsupported child environment");
    await expect(
      runner.run(process.execPath, ["-e", "setInterval(()=>{},1000)"], { cwd: root, timeout: 100 }),
    ).rejects.toThrow("Process failed or exceeded limits");
    const result = await runner.run(process.execPath, ["--version"], { cwd: root });
    expect(result.status).toBe(0);
    expect(result.stdout.toString()).toMatch(/^v22\./);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
