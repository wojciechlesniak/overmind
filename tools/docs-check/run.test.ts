import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { run } from "./run.ts";

it("runs on a real tracked repository, remains offline by default and produces GitHub annotations", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-cli-"));
  try {
    execFileSync("git", ["init", "--quiet", root]);
    await mkdir(join(root, "tools/docs-check"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { check: "test" } }));
    await writeFile(
      join(root, ".markdownlint-cli2.jsonc"),
      JSON.stringify({ config: { MD013: false }, ignores: [] }),
    );
    await writeFile(join(root, "tools/docs-check/pending-links.json"), "{}");
    await writeFile(join(root, "LICENSE"), "fixture license\n");
    await writeFile(
      join(root, "README.md"),
      "# Root\n\n[external](https://public.example/)\n\n```bash\npnpm missing\n```\n",
    );
    execFileSync("git", ["-C", root, "add", "."]);
    const request = vi.fn();
    const result = await run(root, ["--github"], { resolve: vi.fn(), request });
    expect(result.diagnostics.map((d) => d.rule)).toContain("unknown-command");
    expect(result.output).toContain("::error file=README.md,line=6::");
    expect(result.exitCode).toBe(1);
    expect(request).not.toHaveBeenCalled();
    expect((await run(root, ["--bad-option"])).diagnostics[0]?.rule).toBe("arguments");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
