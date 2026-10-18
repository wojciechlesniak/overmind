import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { nodeGit } from "./ports.ts";

test("production Git rejects inherited repository selectors but honors normal credential configuration", () => {
  const temporary = realpathSync(mkdtempSync(resolve(tmpdir(), "ove-adr-git-environment-")));
  const root = resolve(temporary, "selected");
  const other = resolve(temporary, "unrelated");
  const home = resolve(temporary, "owner-home");
  const xdg = resolve(temporary, "owner-xdg");
  try {
    for (const path of [root, other, home, resolve(xdg, "git")]) {
      mkdirSync(path, { recursive: true });
    }
    for (const path of [root, other]) {
      execFileSync("git", ["init", "--quiet", path], {
        env: isolatedGitEnvironment(),
        stdio: "ignore",
      });
    }
    writeFileSync(resolve(xdg, "git/config"), "[credential]\n\thelper = fixture-helper-marker\n");
    const environment = {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      GIT_DIR: resolve(other, ".git"),
      GIT_WORK_TREE: other,
      GIT_INDEX_FILE: resolve(other, ".git/index"),
      GIT_COMMON_DIR: resolve(other, ".git"),
      GIT_OBJECT_DIRECTORY: resolve(other, ".git/objects"),
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "wrong-marker",
    };
    const git = nodeGit(root, environment);
    expect(git.run(["rev-parse", "--show-toplevel"]).trim()).toBe(root);
    expect(git.run(["config", "--get", "credential.helper"]).trim()).toBe("fixture-helper-marker");
    expect(git.run(["status", "--porcelain"])).toBe("");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
