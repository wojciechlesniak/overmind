import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, unlink, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { run } from "./run.ts";

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-targets-"));
  execFileSync("git", ["init", "--quiet", root]);
  await mkdir(join(root, "tools/docs-check"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"scripts":{}}');
  await writeFile(join(root, ".markdownlint-cli2.jsonc"), '{"config":{},"ignores":[]}');
  await writeFile(join(root, "tools/docs-check/pending-links.json"), "{}");
  await writeFile(join(root, "README.md"), "# Root\n\n![Hero](hero.png)\n");
  await writeFile(join(root, "LICENSE"), "fixture license\n");
  await writeFile(join(root, "hero.png"), "fixture image bytes");
  execFileSync("git", ["-C", root, "add", "."]);
  return root;
}

it("does not treat deleted tracked assets or LICENSE as existing publication targets", async () => {
  const root = await fixture();
  try {
    expect((await run(root, ["--publish"])).exitCode).toBe(0);
    await unlink(join(root, "hero.png"));
    await unlink(join(root, "LICENSE"));
    const checked = await run(root, ["--publish"]);
    expect(checked.diagnostics.map((d) => d.rule)).toEqual(
      expect.arrayContaining(["broken-link", "missing-license"]),
    );
    expect(checked.exitCode).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("denies tracked asset and LICENSE symlinks escaping the actual repository", async () => {
  const root = await fixture();
  const outside = await mkdtemp(join(tmpdir(), "ove-doc-target-outside-"));
  try {
    await writeFile(join(outside, "data"), "outside fixture");
    for (const file of ["hero.png", "LICENSE"]) {
      await unlink(join(root, file));
      await symlink(join(outside, "data"), join(root, file));
    }
    const checked = await run(root, ["--publish"]);
    expect(checked.diagnostics.map((d) => d.rule)).toEqual(
      expect.arrayContaining(["broken-link", "missing-license"]),
    );
    expect(checked.exitCode).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
