---
id: OVE_WFRT007
title: Define the Run lifecycle event schemas (one file per event)
area: WFRT
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_WFRT006]
soft_depends_on: [OVE_WFRT001]
provides: ["event:run.created", "event:run.started", "event:run.paused", "event:run.resumed", "event:run.cancel_requested", "event:run.cancelled", "event:run.succeeded", "event:run.failed", "event:run.escalated", "event:run.escalation_resolved", "event:run.versions_pinned", "event:run.checkpoint_written", "event:run.budget_updated", "event:run.completed"]
needs: ["lib:define-event", "contract:EventEnvelope"]
owns: ["packages/contracts/src/events/run.created.event.ts", "packages/contracts/src/events/run.started.event.ts", "packages/contracts/src/events/run.paused.event.ts", "packages/contracts/src/events/run.resumed.event.ts", "packages/contracts/src/events/run.cancel_requested.event.ts", "packages/contracts/src/events/run.cancelled.event.ts", "packages/contracts/src/events/run.succeeded.event.ts", "packages/contracts/src/events/run.failed.event.ts", "packages/contracts/src/events/run.escalated.event.ts", "packages/contracts/src/events/run.escalation_resolved.event.ts", "packages/contracts/src/events/run.versions_pinned.event.ts", "packages/contracts/src/events/run.checkpoint_written.event.ts", "packages/contracts/src/events/run.budget_updated.event.ts"]
reads: ["packages/contracts/src/events/define-event.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 12", "SPECIFICATION 15"]
adr_refs: [5, 15, 19]
---

# OVE_WFRT007: Define the Run lifecycle event schemas (one file per event)

## 1. Summary

The 13 persisted events that describe the life of a Run (created, started, paused, resumed, cancel requested, cancelled, succeeded, failed, escalated, escalation resolved, versions pinned, checkpoint written, budget updated). They are the source of truth from which Run state, projections, the trace and replay are derived.

## 2. Context

ADR 0019: Run state is an append-only event stream in SQLite. ARCH010 defines `defineEvent`, the envelope (`runId`, `workspaceId`, `actor`, `correlationId`, `causationId`) and the rules (past tense, `schemaVersion`, additive evolution, upcasters, payloads without secrets). WFRT001 §11 fixes the names. The reducer is WFRT030; the trace builder WFRT045.

## 3. Scope (in)

Thirteen event files, their zod payloads, `visibleTo`/`telegramSafe` metadata, example fixtures, a registry test.

## 4. Out of scope

Node and action events (WFRT008), loop/join/gate/branch events (WFRT009), appending and storing (WFRT032), consumers.

## 5. Detailed requirements

All events: `persisted: true`, `scope: 'workspace'`, `schemaVersion: 1`, `visibleTo: ['owner','channel']` unless stated, payloads strict, ids only (no definitions, prompts or file content). Payload fields:

1. `run.created`: `runId, number, workflowId, workflowVersionId, workflowVersionNo, workspaceId, mode: 'live'|'dry_run', inputHash (sha256 hex), inputRef? (Artifact id when input > 16 KiB), input? (inline JSON <= 16 KiB, already validated), startedBy: {kind, channel?}, limits: RunLimits (effective, after defaults), definitionHash`.
2. `run.started`: `runId, startNodeKeys: NodeKey[]`.
3. `run.paused`: `runId, reason: PauseReason (kind owner|global_pause|chief_discussion|escalation, ref?)`, `scope: 'run'|'branch'`, `branchNodeKeys?`. Audit flag true (pause changes are audited).
4. `run.resumed`: `runId, reasonKind, scope`, `by: actor`. Audit true.
5. `run.cancel_requested`: `runId, by: {kind: 'owner'|'chief'|'system', channel?}, reason?: enum('owner'|'budget'|'timeout'|'escalation_declined'|'workspace_deleted')`. Audit true.
6. `run.cancelled`: `runId, cancelledNodeCount, abandonedActions: ActionId[]` (actions started but not completed at cancel time).
7. `run.succeeded`: `runId, endNodeKey, outputHash, outputRef?, output?` (inline <= 16 KiB), `elapsedMs`.
8. `run.failed`: `runId, code: ErrorCode, nodeKey?, safeMessage` (no CLI output), `elapsedMs`.
9. `run.escalated`: `runId, escalationId: esc_, nodeKey?, reason: enum('loop_exhausted'|'budget_exceeded'|'timeout'|'retries_exhausted'|'ambiguous_action'|'discussion_deadlock'|'provider_unavailable'|'explicit'), summaryKey, params, addressedTo: 'chief'|'owner'` (ADR 0015: Chief first when within Budget/Docs/Rules, else Owner). Critical flag true; Owner notification triggered by NOTIF subscriber.
10. `run.escalation_resolved`: `runId, escalationId, resolution: enum('retry'|'continue'|'skip'|'raise_limit'|'fail'|'cancel'), by, noteHash?, newLimits?`. Audit true.
11. `run.versions_pinned`: `runId, agents: [{agentId, configVersion}], skills: [{skillId, version}], models: [{providerId, modelId}]`, `nodes: Record<NodeKey, {agentId?, agentVersion?, skills[], modelId?, providerId?}>` (SPEC 15 replay).
12. `run.checkpoint_written`: `runId, checkpointId: chk_, atSeq, stateHash, stateRef?` (the checkpoint body is an Artifact/blob; see WFRT043).
13. `run.budget_updated`: `runId, delta: {tokens?, usd?, iterations?}, used: {...}, source: 'provider_usage'|'estimate'|'iteration'`.
14. A shared helper `packages/contracts/src/events/run-event-common.ts` is NOT created (each file imports `RunId` and `PauseReason` from `workflow-run`); no cross-file coupling beyond contracts.
15. `docs`: an `examples` const per file used by tests and docs.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineEvent` (ARCH010), `PauseReason`, ids and `RunLimits` (WFRT003/006), `ErrorCode` (ARCH003).

## 8. Architecture and code placement

`packages/contracts/src/events/<type>.event.ts`, one per event; the registry barrel is generated (ARCH009). No logic.

## 9. Security and safety

Payloads are free of prompts, file content, paths and secrets; `expectEventSafe` (ARCH010) runs in every test. Pause, resume, cancel and escalation resolution carry the actor so audits are complete. `telegramSafe`: `run.paused` and `run.escalated` params contain no absolute paths.

## 10. Errors and edge cases

Inline `input`/`output` over 16 KiB is rejected (use `Ref`). Unknown reason enum values from a newer engine are tolerated by clients via fallback (clients, not schema). Payload evolution only additive.

## 11. Acceptance criteria

- [ ] 13 files exist, each exporting the event definition and an example.
- [ ] Registry naming/uniqueness test passes.
- [ ] `expectEventSafe` passes for every example.
- [ ] Contract snapshot additive-only passes.

## 12. Test plan

`run-events.contract.test.ts` iterates all example payloads; negative cases per event (oversize, extra key). Command `pnpm vitest run packages/contracts/src/events/run.`.

## 13. Parallelization notes

Parallel with WFRT008 and WFRT009 (different files). WFRT030 starts from the field lists here.

## 14. Open questions and assumptions

- ASSUMPTION: `run.created` carries the effective limits so replay does not depend on mutable defaults.

