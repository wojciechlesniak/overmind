import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "./git-test-environment.ts";

it("temporary Git commands ignore hook-inherited repositories, indexes, objects and config", () => {
  const root = mkdtempSync(join(tmpdir(), "overmind-git-env-"));
  try {
    const parent = join(root, "parent");
    const fixture = join(root, "fixture");
    mkdirSync(parent);
    mkdirSync(fixture);
    const safe = isolatedGitEnvironment();
    const git = (cwd: string, args: string[], env = safe) =>
      execFileSync("git", args, { cwd, env, encoding: "utf8" });
    git(parent, ["init", "--quiet"]);
    writeFileSync(join(parent, "sentinel"), "preserve parent index");
    git(parent, ["add", "sentinel"]);
    const config = readFileSync(join(parent, ".git/config"));
    const index = readFileSync(join(parent, ".git/index"));
    const inherited = {
      ...process.env,
      GIT_DIR: join(parent, ".git"),
      GIT_COMMON_DIR: join(parent, ".git"),
      GIT_WORK_TREE: parent,
      GIT_INDEX_FILE: join(parent, ".git/index"),
      GIT_OBJECT_DIRECTORY: join(parent, ".git/objects"),
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.bare",
      GIT_CONFIG_VALUE_0: "true",
    };
    const isolated = isolatedGitEnvironment(inherited);
    git(fixture, ["init", "--quiet"], isolated);
    writeFileSync(join(fixture, "local"), "fixture content");
    git(fixture, ["add", "local"], isolated);
    expect(readFileSync(join(parent, ".git/config"))).toEqual(config);
    expect(readFileSync(join(parent, ".git/index"))).toEqual(index);
    expect(git(fixture, ["ls-files"], isolated).trim()).toBe("local");
    expect(git(fixture, ["rev-parse", "--is-bare-repository"], isolated).trim()).toBe("false");
    expect(Object.keys(isolated).filter((key) => key.startsWith("GIT_"))).toEqual([
      "GIT_CONFIG_NOSYSTEM",
      "GIT_CONFIG_GLOBAL",
      "GIT_TERMINAL_PROMPT",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
