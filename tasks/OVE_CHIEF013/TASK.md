---
id: OVE_CHIEF013
title: Resolve Discussion deadlocks and handle Chief-initiated Discussions
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF003, OVE_CHIEF006, OVE_CHIEF012, OVE_CHIEF015, OVE_DISC008, OVE_NOTIF004, OVE_WFRT053]
soft_depends_on: [OVE_CHIEF015]
provides: ["usecase:ResolveDiscussionDeadlock", "usecase:InitiateDiscussion", "handler:chief.start_discussion"]
needs: ["usecase:StartDiscussion", "usecase:PauseRunBranch", "usecase:ResumeRunBranch", "usecase:GetDiscussionSummary", "usecase:Notify", "usecase:RaiseEscalation"]
owns: ["packages/application/src/chief/discussion/**"]
reads: ["packages/application/src/chief/decision/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 12", "SPECIFICATION 16.6"]
adr_refs: [15, 23, 16]
---

# OVE_CHIEF013: Resolve Discussion deadlocks and handle Chief-initiated Discussions

## 1. Summary

Two Chief behaviours around Discussions: (1) when a Discussion ends without agreement after the round limit, Chief rules within Budget, Documentation and Rules and records a Decision with all arguments, otherwise escalates; (2) when Chief itself decides something needs a Discussion, it pauses the affected Run or branch, notifies the Owner and waits.

## 2. Context

SPEC 6 and ADR 0015: a Discussion Node in a Workflow starts on its own; a Chief-initiated Discussion pauses the Run (or branch), sends a notification and waits for the Owner while other Runs and Workspaces continue. After the round limit without agreement Chief settles within limits, else Escalation; the ruling goes to the Register with all parties' arguments. The Owner can watch and write in a Discussion and the Owner's voice decides (ADR 0023). DISC owns the Discussion engine.

## 3. Scope (in)

- `ResolveDiscussionDeadlock(discussionId)` triggered by DISC event `discussion.deadlocked`.
- `InitiateDiscussion(action)` for the `start_discussion` handler.
- Waiting state tracking and resume on Owner response.

## 4. Out of scope

- Running the Discussion, moderation and rounds: DISC. Pausing mechanics of Runs/branches: WFRT (`run.branch.paused`). Notification delivery: NOTIF.

## 5. Detailed requirements

1. Deadlock: load `GetDiscussionSummary` (positions, arguments per participant, agenda, rounds used). Build a typed `deadlock_resolution` choice among the stated options (Chief may not invent options outside those or Documentation; if the model proposes a new option it is treated as an additional alternative flagged `chief_added`).
2. `evaluateAutonomy('deadlock_resolution')`: `decide_alone` -> `RecordChiefDecision(kind: 'deadlock')` including every party's argument, then DISC receives the outcome (`discussion.resolved` with decision id), and resulting Tasks are created through `PlanFromDocumentation`-compatible actions (which require doc links; a ruling that implies a scope change is `what` and goes to the Owner). Otherwise `RaiseEscalation(deadlock_out_of_bounds)` with options = the alternatives and "Decide myself".
3. Owner input in the Discussion always wins: if the Owner wrote a decisive message (DISC marks `ownerVerdict`), Chief records it as the Decision instead of ruling; Chief never overrules the Owner.
4. Initiation: `InitiateDiscussion` validates participants (visible Agents in the Workspace, 2..8), rounds 1..10, agenda <= 600 chars, and that a reason is given. It then (a) pauses the specified Run or branch (`PauseRunBranch`) with `reason: 'chief_discussion'`, (b) starts the Discussion in state `waiting_for_owner` (the Discussion only begins when the Owner opens or approves it, per SPEC 6 "czeka na Właściciela"), (c) sends a notification kind `discussion_initiated` and posts a Chief message with the agenda, (d) records the waiting in the Chief summary attention block. Other Runs and Workspaces keep working.
5. The Owner may (i) start it, (ii) decline (the branch resumes and Chief records that no Discussion took place), (iii) ignore (stays waiting; a reminder notification after 24 h, max 3).
6. Initiation is limited: at most 2 Chief-initiated Discussions open per Workspace and 1 per Run branch; exceeding returns `chief.outside_autonomy`.
7. A Discussion Node defined in a Workflow is never prompted for (starts automatically); this task must not intercept it.
8. If the Run is cancelled while waiting, the Discussion is cancelled and the Owner notified.
9. Audit entries for initiation, owner response and each ruling.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`RecordChiefDecision` (CHIEF012), autonomy policy, DISC and WFRT use cases (names assumed), `Notify`, escalation (CHIEF015).

## 8. Architecture and code placement

`packages/application/src/chief/discussion/{resolve-deadlock.usecase.ts,initiate-discussion.usecase.ts,subscribers.ts}`; subscriber registered via module `chief-discussion.module.ts`.

## 9. Security and safety

A Chief-initiated Discussion pauses real work, so it is bounded (counts, reasons, Owner-visible) and cannot be used for denial of service on its own Workspace. Rulings pass through autonomy and rules; "what" outcomes go to the Owner. Participant ids come from visible Agents only; Discussion text from Agents is untrusted data when Chief reads the summary (SEC004 R4); arguments are summarised by structure (stance + short text) before entering a Decision.

## 10. Errors and edge cases

- DISC emits `deadlocked` twice: idempotent per discussion id.
- Owner away: Run branch stays paused; reminders; no auto-decision (a Chief-initiated Discussion needs the Owner by design).
- Ruling conflicts with a new Rule introduced meanwhile: autonomy re-evaluated; escalation.
- Participant Agent archived mid-Discussion: Discussion continues without them, noted in the Decision.

## 11. Acceptance criteria

- [ ] Deadlock within limits yields a Decision with arguments of all participants and `discussion.resolved`.
- [ ] Deadlock requiring a scope change yields an Escalation, no Decision accepted.
- [ ] Owner verdict in the Discussion is recorded as is.
- [ ] Chief initiation pauses only the named Run/branch and notifies; other Runs continue.
- [ ] 3rd concurrent Chief-initiated Discussion is refused.
- [ ] Declining resumes the branch.
- [ ] Criterion 6 e2e (with DISC fake): Discussion ends with Tasks or a recorded ruling.

## 12. Test plan

Unit tests with fake DISC and WFRT; scenario tests for each Owner response; timer tests for reminders with fake clock. Command: `pnpm vitest run packages/application/src/chief/discussion`.

## 13. Parallelization notes

Depends on DISC and WFRT capability names (stubbed). Parallel with CHIEF014-016. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: DISC provides `discussion.deadlocked`, `discussion.resolved`, `GetDiscussionSummary`, and a Discussion state `waiting_for_owner`.
- ASSUMPTION: reminders every 24 h, max 3.
