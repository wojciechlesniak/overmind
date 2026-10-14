---
id: OVE_ENGINE029
title: "Provide the Scheduler port and a timer-based JobScheduler implementation"
area: ENGINE
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH006, OVE_ARCH007, OVE_ENGINE004, OVE_PAUSE005]
soft_depends_on: []
provides: ["port:Scheduler", "port:JobScheduler", "lib:job-scheduler"]
needs: ["lib:result", "port:Clock", "port:ShutdownParticipant", "port:PauseGate"]
owns: ["packages/application/src/ports/Scheduler.ts", "packages/application/src/ports/JobScheduler.ts", "packages/adapters/scheduler/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [5, 24]
---

# OVE_ENGINE029: Provide the Scheduler port and a timer-based JobScheduler implementation

## 1. Summary

Defines one scheduler abstraction used by every area that needs periodic or delayed work (Approval expiry, review-date scans, notification reminders, sandbox reaping, backups). `Scheduler` is the low-level timer port (setTimeout/setInterval semantics on the injected Clock); `JobScheduler` registers named, single-flight, pausable jobs on top of it. `port:Scheduler` and `port:JobScheduler` are the same capability at two levels so consumers can pick the narrow one.

## 2. Context

Several tasks (PERM014, PERM016, PERM022, DEC010, DISC006, BOX016, BOX022) declared a need for a scheduler but no task owned it. Without a shared port every area would write its own timers, which breaks DRY and makes Global Pause, graceful shutdown and tests (fake clock) inconsistent. The engine is a long-running local process (ADR 0005); timers are in-process and are re-registered at start by their owners (nothing is persisted here; durable due-times live in the owner's table).

## 3. Scope (in)

- `Scheduler` port: `after(ms, fn): Handle`, `every(ms, fn, opts): Handle`, `cancel(handle)`, all driven by `Clock` (OVE_ARCH007).
- `JobScheduler` port: `register(job: JobDefinition): Disposable` and `trigger(name)`; `JobDefinition = { name, schedule: {everyMs}|{cron}|{atLocalTime}, singleFlight: true, runWhilePaused: boolean, timeoutMs, handler(ctx) }`.
- System adapter (Node timers) and a deterministic fake that advances with the fake clock from OVE_TEST002.
- `ShutdownParticipant` integration: on shutdown all handles are cancelled and running handlers get an abort signal.

## 4. Out of scope

- Persisting job state or catch-up after sleep: owners that need it (backups, review dates) compute missed runs themselves (OVE_BACKUP006, OVE_DEC010).
- Cron UI or Owner-visible scheduling: later / not planned.
- Telegram or notification timing rules: OVE_NOTIF002.

## 5. Detailed requirements

1. Types are zod-free plain TypeScript interfaces in the port files; `JobDefinition.name` MUST match `^[a-z0-9]+(\.[a-z0-9-]+)*$` and be unique, a duplicate `register` returns `Err(scheduler.duplicate_job)`.
2. Single-flight: if a run is still executing when the next tick fires, the tick is skipped and a counter `skippedTicks` is exposed through `JobScheduler.stats()`; no queue builds up.
3. Handlers receive `{ now, signal, runId }`; exceptions are caught, logged with the job name through `Logger` (OVE_ARCH004) and never crash the engine; after 5 consecutive failures the job is backed off exponentially up to 10 minutes (`ASSUMPTION`).
4. Pause awareness: jobs with `runWhilePaused: false` (default) are skipped while `PauseGate` reports Global Pause (OVE_PAUSE005); jobs that must keep running (backup, audit anchors, Approval expiry) set it to `true` explicitly.
5. Timer drift: `every` is scheduled from the planned time, not from completion; a tick that is more than one interval late runs once, not N times.
6. Maximum timer horizon: delays above 24 days are chained (Node limit 2^31-1 ms) so long `after` calls never fire early.
7. The `Scheduler` fake exposes `advance(ms)` and `runDue()` and is the only scheduler used in unit tests; real timers are forbidden in tests by the test lint rule (OVE_TEST001).
8. Shutdown: `ShutdownParticipant.drain()` cancels handles, aborts running handlers and resolves within 2 seconds.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Clock` and `IdGenerator` (OVE_ARCH007), `Logger` (OVE_ARCH004), `ShutdownParticipant` (OVE_ENGINE004), `PauseGate` (OVE_PAUSE005), fake clock (OVE_TEST002).

## 8. Architecture and code placement

Layer: port in `application/ports`, implementation in `adapters/scheduler` (adapter, no I/O except timers). Depends on `Clock`, `Logger`, `PauseGate`, `ShutdownParticipant` abstractions only (DIP).

## 9. Security and safety

- No elevated capability: the scheduler only calls registered in-process handlers; it never executes data as code (no `eval`).
- Job names and failures are logged; secrets never appear because handlers get no secret context.
- Fail closed on pause: if `PauseGate` cannot be read, jobs without `runWhilePaused: true` are skipped and the failure is logged.

## 10. Errors and edge cases

- Handler throws: logged, counted, back-off applied, scheduler keeps running.
- System sleep or clock jump: next tick runs once, `every` is re-anchored; backwards jump never fires early.
- Registration after shutdown started -> `Err(scheduler.stopping)`.
- Handler ignores the abort signal: the scheduler stops waiting after the shutdown deadline and logs the job name.

## 11. Acceptance criteria

- [ ] Given two ticks while one run is in flight, when time advances, then the second is skipped and `skippedTicks` is 1.
- [ ] Given Global Pause, when a default job is due, then it does not run; a `runWhilePaused: true` job does.
- [ ] Given shutdown, when `drain()` is called, then no handler starts afterwards and in-flight handlers see an aborted signal.
- [ ] Given a duplicate job name, then `register` returns the typed error.
- [ ] Fake and real adapters pass the same contract suite.

## 12. Test plan

- Contract suite run against both adapters (names: `scheduler.single-flight`, `scheduler.pause-skip`, `scheduler.drift`, `scheduler.long-delay`).
- Unit tests with the fake clock; no sleeps.
- Commands: `pnpm --filter @overmind/scheduler test`, `pnpm typecheck`, `pnpm lint`, `pnpm check:boundaries`.

## 13. Parallelization notes

Can run in parallel with all areas after ARCH and ENGINE004 are merged; consumers stub the port with the fake. Hotspot: none; the composition-root registration happens through the module discovery of OVE_ENGINE002.

## 14. Open questions and assumptions

- `JobDefinition.atLocalTime` uses the Owner's local time zone from `ConfigService`; DST handling is the same as OVE_BACKUP006 (`ASSUMPTION`).
- Persistent schedules are intentionally not included; revisit if a job needs them.
