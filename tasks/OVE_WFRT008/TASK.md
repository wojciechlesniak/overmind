---
id: OVE_WFRT008
title: Define node, action and token event schemas (one file per event)
area: WFRT
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_WFRT006]
soft_depends_on: [OVE_WFRT001]
provides: ["event:run.node.ready", "event:run.node.started", "event:run.node.waiting", "event:run.node.resumed", "event:run.node.succeeded", "event:run.node.failed", "event:run.node.skipped", "event:run.node.cancelled", "event:run.node.retry_scheduled", "event:run.node.dead_lettered", "event:run.action.started", "event:run.action.completed", "event:run.action.ambiguous", "event:run.action.resolved", "event:run.token.emitted", "event:run.token.dropped"]
needs: ["lib:define-event", "contract:EventEnvelope"]
owns: ["packages/contracts/src/events/run.node.*.event.ts", "packages/contracts/src/events/run.action.*.event.ts", "packages/contracts/src/events/run.token.*.event.ts"]
reads: ["packages/contracts/src/events/define-event.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 12", "SPECIFICATION 15"]
adr_refs: [5, 19]
---

# OVE_WFRT008: Define node, action and token event schemas (one file per event)

## 1. Summary

Sixteen persisted events for the per-node life cycle (ready, started, waiting, resumed, succeeded, failed, skipped, cancelled, retry scheduled, dead-lettered), the action intent/outcome pair that makes crash recovery safe (started, completed, ambiguous, resolved) and token flow (emitted, dropped).

## 2. Context

SPEC 7 statuses; SPEC 12/16.7: non-idempotent actions are never blindly repeated, which requires recording the intent (`action.started`) before the effect and the outcome (`action.completed`) after, as TEST011 expects. Tokens model data moving over edges (WFRT001 §2).

## 3. Scope (in)

Sixteen event files with payload schemas and examples.

## 4. Out of scope

Loop/join/gate/branch events (WFRT009), the state machine (WFRT030), action ledger logic (WFRT037).

## 5. Detailed requirements

Common: persisted, workspace scope, `schemaVersion: 1`, strict, ids/hashes/refs only. Every payload has `runId`, `executionKey`, `nodeKey`, `scope`.

1. `run.node.ready`: `nodeType, nexId: nex_, inputTokenIds: string[], readyAt`. First event of every NodeExecution (creates it in `ready`; `pending` exists only as the unreached state in the reducer for nodes with no execution yet).
2. `run.node.started`: `attempt, agentId?, pinned?: {agentVersion, skills[], providerId?, modelId?}, slotId? (parallelism slot), startedAt`.
3. `run.node.waiting`: `waitingFor: {kind: 'timer'|'tokens'|'external'|'approval'|'pause'|'slot', ref?, dueAt?, timeoutAt?}`, `localState?` (JSON <= 64 KiB).
4. `run.node.resumed`: `signal: 'timer_fired'|'tokens_arrived'|'external_resolved'|'approval_granted'|'branch_resumed'|'recovered'`.
5. `run.node.succeeded`: `attempt, outputs: [{port, tokenId}]`, `outputHash`, `elapsedMs`, `usage?: {tokens?, usd?}`.
6. `run.node.failed`: `attempt, error: {code, retryable, safeMessage}`, `final: boolean` (true when no retry will follow), `elapsedMs`.
7. `run.node.skipped`: `reason: 'branch_not_taken'|'upstream_skipped'|'dry_run'|'policy'|'join_any_satisfied'|'cancelled_branch'`.
8. `run.node.cancelled`: `reason`, `abandonedActionIds[]`.
9. `run.node.retry_scheduled`: `attempt (the next one), notBefore, backoffMs, cause: ErrorCode`.
10. `run.node.dead_lettered`: `attempts, lastError, escalationId?` (final failure after retries; the dead-letter record is the pair node.failed(final) + this event; WFRT038).
11. `run.action.started`: `actionId: act_, actionKey, kind: ActionKind, idempotency: 'pure'|'idempotent'|'non_idempotent', idempotencyKey (deterministic: runId + executionKey + actionKey + attempt-independent for idempotent actions), inputHash`. MUST be appended and committed before the effect is attempted.
12. `run.action.completed`: `actionId, outcome: 'ok'|'error', errorCode?, resultHash, resultRef?`.
13. `run.action.ambiguous`: `actionId, detectedAt, reason: 'crash_between_start_and_complete'|'timeout_unknown_effect'`, `idempotency`. Emitted by recovery (WFRT043) for non-idempotent actions started without completion.
14. `run.action.resolved`: `actionId, decision: 'confirmed_done'|'retry'|'skip'|'abort', by: actor`. Audit true.
15. `run.token.emitted`: `tokenId, edgeId, from: PortRef, to: PortRef, scope, payload? (inline <= 16 KiB) | payloadRef, trust: 'trusted'|'untrusted', payloadHash`.
16. `run.token.dropped`: `tokenId, reason: 'duplicate_continue'|'scope_closed'|'run_terminal'`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineEvent` (ARCH010); `PortRef`, `NodeKey`, statuses (WFRT003, WFRT006); `ActionKind` is a string `<node>.<verb>` registered by node definitions (WFRT005), validated by the registry at runtime, here only pattern `^[a-z_]+\.[a-z_]+$`.

## 8. Architecture and code placement

`packages/contracts/src/events/run.node.<verb>.event.ts` etc. (generated barrel). No logic.

## 9. Security and safety

`payload` of tokens may carry untrusted Agent output: events store it as data, marked `trust: 'untrusted'`; consumers (UI, Telegram) must render it escaped. Large or sensitive content goes to Artifacts by ref. `error.safeMessage` is derived from codes. `action.started` has no raw command text, only kind and hash.

## 10. Errors and edge cases

Duplicate `action.started` with the same `idempotencyKey` is legal only for `idempotent` and `pure` actions (reducer handles). `node.failed` with `final: false` MUST be followed by `retry_scheduled`. `node.succeeded` outputs referencing unknown tokens are rejected by the reducer (WFRT030), not here.

## 11. Acceptance criteria

- [ ] 16 files with examples; registry naming test passes.
- [ ] `expectEventSafe` passes for all examples.
- [ ] Inline payload cap 16 KiB enforced; larger payload requires `payloadRef`.
- [ ] Snapshot additive-only check passes.

## 12. Test plan

`node-events.contract.test.ts`, `action-events.contract.test.ts`, negative cases (oversize, missing runId). Command `pnpm vitest run packages/contracts/src/events/run.node packages/contracts/src/events/run.action packages/contracts/src/events/run.token`.

## 13. Parallelization notes

Parallel with WFRT007/009. Consumed by WFRT030, 036, 037, 038.

## 14. Open questions and assumptions

- ASSUMPTION: node outputs are represented only by tokens (one `token.emitted` per output port) to avoid two copies of the data.

