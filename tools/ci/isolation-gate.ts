import { appendFileSync } from "node:fs";
import { z } from "zod";
import {
  readIsolationEvent,
  githubAPI,
  isolationPR,
  labelEvents,
  role,
  commit,
} from "./isolation.parse-boundary.ts";
import { approveIsolation, writer } from "./isolation-policy.ts";
const event = readIsolationEvent();
const repository = event.repository.full_name;
const branch = event.repository.default_branch;
const trusted = `${repository}/.github/workflows/isolation.yml@refs/heads/${branch}`;
const permission = async (login: string) =>
  (
    await githubAPI(
      `/repos/${repository}/collaborators/${encodeURIComponent(login)}/permission`,
      role,
    )
  ).permission;
async function approvePR(number: string, actor: string, actorRole: string) {
  const pr = await githubAPI(`/repos/${repository}/pulls/${number}`, isolationPR);
  if (
    pr.head.repo?.full_name !== repository ||
    pr.base.repo.full_name !== repository ||
    pr.state !== "open"
  ) {
    return { allowed: false, sha: "", reason: "Forked, closed or foreign PR" };
  }
  const sha = pr.head.sha;
  const reports = await githubAPI(
    `/repos/${repository}/actions/runs?head_sha=${sha}&event=pull_request`,
    z.object({
      workflow_runs: z.array(
        z.object({
          id: z.number().int(),
          path: z.string(),
          head_sha: z.string(),
          conclusion: z.string().nullable(),
        }),
      ),
    }),
  );
  const latest = reports.workflow_runs
    .filter((run) => run.path === ".github/workflows/ci.yml" && run.head_sha === sha)
    .sort((a, b) => b.id - a.id)[0];
  if (latest?.conclusion !== "success") {
    return { allowed: false, sha: "", reason: "Current PR head has no successful hosted CI run" };
  }
  const events = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await githubAPI(
      `/repos/${repository}/issues/${String(pr.number)}/events?per_page=100&page=${String(page)}`,
      labelEvents,
    );
    events.push(...batch);
    if (batch.length < 100) {
      break;
    }
    if (page === 20) {
      throw new Error("Isolation approval history exceeds review limit");
    }
  }
  const permissions: Record<string, string> = { [actor]: actorRole };
  const latestLabels = new Map<string, (typeof events)[number]>();
  for (const item of events) {
    const name = item.label?.name;
    if (
      item.event === "labeled" &&
      name &&
      (name === "run-isolation" || name === `isolate-${sha}`)
    ) {
      const previous = latestLabels.get(name);
      if (!previous || item.id > previous.id) {
        latestLabels.set(name, item);
      }
    }
  }
  for (const item of latestLabels.values()) {
    if (item.actor && !permissions[item.actor.login]) {
      permissions[item.actor.login] = await permission(item.actor.login);
    }
  }
  const head = await githubAPI(`/repos/${repository}/commits/${sha}`, commit);
  return {
    ...approveIsolation({
      repository,
      sha,
      actor,
      permissions,
      pr,
      events,
      committedAt: head.commit.committer.date,
    }),
    sha,
  };
}
let allowed = false;
let sha = "";
let reason = "Isolation requires an explicit trusted default-branch dispatch or push";
if (
  process.env["GITHUB_WORKFLOW_REF"] === trusted &&
  process.env["GITHUB_REF"] === `refs/heads/${branch}`
) {
  const kind = process.env["GITHUB_EVENT_NAME"];
  if (kind === "push" || kind === "workflow_dispatch") {
    const actor = process.env["GITHUB_ACTOR"] ?? "";
    const actorRole = await permission(actor);
    if (writer(actorRole)) {
      const number = event.inputs?.pr_number;
      if (kind === "workflow_dispatch" && number && Number(number) > 0) {
        const result = await approvePR(String(Number(number)), actor, actorRole);
        allowed = result.allowed;
        sha = result.sha;
        reason = result.reason;
      } else {
        sha = process.env["GITHUB_SHA"] ?? "";
        allowed = /^[a-f0-9]{40}$/u.test(sha);
        reason = "Writer invoked trusted default-branch isolation";
      }
    } else {
      reason = "Trigger actor lacks write permission";
    }
  }
}
console.log(reason);
const output = process.env["GITHUB_OUTPUT"];
if (!output) {
  throw new Error("GITHUB_OUTPUT is required");
}
appendFileSync(output, `allowed=${String(allowed)}\nsha=${allowed ? sha : ""}\n`);
