import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { nodeGit, observedNumbers } from "./ports.ts";

test("real remote task additions reserve numbers without checking out their content", () => {
  const parent = realpathSync(mkdtempSync(resolve(tmpdir(), "ove-adr-remote-")));
  const root = resolve(parent, "work");
  const remote = resolve(parent, "remote.git");
  const env = isolatedGitEnvironment();
  const git = (args: string[], cwd = root) =>
    execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    mkdirSync(root);
    git(["init", "--bare", "--quiet", remote], parent);
    git(["init", "--quiet"]);
    git(["config", "user.name", "ADR fixture"]);
    git(["config", "user.email", "adr@example.invalid"]);
    git(["checkout", "-b", "DEVELOP"]);
    mkdirSync(resolve(root, "docs/adr"), { recursive: true });
    writeFileSync(resolve(root, "docs/adr/0030-existing.md"), "integrated decision\n");
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: initial decision"]);
    git(["remote", "add", "origin", remote]);
    git(["push", "--quiet", "-u", "origin", "DEVELOP"]);
    git(["checkout", "-b", "task/OVE_TEST001"]);
    writeFileSync(resolve(root, "docs/adr/0035-reserved.md"), "remote data\n");
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "docs: reserve number"]);
    git(["push", "--quiet", "origin", "task/OVE_TEST001"]);
    git(["checkout", "DEVELOP"]);
    writeFileSync(resolve(root, "docs/adr/0033-local.md"), "local data\n");
    expect(observedNumbers(nodeGit(root), ["docs/adr/0033-local.md"])).toBe(36);
    expect(git(["branch", "--show-current"]).trim()).toBe("DEVELOP");
    expect(git(["status", "--porcelain"])).toBe("?? docs/adr/0033-local.md\n");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}, 15000);
