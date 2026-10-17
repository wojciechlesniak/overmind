import { mkdtemp, mkdir, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readRepositoryFile } from "./files.ts";

it("reads real repository files and denies symlinks escaping root or executable plugin aliases", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-files-"));
  const outside = await mkdtemp(join(tmpdir(), "ove-doc-outside-"));
  try {
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "README.md"), "# Root\n");
    await writeFile(join(outside, "secret.txt"), "private fixture");
    await symlink(join(outside, "secret.txt"), join(root, "docs", "escape.md"));
    await symlink("README.md", join(root, "alias.md"));
    expect(await readRepositoryFile(root, "README.md")).toBe("# Root\n");
    await expect(readRepositoryFile(root, "docs/escape.md")).rejects.toThrow();
    await expect(readRepositoryFile(root, "alias.md", true)).rejects.toThrow();
    await expect(readRepositoryFile(root, "../secret.txt")).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
