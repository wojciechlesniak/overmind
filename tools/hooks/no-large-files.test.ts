import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { largeFiles } from "./no-large-files.mjs";
it("rejects over 1 MiB and permits the exact limit and only documented PNG exceptions", () => {
  const root = mkdtempSync(join(tmpdir(), "overmind-size-"));
  const previous = process.cwd();
  try {
    process.chdir(root);
    execFileSync("git", ["init", "--quiet"]);
    mkdirSync("docs");
    mkdirSync("tasks");
    writeFileSync("ünï code.md", Buffer.alloc(1024 * 1024));
    const oversized = ["large.md", "asset.png", "docs/photo.jpg"];
    for (const file of [...oversized, "docs/design.png", "tasks/design.png"]) {
      writeFileSync(file, Buffer.alloc(1024 * 1024 + 1));
    }
    execFileSync("git", ["add", "--", "."]);
    expect(
      largeFiles([...oversized, "ünï code.md", "docs/design.png", "tasks/design.png"]),
    ).toEqual(oversized);
    expect(() => largeFiles(["missing"])).toThrow();
  } finally {
    process.chdir(previous);
    rmSync(root, { recursive: true, force: true });
  }
});
