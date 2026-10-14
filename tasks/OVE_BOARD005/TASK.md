---
id: OVE_BOARD005
title: "Provision the Workspace Board and reconcile Lanes with the Workflow Version"
area: BOARD
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_BOARD003, OVE_DATA002, OVE_PERM020]
soft_depends_on: ["OVE_BOARD004"]
provides: ["usecase:board.provision", "usecase:board.reconcile-lanes", "port:WorkflowLaneSourceConsumer"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:WorkflowLaneSource", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "port:AgentDirectory"]
owns: ["packages/application/src/board/provision/**", "packages/testing/src/fakes/FakeWorkflowLaneSource.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 16]
---

# OVE_BOARD005: Provision the Workspace Board and reconcile Lanes with the Workflow Version

## 1. Summary

Create the single Board of a Workspace with sensible default Lanes, and keep its Lanes in sync with the Workflow Version that defines them (TOR Nodes), without losing Tasks when the Workflow changes. Provides the use cases that BOARD010 (Node binding) and the WFRT area rely on.

## 2. Context

SPEC 6: each Workspace has one Board; the Workflow defines its Lanes (for example Build, QA, Review) with an assigned Agent or Team. The mock header says `Tory z Workflow „board” v3`. SPEC 3 distinguishes two Workflow kinds around the Board: `collect` (gathers verified reports and feeds Tasks to the Board) and `board` (moves Tasks through Lanes). A Workflow edit creates a new Version (ADR 0002); a Board outlives Versions, so lanes need a stable identity (`key`) and a reconciliation rule. Until a `board` Workflow exists the Chief still needs somewhere to put Tasks.

## 3. Scope (in)

- `provisionBoard(workspaceId, actor)` creating the Board plus the default Lanes.
- `reconcileLanes(workspaceId, workflowRef, laneSpecs)` applying a Workflow Version's lane list.
- Handling of lane rename, reorder, add, archive and WIP/assignee changes; emitting `board.lanes_changed`.
- Subscriber that calls `reconcileLanes` when WFRT publishes a published-version event for a `board` Workflow of that Workspace.

## 4. Out of scope

- Binding Tasks to Node execution: OVE_BOARD010. Workflow validation of TOR nodes and `WorkflowLaneSource` implementation: WFRT.
- Visibility rules of Workflows (ADR 0028): VIS/WFRT; a Board belongs to one Workspace regardless.

## 5. Detailed requirements

1. **Default lanes** (ASSUMPTION, used until a `board` Workflow is attached): `todo` ("To do", category todo, hint `Chief assigns when a slot frees up`), `doing` ("In progress", doing), `review` ("Review", review), `done` ("Done", done). They carry no assignee and no WIP limit. Names are i18n keys resolved by the UI, stored as plain English defaults.
2. **provisionBoard** is idempotent: if a Board exists it returns it (`Result<Board>`); otherwise creates it in one `UnitOfWork` transaction with the default lanes and writes `board.lanes_changed` (outbox). Called by the Workspace creation flow (WSPACE/DATA) via capability `usecase:board.provision`; also lazily by `getBoardView` if somehow missing (self-heal, logged `warn`).
3. **LaneSpec input** (from `WorkflowLaneSource.listLanes(workflowVersionId)`): `{ key, name, position, category, assignee: {kind:'agent', agentId}|{kind:'team', teamId}|null, wipLimit?, nodeId, hint? }`. The Workflow validator (WFRT) guarantees unique `key`; this task re-validates and rejects duplicates (`validation.invalid_input`).
4. **Reconciliation algorithm** (single transaction, deterministic):
   - match existing lanes by `key`; for matches update `name`, `position`, `category`, `assignee`, `wipLimit`, `workflowNodeId`, `hint`.
   - new keys: insert as active lanes.
   - existing keys missing from the new spec: if the lane has no non-terminal tasks -> set `archived = true` (kept for history, hidden from view); if it has tasks -> keep it active, flag `workflowNodeId = null`, and publish an `Escalation` request through `usecase:escalation.raise` with reason `lane_removed_with_tasks` (Chief decides where to move them: no silent mass-move). Returns `board.lane_not_empty` in the result's warnings list but does not fail the whole reconcile.
   - `category` change on a lane containing tasks is applied (it only changes aggregation) and noted in the event.
   - the default lanes created by provisioning are matched to Workflow lanes by key if equal, otherwise archived when empty.
   - `Board.workflowId`, `workflowVersionId`, `laneSourceLabel` (`Workflow "board" v3`) updated.
5. **Assignee validation:** each `assignee.agentId` must exist and be visible in the Workspace (`AgentDirectory.isUsableIn(agentId, workspaceId)`, which enforces ADR 0028: a private Agent of another Workspace is invalid); invalid assignees fail the whole reconcile with `validation.invalid_input` listing lane keys (the Workflow Version should not have been publishable; defence in depth).
6. **Concurrency:** reconcile takes the Board row version; a concurrent reconcile with an older Workflow version number is rejected (`board.version_conflict`) so Versions cannot be applied out of order. Applying the same Version twice is a no-op.
7. **Events:** one `board.lanes_changed` per reconcile with `added[]`, `renamed[]`, `archived[]`; plus an audit record `board.lanes_reconciled` (actor `system`, ids only).
8. **Collect vs board semantics.** The Board knows nothing about which Workflow kind feeds it: `collect` Workflows call `usecase:board.create-tasks-from-plan`/`from-discussion` (BOARD007) with `origin: 'workflow_collect'`; `board` Workflows own the Lanes. Only a `board` Workflow Version may reconcile Lanes; reconcile requests carrying `kind !== 'board'` are rejected (`validation.invalid_input`).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`UnitOfWork`, `EventBus`/outbox (OVE_ARCH010), `AgentDirectory` (AGENT), `usecase:escalation.raise`, `AuditLog` (PERM). Domain `lanePolicy` from OVE_BOARD002. Do not duplicate lane-key validation: it is a shared zod schema in contracts.

## 8. Architecture and code placement

Application layer `packages/application/src/board/provision/{provision-board.ts,reconcile-lanes.ts,lane-spec.ts,workflow-subscriber.ts}`. Depends on ports only. The subscriber is registered through the extension point of OVE_ARCH006 (composition root collects `*.subscriber.ts`), not by editing a shared file.

## 9. Security and safety

Lane definitions come from a Workflow Version, which an Agent could try to influence (Chief writes Workflows, Owner publishes). The use case therefore validates every field again, treats `name` and `hint` as untrusted display strings (length caps, control characters stripped) and never creates assignments to Agents that are not usable in this Workspace (ADR 0028 privacy). Reconcile is system-only: the Owner/Chief/agent callers cannot call it from the gateway (no route). Removal of a populated lane escalates instead of silently relocating work (ADR 0016: scope discipline). Fail closed: if `AgentDirectory` is unavailable, reconcile aborts and keeps the old lanes.

## 10. Errors and edge cases

- Workflow Version without any lane: rejected (Board needs at least one `todo` and one `done` category lane: `validation.invalid_input`).
- Two lanes with the same `position`: positions are normalised to a dense 0..n-1 order by `(position, key)`.
- Lane keys reused after archive: the archived lane is un-archived (same `(boardId,key)`).
- Workspace deleted mid-reconcile: transaction fails with not found; no partial state.
- WIP limit lower than current count: allowed; `wipExceeded` shown by read model.

## 11. Acceptance criteria

- [ ] `provisionBoard` twice yields one Board and one set of lanes; Board has the four default lanes.
- [ ] Reconcile with renamed, reordered, added lanes updates the Board and emits one `board.lanes_changed`.
- [ ] Removing an empty lane archives it; removing a lane with tasks keeps it and raises an Escalation.
- [ ] A lane assignee that is a private Agent of another Workspace makes reconcile fail with no change.
- [ ] Out-of-order Workflow Version application is rejected; same Version twice is a no-op.
- [ ] Reconcile from a `collect` Workflow is rejected.

## 12. Test plan

- Unit tests with `InMemoryBoardRepository`, `FakeClock`, a fake `WorkflowLaneSource`, fake `AgentDirectory`: `provision.test.ts`, `reconcile-lanes.test.ts` (table-driven scenarios above), `workflow-subscriber.test.ts`.
- Commands: `pnpm vitest run packages/application/src/board/provision`.

## 13. Parallelization notes

Independent of BOARD006-BOARD009 (different folder). Needs the WFRT capability `port:WorkflowLaneSource`; if not yet merged, develop against a fake defined in `packages/testing/src/fakes/FakeWorkflowLaneSource.ts` (owned here).

## 14. Open questions and assumptions

- ASSUMPTION: default lane set is four lanes (To do / In progress / Review / Done). The mock's five lanes come from the demo `board` Workflow.
- Open: should the Owner be able to add lanes directly on the Board without a Workflow? Default: no (SPEC 6: the Workflow defines the Lanes).
