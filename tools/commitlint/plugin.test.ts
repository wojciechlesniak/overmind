import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { areaScopes, commitPolicy, taskReference, currentBranch } from "./plugin.mjs";
function parsed(raw: string) {
  const header = raw.split("\n")[0] ?? "";
  return {
    raw,
    header,
    type: header.split(/[(:]/u)[0] ?? "",
    subject: header.split(": ").slice(1).join(": "),
  };
}
it("reads scopes from the plan and preserves maintainer scopes", () => {
  expect(areaScopes()).toContain("perm");
  expect(areaScopes()).toContain("setup");
  expect(areaScopes()).toContain("deps");
  expect(areaScopes()).not.toContain("unknown");
});
it("requires one matching task footer and exempts reverts and merge commits", () => {
  const message =
    "feat(perm): add policy intersection\n\nDeny access outside both policies.\n\nRefs: OVE_PERM001";
  expect(taskReference(parsed(message), "always", "task/OVE_PERM001")[0]).toBe(true);
  for (const raw of [
    message.replace("Refs: OVE_PERM001", "Refs: OVE_PERM002"),
    message.replace("\n\nRefs: OVE_PERM001", ""),
    message + "\nRefs: OVE_PERM002",
    "chore: add file\nRefs: OVE_PERM001",
  ]) {
    expect(taskReference(parsed(raw), "always", "task/OVE_PERM001")[0]).toBe(false);
  }
  expect(taskReference(parsed("revert: remove policy"), "always", "task/OVE_PERM001")[0]).toBe(
    true,
  );
  expect(taskReference(parsed("Merge branch 'x'"), "always", "task/OVE_PERM001")[0]).toBe(true);
  expect(taskReference(parsed("chore: update tools"), "always", "HEAD")[0]).toBe(false);
});
it("checks lower-case start, emoji, explanatory body and strict line lengths", () => {
  for (const raw of [
    "fix: Handle null\n\nAvoid a crash.",
    "feat: add policy",
    "security: deny access\n\nRefs: OVE_SEC001",
    "docs: add 🛡 policy",
    "docs: add 1️⃣ item",
    "docs: add flags 🇵🇱",
    "docs: update guide\n\n" + "x".repeat(101),
  ]) {
    expect(commitPolicy(parsed(raw))[0], raw).toBe(false);
  }
  for (const raw of [
    "feat(perm): add policy\n\nDeny unauthorised access.\n\nRefs: OVE_PERM001",
    "docs: show input → output",
    "test: cover parser\n\nCo-Authored-By: Agent <agent@example.com>",
  ]) {
    expect(commitPolicy(parsed(raw))[0], raw).toBe(true);
  }
});

it("checks the real commitlint parser and built-in rules", () => {
  const branch = currentBranch();
  const task = /^task\/(OVE_[A-Z]{2,6}\d{3})$/u.exec(branch)?.[1] ?? "OVE_SETUP005";
  const suffix = `\n\nExplain the reason for this change.\n\nRefs: ${task}`;
  const run = (header: string) =>
    spawnSync(resolve(import.meta.dirname, "../../node_modules/.bin/commitlint"), [], {
      cwd: resolve(import.meta.dirname, "../.."),
      input: header + suffix,
      encoding: "utf8",
    });
  for (const header of [
    "fix: Handle null",
    "docs(unknown): add guide",
    "docs(setup/deps): add guide",
    "docs: add guide.",
    "oops: add guide",
    "docs: add 🛡 guide",
    `docs: ${"x".repeat(100)}`,
  ]) {
    const result = run(header);
    expect(result.status, header).not.toBe(0);
  }
  for (const header of [
    "feat(perm): add policy intersection",
    "docs: show input → output",
    "security(sec): deny access",
  ]) {
    const result = run(header);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }
}, 30000);
