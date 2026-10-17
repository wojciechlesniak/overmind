import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

const repository = resolve(import.meta.dirname, "../..");
const safe = () => isolatedGitEnvironment();
const git = (cwd: string, args: string[]) =>
  execFileSync("git", args, { cwd, env: safe(), encoding: "utf8" });
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

function sentinel(root: string): { parent: string; index: string; original: string } {
  const parent = join(root, "parent");
  mkdirSync(parent);
  git(parent, ["init", "--quiet"]);
  writeFileSync(join(parent, "parent-sentinel.md"), "# Parent sentinel\n");
  git(parent, ["add", "parent-sentinel.md"]);
  const index = join(parent, ".git/index");
  return { parent, index, original: hash(index) };
}

function inherited(parent: string, index: string): NodeJS.ProcessEnv {
  return {
    ...safe(),
    GIT_DIR: join(parent, ".git"),
    GIT_COMMON_DIR: join(parent, ".git"),
    GIT_WORK_TREE: parent,
    GIT_INDEX_FILE: index,
    GIT_OBJECT_DIRECTORY: join(parent, ".git/objects"),
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.bare",
    GIT_CONFIG_VALUE_0: "true",
  };
}

it.each(["index", "selection"])(
  "real documentation fixture tests preserve the inherited disposable parent %s",
  (mode) => {
    const root = mkdtempSync(join(tmpdir(), "ove-doc-hook-index-"));
    try {
      const { parent, index, original } = sentinel(root);
      const config = readFileSync(join(parent, ".git/config"));
      const checked = spawnSync(
        process.execPath,
        [
          join(repository, "node_modules/vitest/vitest.mjs"),
          "run",
          "tools/docs-check/run.test.ts",
          "tools/docs-check/targets.test.ts",
          "--maxWorkers",
          "1",
        ],
        {
          cwd: repository,
          env: mode === "index" ? { ...safe(), GIT_INDEX_FILE: index } : inherited(parent, index),
          encoding: "utf8",
          timeout: 10_000,
        },
      );
      expect(hash(index)).toBe(original);
      expect(readFileSync(join(parent, ".git/config"))).toEqual(config);
      expect(git(parent, ["ls-files"])).toBe("parent-sentinel.md\n");
      expect(checked.error).toBeUndefined();
      expect(checked.status, `${checked.stdout}\n${checked.stderr}`).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

it("the real documentation CLI reads its requested repository despite inherited Git selection", () => {
  const root = mkdtempSync(join(tmpdir(), "ove-doc-hook-cli-"));
  try {
    const { parent, index, original } = sentinel(root);
    const fixture = join(root, "fixture");
    mkdirSync(join(fixture, "tools/docs-check"), { recursive: true });
    git(fixture, ["init", "--quiet"]);
    writeFileSync(join(fixture, "README.md"), "# Fixture\n\n[Missing](missing.md)\n");
    writeFileSync(join(fixture, "package.json"), '{"scripts":{}}');
    writeFileSync(join(fixture, ".markdownlint-cli2.jsonc"), '{"config":{},"ignores":[]}');
    writeFileSync(join(fixture, "tools/docs-check/pending-links.json"), "{}");
    git(fixture, ["add", "."]);
    const invoke = (env: NodeJS.ProcessEnv) =>
      spawnSync(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), join(repository, "tools/docs-check/run.ts")],
        { cwd: fixture, env, encoding: "utf8", timeout: 10_000 },
      );
    const baseline = invoke(safe());
    expect(baseline.error).toBeUndefined();
    expect(baseline.status, baseline.stderr).toBe(1);
    expect(baseline.stdout).toContain("README.md | 3 | error | broken-link");
    const checked = invoke(inherited(parent, index));
    expect(hash(index)).toBe(original);
    expect(git(parent, ["ls-files"])).toBe("parent-sentinel.md\n");
    expect(checked.error).toBeUndefined();
    expect(checked.status, checked.stderr).toBe(baseline.status);
    expect(checked.stdout).toBe(baseline.stdout);
    expect(git(fixture, ["ls-files"])).toBe(
      ".markdownlint-cli2.jsonc\nREADME.md\npackage.json\ntools/docs-check/pending-links.json\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
