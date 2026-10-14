---
id: OVE_ENGINE005
title: Crash recovery on start - resume Runs without repeating non-idempotent actions
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH006, OVE_ARCH007, OVE_DATA002, OVE_DATA005, OVE_DATA006, OVE_DATA020, OVE_ENGINE002]
soft_depends_on: []
provides: ["lib:crash-recovery", "port:RecoveryParticipant", "usecase:RunStartupRecovery"]
needs: ["port:EventStore", "port:CheckpointStore", "port:UnitOfWork", "port:Clock", "port:Logger", "lib:multi-token"]
owns: ["apps/engine/src/recovery/**", "packages/application/src/ports/RecoveryParticipant.ts", "apps/engine/src/composition/modules/engine-recovery.module.ts"]
reads: ["docs/testing/recovery.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 19]
---

# OVE_ENGINE005: Crash recovery on start

## 1. Summary

After any unclean stop (kill -9, power loss, panic) the engine reconstructs what was running from the event log and checkpoints, resumes Runs, and never repeats an action that may already have had a side effect. Ambiguous non-idempotent actions are surfaced to the Owner.

## 2. Context

SPEC 16 criterion 7, SR-18, TEST011 scenarios R-02..R-14. The engine core provides the orchestration and the invariant ("started without completed"); WFRT implements Run semantics through `RecoveryParticipant`. Prototype fact: a prompt sent right before a crash may or may not have been delivered; herdr state is a hint only.

## 3. Scope (in)

- Recovery orchestrator run once per start, after DB and modules start, before the gateway accepts mutating requests.
- `RecoveryParticipant` multi-port and the shared "ambiguous action" model.

## 4. Out of scope

- Workflow semantics of resuming nodes: WFRT participant. Reattaching terminals: PROV. Re-sending Telegram updates: TG (uses its own high-water mark).

## 5. Detailed requirements

1. Orchestrator steps: (1) determine `previousShutdown`: `clean` if the last event is `engine.stopped_cleanly` (appended by ENGINE004) else `crashed`; append `engine.recovery_started { previousShutdown, headSeq }`; (2) find non-terminal Runs (status `running|waiting|paused|interrupted`) via `RunReader` port (WFRT); (3) for each Run call participants in `order`; (4) append `engine.recovery_completed { runs, resumed, escalated, durationMs }`; (5) open the gateway for mutations (reads were available since lifecycle state `recovering`, ENGINE006).
2. Port `RecoveryParticipant` (multi-token): `{ id, order, recover(ctx: { runId, previousShutdown, events: EventCursor, checkpoint? }): Promise<Result<RecoveryOutcome>> }` with `RecoveryOutcome = resumed | already_terminal | needs_owner_decision{ actionId, reason } | failed{ code }`.
3. Shared rule (normative, implemented in a helper `classifyAction(events)` here and used by WFRT): for each action event pair `action.started` / `action.completed` keyed by `actionId`: completed -> done; started without completed and `idempotent: true` -> safe to re-run; started without completed and non-idempotent -> `ambiguous`: Run state becomes `waiting` with an Escalation/decision record `needs_owner_decision` (Owner chooses `confirmed_done`, `retry`, `skip`); the action is never re-run automatically.
4. Sequence safety: recovery is idempotent and itself crash-safe: each Run's recovery appends `run.recovery_attempted {n}`; at most 3 attempts per start, then `run.recovery_failed` and Escalation.
5. Concurrency: Runs recover in parallel up to `engine.maxParallelAgents`, but participants for one Run are sequential. No Run executes new nodes until its recovery finished.
6. Global Pause: if PauseState is paused (PAUSE area read port) recovery restores state but starts nothing (TEST011 R-14).
7. Event log health: `readByRun` gap or chain failure for a Run -> that Run is `failed{ code: 'data.event_gap' }` with Escalation; other Runs continue.
8. Recovery duration budget: warn above 10 s, no hard limit; progress is exposed in `GET /v1/system/health` as `recovery: { total, done }`.
9. Fault points placed here: `on_startup_recovery_step` (TEST011).
10. Notifications: after recovery with at least one ambiguous action, emit event `run.needs_owner_decision` (NOTIF subscribes).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EventStore.readByRun`, `replayRun`, `CheckpointStore` (DATA005/006), `multiToken` (ARCH006), TEST011 harness for proof.

## 8. Architecture and code placement

Orchestrator `apps/engine/src/recovery/`; port in application; WFRT, PROV and TG add `*.module.ts` providers. Pure `classifyAction` has no I/O and lives in `packages/domain/src/recovery/classify-action.ts` (owned here).

## 9. Security and safety

Never replay a non-idempotent action blindly (SR-18). Agent-reported or herdr-reported "done" is a hint, not proof (SR-19): recovery uses stored events and real evidence. Recovery does not restore permissions from memory: Effective Permissions are recomputed from stored policy (fail closed if unreadable: Run stays `waiting`). Pause is honoured (SR-30).

## 10. Errors and edge cases

- Crash during recovery: next start repeats safely (attempt counter).
- Run whose workflow version no longer loads: `failed` with Escalation, never silently dropped.
- Event log contains unknown event types (newer app): upcaster missing -> Run `failed{validation.event_upcast_failed}`.
- Many Runs (100): bounded parallelism.

## 11. Acceptance criteria

- [ ] Given a crash after `action.started` of a non-idempotent action, then the ledger shows one execution and the Run waits for the Owner.
- [ ] Given a crash after `action.completed`, then the next node starts and the action is not repeated.
- [ ] Given Global Pause active, then no node starts after recovery.
- [ ] Given a gap in `run_seq`, then the Run is failed with Escalation and others continue.
- [ ] Recovery run twice in a row produces no extra side effects.

## 12. Test plan

Unit tests for `classifyAction` truth table; orchestrator tests with fake participants; TEST011 scenarios R-03..R-10 as the integration proof. Commands: `pnpm vitest run apps/engine/src/recovery packages/domain/src/recovery`.

## 13. Parallelization notes

WFRT depends on the port; merge the port file and `classifyAction` first.

## 14. Open questions and assumptions

- ASSUMPTION: three recovery attempts per start.
- ASSUMPTION: `RunReader` port is provided by WFRT (`needs: port:RunReader`, flagged in report).
