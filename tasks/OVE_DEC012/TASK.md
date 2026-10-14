---
id: OVE_DEC012
title: "Test the Decision Register: immutability, privacy boundaries, evidence and poisoning"
area: DEC
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DEC009, OVE_DEC010, OVE_DEC011, OVE_SEC004, OVE_TEST002]
soft_depends_on: []
provides: ["lib:decision-abuse-suite"]
needs: ["lib:test-utils", "lib:injection-corpus", "lib:builders"]
owns: ["packages/application/src/decision/abuse/**", "packages/adapters/sqlite/src/decision/abuse/**", "packages/gateway/src/routes/decision/abuse/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 14, 16, 28]
---

# OVE_DEC012: Test the Decision Register: immutability, privacy boundaries, evidence and poisoning

## 1. Summary

Write the executable gate for the Register's guarantees: append-only enforcement at database level, the isolation boundary for cross-Workspace search, evidence and Outcome rules, authorisation, poisoning attempts and crash/idempotency behaviour.

## 2. Context

ADR 0008 and SPEC 10/16.6 are the product's memory guarantees. This task collects cross-cutting negative tests, including the privacy boundary tests demanded for isolated Workspaces.

## 3. Scope (in)

- Test-only code in three folders.

## 4. Out of scope

- Fixes belong to owning tasks.

## 5. Detailed requirements

1. **Immutability (raw SQL):** `UPDATE decisions SET ...` for every column, `UPDATE decision_events`, `DELETE`, `INSERT OR REPLACE`, `REPLACE INTO`, `DELETE` with a guard row for another Workspace, `DROP TRIGGER` through the app connection, `PRAGMA writable_schema`, attempt to disable triggers: all fail or are unavailable; `triggers-present` after all migrations; backup export `content_hash` verification after tampering a copy.
2. **Application-level immutability:** no exported API edits records; supersede leaves the old row byte-identical; corrections only via new Decisions; concurrent supersedes.
3. **Privacy boundary matrix:** Workspaces A (public), B (public), C (isolated); callers: owner, chief in A, chief in C, agent in A, system job in B, Telegram; operations: list, search, similar finder, get by id, history, refs (`supersedesId` to C), facets; assert exact visible sets; no count/ordering/timing-class leaks (exact-body comparison of empty vs hidden results); isolation toggled mid-session; Workspace deleted; unknown isolation flag fail-closed.
4. **Evidence rules:** outcome proposals without evidence, with another Workspace's artifact, with URL-only evidence, with forged checksum, by agent/owner/system roles; verdict by non-owner/Telegram; 21 proposals; evidence flood.
5. **Poisoning:** Agent proposals with corpus payloads in every text field and `origin` spoofing, fake `participants`, fake `skillsUsed` versions, 100 proposals/hour, a proposal claiming `accepted`; assert stored as `proposed` data, bounded, audited, and that when included in a prompt by the assembler they are fenced data.
6. **Authority:** who can accept, reject, supersede, verdict across statuses (full matrix against DEC002), including Chief on `what` questions.
7. **Idempotency/crash:** crash between Decision insert and FTS insert (same transaction), between Decision and `superseded` event, duplicate `sourceKey`, repeated scans; end state equals one execution.
8. **Search hardening:** FTS hostile corpus (operators, long strings, unicode); sanitiser parity test across BOARD/DEC/MEM implementations using one shared corpus.
9. **Workspace deletion:** with two Workspaces, deleting one through the cascade participant removes its Decisions, events and FTS rows and leaves the other intact; cross-Workspace `supersedesId` ref then shows `workspaceName: null`.
10. Tagged `@security`, in default CI.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Corpora, fakes, harnesses; builders for mock data (D-03, D-14).

## 8. Architecture and code placement

Tests only, via public use cases, routes and raw SQLite connection for trigger tests.

## 9. Security and safety

This is the verification of the area; uses fake secrets only; temp DBs only.

## 10. Errors and edge cases

- Trigger tests must use a real SQLite build with the same options as production (`recursive_triggers` setting documented and both values tested).

## 11. Acceptance criteria

- [ ] All nine groups exist and pass in CI.
- [ ] Mutation check: removing any trigger or the authorised-set requirement fails at least one test.
- [ ] The privacy matrix has an explicit expected table committed in the test.
- [ ] Sanitiser parity corpus shared with BOARD/MEM.

## 12. Test plan

`pnpm vitest run --project security packages/application/src/decision/abuse packages/adapters/sqlite/src/decision/abuse packages/gateway/src/routes/decision/abuse`; add to the CI security job.

## 13. Parallelization notes

Runs after DEC011; can start earlier for groups 1-2.

## 14. Open questions and assumptions

- Open: timing side channels are not equalised (documented limitation).
