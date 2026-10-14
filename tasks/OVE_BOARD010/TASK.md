---
id: OVE_BOARD010
title: "Bind Workflow TOR nodes to the Board: move and update Tasks as Nodes execute"
area: BOARD
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_BOARD005, OVE_BOARD008, OVE_DATA002, OVE_PAUSE005, OVE_PERM008, OVE_PERM020, OVE_WFRT008]
soft_depends_on: ["OVE_BOARD009"]
provides: ["port:BoardLaneBinding", "usecase:board.node-entered", "usecase:board.node-finished", "usecase:board.claim-next-task"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "event:run.node.started", "event:run.node.succeeded", "event:run.node.failed", "port:AgentDirectory", "port:PauseGate"]
owns: ["packages/application/src/board/lane-binding/**", "packages/application/src/ports/BoardLaneBinding.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [2, 11, 19]
---

# OVE_BOARD010: Bind Workflow TOR nodes to the Board: move and update Tasks as Nodes execute

## 1. Summary

Define and implement `BoardLaneBinding`, the port the Workflow runtime calls from TOR Nodes ("Build", "QA", "Review") to take Tasks from a Lane, mark them as worked on, move them on success, return them on a failed Quality Gate, and keep the Board consistent across crashes and retries.

## 2. Context

SPEC 6 and 3 ("Tablica jak na zrzucie"): a `board` Workflow moves Tasks through Lanes Build, QA, Review as Nodes execute, with a loop `review done -> collect next` and failing Quality Gates returning work to Build with a report. SPEC 12: Run state is event-sourced and non-idempotent actions are never blindly repeated after restart; ADR 0019: the engine owns execution. The Board must follow the Run, never lead it. The binding is therefore an explicit port (so WFRT and BOARD stay decoupled) whose operations are idempotent per `(runId, nodeExecutionId)`.

## 3. Scope (in)

- `BoardLaneBinding` port (consumed by WFRT TOR Node executor) and its implementation as use cases.
- Operations: `claimNextTask`, `nodeEntered`, `nodeFinished`, `releaseTask`.
- Idempotency, crash recovery reconciliation, WIP-aware queuing, loop-back moves.
- Subscriber that keeps `progress` of the Task in sync with Node progress events.

## 4. Out of scope

- WFRT TOR node definition, validation and executor: WFRT. Choosing which Agent runs: WFRT/PROV. Quality Gate evaluation: WFRT (this task records its result).
- Chief assignment strategy: CHIEF.

## 5. Detailed requirements

1. **Port** (in `packages/application/src/ports/BoardLaneBinding.ts`):
   ```ts
   interface BoardLaneBinding {
     claimNextTask(i: { workspaceId; runId; nodeExecutionId; laneKey; agentId; selector?: { assigneeAgentId?: AgentId; docRefPrefix?: string } }): Promise<Result<{ task: Task } | { task: null }>>;
     nodeEntered(i: { taskId; runId; nodeExecutionId; laneKey; agentId }): Promise<Result<Task>>;           // status working, assignee set, run bound
     reportNodeProgress(i: { taskId; nodeExecutionId; done: number; total: number; label?: string }): Promise<Result<void>>;
     nodeFinished(i: { taskId; runId; nodeExecutionId; outcome: 'succeeded' | 'failed' | 'needs_rework' | 'awaiting_review'; toLaneKey?: string; reasonCode: string; gate?: { passed: boolean; reportArtifactId?: ArtifactId; summary?: string } }): Promise<Result<Task>>;
     releaseTask(i: { taskId; runId; nodeExecutionId; reasonCode: string }): Promise<Result<Task>>;                 // Run cancelled/failed: back to queued, run unbound
   }
   ```
2. **claimNextTask**: picks the oldest `queued` Task in the lane (order: `priority desc, seq asc`), optionally filtered by assignee preset; skips `deferred`, `blocked`, tasks already bound to another Run; atomically binds `runId` and sets status `queued -> working` is NOT done here (done by `nodeEntered`); claim marks `runId` with a lease (`claimedUntil = now + 15 min`, refreshed on progress) so two Runs cannot take the same Task. Returns `{ task: null }` when nothing is available (the loop "review done -> collect next" ends or waits, WFRT decides).
3. **nodeEntered**: moves the Task into the Node's lane if different (system move via BOARD008; WIP full -> returns `board.wip_limit_reached`, the Node then waits; Task stays `queued`, rendered "w kolejce"), assigns the Agent, sets status `working`, writes `moved` + `status_changed` timeline entries with `runId`, `nodeExecutionId`.
4. **nodeFinished**: outcomes: `succeeded` -> move to `toLaneKey` (next lane in position order if omitted) with status `queued` (or `in_review` when the next lane has category review and the Node says `awaiting_review`); `failed` (Node error) -> `blocked` with reason code, `runId` released; `needs_rework` (Quality Gate failed) -> backward move to `toLaneKey` (required) with `gate_result` entry (`passed: false`, report artifact ref, summary like `testsPassed = 96% · required 100%`) and reason `quality_gate_failed`; `done` category target -> status `done` only when `gate.passed === true` AND `gate.reportArtifactId` exists in the Workspace (evidence rule, SEC004 R4; Agent text alone never completes a Task) .
5. **Idempotency.** Each call carries `nodeExecutionId`; a unique index on `(task_id, node_execution_id, kind)` in timeline payload plus an application-level check (`findByNodeExecution`) makes repeats no-ops that return the current Task. After engine restart WFRT replays events and may re-call; results must be identical.
6. **Recovery reconciliation** (`reconcileBoardWithRuns`, called at engine startup and on `run.cancelled`/`run.failed` events): any Task with `runId` whose Run is not active (via `RunStateQuery`) and whose lease expired is released to `queued` (status `working -> queued`, reason `run_not_active`); this never moves lanes. Non-idempotent side effects are not repeated: only Board state is repaired.
7. **Progress sync.** Subscriber on `run.node.progress` events (ephemeral) updates `progress` via `reportProgress` with a 1 s coalescing window.
8. **Pause.** All system operations are refused while `PauseGate` says paused (`pause.active`); Nodes are paused by the runtime anyway, so the Board must not advance.
9. **Agent identity check.** `agentId` must be usable in the Workspace (`AgentDirectory`), and `nodeEntered` verifies that the Lane's configured assignee, if any, equals `agentId` or is a Team containing it; mismatches are allowed only with `reasonCode: 'delegated'` and recorded.
10. **Collect semantics.** For a `collect` Workflow, TOR nodes are absent; `claimNextTask` is not used. Verified reports from a `collect` Run call BOARD007 with `origin: 'workflow_collect'`.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

BOARD008 `moveTask`/`changeStatus`/`assignTask`/`reportProgress`; BOARD005 lane lookup by `workflowNodeId`; `PauseGate`; `RunStateQuery` (WFRT). Never write Task rows directly.

## 8. Architecture and code placement

Port in `packages/application/src/ports/BoardLaneBinding.ts`; implementation `packages/application/src/board/lane-binding/{lane-binding-service.ts,claim.ts,reconcile.ts,progress-sync.subscriber.ts}`. WFRT depends on the port, never on BOARD internals; BOARD depends on WFRT only via event contracts and `RunStateQuery`.

## 9. Security and safety

The Board must not be a way to make the engine do things: a Task's text never becomes a command; the binding only moves cards. A malicious Agent cannot cause `done` without an Artifact evidence reference produced by the system (Quality Gate), so "I finished, tests pass" is ignored for state. Leases and idempotency prevent double execution of non-idempotent work caused by double claims (SPEC 17 duplicated side effects). Pause blocks advancement. Recovery never repeats Node side effects. All denials audited.

## 10. Errors and edge cases

- Two Runs claim simultaneously: one gets the Task, the other gets another or `null`.
- Node finished after the Run was cancelled: `board.invalid_transition` ignored (logged), Task already released.
- Gate passed without report artifact for a done lane: refused `board.invalid_transition` with reason `evidence_required`.
- Lane archived between claim and finish: moves to the nearest active lane in position order is NOT done silently; returns `board.lane_not_found` and raises Escalation via BOARD005 path.
- Lease expired while Node still runs: progress refreshes the lease; if not refreshed, reconcile releases only when the Run is inactive.
- Engine crash between `nodeEntered` DB commit and Node start: reconcile sees an active Run with a working Task and does nothing; WFRT replays `nodeEntered` idempotently.

## 11. Acceptance criteria

- [ ] `claimNextTask` is race-safe (two concurrent claims never return the same Task).
- [ ] `nodeEntered` + `nodeFinished(succeeded)` moves the Task Build -> QA with correct timeline entries and events.
- [ ] A failed Quality Gate returns the Task to Build with a `gate_result` entry and the report reference.
- [ ] `done` requires gate evidence from a real Artifact; agent text alone is ignored.
- [ ] Repeating any call with the same `nodeExecutionId` is a no-op.
- [ ] Startup reconciliation releases Tasks of inactive Runs without moving lanes.
- [ ] Operations are refused during Global Pause.

## 12. Test plan

- `lane-binding-service.test.ts` (scenario table: happy path, QA loop-back, WIP full, cancel), `claim.race.test.ts` (interleavings with fake UnitOfWork), `reconcile.test.ts` using a scripted `RunStateQuery`.
- A scenario test "board workflow" with fake runtime that plays the loop of SPEC 16.5 for 3 Tasks.
- Commands: `pnpm vitest run packages/application/src/board/lane-binding`.

## 13. Parallelization notes

Unblocks the WFRT TOR Node task (they consume `port:BoardLaneBinding`). Needs BOARD005 for lane lookup. Hotspot: the port file is owned here; changes by additive proposal only.

## 14. Open questions and assumptions

- ASSUMPTION: lease of 15 minutes refreshed by progress; tune with real Node durations.
- ASSUMPTION: event names `run.node.started|succeeded|failed|progress` and `run.cancelled` belong to WFRT; confirm in linking.
- Open: WIP-full behaviour for the system: wait in current lane (default) vs skip to another Task.
