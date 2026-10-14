---
id: OVE_WFED080
title: "Project Run events onto canvas state: node states, edge traces, iterations (pure)"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS087, OVE_WFED050, OVE_WFED072, OVE_WFRT006, OVE_WFRT007, OVE_WFRT008, OVE_WFRT009]
soft_depends_on: []
provides: ["feature:wfed-run-overlay-model", "lib:wfed-run-projection"]
needs: ["contract:NodeExecution", "contract:WorkflowRun", "contract:Token", "event:run.node.started", "event:run.node.waiting", "event:run.node.succeeded", "event:run.node.failed", "event:run.node.skipped", "event:run.node.cancelled", "event:run.token.emitted", "event:run.loop.iterated", "event:run.loop.exhausted", "event:run.join.resolved", "event:run.gate.evaluated", "event:run.paused", "event:run.resumed", "ui:CanvasModel", "lib:wfed-loop-frame-label"]
owns: ["apps/desktop/src/features/workflow-editor/run-overlay/model/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 15"]
adr_refs: [2, 19, 28]
---

# OVE_WFED080: Project Run events onto canvas state: node states, edge traces, iterations (pure)

## 1. Summary

A pure reducer `projectRunEvent(state, event)` plus `initialOverlay(snapshot)` that turns the Run snapshot and the event stream into exactly what the canvas draws: per-Node execution state (with iteration, wait reason, evidence), per-Edge traversal and in-flight tokens, per-group iteration counters, Join member states and Gate evaluations.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The UI never parses raw engine events inside components (WFRT006: `RunTrace` is presentation-neutral for lists; the canvas overlay is a live projection). Node statuses: pending, ready, running, waiting, succeeded, failed, skipped, cancelled. `NodeExecution` is keyed by `executionKey = nodeKey@scope` (scope like `quality-loop:2`); a Node inside a Loop has one execution per iteration. The mock shows: working glow (QA, magenta), waiting-for-Approval glow (Security, amber), done check (Developer), queued 'czeka na Quality Gate', an active edge with magenta glow, and the Loop frame label with 'iteracja 2 z 5'.

## 3. Scope (in)

- `OverlayState` type and `initialOverlay(snapshot)`.
- `projectRunEvent(state, event): OverlayState` (pure, immutable, idempotent by event `seq`).
- Selectors: `nodeView(state, nodeKey)`, `edgeView(state, edgeId)`, `groupView(state, groupId)`.
- Mapping tables to DS node states and edge states.

## 4. Out of scope

- Subscription and resync (`OVE_WFED081`).
- Rendering (`OVE_WFED082`).
- Finished-Run presentation (`OVE_WFED083`).

## 5. Detailed requirements

1. `OverlayState = { runId, versionNo, mode:'live'|'dry_run', status: RunStatus, lastSeq, nodes: Record<NodeKey, NodeOverlay>, edges: Record<EdgeId, EdgeOverlay>, loops: Record<NodeKey, LoopOverlay>, joins: Record<NodeKey, JoinOverlay>, gates: Record<NodeKey, GateOverlay>, discussions: Record<NodeKey, {discussionId, status}>, pauseReasons }`.
2. `NodeOverlay = { state: 'idle'|'queued'|'working'|'waiting-approval'|'waiting-other'|'done'|'error'|'skipped'|'cancelled', iteration?: number, attempt: number, waitingFor?: {kind, ref?}, blockedBy?, startedAt?, endedAt?, errorCode?, lastExecutionKey, executions: ExecutionSummary[] (max 50 newest) }`: the node-level state is the state of its newest execution; a Node inside a Loop shows the current iteration's state and keeps earlier ones in `executions`.
3. Status mapping: `pending|ready` -> `queued` ('czeka'), `running` -> `working`, `waiting` with `waitingFor.kind==='approval'` -> `waiting-approval`, other waiting kinds (`timer|tokens|external|pause|slot`) -> `waiting-other` with the kind word, `succeeded` -> `done`, `failed` -> `error`, `skipped` -> `skipped`, `cancelled` -> `cancelled`; `blockedBy` Global/owner pause overrides to a paused look (`working` becomes `waiting-other` with kind `pause`).
4. Edges: `run.token.emitted { edgeId, tokenId }` marks the edge `inFlight` (target not yet started) with `lastEmittedAt`; when the target Node's execution starts (`run.node.started` that consumes the token) the edge becomes `traversed` (count, last time); dropped tokens (`run.token.dropped`) mark `dropped` with reason; edges never traversed stay `idle`.
5. Return edges (kind 'return') become `active` when a `continue` token is emitted (the amber 'nie spełnia → wróć do Developera' path).
6. Loops: `run.loop.iterated { iteration, limit }` sets `{iteration, limit, state:'iterating'}`; `run.loop.exhausted` sets `exhausted` with reason; the group frame label is `loopFrameLabel(limits)` + ` · iteracja ${iteration} z ${limit}` composed by the renderer from this state.
7. Joins: `run.join.resolved { satisfied, members }` and per-member delivery from token events: `members: Record<memberKey,'waiting'|'delivered'|'failed'|'skipped'|'timed_out'>`.
8. Gates: `run.gate.evaluated { passed, evidence: [{name, value, required, ok}] }` -> `GateOverlay { passed, evidence }`; a failed Gate sets the diamond state `error` briefly and activates the return edge.
9. Discussions: Node `waiting` + `run.node.waiting {waitingFor:{kind:'external', ref: discussionId}}` links `discussionId`.
10. Idempotence and order: events with `seq <= lastSeq` are ignored; a gap (`seq > lastSeq + 1`) returns `{state, needsResync:true}` and the caller resyncs from the snapshot (`OVE_WFED081`); unknown event types are ignored.
11. Immutability: reducers return new objects only for changed branches (structural sharing) so React memoisation works; 200 nodes and 1 000 events per second must reduce in under 5 ms per batch.
12. `initialOverlay(snapshot)`: builds from `NodeExecution[]`, tokens in flight and the Run's `lastEventSeq`.
13. No timers, no Date.now(): times come from events.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Contracts (WFRT006-009) and `stateMaps`; `loopFrameLabel` from `OVE_WFED072`.

## 8. Architecture and code placement

Pure TypeScript `@WF/run-overlay/model/` (`state.ts`, `reduce.ts`, `selectors.ts`, `mappings.ts`, `fixtures/`). Zero React; types from `contracts`.

## 9. Security and safety

The projection treats event payloads as data: strings (error codes, evidence names) are bounded and used only as display text or lookup keys. Agent output never enters the overlay (only ids, codes and counters). Unknown values map to a neutral state instead of throwing (the canvas must never crash on a malformed event).

## 10. Errors and edge cases

- Events out of order or duplicated: handled by `seq`.
- Event for a Node not in the pinned Version (stale client): ignored and counted in `unknownNodeEvents` for diagnostics.
- Execution restarts after a crash (`run.node.resumed`): state returns to the proper status.
- Cancelled Run: nodes in `running` become `cancelled` only when their `run.node.cancelled` arrive (no guessing).
- Loop with nested Loop: counters keyed per Loop node and scope.

## 11. Acceptance criteria

- [ ] Table-driven tests cover every status mapping row and the `blockedBy` override.
- [ ] Given a duplicated event, then the state is unchanged (reference equality).
- [ ] Given a gap in `seq`, then `needsResync` is true.
- [ ] Given 1 000 mixed events, then the result equals the state built from the final snapshot (replay equivalence test).
- [ ] Given `run.loop.iterated` 2 of 5, then the loop overlay has iteration 2 and limit 5.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`reduce.test.ts`, `mappings.test.ts`, replay-equivalence property test (events -> state equals `initialOverlay(snapshotAtEnd)`), benchmark test. Fixtures from a recorded Run (golden `run-14.events.json`). `pnpm --filter desktop vitest run src/features/workflow-editor/run-overlay/model`.

## 13. Parallelization notes

Blocks `OVE_WFED081`, `OVE_WFED082`, `OVE_WFED083`; the join form uses selectors. Replay in RUNUI (`OVE_RUNUI013`) reuses the reducer: expose it from the barrel. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the event payload field names follow WFRT007-009; adjust mappers when the exact schemas are final.
- ASSUMPTION: DS node states lack 'waiting-other' and 'cancelled' variants; closest existing variants are used (`queued` look with a word, `skipped` look with '✗ anulowany') and the gap is recorded for the DS owners.
