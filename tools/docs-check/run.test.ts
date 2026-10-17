import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { run } from "./run.ts";

it("runs on a real tracked repository, remains offline by default and produces GitHub annotations", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-cli-"));
  try {
    execFileSync("git", ["init", "--quiet", root], { env: isolatedGitEnvironment() });
    await mkdir(join(root, "tools/docs-check"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { check: "test" } }));
    await mkdir(join(root, "apps/engine"), { recursive: true });
    await writeFile(join(root, "pnpm-workspace.yaml"), "packages: [apps/*]\n");
    await writeFile(
      join(root, "apps/engine/package.json"),
      JSON.stringify({ name: "@overmind/engine", scripts: { start: "test" } }),
    );
    await writeFile(
      join(root, ".markdownlint-cli2.jsonc"),
      JSON.stringify({ config: { MD013: false }, ignores: [] }),
    );
    await writeFile(join(root, "tools/docs-check/pending-links.json"), "{}");
    await writeFile(join(root, "LICENSE"), "fixture license\n");
    await writeFile(
      join(root, "README.md"),
      "# Root\n\n[external](https://public.example/)\n\n```bash\npnpm missing\npnpm --filter @overmind/engine start\npnpm --filter @overmind/unknown start\npnpm --filter @overmind/engine missing\n```\n",
    );
    execFileSync("git", ["-C", root, "add", "."], { env: isolatedGitEnvironment() });
    const request = vi.fn();
    const result = await run(root, ["--github"], { resolve: vi.fn(), request });
    expect(result.diagnostics.map((d) => d.rule)).toContain("unknown-command");
    expect(result.output).toContain("::error file=README.md,line=6::");
    expect(
      result.diagnostics.filter((d) => d.rule === "unknown-command").map((d) => d.line),
    ).toEqual([6, 8, 9]);
    expect(result.exitCode).toBe(1);
    expect(request).not.toHaveBeenCalled();
    expect((await run(root, ["--bad-option"])).diagnostics[0]?.rule).toBe("arguments");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
