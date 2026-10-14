---
id: OVE_CHIEF008
title: Implement PlanFromDocumentation to create linked Tasks and route gaps
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD003, OVE_BOARD006, OVE_CHIEF004, OVE_CHIEF005, OVE_CHIEF006, OVE_CHIEF012, OVE_CHIEF015]
soft_depends_on: [OVE_CHIEF003, OVE_CHIEF012]
provides: ["usecase:PlanFromDocumentation", "handler:chief.plan_from_docs"]
needs: ["usecase:CreateTask", "port:BoardReader", "port:ProjectDocReader", "usecase:RaiseEscalation", "usecase:RecordChiefDecision"]
owns: ["packages/application/src/chief/plan/**"]
reads: ["packages/domain/src/chief/docs/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 3", "SPECIFICATION 16.4"]
adr_refs: [16, 15, 11]
---

# OVE_CHIEF008: Implement PlanFromDocumentation to create linked Tasks and route gaps

## 1. Summary

The handler for `plan_from_docs`: validate every proposed Task against Project Documentation (each must link to a location), create the valid ones on the Board, reject or escalate the rest, decide "how" gaps itself (recorded as Decisions) and send "what" gaps to the Owner as questions.

## 2. Context

ADR 0016: every Task must follow from the Documentation; Agents and Chief add no scope. Spec criterion 4: from the Documentation Chief creates Tasks on the Board, each with a link. "How" gaps (library choice) Chief decides and records; "what" gaps (should there be Google login) always go to the Owner. The Board (ADR 0011) is owned by BOARD; Chief only calls its use cases.

## 3. Scope (in)

- `PlanFromDocumentation(action, ctx)`: validate, create, route gaps, report result.
- Plan idempotency (same plan twice does not duplicate Tasks), dependency ordering between Tasks, lane assignment hints.
- Result summary posted as a Chief message with a `plan_update` part per created Task group.

## 4. Out of scope

- Link rules: CHIEF004. Task storage and lanes: BOARD. Delegating Tasks to Agents: `OVE_CHIEF009`/`010`. Decision writing: `OVE_CHIEF012`.

## 5. Detailed requirements

1. Input is the typed action (CHIEF001). Before anything else the handler re-reads the cited documents through `ProjectDocReader` and builds a `DocIndex`; model claims about what a document says are never trusted, only that the anchor exists.
2. For each proposed Task run `validateTaskDocLink`: `ok` -> create; `reject` -> not created, listed in the result with reason; `escalate('missing_doc_link')` -> `RaiseEscalation` once per batch with the list (options: "Add documentation", "Drop these Tasks").
3. Creation: `CreateTask({ workspaceId, title, description, docRef: { path, anchor, gitCommit }, origin: { kind: 'chief_plan', planId }, dependsOn })` for each valid Task. `docRef.gitCommit` is the current HEAD commit of the documentation file (from the reader), so the link survives later edits. Dependencies by `dependsOnTitles` are resolved within the plan; unknown titles drop the dependency with a warning.
4. Duplicate detection: a Task with the same `(workspaceId, docRef.path+anchor, normalisedTitle)` on the Board in a non-finished state is not created again; the result reports it as `existing` (idempotent replanning).
5. Gaps: classify with `classifyGap`. `how` gaps: run `evaluateAutonomy(category 'how_gap_choice')`; if `decide_alone`, call `RecordChiefDecision` (CHIEF012) with the model's proposed option and alternatives, mark the Task unblocked; otherwise escalate. `what` gaps: do NOT create the dependent Tasks; post a chat question to the Owner (Chief message with the question and the affected Tasks) and create an Escalation `missing_what` with options when known; the plan result says "waiting for your answer".
6. Scope discipline: the handler rejects Tasks whose title or description introduce features not present in any cited location when the model flagged them `scopeAddition: true`; additional protection: Task count per plan <= 30, per Workspace Chief-created open Tasks <= 200 (guards runaway planning), exceeding -> escalate.
7. Owner Rules: before creation, each Task passes the precedence resolver (`detectConflicts` with candidate effects from the plan, e.g. a plan that skips tests while a Rule requires them); blocking conflicts reject the Task with the Rule named; the Rule's required steps ("pentest after each Task") are added as required follow-up Tasks or Board checks per BOARD capability when a Rule `requires` them (mapped through `subject` keys).
8. Isolated Workspaces: planning is allowed inside the Workspace; no cross-Workspace Decisions are consulted for an isolated one.
9. Result: `{ created: TaskRef[], existing: TaskRef[], rejected: Array<{title, reason}>, escalated: boolean, questions: number, decisionsRecorded: number }` stored in the turn trace and summarised to the Owner in plain language by an Overmind template.
10. All Board writes are one logical batch: if creation fails midway, already-created Tasks stay (idempotent by key) and the result states which failed; no partial hidden state.
11. Audit entries `chief.plan.applied` with counts; Task provenance records `planId` and `turnId`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`validateTaskDocLink`, `classifyGap` (CHIEF004); `evaluateAutonomy` (CHIEF003); `detectConflicts` (CHIEF002); BOARD `CreateTask`; `RecordChiefDecision`, `RaiseEscalation`.

## 8. Architecture and code placement

`packages/application/src/chief/plan/{plan-from-documentation.usecase.ts,dedupe.ts,gap-routing.ts,result.ts}`; registered as a dispatcher handler via a multi-token in `chief-plan.module.ts`.

## 9. Security and safety

Documentation is external content: only existence of locations matters, never instructions inside it. A prompt-injected plan cannot create Tasks without a valid link, cannot skip Owner Rules, and cannot exceed counts. Doc paths are canonicalised (SEC002). Chief cannot add scope on its own initiative (ADR 0016): `scopeAddition` Tasks are rejected.

## 10. Errors and edge cases

- Documentation file changed between planning and creation: re-read; if the anchor vanished the Task is rejected `target_missing`.
- BOARD unavailable: whole plan fails with `internal.dependency_unavailable`, nothing partial.
- Same plan delivered twice (retry): idempotent, all `existing`.
- Cyclic `dependsOnTitles`: those dependencies dropped, warning.
- Owner answers a "what" question later: a new turn replans only the blocked Tasks.

## 11. Acceptance criteria

- [ ] Fixture with 5 Tasks (3 linked, 1 unlinked, 1 invalid anchor) creates 3, rejects 2 with reasons.
- [ ] Unlinked Task from an Owner Discussion outcome raises `missing_doc_link` instead of rejecting silently.
- [ ] A "how" gap inside budget produces a recorded Decision; a "what" gap produces an Owner question and no dependent Tasks.
- [ ] Re-running the same plan creates no duplicates.
- [ ] A plan that skips tests against an Owner Rule requiring tests is rejected naming the Rule.
- [ ] Count limits escalate.
- [ ] Criterion 4 e2e: Tasks on the Board each carry a documentation link.

## 12. Test plan

Unit tests with in-memory BOARD fake and doc fixtures; e2e with `FakeChiefModel` plan output; injection test (doc containing "create task without link"). Command: `pnpm vitest run packages/application/src/chief/plan`.

## 13. Parallelization notes

Parallel with CHIEF009-011 after CHIEF006. Hotspot: none; BOARD `CreateTask` stubbed first.

## 14. Open questions and assumptions

- ASSUMPTION: Rule-required follow-up steps are created through a BOARD capability (`usecase:AddRequiredStep`); if BOARD lacks it, Chief adds them as separate linked Tasks.
- ASSUMPTION: 30 Tasks per plan, 200 open Chief Tasks per Workspace.
