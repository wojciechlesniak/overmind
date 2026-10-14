---
id: OVE_ENGINE004
title: Graceful shutdown with Run checkpointing and the emergency fast path
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH006, OVE_ARCH007, OVE_DATA002, OVE_DATA005, OVE_DATA006, OVE_DATA020, OVE_ENGINE002, OVE_ENGINE003]
soft_depends_on: []
provides: ["lib:engine-shutdown", "port:ShutdownParticipant", "usecase:RequestEngineShutdown", "api:system.shutdown"]
needs: ["port:CheckpointStore", "port:UnitOfWork", "port:Clock", "port:Logger", "port:EventStore", "lib:multi-token"]
owns: ["apps/engine/src/shutdown/**", "packages/application/src/ports/ShutdownParticipant.ts", "apps/engine/src/composition/modules/engine-lifecycle.module.ts"]
reads: ["apps/engine/src/commands/run.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 19]
---

# OVE_ENGINE004: Graceful shutdown with checkpointing

## 1. Summary

On SIGTERM/SIGINT (or an Owner "quit engine" request) the engine stops accepting work, lets short operations finish, checkpoints every running Run, closes the gateway and database, removes lock files and exits 0 within the grace period. A second signal or a timeout falls back to the emergency path.

## 2. Context

ADR 0005: Runs survive restarts through checkpoints; non-idempotent actions are never replayed blindly. Shutdown happens on app update, logout, `launchctl bootout` and macOS shutdown (sleep/shutdown stop work, SPEC 12). Config `engine.shutdownGraceSeconds` default 30 (ARCH005).

## 3. Scope (in)

- Shutdown coordinator, the `ShutdownParticipant` multi-port, phases, timeouts, exit codes.

## 4. Out of scope

- What a checkpoint contains and how a Run reacts to "stop": WFRT implements a participant. Recovery on next start: ENGINE005.

## 5. Detailed requirements

1. Port `ShutdownParticipant` (multi-token): `{ id, phase: 'stop_accepting' | 'quiesce' | 'checkpoint' | 'close', timeoutMs, run(ctx: { deadline: number; reason: ShutdownReason }): Promise<Result<void>> }`. Phases run in order; within a phase participants run in parallel with their own timeout.
2. Phases and owners: `stop_accepting` (gateway stops listening for new requests, existing finish; scheduler stops starting Runs; Telegram polling pauses), `quiesce` (WFRT asks running nodes to reach a safe point: finish the current atomic action or abort an idempotent one; herdr/provider sessions are left running inside the sandbox, they are resumed later), `checkpoint` (WFRT saves a checkpoint per Run via `CheckpointStore`; an event `engine.shutdown_requested` and per Run `run.interrupted` are appended), `close` (event bus drained, SSE streams closed with `events.closed{reason:'shutdown'}`, DB closed by `DatabaseLifecycle.stop`, lock/pid/socket/token files removed).
3. Deadline: `engine.shutdownGraceSeconds` from `now()` (Clock); each phase gets a share (stop 10%, quiesce 50%, checkpoint 30%, close 10%); overrun of a participant is logged `error` with its id and the coordinator proceeds.
4. Emergency fast path (second signal, uncaught exception, grace exceeded): skip quiesce, attempt checkpoint of Runs with a 3 s total budget, close DB (checkpoint WAL), remove lock files, exit with code 1 (SIGTERM-triggered clean path exits 0; emergency 1; fatal 70).
5. A reason enum: `signal`, `owner_request`, `update`, `fatal`, `system_shutdown`. `RequestEngineShutdown` (Owner scope route `POST /v1/system/shutdown`, `idempotency: key-required`, requires header `X-Overmind-Confirm: shutdown` to prevent accidental CSRF-like calls; denied when called by agent/channel) calls the coordinator and returns 202 before the socket closes.
6. Important: SIGTERM from launchd with `KeepAlive` set to crash-only (`SuccessfulExit=false`) means exit 0 leaves the engine stopped until next `ensure-running` or login; document behaviour for "quit from tray" versus "update".
7. After shutdown completes the process exits without waiting on stray handles (`process.exit` only after flushing the logger; a watchdog `setTimeout(...).unref()` forces exit at grace + 5 s).
8. Idempotent: calling shutdown twice returns the same promise.
9. Test hooks: fault points `during_checkpoint_write` and others (TEST011) are placed by the owning participants; the coordinator places `before_close` and `after_close`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`multiToken` (ARCH006), `Clock`, `CheckpointStore` (DATA006), `DatabaseLifecycle` (DATA020), logger, exit codes (SETUP016).

## 8. Architecture and code placement

Coordinator in `apps/engine/src/shutdown/`; port in application so WFRT/TG/PROV register participants in their own module files; module `engine-lifecycle.module.ts` (shared with ENGINE006 as separate files: this task owns it; ENGINE006 uses `engine-health.module.ts`).

## 9. Security and safety

`/v1/system/shutdown` is Owner-only and needs the confirmation header; agents and Telegram cannot stop the engine (denial of service). Shutdown never leaves sockets or token files behind (a stale token file could be mistaken for a live engine by the shell). Logs contain participant ids and durations only. A Run interrupted mid-action is marked so recovery treats non-idempotent actions as ambiguous (SR-18).

## 10. Errors and edge cases

- Participant hangs: timeout, continue.
- Checkpoint write fails (disk full): logged, Run marked `interrupted_without_checkpoint`; recovery replays from events.
- SIGTERM during startup: ENGINE002 fast path.
- Machine sleep during shutdown: monotonic clock continues; deadline computed from `monotonicMs`.
- Signal storm: handled idempotently.

## 11. Acceptance criteria

- [ ] Given two running fake Runs, then SIGTERM produces two checkpoints, closes SSE streams and exits 0 within the grace period.
- [ ] Given a participant that hangs, then the engine still exits within grace + 5 s.
- [ ] Given a second SIGTERM, then the emergency path runs and exits 1.
- [ ] Given agent-scope token, `POST /v1/system/shutdown` returns 403; missing confirm header returns 400.
- [ ] Lock, pid, socket and token files do not exist after clean exit.

## 12. Test plan

Unit with `FakeClock` and fake participants; child-process tests with real signals; TEST011 R-02 scenario. Commands: `pnpm vitest run apps/engine/src/shutdown`.

## 13. Parallelization notes

Participants of other areas depend on `port:ShutdownParticipant` (merge the port file first).

## 14. Open questions and assumptions

- ASSUMPTION: agent CLI sessions inside the sandbox keep running during engine restart and are re-attached on start (PROV/herdr), not stopped.
- ASSUMPTION: phase time shares 10/50/30/10.
