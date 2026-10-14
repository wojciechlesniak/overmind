---
id: OVE_VIS009
title: Build the visibility invariants and abuse-case test suite (leaks, memory, permissions)
area: VIS
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM005, OVE_TEST002, OVE_VIS004, OVE_VIS006, OVE_VIS008]
soft_depends_on: [OVE_PERM005, OVE_PERM030]
provides: ["lib:visibility-invariants-suite", "ci:visibility-tests"]
needs: ["lib:test-utils", "lib:fake-ports", "lib:effective-permissions"]
owns: ["packages/testing/src/visibility/invariants.ts", "packages/gateway/test/security/vis/**", "docs/security/visibility-abuse-cases.md"]
reads: ["packages/application/src/visibility/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16.3", "SPECIFICATION 10", "SPECIFICATION 11"]
adr_refs: [28, 14, 3]
---

# OVE_VIS009: Build the visibility invariants and abuse-case suite

## 1. Summary

Cross-cutting tests that prove ADR 0028's guarantees end to end: Private never leaks, only the desktop Owner changes visibility, isolated Workspaces behave, and visibility never changes permissions or memory boundaries.

## 2. Context

VIS004 proves repositories filter correctly; this suite proves the composed behaviour through use cases, gateway and events, including the negative claims ("visibility does not change permissions", ADR 0003 and "does not change memory", ADR 0014) that are easy to break by accident.

## 3. Scope (in)

Invariant tests, abuse-case tests, documentation list.

## 4. Out of scope

Repository conformance (VIS004), Agent Memory implementation (MEM), permission engine tests (PERM030).

## 5. Detailed requirements (each a named test)

A. Leaks
1. Private Agent/Skill/Workflow of W1 is absent from W2: lists, search, counts, Chief suggestions (CHIEF suggestion port with context workspace), Telegram `/agents` style listing, Skill library, workflow node palette, assignment candidates, export of Workspace data, error messages (no names of foreign private items in `vis.used_elsewhere` for non-Owner), event payloads delivered to W2 subscribers.
2. Public item appears in all Workspaces including an isolated one; an isolated Workspace's own items never appear elsewhere even after attempts to publish.
3. A workflow in W2 referencing a Public item that later becomes Private (via a stale reference) is flagged invalid at validation/run start (`WFRT` validation hook) and never silently resolves.
B. Authority
4. Chief, agent tokens, Telegram, `owner other`, and system cannot change visibility (route and use case); Chief can only create proposals; proposals acceptance only by desktop Owner.
5. Prompt-injected proposal rationale or agent text cannot trigger a change.
C. Rules
6. Defaults per ADR 0028 for each creation path; isolated forces Private; Dynamic Agent private; promote Dynamic to persistent keeps Private until Owner publishes.
7. Skill assignment works only where both visible; Private Skill on Public Agent is effective only in its Workspace (agent effective skills differ per Workspace); two Private items of different Workspaces cannot be assigned.
8. Making Private is blocked while used elsewhere and succeeds after removal; report contents verified; provider outage blocks.
D. Versioning
9. Every successful change creates exactly one new configuration version; a Run started before keeps the old version's visibility and behaviour (pinned); a Run started after uses the new one.
E. Independence
10. Permissions: for random Agents/policies, `computeEffectivePermissions` and `CheckAccess` results are identical before and after any visibility change (hash equality); there is no import of visibility modules in the PERM packages (import-graph test).
11. Memory: after a visibility change, no memory rows move, are deleted or become visible/invisible across Workspaces (fake MEM port records zero calls; Public Agent keeps separate memory per Workspace).
12. Audit: every change and refusal has an audit event with channel, without names of foreign items beyond ids; `expectAuditEventSafe`.
F. Concurrency
13. Two simultaneous changes on one item: one wins, the other gets version conflict; a workflow edit racing a visibility change cannot produce a Workspace-crossing reference.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

VIS004 fixtures, PERM `computeEffectivePermissions` and `expectAuditEventSafe`, fake MEM port, gateway harness.

## 8. Architecture and code placement

Invariant helpers in `packages/testing/src/visibility/invariants.ts`; gateway tests in `packages/gateway/test/security/vis/*.sec.test.ts`.

## 9. Security and safety

Protects against data exposure across client Workspaces and against privilege confusion between visibility and permissions. Includes negative controls (a leaky fake must fail). Tests use synthetic data only.

## 10. Errors and edge cases

Archived items: not visible in lists, still referenced by pinned versions. Deleted Workspace: its Private items are removed with it (SPEC 10), Public items remain; test via the cascade participants of AGENT/SKILL/WFRT.

## 11. Acceptance criteria

- [ ] All 13 groups implemented and green; CI job `visibility-tests` required.
- [ ] Removing the visibility filter from a repository, the authority check, or the usage check makes at least one test fail (documented mutation run).
- [ ] Import-graph test proves PERM and MEM do not import visibility modules.

## 12. Test plan

`pnpm vitest run packages/gateway/test/security/vis packages/testing/src/visibility`.

## 13. Parallelization notes

Can be written incrementally as AGENT, SKILL and WFRT repositories land.

## 14. Open questions and assumptions

- ASSUMPTION: deleting a Workspace deletes its Private items only (SPEC 10); Public items persist.
