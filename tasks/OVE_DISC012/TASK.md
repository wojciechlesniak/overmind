---
id: OVE_DISC012
title: "Finalise a Discussion outcome: draft, Owner approval, Tasks and Decisions exactly once"
area: DISC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_BOARD006, OVE_BOARD007, OVE_DATA002, OVE_DEC005, OVE_DISC006, OVE_DISC009, OVE_NOTIF004, OVE_PERM008, OVE_PERM020, OVE_WFRT053]
soft_depends_on: ["OVE_DISC011"]
provides: ["usecase:discussion.draft-outcome", "usecase:discussion.approve-outcome", "usecase:discussion.reject-outcome", "event:discussion.outcome.approved"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "usecase:board.create-tasks-from-discussion", "usecase:decision.record", "port:DocRefVerifier", "port:RunBranchControl", "port:NotificationPublisher"]
owns: ["packages/application/src/discussion/outcome/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 11, 16, 8]
---

# OVE_DISC012: Finalise a Discussion outcome: draft, Owner approval, Tasks and Decisions exactly once

## 1. Summary

Turn a Discussion's conclusion into its required outcome: build and validate the outcome draft ("Szkic wyniku"), obtain Owner approval where required, then create the Decisions and the Board Tasks exactly once and release the paused Run branch. A Discussion cannot be concluded without an outcome.

## 2. Context

SPEC 6: a Discussion ends with a required outcome, usually Tasks and Decisions, not another Skill. SPEC 16 criterion 6: Discussion ends with Tasks. ADR 0016: Tasks must follow from Documentation; Agents add no scope. Mock right panel `Szkic wyniku`: `DECYZJA (PROPOZYCJA) Przelewy24 z formularzem hostowanym`, `ZADANIA PO ZATWIERDZENIU` with docRefs, buttons `Zatwierdź wynik` and `Zakończ teraz`. Sidebar summary after finishing: `4 rundy · 3 Decyzje · 5 Zadań`.

## 3. Scope (in)

- Outcome drafting from the moderator output and participants' proposals, validation, revision history, approval and rejection, creation of Decisions and Tasks with idempotency, completion event, branch release.

## 4. Out of scope

- Deadlock rulings: DISC011 (feeds this use case). Task and Decision creation internals: BOARD007 / DEC. Approval UI: DISCUI.

## 5. Detailed requirements

1. **Draft:** after consensus, Owner vote, Chief ruling or Owner decision the moderator turn produces `OutcomeDraft` (strict schema: summary, `selectedOptionKey`, `conditions`, `decisionDrafts` <= 5, `taskDrafts` <= 50). The engine merges participants' `proposedTasks`/`proposedDecisions` (from messages) by `draftKey`, de-duplicates, and does not try to judge scope by reading text; scope control is by docRef: every Task draft MUST verify via `DocRefVerifier` (BOARD006); unverifiable drafts are removed from the outcome and listed in `rejectedDrafts` with reason `doc_ref_*` (ADR 0016: no scope without Documentation). The conditions from consensus (union) are appended to relevant Task descriptions as data text.
2. **Validation** (`validateOutcomeCompleteness`, DISC002): at least one Decision or Task draft, else the moderator gets ONE repair turn (counts against limits); if still empty and no Owner vote -> Escalation `outcome_required` (never conclude without outcome).
3. **Revisions:** every draft/edit/approval/rejection is a new `discussion_outcome_revisions` row (append-only) with a `contentHash`; the Owner may edit drafts (`owner_edit`: change titles, drop drafts, change docRef (verified again), change selected option) through `usecase:discussion.edit-outcome`, exported here. Edits can only REMOVE or narrow drafts or modify text; adding a Task draft requires a docRef verification like any other.
4. **Approval policy:** `ownerApprovalRequired` (Chief-started, `what` questions, escalations, Owner `concludeNow`) -> status `awaiting_outcome_approval`; `approveOutcome` is desktop-owner only. Otherwise (`how` node-started with consensus, or Chief ruling within autonomy) the outcome is auto-approved by actor `system` on behalf of Chief with `approvedBy: { kind: 'chief' }` after validation; resolution is recorded.
5. **Approval effect (single transaction where possible, else ordered idempotent steps with keys):** (a) record the Decision drafts through `usecase:decision.record` with `sourceKey = 'discussion:<id>:<draftKey>'`, linking participants, skillsUsed (versions from the transcript), evidenceRefs (`discussion:<id>`), arguments of each side in `alternatives[].arguments`, `status 'accepted'`; (b) create Tasks through `usecase:board.create-tasks-from-discussion` passing the created `decisionId` (ASSUMPTION: the single selected Decision id is attached to every Task; per-Task linking would need an additive `decisionKey` on `TaskDraft`); (c) mark outcome revision `approval` and Discussion `concluded`; (d) publish `discussion.outcome.approved` then `discussion.concluded` with created ids; (e) release the branch (DISC008 subscriber). Each step is idempotent by key, so a crash after (a) and before (b) resumes without duplicates: the finaliser is a persisted state machine (`finalisation_state` in `run_control_json`: `decisions_done`, `tasks_done`).
6. **Rejection:** `rejectOutcome(reason)`: new revision `rejection`; status returns to `running` for at most ONE extra revision round (the moderator redrafts with the Owner's reason as trusted input) bounded by limits; second rejection -> the Owner is asked to decide directly (Escalation to the Owner with the drafts).
7. **Counts for UI:** `DiscussionSummary.decisionCount/taskCount` updated from the created ids.
8. **Notification:** `discussion_concluded` notification with counts (Owner, Telegram summary).
9. **Nothing is created before approval where approval is required**: the Board and Register show nothing until `Zatwierdź wynik` (the mock label "zadania po zatwierdzeniu").

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`validateOutcomeCompleteness` (DISC002), `DocRefVerifier` (BOARD006), `usecase:board.create-tasks-from-discussion` (BOARD007), `usecase:decision.record` (DEC), outbox, `RunBranchControl`.

## 8. Architecture and code placement

`packages/application/src/discussion/outcome/{draft-outcome.ts,merge-proposals.ts,approve-outcome.ts,reject-outcome.ts,edit-outcome.ts,finalisation-state.ts}`. Depends on ports and use-case capabilities only.

## 9. Security and safety

The outcome is where Agent output becomes durable state, so: nothing is created before the required approval; Task drafts need verified docRefs (no scope from the Agents' own initiative); the Owner approval endpoint accepts only the authenticated desktop Owner; finalisation steps are idempotent (no duplicated Tasks/Decisions after crash, SPEC 17); edits can only narrow content and every revision is hashed and append-only; the approval itself is audited with the content hash so the Owner approves exactly what is stored (TOCTOU protection: `approve(discussionId, revision, contentHash)` fails if the latest revision changed since the UI showed it).

## 10. Errors and edge cases

- Approval with a stale hash: `disc.outcome_invalid` and the UI reloads.
- DEC or BOARD unavailable mid-finalisation: state machine retries later; Discussion stays `awaiting_outcome_approval`/finalising, Owner sees a pending status; no partial duplicates.
- All Task drafts lose their docRef: outcome only has Decisions (allowed) or is empty -> repair/Escalation.
- Owner edits to remove everything: refused (`disc.outcome_required`).

## 11. Acceptance criteria

- [ ] A Discussion cannot reach `concluded` without >= 1 Decision or Task draft.
- [ ] Drafts with unverifiable docRef are removed and listed with a reason.
- [ ] No Task or Decision exists before approval when approval is required.
- [ ] After approval, Decisions and Tasks exist exactly once even when the process crashes between steps and retries.
- [ ] Approval binds to the revision hash; a changed revision rejects the approval.
- [ ] Rejection allows one redraft; second rejection escalates to the Owner.
- [ ] Created Decisions carry each side's arguments and skills with versions.

## 12. Test plan

- `draft-outcome.test.ts`, `merge-proposals.test.ts`, `approve-outcome.test.ts` (crash at each step with fake UnitOfWork), `reject-outcome.test.ts`, `edit-outcome.test.ts`. Commands: `pnpm vitest run packages/application/src/discussion/outcome`.

## 13. Parallelization notes

Depends on BOARD007 and DEC capabilities; use fakes. DISC015 includes the end-to-end scenario.

## 14. Open questions and assumptions

- ASSUMPTION: all Tasks of an outcome link to the single selected Decision (or the first Decision draft); multi-decision linking can be added through an additive `decisionKey` later.
- ASSUMPTION: one redraft round after a rejection.
