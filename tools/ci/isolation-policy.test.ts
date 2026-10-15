import { expect, it } from "vitest";
import { approveIsolation } from "./isolation-policy.ts";
import { cleanup } from "./isolation-cleanup.mjs";
const sha = "a".repeat(40);
function approved() {
  return {
    repository: "owner/repo",
    sha,
    committedAt: "2026-10-15T10:00:00Z",
    actor: "owner",
    permissions: { owner: "write" },
    pr: {
      number: 1,
      state: "open",
      draft: false,
      head: { sha, repo: { full_name: "owner/repo" } },
      base: { repo: { full_name: "owner/repo" } },
      labels: [{ name: "run-isolation" }, { name: `isolate-${sha}` }],
    },
    events: [
      {
        id: 1,
        event: "labeled",
        created_at: "2026-10-15T11:00:00Z",
        actor: { login: "owner" },
        label: { name: "run-isolation" },
      },
      {
        id: 2,
        event: "labeled",
        created_at: "2026-10-15T11:00:00Z",
        actor: { login: "owner" },
        label: { name: `isolate-${sha}` },
      },
    ],
  };
}
it("only current same-repository heads with fresh writer-applied bound labels are admitted", () => {
  const input = approved();
  expect(approveIsolation(input).allowed).toBe(true);
  expect(approveIsolation({ ...input, pr: { ...input.pr, draft: true } }).allowed).toBe(false);
  expect(
    approveIsolation({
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
    }).allowed,
  ).toBe(false);
  expect(
    approveIsolation({
      ...input,
      pr: { ...input.pr, head: { ...input.pr.head, repo: { full_name: "fork/repo" } } },
    }).allowed,
  ).toBe(false);
  expect(
    approveIsolation({
      ...input,
      pr: { ...input.pr, head: { ...input.pr.head, sha: "b".repeat(40) } },
    }).allowed,
  ).toBe(false);
  expect(approveIsolation({ ...input, permissions: { owner: "read" } }).allowed).toBe(false);
  expect(
    approveIsolation({ ...input, pr: { ...input.pr, labels: [{ name: "run-isolation" }] } })
      .allowed,
  ).toBe(false);
  expect(
    approveIsolation({
      ...input,
      events: input.events.map((event) => ({ ...event, created_at: "2026-10-14T00:00:00Z" })),
    }).allowed,
  ).toBe(false);
  expect(
    approveIsolation({
      ...input,
      events: input.events.map((event) => ({ ...event, actor: { login: "outsider" } })),
    }).allowed,
  ).toBe(false);
});
it("cleanup removes only CI-prefixed resources and still stops the system after failures", () => {
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    return {
      status: 0,
      stdout: args.includes("list") ? "ovm-ci-safe\nowner-data\novm-ci-$(unsafe)\n" : "",
    };
  };
  expect(cleanup(run)).toBe(true);
  expect(calls).toContainEqual(["delete", "--force", "ovm-ci-safe"]);
  expect(calls).toContainEqual(["volume", "delete", "ovm-ci-safe"]);
  expect(calls.flat()).not.toContain("owner-data");
  expect(calls.flat()).not.toContain("ovm-ci-$(unsafe)");
  calls.length = 0;
  expect(
    cleanup((args) => {
      calls.push(args);
      return { status: args.includes("list") ? 1 : 0, stdout: "" };
    }),
  ).toBe(false);
  expect(calls.at(-1)).toEqual(["system", "stop"]);
});
