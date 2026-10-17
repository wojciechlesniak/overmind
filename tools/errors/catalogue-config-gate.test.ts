import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

const root = resolve(import.meta.dirname, "../..");

it("requests the repository Owner review for compiler and integration-gate changes", () => {
  const owners = readFileSync(resolve(root, ".github/CODEOWNERS"), "utf8").split("\n");
  expect(owners).toContain("/tools/errors/ @wojciechlesniak");
});

it.each([
  { file: "tools/errors/catalogue-compiler.ts", protected: true },
  { file: "tools/errors/catalogue-ci-gate.test.ts", protected: true },
  { file: "tools/errors-unrelated/ordinary.ts", protected: false },
])("enforces the actual configuration gate for $file", ({ file, protected: isProtected }) => {
  const fixture = mkdtempSync(resolve(tmpdir(), "ove037-config-gate-"));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: fixture, env, encoding: "utf8" });
  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "Catalogue gate fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "core.hooksPath", "/dev/null"]);
    git(["commit", "--allow-empty", "--quiet", "-m", "chore: baseline"]);
    const base = git(["rev-parse", "HEAD"]).trim();
    const path = resolve(fixture, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "export {};\n");
    git(["add", "--", file]);
    git(["commit", "--quiet", "-m", "chore: change catalogue tooling"]);
    const head = git(["rev-parse", "HEAD"]).trim();
    const eventPath = resolve(fixture, "event.json");
    for (const labels of [[], [{ name: "config-change" }]]) {
      writeFileSync(
        eventPath,
        JSON.stringify({
          pull_request: {
            number: 1,
            title: "test(arch): verify catalogue configuration protection",
            draft: false,
            base: { sha: base, ref: "DEVELOP", repo: { full_name: "owner/repo" } },
            head: { sha: head, ref: "task/OVE_ARCH003", repo: { full_name: "owner/repo" } },
            labels,
          },
        }),
      );
      const result = spawnSync(
        resolve(root, "node_modules/.bin/tsx"),
        [resolve(root, "tools/ci/config-integrity.ts")],
        {
          cwd: fixture,
          env: { ...env, GITHUB_EVENT_PATH: eventPath },
          encoding: "utf8",
          timeout: 4000,
          maxBuffer: 16_384,
        },
      );
      expect(result.error).toBeUndefined();
      const denied = isProtected && labels.length === 0;
      expect(result.status).toBe(denied ? 1 : 0);
      if (denied) {
        expect(result.stderr).toContain("require config-change");
      }
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
