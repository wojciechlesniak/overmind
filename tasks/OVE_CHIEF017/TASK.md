---
id: OVE_CHIEF017
title: Handle direct Owner commands by updating the plan and the Board
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD003, OVE_BOARD008, OVE_CHAT009, OVE_CHIEF003, OVE_CHIEF006, OVE_CHIEF012, OVE_CHIEF015]
soft_depends_on: [OVE_CHIEF016, OVE_CHIEF015]
provides: ["usecase:HandleDirectCommand", "handler:chief.update_board"]
needs: ["usecase:UpdateTask", "port:BoardReader", "usecase:PostSystemMessage", "usecase:RaiseEscalation", "usecase:RecordChiefDecision"]
owns: ["packages/application/src/chief/direct-command/**"]
reads: ["packages/application/src/chat/direct-command/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 5", "SPECIFICATION 16.11", "SPECIFICATION 17"]
adr_refs: [23, 16]
---

# OVE_CHIEF017: Handle direct Owner commands by updating the plan and the Board

## 1. Summary

After the Owner gives an Agent a direct command (which the Agent already received), Chief reads it, updates its plan and moves or edits Board Tasks accordingly, and tells the Agent's thread what changed. This keeps Chief's plan from drifting away from what the Owner ordered (criterion 11).

## 2. Context

ADR 0023: the Owner's direct command is binding; the Agent informs Chief at once and Chief updates the plan and the Board. SPEC 17 lists "rozjazd planu Chiefa z poleceniami wydanymi Agentom bezpośrednio" as a risk, so Overmind itself relays the command (CHAT010) instead of relying on the Agent. Mock: "Skip performance tests in this iteration" leads to the chip "Chief updated plan: Load tests -> Deferred".

## 3. Scope (in)

- `HandleDirectCommand({ messageId, agentId, workspaceId })` invoked by CHAT010 after a command was allowed and delivered.
- A Chief model turn dedicated to "interpret this binding command" producing typed `update_board` and `record_decision` actions.
- Board updates limited to the Task(s) the command touches; result reported to the Agent conversation as `plan_update` chips and to the Chief conversation.

## 4. Out of scope

- Gate before delivery: CHIEF016/CHAT010. Re-planning from Documentation: CHIEF008. Executing the work: the Agent.

## 5. Detailed requirements

1. Idempotent by `messageId`. The command text is read from chat history (not passed in the event) and treated as `owner` trust (or `owner_remote` for Telegram).
2. A turn (CHIEF006 trigger `direct_command`, priority above agent reports) is run with the Agent's current Tasks, the Board lane state of that Agent and the Rules in context. Allowed outputs: `update_board`, `record_decision`, `reply`, `escalate`. `delegate`, `plan_from_docs` and others are dropped for this trigger type (principle of least authority, enforced by an allow-list in the handler registry per trigger type).
3. `update_board` limits: only Tasks assigned to this Agent or created by the plan in the same Workspace; allowed changes: lane move (to `Deferred`/`Done`-like lanes defined by the Workflow Board, never to lanes that skip Review/Quality Gate), status note, priority; deletion is not allowed (move to Deferred/Cancelled instead, history kept).
4. Binding semantics: Chief MUST apply the Owner's intent when it passes the Rules; Chief cannot decline a command the gate allowed. If the effect is impossible (Task unknown, lane missing) Chief posts a clarification in the Chief conversation and keeps the Task unchanged, then raises no error; if the effect needs the Owner (scope change) it escalates.
5. A command that reduces scope (skip a feature) is allowed only if the gate said `allow`; the change is recorded as a Decision of kind `owner_command` with `decidedBy: owner` (not an autonomous Chief ruling) so history shows who decided (`RecordChiefDecision` accepts `source: 'owner_command'`, no autonomy check needed because the Owner decided).
6. Quality Gate evidence rules are untouched: deferring tests as Owner command moves the Task, but required evidence for other Tasks remains.
7. Feedback: `PostSystemMessage('plan_update', { taskId, fromLane, toLane })` into the Agent conversation (chip) and a short Chief message in the Chief conversation ("QA <- Owner: skip performance tests. I moved Task X to Deferred.") built from templates.
8. Failure handling: if the turn fails (model down) 3 retries with backoff, then Escalation `plan_drift` so the Owner sees the command is delivered but the plan is not updated. The command is never undone.
9. Telegram-origin commands behave identically; `update_board` effects are non-permanent by nature.
10. Audit `chief.direct_command.applied` with Task ids and the lanes.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

CHIEF006 dispatcher with per-trigger allow-list, BOARD `UpdateTask`, `PostSystemMessage` (CHAT009), `RecordChiefDecision` (CHIEF012), `RaiseEscalation` (CHIEF015).

## 8. Architecture and code placement

`packages/application/src/chief/direct-command/{handle-direct-command.usecase.ts,allowlist.ts}`; the per-trigger allow-list is a small map file in this task's folder consumed by the dispatcher (the dispatcher exposes `registerTriggerPolicy`, no edit to CHIEF006 files).

## 9. Security and safety

Direct commands are a way to change the plan, so the Board effect is bounded (lanes, own Tasks, no deletion, no skipping gates). The allow-list per trigger prevents a command from triggering delegation or workflow starts. Command text is the Owner's but may embed pasted third-party content; outputs are typed and re-validated. Audit records link command message to Board change.

## 10. Errors and edge cases

- Command refers to a Task not found: clarification, no change.
- Two commands quickly: processed in order; second sees updated Board.
- Command only conversational ("thanks"): `reply` only, no Board change.
- Board write conflict: retried once with fresh state.
- Agent archived after delivery: Board update still applied if Tasks exist.

## 11. Acceptance criteria

- [ ] "Skip performance tests in this iteration" moves the load-test Task to Deferred and posts the chip and the Chief note (criterion 11 e2e with fake CLI and fake Board).
- [ ] The Decision of kind `owner_command` is recorded with `decidedBy: owner`.
- [ ] A model output with `delegate` for this trigger is dropped.
- [ ] Moving a Task past Review without evidence is refused.
- [ ] Turn failure after retries raises a `plan_drift` Escalation and the command remains delivered.
- [ ] Idempotent: replay of the relay creates no second change.

## 12. Test plan

Unit tests with `FakeChiefModel`; scenario test through CHAT010 -> CHIEF017 with fake CLI; allow-list tests. Command: `pnpm vitest run packages/application/src/chief/direct-command`.

## 13. Parallelization notes

Parallel with CHIEF016. Joint e2e with CHAT010 in CHIEF020. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Board lane names for "deferred" come from the Workflow's lane definition; if absent Chief uses a Board status `deferred` (BOARD field).
- ASSUMPTION: `RecordChiefDecision` accepts `source: 'owner_command'`.
