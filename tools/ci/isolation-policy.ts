import type { IsolationPR, LabelEvent } from "./isolation.parse-boundary.ts";
const writers = new Set(["admin", "maintain", "write"]);
export function writer(permission: string | undefined): boolean {
  return Boolean(permission && writers.has(permission));
}
export function approveIsolation(input: {
  repository: string;
  sha: string;
  committedAt: string;
  actor: string;
  permissions: Readonly<Record<string, string>>;
  pr: IsolationPR;
  events: readonly LabelEvent[];
}): { allowed: boolean; reason: string } {
  const { pr, repository, sha, events, permissions } = input;
  if (
    pr.state !== "open" ||
    pr.head.repo?.full_name !== repository ||
    pr.base.repo.full_name !== repository
  ) {
    return { allowed: false, reason: "Forked, closed or foreign PR" };
  }
  if (pr.head.sha !== sha) {
    return { allowed: false, reason: "Completed CI belongs to an obsolete head" };
  }
  if (!writer(permissions[input.actor])) {
    return { allowed: false, reason: "Trigger actor lacks write permission" };
  }
  const labels = new Set(pr.labels.map((label) => label.name));
  // Binding approval to the exact SHA prevents backdated commits or same-second
  // pushes from reusing a generic label. The generic label must still be fresh.
  for (const name of ["run-isolation", `isolate-${sha}`]) {
    if (!labels.has(name)) {
      return { allowed: false, reason: "Exact-head isolation approval is missing" };
    }
    const event = events
      .filter((item) => item.event === "labeled" && item.label?.name === name)
      .reduce<LabelEvent | undefined>(
        (latest, item) => (!latest || item.id > latest.id ? item : latest),
        undefined,
      );
    if (!event?.actor || !writer(permissions[event.actor.login])) {
      return { allowed: false, reason: "Label was not applied by a writer" };
    }
    if (Date.parse(event.created_at) < Date.parse(input.committedAt)) {
      return { allowed: false, reason: "Label predates the approved commit" };
    }
  }
  return { allowed: true, reason: "Maintainer approved the current same-repository head" };
}
