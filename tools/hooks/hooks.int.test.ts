import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "./git-test-environment.ts";

const source = resolve(import.meta.dirname, "../..");
const lefthook = resolve(source, "node_modules/.bin/lefthook");
const message = "chore(setup): exercise hooks\n\nRefs: OVE_PERM001";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "overmind-hooks-"));
  const repo = join(root, "repo");
  try {
    mkdirSync(repo);
    for (const file of [
      "lefthook.yml",
      "commitlint.config.mjs",
      "package.json",
      "pnpm-workspace.yaml",
      "pnpm-lock.yaml",
      "prettier.config.mjs",
      ".prettierignore",
      "eslint.config.mjs",
      "eslint.config.d",
      "tools/hooks",
      "tools/commitlint",
      "tools/eslint",
      "tasks/PLAN.md",
    ]) {
      cpSync(join(source, file), join(repo, file), { recursive: true });
    }
    function copyManifests(directory: string) {
      for (const entry of readdirSync(join(source, directory), { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory() && !["node_modules", ".tsbuild"].includes(entry.name)) {
          copyManifests(path);
        } else if (entry.isFile() && entry.name === "package.json") {
          mkdirSync(resolve(repo, directory), { recursive: true });
          cpSync(join(source, path), join(repo, path));
        }
      }
    }
    for (const directory of ["apps", "packages", "tools"]) {
      copyManifests(directory);
    }
    writeFileSync(join(repo, ".gitignore"), "node_modules\n");
    symlinkSync(join(source, "node_modules"), join(repo, "node_modules"), "dir");
    const env = {
      ...isolatedGitEnvironment(),
      CI: "false",
      LEFTHOOK: "1",
      LEFTHOOK_EXCLUDE: "",
      LEFTHOOK_VERBOSE: "0",
      GIT_CONFIG_NOSYSTEM: "1",
    };
    const run = (command: string, args: string[], cwd = repo, extra: NodeJS.ProcessEnv = {}) =>
      spawnSync(command, args, {
        cwd,
        env: { ...env, ...extra },
        encoding: "utf8",
        timeout: 30000,
      });
    const git = (...args: string[]) => run("git", args);
    expect(git("init", "-b", "task/OVE_PERM001").status).toBe(0);
    expect(git("config", "user.email", "test@example.com").status).toBe(0);
    expect(git("config", "user.name", "Hook Test").status).toBe(0);
    expect(git("config", "commit.gpgsign", "false").status).toBe(0);
    expect(git("add", ".").status).toBe(0);
    expect(git("commit", "-m", message).status).toBe(0);
    expect(run(lefthook, ["install"]).status).toBe(0);
    return { root, repo, run, git };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
it("real commits format and stage fixes, enforce messages, block keys and work in linked worktrees", () => {
  const f = fixture();
  try {
    const file = "ünï code.json";
    writeFileSync(join(f.repo, file), '{"ready":true}');
    expect(f.git("add", "--", file).status).toBe(0);
    const badMessage = f.git(
      "commit",
      "-m",
      "fix: Handle null\n\nAvoid a crash.\n\nRefs: OVE_PERM001",
    );
    expect(badMessage.status, badMessage.stdout + badMessage.stderr).not.toBe(0);
    expect(badMessage.stdout + badMessage.stderr).toContain("lower-case");
    const commit = f.git("commit", "-m", message);
    expect(commit.status, commit.stdout + commit.stderr).toBe(0);
    expect(f.git("show", `HEAD:${file}`).stdout).toBe('{ "ready": true }\n');
    writeFileSync(join(f.repo, "check.mjs"), "var value=1; export {value};");
    const quoted = "quote ' $(touch injected).json";
    writeFileSync(join(f.repo, quoted), '{"quoted":true}');
    expect(f.git("add", "--", "check.mjs", quoted).status).toBe(0);
    const style = f.git("commit", "-m", message);
    expect(style.status, style.stdout + style.stderr).toBe(0);
    expect(f.git("show", "HEAD:check.mjs").stdout).toContain("const value = 1;");
    expect(existsSync(join(f.repo, "injected"))).toBe(false);
    for (const filename of [".env.local", "key.p12"]) {
      writeFileSync(join(f.repo, filename), "fixture-only");
      expect(f.git("add", "--force", "--", filename).status).toBe(0);
      const blocked = f.git("commit", "-m", message);
      expect(blocked.status).not.toBe(0);
      expect(blocked.stdout + blocked.stderr).toContain("Forbidden secret/key filenames");
      expect(f.git("reset", "HEAD", "--", filename).status).toBe(0);
      rmSync(join(f.repo, filename));
    }
    writeFileSync(join(f.repo, "expanded.json"), `[${"0,".repeat(399999)}0]`);
    expect(f.git("add", "expanded.json").status).toBe(0);
    const expanded = f.git("commit", "-m", message);
    expect(
      expanded.status,
      expanded.stdout + expanded.stderr + f.git("cat-file", "-s", ":expanded.json").stdout,
    ).not.toBe(0);
    expect(expanded.stdout + expanded.stderr).toContain("Files exceed 1 MiB");
    expect(Number(f.git("cat-file", "-s", ":expanded.json").stdout)).toBeGreaterThan(1024 * 1024);
    expect(f.git("reset", "HEAD", "--", "expanded.json").status).toBe(0);
    rmSync(join(f.repo, "expanded.json"));
    writeFileSync(join(f.repo, "large.bin"), Buffer.alloc(1024 * 1024 + 1));
    expect(f.git("add", "large.bin").status).toBe(0);
    writeFileSync(join(f.repo, "large.bin"), "small unstaged edit");
    const oversized = f.git("commit", "-m", message);
    expect(oversized.status).not.toBe(0);
    expect(oversized.stdout + oversized.stderr).toContain("Files exceed 1 MiB");
    expect(f.git("reset", "HEAD", "--", "large.bin").status).toBe(0);
    rmSync(join(f.repo, "large.bin"));
    writeFileSync(join(f.repo, "small.bin"), "small staged blob");
    expect(f.git("add", "small.bin").status).toBe(0);
    writeFileSync(join(f.repo, "small.bin"), Buffer.alloc(1024 * 1024 + 1));
    const small = f.git("commit", "-m", message);
    expect(small.status, small.stdout + small.stderr).toBe(0);
    expect(f.git("show", "HEAD:small.bin").stdout).toBe("small staged blob");
    const worktree = join(f.root, "worktree");
    expect(f.git("worktree", "add", "-b", "task/OVE_PERM002", worktree).status).toBe(0);
    symlinkSync(join(source, "node_modules"), join(worktree, "node_modules"), "dir");
    expect(readFileSync(join(worktree, ".git"), "utf8")).toContain("gitdir:");
    expect(f.run(lefthook, ["install"], worktree).status).toBe(0);
    writeFileSync(join(worktree, "second.json"), '{"worktree":true}');
    expect(f.run("git", ["add", "second.json"], worktree).status).toBe(0);
    const mismatch = f.run("git", ["commit", "-m", message], worktree);
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stdout + mismatch.stderr).toContain("Refs: OVE_PERM002");
    const accepted = f.run("git", ["commit", "-m", message.replace("001", "002")], worktree);
    expect(accepted.status, accepted.stdout + accepted.stderr).toBe(0);
    expect(f.run("git", ["show", "HEAD:second.json"], worktree).stdout).toBe(
      '{ "worktree": true }\n',
    );
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
}, 60000);

it("pre-push runs sequentially and aborts on the first failure", () => {
  const f = fixture();
  try {
    const bin = join(f.root, "bin");
    mkdirSync(bin);
    const log = join(f.root, "push.log");
    writeFileSync(
      join(bin, "pnpm"),
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOOK_TEST_LOG"\nif [ "$1" = "$HOOK_TEST_FAIL" ]; then exit 1; fi\n',
      { mode: 0o755 },
    );
    const env = {
      PATH: `${bin}:${process.env["PATH"] ?? ""}`,
      HOOK_TEST_LOG: log,
      HOOK_TEST_FAIL: "lint",
    };
    const fail = f.run(lefthook, ["run", "pre-push"], f.repo, env);
    expect(fail.status).not.toBe(0);
    expect(readFileSync(log, "utf8").trim().split("\n")).toEqual(["typecheck", "lint"]);
    writeFileSync(log, "");
    const pass = f.run(lefthook, ["run", "pre-push"], f.repo, { ...env, HOOK_TEST_FAIL: "" });
    expect(pass.status, pass.stdout + pass.stderr).toBe(0);
    expect(readFileSync(log, "utf8").trim().split("\n")).toEqual(["typecheck", "lint", "test"]);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
}, 30000);

it("prepare is idempotent, respects CI and installs into the common hook directory", () => {
  const f = fixture();
  try {
    const hook = join(f.repo, ".git/hooks/pre-commit");
    expect(existsSync(hook)).toBe(true);
    const before = readFileSync(hook, "utf8");
    writeFileSync(
      join(f.repo, "lefthook-secrets.yml"),
      "pre-commit:\n  jobs:\n    - name: extension-probe\n      run: node --version\n",
    );
    expect(f.run(lefthook, ["dump"]).stdout).toContain("extension-probe");
    expect(f.run("pnpm", ["run", "prepare"]).status).toBe(0);
    expect(readFileSync(hook, "utf8")).toBe(before);
    rmSync(hook);
    rmSync(join(f.repo, "node_modules"));
    const ciInstall = f.run("pnpm", ["install", "--frozen-lockfile", "--offline"], f.repo, {
      CI: "true",
    });
    expect(ciInstall.status, ciInstall.stdout + ciInstall.stderr).toBe(0);
    expect(existsSync(hook)).toBe(false);
    expect(f.run("pnpm", ["run", "prepare"]).status).toBe(0);
    expect(existsSync(hook)).toBe(true);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
}, 60000);
