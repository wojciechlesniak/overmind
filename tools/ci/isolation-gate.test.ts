import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { fullHostedChecksPassed } from "./isolation-policy.ts";
import { readWorkflow } from "./workflow.parse-boundary.ts";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";

const root = resolve(import.meta.dirname, "../..");
const sha = "a".repeat(40);
const jobs = Object.keys(readWorkflow(resolve(root, ".github/workflows/ci.yml")).jobs)
  .filter((name) => !["rust", "desktop-e2e"].includes(name))
  .flatMap((name) => (name === "test" ? ["test (1)", "test (2)", "test (3)"] : [name]))
  .map((name) => ({ name, status: "completed", conclusion: "success" }));

function approved() {
  const pr = {
    number: 1,
    state: "open",
    draft: false,
    head: { sha, repo: { full_name: "owner/repo" } },
    base: { repo: { full_name: "owner/repo" } },
    labels: [{ name: "run-isolation" }, { name: `isolate-${sha}` }],
  };
  return {
    pr,
    currentPR: pr,
    jobs,
    reports: [{ id: 1, path: ".github/workflows/ci.yml", head_sha: sha, conclusion: "success" }],
    events: pr.labels.map((label, index) => ({
      id: index + 1,
      event: "labeled",
      created_at: "2026-10-15T11:00:00Z",
      actor: { login: "owner" },
      label,
    })),
    permission: "write",
    apiStatus: 200,
  };
}

function gate(data: unknown, extra: NodeJS.ProcessEnv = {}, number = "1") {
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-isolation-gate-"));
  try {
    const event = resolve(fixture, "event.json");
    const output = resolve(fixture, "output");
    const responses = resolve(fixture, "responses.json");
    const entry = resolve(fixture, "entry.mjs");
    writeFileSync(
      event,
      JSON.stringify({
        repository: { full_name: "owner/repo", default_branch: "master" },
        inputs: { pr_number: number },
      }),
    );
    writeFileSync(responses, JSON.stringify(data));
    // Execute the actual gate and HTTP/schema boundary without contacting GitHub.
    writeFileSync(
      entry,
      `
import { readFileSync } from "node:fs";
const fixture = JSON.parse(readFileSync(process.env.ISOLATION_RESPONSES, "utf8"));
let prReads = 0;
globalThis.fetch = async (url, options) => {
  if (url.origin !== "https://api.github.com" || options.redirect !== "error") throw new Error("Unsafe request");
  const path = url.pathname;
  let body;
  if (path.endsWith("/permission")) body = { permission: fixture.permission };
  else if (path.endsWith("/pulls/1")) body = prReads++ === 0 ? fixture.pr : fixture.currentPR;
  else if (path.endsWith("/actions/runs")) body = { workflow_runs: fixture.reports };
  else if (path.endsWith("/jobs")) body = { jobs: fixture.jobs };
  else if (path.endsWith("/events")) body = fixture.events;
  else if (path.includes("/commits/")) body = { commit: { committer: { date: "2026-10-15T10:00:00Z" } } };
  else throw new Error("Unexpected request");
  return Response.json(body, { status: fixture.apiStatus });
};
await import(${JSON.stringify(pathToFileURL(resolve(root, "tools/ci/isolation-gate.ts")).href)});
`,
    );
    const result = spawnSync(process.execPath, ["--import", "tsx", entry], {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...isolatedGitEnvironment(),
        GH_TOKEN: "fixture-token",
        GITHUB_EVENT_PATH: event,
        GITHUB_OUTPUT: output,
        GITHUB_WORKFLOW_REF: "owner/repo/.github/workflows/isolation.yml@refs/heads/master",
        GITHUB_REF: "refs/heads/master",
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_ACTOR: "owner",
        GITHUB_SHA: sha,
        ISOLATION_RESPONSES: responses,
        ...extra,
      },
    });
    return { ...result, output: existsSync(output) ? readFileSync(output, "utf8") : "" };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

it("isolation requires every full hosted check exactly once, not just a green Draft aggregate", () => {
  expect(fullHostedChecksPassed(jobs)).toBe(true);
  for (const job of jobs) {
    expect(fullHostedChecksPassed(jobs.filter((item) => item !== job)), job.name).toBe(false);
    for (const conclusion of ["skipped", "failure", "cancelled", null]) {
      expect(
        fullHostedChecksPassed([...jobs.filter((item) => item !== job), { ...job, conclusion }]),
      ).toBe(false);
    }
  }
  expect(fullHostedChecksPassed([...jobs, ...jobs])).toBe(false);
});

it("actual isolation gate denies untrusted triggers, forks, revoked approvals and stale queued heads", () => {
  const input = approved();
  const allowed = gate(input);
  expect(allowed.status, allowed.stderr).toBe(0);
  expect(allowed.output).toBe(`allowed=true\nsha=${sha}\n`);
  const denied = [
    gate(input, { GITHUB_EVENT_NAME: "pull_request" }),
    gate(input, { GITHUB_EVENT_NAME: "merge_group" }),
    gate(input, { GITHUB_REF: "refs/heads/attacker" }),
    gate({ ...input, permission: "read" }),
    gate({ ...input, pr: { ...input.pr, draft: true } }),
    gate({
      ...input,
      pr: { ...input.pr, head: { ...input.pr.head, repo: { full_name: "fork/repo" } } },
    }),
    gate({
      ...input,
      jobs: jobs.map((job) => ({
        ...job,
        conclusion: job.name === "test-merge" ? "skipped" : "success",
      })),
    }),
    gate({
      ...input,
      events: [
        ...input.events,
        {
          id: 3,
          event: "unlabeled",
          created_at: "2026-10-15T12:00:00Z",
          actor: { login: "owner" },
          label: { name: "run-isolation" },
        },
      ],
    }),
    gate({ ...input, currentPR: { ...input.pr, labels: [] } }),
    gate({ ...input, currentPR: { ...input.pr, head: { ...input.pr.head, sha: "b".repeat(40) } } }),
    gate({
      ...input,
      reports: [
        ...input.reports,
        { id: 2, path: ".github/workflows/ci.yml", head_sha: sha, conclusion: "failure" },
      ],
    }),
  ];
  for (const result of denied) {
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe("allowed=false\nsha=\n");
  }
}, 30000);

it("unavailable or malformed API data and invalid PR numbers cannot publish approval", () => {
  for (const result of [
    gate({ ...approved(), apiStatus: 503 }),
    gate({ ...approved(), jobs: [{ name: "ci-success" }] }),
    gate(approved(), {}, "0"),
    gate(approved(), {}, "not-a-number"),
  ]) {
    expect(result.status).not.toBe(0);
    expect(result.output).toBe("");
  }
}, 15000);
