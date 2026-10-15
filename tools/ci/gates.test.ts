import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
const root = resolve(import.meta.dirname, "../..");
const fullJobs = [
  "plan",
  "format-lint",
  "typecheck",
  "test",
  "test-merge",
  "build",
  "architecture",
  "licenses",
  "audit",
  "commits",
  "config-integrity",
  "workflow-lint",
];
function aggregate(
  results: Record<string, { result: string }>,
  full = "true",
  extra: NodeJS.ProcessEnv = {},
) {
  return spawnSync(process.execPath, ["--import", "tsx", "tools/ci/success.ts"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...isolatedGitEnvironment(),
      CI_NEEDS: JSON.stringify(results),
      CI_FULL: full,
      ...extra,
    },
  });
}
it("aggregate rejects failures, cancellations and unexpected skips, permitting only planned exclusions", () => {
  const success = Object.fromEntries(fullJobs.map((job) => [job, { result: "success" }]));
  expect(
    aggregate({ ...success, rust: { result: "skipped" }, "desktop-e2e": { result: "skipped" } })
      .status,
  ).toBe(0);
  for (const result of ["failure", "cancelled", "skipped"]) {
    expect(aggregate({ ...success, test: { result } }).status).not.toBe(0);
  }
  expect(
    aggregate({ ...success, rust: { result: "skipped" } }, "true", { CI_RUST: "true" }).status,
  ).not.toBe(0);
  const draft = Object.fromEntries(
    fullJobs.map((job) => [
      job,
      { result: ["plan", "format-lint", "typecheck"].includes(job) ? "success" : "skipped" },
    ]),
  );
  expect(aggregate(draft, "false").status).toBe(0);
  expect(aggregate({ ...draft, plan: { result: "failure" } }, "false").status).not.toBe(0);
  expect(aggregate({}).status).not.toBe(0);
}, 15000);
it("configuration guards use the Git diff and strict mode rejects absent foundation tools", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-ci-guards-"));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: fixture, env, encoding: "utf8" });
  const run = (name: string, extra: NodeJS.ProcessEnv) =>
    spawnSync(resolve(root, "node_modules/.bin/tsx"), [resolve(root, "tools/ci", name)], {
      cwd: fixture,
      env: { ...env, ...extra },
      encoding: "utf8",
    });
  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "CI fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "core.hooksPath", "/dev/null"]);
    git(["commit", "--allow-empty", "--quiet", "-m", "chore: baseline"]);
    const base = git(["rev-parse", "HEAD"]).trim();
    writeFileSync(resolve(fixture, "lefthook.yml"), "pre-commit: {}\n");
    git(["add", "lefthook.yml"]);
    git(["commit", "--quiet", "-m", "chore: change hooks"]);
    const head = git(["rev-parse", "HEAD"]).trim();
    const eventPath = resolve(fixture, "event.json");
    const check = (labels: string[]) => {
      writeFileSync(
        eventPath,
        JSON.stringify({
          pull_request: {
            number: 1,
            title: "chore: change hooks",
            draft: false,
            base: { sha: base, ref: "DEVELOP", repo: { full_name: "owner/repo" } },
            head: { sha: head, ref: "task/OVE_SETUP006", repo: { full_name: "owner/repo" } },
            labels: labels.map((name) => ({ name })),
            body: "config-change hooks-change", // Untrusted body cannot grant approval.
          },
        }),
      );
      return run("config-integrity.ts", { GITHUB_EVENT_PATH: eventPath });
    };
    expect(check([]).stderr).toContain("require config-change");
    expect(check(["config-change"]).stderr).toContain("require hooks-change");
    expect(check(["config-change", "hooks-change"]).status).toBe(0);
    expect(run("architecture.ts", { CI_STRICT_TOOLS: "true" }).status).not.toBe(0);
    const bootstrap = run("architecture.ts", { CI_STRICT_TOOLS: "false" });
    expect(bootstrap.status).toBe(0);
    expect(bootstrap.stderr).toContain("OVE_ARCH002");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 15000);
it("PR title checks retain syntax policy without requiring a nonexistent body", () => {
  const run = (input: string) =>
    spawnSync(
      resolve(root, "node_modules/.bin/commitlint"),
      ["--config", "tools/ci/commitlint-title.config.mjs"],
      { cwd: root, input, encoding: "utf8", env: isolatedGitEnvironment() },
    );
  expect(run("feat(setup): add pipeline").status).toBe(0);
  expect(run("fix: Handle null").status).not.toBe(0);
  expect(run("docs(unknown): add guide").status).not.toBe(0);
  const normal = spawnSync(resolve(root, "node_modules/.bin/commitlint"), [], {
    cwd: root,
    input: "feat(setup): add pipeline",
    encoding: "utf8",
    env: isolatedGitEnvironment(),
  });
  expect(normal.status).not.toBe(0);
}, 15000);
