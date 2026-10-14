---
id: OVE_AGENT019
title: Add Run-level shutdown and recovery participants for the workflow runtime
area: AGENT
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT018, OVE_ARCH007, OVE_DATA005, OVE_ENGINE004, OVE_ENGINE005, OVE_PERM010, OVE_WFRT052]
soft_depends_on: []
provides: ["participant:run-shutdown", "participant:run-recovery"]
needs: ["port:ShutdownParticipant", "port:RecoveryParticipant", "port:RunReader", "port:RunExecutor", "port:EventStore", "port:PauseStateReader", "port:Clock"]
owns: ["apps/engine/src/composition/modules/run-lifecycle.module.ts", "packages/application/src/run-lifecycle/**"]
reads: ["packages/contracts/src/workflow-run/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16"]
adr_refs: [5, 19, 2]
---

# OVE_AGENT019: Add Run-level shutdown and recovery participants for the workflow runtime

## 1. Summary

Provides the workflow runtime's side of orderly shutdown and crash recovery: stop starting work, checkpoint active Runs, and on start resume each non-terminal Run without repeating non-idempotent actions.

## 2. Context

ENGINE004 and ENGINE005 define the multi-ports and the shared `classifyAction` rule; the runtime must supply the Run-specific participants. The brief (coordinator) asks for them here because WFRT currently has no executor tasks. Provisional ownership; WFRT should take them over when it defines `RunExecutor`.

## 3. Scope (in)

- `run-shutdown` and `run-recovery` participants, the `RunExecutor` port they call, tests with fakes.

## 4. Out of scope

- The executor itself, node semantics, checkpoint format (WFRT). Orchestration of recovery (ENGINE005).

## 5. Detailed requirements

1. Port `RunExecutor` (owned here, implemented by WFRT): `stopScheduling()`, `awaitQuiescent(deadline)`, `checkpoint(runId)`, `resume(runId, { recoveredFrom })`, `markWaitingOwnerDecision(runId, actionId, reason)`.
2. `run-shutdown` participant phases: `stop_accepting` calls `stopScheduling` (no new node executions or Runs); `quiesce` waits for running node executions to reach a safe point within the budget, then cancels the rest with `interrupted` status; `checkpoint` writes a checkpoint per active Run and appends `run.shutdown_checkpointed`.
3. `run-recovery` participant (`recover(ctx)`): reads the Run's events, applies `classifyAction`: completed -> done; started without completed and idempotent -> re-run; non-idempotent ambiguous -> `markWaitingOwnerDecision` and return `needs_owner_decision`; never re-runs automatically.
4. Global Pause: if paused, restores state to `paused` and starts nothing.
5. Agent turns in flight: an Agent node whose CLI turn was interrupted is treated as non-idempotent (a prompt may have been delivered); recovery asks the Owner (`confirmed_done`, `retry`, `skip`).
6. Recovery is idempotent: appends `run.recovery_attempted {n}`; after 3 attempts emits `run.recovery_failed` and escalates.
7. Returns `RecoveryOutcome` per ENGINE005; errors never crash startup.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

ENGINE005 `classifyAction` helper.

## 8. Architecture and code placement

`packages/application/src/run-lifecycle/{run-shutdown.ts,run-recovery.ts}`; wired in the lifecycle module.

## 9. Security and safety

Prevents duplicate side effects (double prompts, double merges) after crash. Owner decision is required for ambiguity. Pause is respected.

## 10. Errors and edge cases

- Event gap: fail the Run with `data.event_gap`.
- Executor missing at start (feature off): participants no-op and log.
- Shutdown timeout: unfinished node executions are marked `interrupted` for recovery.

## 11. Acceptance criteria

- [ ] Ambiguous action never auto re-run.
- [ ] Pause respected on recovery.
- [ ] Shutdown leaves checkpoints for all active Runs.
- [ ] Attempt cap enforced.

## 12. Test plan

Unit tests with fake executor and event store; scenario subset of TEST011 R-02..R-14. Command: `pnpm vitest run packages/application/src/run-lifecycle`.

## 13. Parallelization notes

Depends on ENGINE004/005 port files; WFRT implements `RunExecutor`.

## 14. Open questions and assumptions

- GAP/OPEN: ownership should move to WFRT; `port:RunExecutor` is new.
- ASSUMPTION: interrupted Agent turns are always ambiguous.
