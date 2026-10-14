---
id: OVE_DISC008
title: "Let Chief start a Discussion: pause the Run branch, notify the Owner, wait"
area: DISC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DISC006, OVE_DISC007, OVE_NOTIF004, OVE_PAUSE005, OVE_PERM008, OVE_PERM020, OVE_WFRT053]
soft_depends_on: []
provides: ["usecase:discussion.start-by-chief", "usecase:StartDiscussion"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:RunBranchControl", "port:NotificationPublisher", "port:AgentDirectory", "port:PauseGate"]
owns: ["packages/application/src/discussion/start-by-chief/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 12, 23]
---

# OVE_DISC008: Let Chief start a Discussion: pause the Run branch, notify the Owner, wait

## 1. Summary

Implement Chief-initiated Discussions: Chief decides that something must be discussed, the affected Run or branch is paused, the Owner is notified (with the reason), and the work waits for the Owner's decision while other Runs and Workspaces continue.

## 2. Context

SPEC 6 and ADR 0015: when Chief decides something needs discussing it pauses that Run or branch, notifies the Owner and waits; the rest keeps working. SPEC 12 lists "Dyskusja rozpoczęta przez Chiefa" among notifications. Mock: banner `Chief rozpoczął tę Dyskusję sam, bo Dokumentacja nie mówi, czym płacą goście. To pytanie „co”, więc wynik zatwierdzasz Ty.`, header `Run #14 wstrzymany w gałęzi „Płatności”, reszta pracuje`, list label `rozpoczął Chief`, dashboard notification `Chief zaczął Dyskusję o płatnościach · Czeka na Twój głos`.

## 3. Scope (in)

- `startByChief` use case, branch pause and resume contract, Owner notification, rate limiting of Chief-started Discussions, resume after the outcome.

## 4. Out of scope

- Deciding WHEN Chief starts one: CHIEF. Notification delivery and sounds: NOTIF/TG. Outcome approval: DISC012.

## 5. Detailed requirements

1. **Input** `{ workspaceId, runId?, branchId?, title, agenda, question: 'how'|'what', options?, participantAgentIds[], reason: string 1..300 (shown to the Owner), maxRounds? }`; actor must be `chief`; Owner, system and agents are refused (`disc.owner_input_forbidden`/`gateway.forbidden`, audited).
2. **Pause semantics:** if `runId` is given, call `RunBranchControl.pauseBranch(runId, branchId, { reason: { kind: 'discussion', discussionId } })` BEFORE the Discussion starts; the branch resumes only when the Discussion reaches a terminal state AND (when `ownerApprovalRequired`) the Owner approved the outcome, or escalation was resolved. `runControl = { paused: true, branchId }` is persisted. If pausing fails the Discussion is not started (`disc.invalid_state`), Chief is told; no half state.
3. **Owner notification:** `NotificationPublisher.publish({ kind: 'discussion_started_by_chief', workspaceId, discussionId, title, reasonPreview <= 160, needsOwner: true })`, once per Discussion (idempotent by discussion id). Telegram delivery reuses the same notification (summary only).
4. **Owner waiting:** `ownerApprovalRequired = true` for every Chief-started Discussion (ASSUMPTION: "waits for the Owner's decision"); the agents' turns run immediately so the Owner can watch live (mock status `na żywo`), but the outcome is applied only after `Zatwierdź wynik` (DISC012). Setting `startMode: 'wait_for_owner_join'` (Discussion stays `scheduled` until the Owner opens it) is NOT in MVP.
5. **Limits:** at most 2 Chief-started Discussions open per Workspace and 6 per Run (ASSUMPTION) to prevent Chief loops that stall work; exceeding returns `disc.rate_limited` and Chief must decide itself or escalate.
6. **Branch release:** a subscriber on `discussion.outcome.approved|rejected`, `discussion.escalated`, `discussion.cancelled`, `discussion.failed` calls `resumeBranch` exactly once (idempotent by discussion id); on `cancelled` by the Owner the branch resumes with a `system_notice`; on `failed` the Run branch stays paused and an Escalation is raised (DISC010).
7. **Run cancelled meanwhile:** subscriber on `run.cancelled` cancels open Discussions of that Run.
8. **Documentation scope:** if `question` is `what`, Chief may include the Documentation gap reference (`docRef` of the missing place) in the agenda text for the participants; it is data.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`createDiscussion()` from DISC007; `RunBranchControl` (WFRT); `NotificationPublisher` (NOTIF); DISC006 runner.

## 8. Architecture and code placement

`packages/application/src/discussion/start-by-chief/{start-by-chief.ts,branch-release.subscriber.ts,limits.ts}`. Depends on ports.

## 9. Security and safety

Chief is a model and can be prompt-injected: Chief-started Discussions are bounded (rate limits), cannot be started by agents, always require Owner approval of the outcome, and pausing is the only effect on the Run (no permission or configuration change). The notification reason is untrusted text: length capped, rendered as text, truncated for Telegram. Branch resume is idempotent and only triggered by Discussion lifecycle events from the engine.

## 10. Errors and edge cases

- Chief starts a Discussion for a Run already paused by the Owner: the branch stays paused after the Discussion (resume only if this Discussion owned the pause: pause reasons are a set).
- Owner never responds: Discussion waits in `awaiting_outcome_approval`; no timeout in MVP; reminder notification after 24 h (ASSUMPTION).
- Notification service down: Discussion proceeds, `warn` logged, retried by NOTIF.
- Two Chief starts for the same branch: second returns `disc.already_open`.

## 11. Acceptance criteria

- [ ] Chief start pauses the branch, creates a Discussion with `ownerApprovalRequired: true`, notifies once.
- [ ] Non-chief actors are refused and audited.
- [ ] Other Runs and branches are unaffected.
- [ ] The branch resumes exactly once after approval, rejection, escalation or cancellation.
- [ ] Pause failure prevents the start.
- [ ] Rate limits enforced; a Chief loop cannot open more than the limit.

## 12. Test plan

- `start-by-chief.test.ts`, `branch-release.subscriber.test.ts` (duplicate and out-of-order events), `limits.test.ts`. Commands: `pnpm vitest run packages/application/src/discussion/start-by-chief`.

## 13. Parallelization notes

Parallel with DISC009/010. CHIEF planning consumes `usecase:discussion.start-by-chief`.

## 14. Open questions and assumptions

- ASSUMPTION: reminder after 24 h; no auto-timeout.
- Open: should the Owner be able to decline the Discussion entirely and decide directly? Default: yes through an Owner vote immediately (DISC009).
