---
id: OVE_PERM029
title: Define and implement the Global Pause interaction rules for permissions and approvals
area: PERM
kind: decision
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_PAUSE001, OVE_PERM010, OVE_PERM014, OVE_PERM016]
soft_depends_on: []
provides: ["lib:perm-pause-policy", "doc:perm-pause-interaction"]
needs: ["port:PauseStateReader", "event:pause.changed"]
owns: ["packages/domain/src/perm/pause-policy.ts", "packages/application/src/perm/pause-guard.ts", "docs/security/perm-pause-interaction.md"]
reads: ["packages/application/src/ports/PauseStateReader.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16.14"]
adr_refs: [3, 5, 6]
---

# OVE_PERM029: Define the Global Pause interaction rules

## 1. Summary

The PAUSE area owns Global Pause (halting Runs). This task fixes exactly what PERM does while the system is paused so the behaviour is not left to each use case: which checks deny, which decisions may still be recorded, and what must never happen during a pause.

## 2. Context

SR-30: Global Pause halts all Runs and prevents new executions; only the Owner resumes. Approvals and Access Requests are decisions about future actions; granting access while nothing may run is harmless for execution, but a pause must not be a window for widening.

## 3. Scope (in)

A pure `pauseRules` table, a guard used by PERM010/014/016, the documentation, and tests.

## 4. Out of scope

Pause state, routes, tray, Telegram `/pause` (PAUSE).

## 5. Detailed requirements (the decision, ASSUMPTION until the Owner answers)

1. `CheckAccess` while paused: deny reason `paused` for every action with an external or filesystem effect and for new approvals consumption; pure queries of Overmind state are not actions.
2. `RequestApproval` and `FileAccessRequest` while paused: accepted and recorded (the Agent may already be waiting) but **no notification sound** is emitted and the event carries `paused: true`; items appear in the Approvals view marked "paused".
3. `DecideApproval` / `DecideAccessRequest(grant_run)` while paused: **desktop Owner only**; Telegram decisions are rejected with `perm.paused` (a paused system should not collect remote grants; resume happens at the computer). Denials are allowed from both channels.
4. `grant_permanent`, policy changes, override lifting: allowed on the desktop with proof (they are configuration, not execution); mounts are applied but nothing runs.
5. `ConsumeApproval` while paused: refused (`perm.paused`); the approval stays `approved` and its consume window (10 min) keeps running, so long pauses make approvals expire (conservative; the Agent re-requests after resume).
6. Expiry timers keep running during pause.
7. On resume (`pause.changed {paused:false}`): PERM does not auto-consume anything; WFRT resumes nodes which then call `CheckAccess` and `ConsumeApproval` normally.
8. Pause state unreadable: treated as paused (fail closed).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`PauseStateReader` port (PERM010), authority table (PERM008).

## 8. Architecture and code placement

`packages/domain/src/perm/pause-policy.ts` (table) and `packages/application/src/perm/pause-guard.ts` (calls the port). Use cases import the guard; no copies of the rules.

## 9. Security and safety

Prevents the pause being used to accumulate remote grants, and prevents approved-but-unexecuted actions from firing unexpectedly after a long pause. Fail closed on unreadable pause state.

## 10. Errors and edge cases

Pause toggled during an in-flight decision: the decision re-reads the state inside the transaction. Telegram `/pause` then Telegram approve: rejected `perm.paused`.

## 11. Acceptance criteria

- [ ] Rule table has a test per row.
- [ ] Telegram approve while paused: `perm.paused`; desktop approve works.
- [ ] Consume while paused refused; expiry continues.
- [ ] Unreadable pause state denies.
- [ ] No sound emitted for requests filed during pause.

## 12. Test plan

Table tests; use case tests with a fake `PauseStateReader`. `pnpm vitest run packages/domain/src/perm/pause-policy packages/application/src/perm/pause-guard`.

## 13. Parallelization notes

Small; can land with or after PERM014/016. Coordinate with PAUSE author.

## 14. Open questions and assumptions

- OPEN for the Owner: may Telegram approvals be accepted while paused? Default: no. Should decided-but-unconsumed approvals survive a pause? Default: they expire normally.
