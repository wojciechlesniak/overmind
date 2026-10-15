import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
it("CI preparation is a no-op and a missing Lefthook fails loudly outside CI", () => {
  const empty = mkdtempSync(join(tmpdir(), "overmind-empty-path-"));
  try {
    const script = resolve(import.meta.dirname, "prepare.mjs");
    const run = (ci: string) =>
      spawnSync(process.execPath, [script], {
        env: { ...process.env, PATH: empty, CI: ci },
        encoding: "utf8",
      });
    expect(run("true").status).toBe(0);
    const missing = run("false");
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("pnpm exec lefthook install");
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
