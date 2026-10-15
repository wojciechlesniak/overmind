import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { isolatedGitEnvironment } from "./git-test-environment.ts";
import { largeFiles } from "./no-large-files.mjs";
it("rejects over 1 MiB and permits the exact limit and only documented PNG exceptions", () => {
  const root = mkdtempSync(join(tmpdir(), "overmind-size-"));
  const previous = process.cwd();
  const gitEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith("GIT_")),
  );
  try {
    for (const key of Object.keys(gitEnvironment)) {
      vi.stubEnv(key, undefined);
    }
    process.chdir(root);
    execFileSync("git", ["init", "--quiet"], { env: isolatedGitEnvironment() });
    mkdirSync("docs");
    mkdirSync("tasks");
    writeFileSync("ünï code.md", Buffer.alloc(1024 * 1024));
    const oversized = ["large.md", "asset.png", "docs/photo.jpg"];
    for (const file of [...oversized, "docs/design.png", "tasks/design.png"]) {
      writeFileSync(file, Buffer.alloc(1024 * 1024 + 1));
    }
    execFileSync("git", ["add", "--", "."], { env: isolatedGitEnvironment() });
    expect(
      largeFiles([...oversized, "ünï code.md", "docs/design.png", "tasks/design.png"]),
    ).toEqual(oversized);
    expect(() => largeFiles(["missing"])).toThrow();
  } finally {
    process.chdir(previous);
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});
