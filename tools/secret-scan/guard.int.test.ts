import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

it("actual Git-diff guard requires maintainer labels for secret policy, pins and the staged hook", () => {
  const root = resolve(import.meta.dirname, "../..");
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-secret-guard-"));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: fixture, env, encoding: "utf8" });
  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "core.hooksPath", "/dev/null"]);
    git(["commit", "--allow-empty", "--quiet", "-m", "chore: fixture"]);
    for (const path of [
      ".gitleaks.toml",
      "tools/secret-scan/gitleaks.lock.json",
      "tools/secret-scan/default-config.lock.json",
      "tools/secret-scan/syft.lock.json",
      "tools/secret-scan/policy.json",
      "lefthook-secrets.yml",
    ]) {
      const base = git(["rev-parse", "HEAD"]).trim();
      const file = resolve(fixture, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "{}\n");
      git(["add", path]);
      git(["commit", "--quiet", "-m", "chore: policy fixture"]);
      const head = git(["rev-parse", "HEAD"]).trim();
      const event = resolve(fixture, "event.json");
      const check = (labels: string[]) => {
        writeFileSync(
          event,
          JSON.stringify({
            pull_request: {
              number: 1,
              title: "chore: policy fixture",
              draft: false,
              base: { sha: base, ref: "DEVELOP", repo: { full_name: "owner/repo" } },
              head: { sha: head, ref: "task/OVE_SETUP007", repo: { full_name: "owner/repo" } },
              labels: labels.map((name) => ({ name })),
            },
          }),
        );
        return spawnSync(
          resolve(root, "node_modules/.bin/tsx"),
          [resolve(root, "tools/ci/config-integrity.ts")],
          {
            cwd: fixture,
            env: { ...env, GITHUB_EVENT_PATH: event },
            encoding: "utf8",
            timeout: 10000,
          },
        );
      };
      expect(check([]).stderr, path).toContain("require config-change");
      if (path === "lefthook-secrets.yml") {
        expect(check(["config-change"]).stderr).toContain("require hooks-change");
      }
      expect(check(["config-change", "hooks-change"]).status).toBe(0);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 30000);
