---
id: OVE_WFRT053
title: "Define RunBranchControl: pause and resume a single Run branch"
area: WFRT
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_PAUSE005, OVE_PERM020, OVE_WFRT006, OVE_WFRT009, OVE_WFRT052]
soft_depends_on: []
provides: ["port:RunBranchControl", "usecase:PauseRunBranch", "usecase:ResumeRunBranch"]
needs: ["port:RunExecutor", "port:UnitOfWork", "usecase:AppendAudit", "port:PauseGate"]
owns: ["packages/application/src/ports/RunBranchControl.ts", "packages/application/src/wfrt/branch-control/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12"]
adr_refs: [23]
---

# OVE_WFRT053: Define RunBranchControl: pause and resume a single Run branch

## 1. Summary

Defines the `RunBranchControl` port and the use cases that pause and resume one branch (a token path) of a Run while the rest continues. Discussions started by Chief use it to hold a branch until the Owner approves an outcome.

## 2. Context

Chief-initiated Discussions pause the affected branch, notify the Owner and wait (OVE_DISC008, OVE_DISC012, OVE_CHIEF013). The events `run.branch.paused` and `run.branch.resumed` are defined by OVE_WFRT009; no task owned the command side.

## 3. Scope (in)

- `pauseBranch({ runId, branchId, reason, actor })` and `resumeBranch({ runId, branchId, actor })` returning `Result<BranchState>`.
- Use cases `PauseRunBranch` and `ResumeRunBranch` appending the OVE_WFRT009 events and signalling `RunExecutor`.
- Fake for consumers.

## 4. Out of scope

- Whole-Run pause: OVE_WFRT052. Global Pause: OVE_PAUSE area.
- Which branch to pause (Discussion binding): OVE_DISC008.

## 5. Detailed requirements

1. A branch is identified by `branchId` from the token path (OVE_WFRT006); unknown branch -> `Err(run.branch_not_found)`.
2. Pausing an already paused branch is idempotent and returns the existing state; resuming a branch not paused returns `Err(run.branch_not_paused)`.
3. A branch paused by a Discussion records `reason: { kind: "discussion", id }`; only the same reason owner or the Owner may resume it (checked through `Actor`).
4. Resume is refused while Global Pause or the Workspace pause is active (`PauseGate`).
5. Terminal Runs (succeeded, failed, cancelled) reject both commands with `409 invalid_transition`.
6. Both commands emit audit events and use one `UnitOfWork` with the outbox.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `RunExecutor` (OVE_WFRT052), events (OVE_WFRT009), `Actor` (OVE_PERM008), `PauseGate` (OVE_PAUSE005).

## 8. Architecture and code placement

Layer: port and use cases in application; the runtime implements `RunExecutor`. Depends on abstractions only (DIP).

## 9. Security and safety

- Only Owner, Chief or the reason owner may resume: wrong Actor -> `Err(forbidden)` and an audit denial.
- A branch pause never widens permissions or bypasses Approvals; paused nodes keep their granted permissions unchanged.
- Fail closed: if the Run state cannot be read the command fails and nothing is signalled.

## 10. Errors and edge cases

- Race: pause and finish at the same time -> the state machine decides; loser gets `invalid_transition`.
- Branch finished while pausing -> `Err(run.branch_not_found)`.
- Executor signal failure -> events are kept, command returns `Err(run.signal_failed)` and recovery retries.

## 11. Acceptance criteria

- [ ] Given a running branch, when paused twice, then one event.
- [ ] Given a Discussion-owned pause, when an unrelated Agent resumes, then forbidden.
- [ ] Given a terminal Run, then both commands return invalid_transition.
- [ ] Given Global Pause, resume is refused.

## 12. Test plan

- Unit tests table-driven over states; fake executor; negative actor tests. `pnpm --filter @overmind/application test`.

## 13. Parallelization notes

Parallel with OVE_WFRT054 and the Discussion tasks once the port exists; consumers use the fake. New files only.

## 14. Open questions and assumptions

- ASSUMPTION: resume by Owner is always allowed except under pause.
