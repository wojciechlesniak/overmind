import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

const repository = resolve(import.meta.dirname, "../..");

it.each(["AGENTS.md", "CLAUDE.md"])(
  "%s edits fail the actual configuration gate without its approval label",
  (file) => {
    const root = mkdtempSync(resolve(tmpdir(), "overmind-agents-config-gate-"));
    const env = isolatedGitEnvironment();
    const git = (args: string[]) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" });
    try {
      git(["init", "--quiet"]);
      git(["config", "user.name", "CI fixture"]);
      git(["config", "user.email", "fixture@example.invalid"]);
      git(["config", "core.hooksPath", "/dev/null"]);
      git(["commit", "--allow-empty", "--quiet", "-m", "chore: baseline"]);
      const base = git(["rev-parse", "HEAD"]).trim();
      if (file === "CLAUDE.md") {
        symlinkSync("AGENTS.md", resolve(root, file));
      } else {
        writeFileSync(resolve(root, file), "Fixture agent rules\n");
      }
      git(["add", file]);
      git(["commit", "--quiet", "-m", "docs: edit agent rules"]);
      const head = git(["rev-parse", "HEAD"]).trim();
      const event = resolve(root, "event.json");
      for (const labels of [[], [{ name: "config-change" }]]) {
        writeFileSync(
          event,
          JSON.stringify({
            pull_request: {
              number: 1,
              title: "docs: edit agent rules",
              draft: false,
              base: { sha: base, ref: "DEVELOP", repo: { full_name: "owner/repo" } },
              head: { sha: head, ref: "task/OVE_SETUP019", repo: { full_name: "owner/repo" } },
              body: "config-change", // Untrusted text cannot approve the change.
              labels,
            },
          }),
        );
        const result = spawnSync(
          resolve(repository, "node_modules/.bin/tsx"),
          [resolve(repository, "tools/ci/config-integrity.ts")],
          { cwd: root, env: { ...env, GITHUB_EVENT_PATH: event }, encoding: "utf8" },
        );
        expect(result.status).toBe(labels.length ? 0 : 1);
        if (!labels.length) {
          expect(result.stderr).toContain("require config-change");
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

it("the root instruction protection does not match similarly named files", () => {
  const root = mkdtempSync(resolve(tmpdir(), "overmind-agents-config-boundary-"));
  const env = isolatedGitEnvironment();
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" });
  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "CI fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "core.hooksPath", "/dev/null"]);
    git(["commit", "--allow-empty", "--quiet", "-m", "chore: baseline"]);
    const base = git(["rev-parse", "HEAD"]).trim();
    for (const file of ["AGENTS.md.txt", "docs/CLAUDE.md.txt"]) {
      mkdirSync(dirname(resolve(root, file)), { recursive: true });
      writeFileSync(resolve(root, file), "Fixture unrelated document\n");
      git(["add", file]);
    }
    git(["commit", "--quiet", "-m", "docs: unrelated files"]);
    const event = resolve(root, "event.json");
    writeFileSync(
      event,
      JSON.stringify({
        pull_request: {
          number: 1,
          title: "docs: unrelated files",
          draft: false,
          base: { sha: base, ref: "DEVELOP", repo: { full_name: "owner/repo" } },
          head: {
            sha: git(["rev-parse", "HEAD"]).trim(),
            ref: "task/OVE_SETUP019",
            repo: { full_name: "owner/repo" },
          },
          labels: [],
        },
      }),
    );
    const result = spawnSync(
      resolve(repository, "node_modules/.bin/tsx"),
      [resolve(repository, "tools/ci/config-integrity.ts")],
      { cwd: root, env: { ...env, GITHUB_EVENT_PATH: event }, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
