---
id: OVE_ENGINE003
title: Single-instance lock, pid file and stale resource cleanup at engine start
area: ENGINE
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH007, OVE_ARCH013, OVE_ARCH014, OVE_ENGINE002]
soft_depends_on: []
provides: ["lib:engine-lock", "port:InstanceLock"]
needs: ["lib:data-dir", "port:Clock", "port:Logger", "port:ProcessRunner"]
owns: ["apps/engine/src/bootstrap/instance-lock.ts", "packages/application/src/ports/InstanceLock.ts", "packages/adapters/system/src/instance-lock/**"]
reads: ["docs/architecture/data-directory.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5, 10]
---

# OVE_ENGINE003: Single-instance lock and stale resource cleanup

## 1. Summary

Guarantee exactly one engine per user and data directory. A second start exits cleanly with code 10 (already running); leftovers of a crashed engine (pid, lock, socket, token) are cleaned only when provably dead.

## 2. Context

ADR 0005: the engine runs as a LaunchAgent with `KeepAlive`, the app also calls `ensure-running`, so concurrent starts are normal. ARCH005 defines `run/engine.lock`, `engine.pid`, `gateway.sock`. TEST011 scenarios R-15 and R-16 verify behaviour.

## 3. Scope (in)

- `InstanceLock` port and Node adapter; stale detection; startup cleanup; `already_running` outcome.

## 4. Out of scope

- Socket creation (ENGINE010). Service installation (ENGINE008).

## 5. Detailed requirements

1. Lock mechanism: exclusive creation of `run/engine.lock` (`O_CREAT|O_EXCL`, mode 0600) holding JSON `{ pid, startedAt, bootId, version }`; Node has no portable `flock`, so liveness is decided by pid check plus start-time check (`ps -o lstart= -p <pid>` through `ProcessRunner`, or `process.kill(pid, 0)` plus compare with recorded `startedAt` within 2 s) to defeat pid reuse.
2. `acquire()` returns `Result<LockHandle, AppError>`: free -> acquired; held by a live engine -> `config.already_running` (retryable false); held by a dead process -> stale: remove lock, pid file, `gateway.sock`, `gateway.sock.path` target, `session-token`, and retry once (log `warn` with the dead pid).
3. Two engines racing: the loser of `O_EXCL` re-reads the lock, sees a live owner, exits with code 10. A race on stale removal is handled by renaming the stale lock to `engine.lock.stale-<ulid>` (atomic) before creating the new one.
4. Writes `engine.pid` (0600) after the lock; both files removed on clean shutdown (ENGINE004). A heartbeat file mtime update every 10 s (`run/engine.heartbeat`) lets the shell distinguish a hung engine from a dead one (read-only for others).
5. Never kills another process. If a live process holds the lock but does not answer on the socket within 15 s (hung), the new engine still exits 10 and reports `engine_unresponsive` in its JSON detail; recovery from hangs is a manual or launchd decision (ENGINE008 uses `KeepAlive` only for crashes).
6. Cleanup of `tmp/` (ARCH005) happens only after the lock is held.
7. Output for `ensure-running`: the lock info (pid, version) is what ENGINE009 reports.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AtomicFileWriter` for the pid file, `ProcessRunner` (argv only: `ps`), `Clock`, data-dir layout (ARCH005).

## 8. Architecture and code placement

Port `InstanceLock` in application; adapter `packages/adapters/system/src/instance-lock/`; bootstrap step `apps/engine/src/bootstrap/instance-lock.ts`.

## 9. Security and safety

All files 0600 in the 0700 `run/` directory; symlinks refused (a planted symlink named `engine.lock` fails closed). The lock content is not trusted for anything but liveness; it never causes a kill. A stale-removal bug could delete a live engine's socket, so removal requires the dead-process proof twice (pid dead and start time mismatch) and never touches a socket that answers.

## 10. Errors and edge cases

- pid reused by an unrelated process: start-time mismatch -> treated as stale.
- Lock file empty or corrupt (crash during write): treated as stale after 5 s age.
- `run/` missing: recreated by the initializer before acquire.
- Clock changes: only `startedAt` equality with tolerance is used.
- Two users on one Mac: each has own data dir; the lock is per directory.

## 11. Acceptance criteria

- [ ] Given a live engine, a second start exits 10 and leaves the first untouched.
- [ ] Given a kill -9 leftover, the next start cleans pid/lock/socket/token and runs.
- [ ] Given a reused pid, the lock is treated as stale.
- [ ] Given a symlinked `engine.lock`, start fails closed.
- [ ] Two simultaneous starts yield exactly one engine (100 iterations).

## 12. Test plan

Unit with fake `ProcessRunner`/`Clock`; integration spawning real node processes; contract suite `InstanceLock.contract.ts` (TEST003) for the adapter and a fake. Commands: `pnpm vitest run packages/adapters/system/src/instance-lock`.

## 13. Parallelization notes

Parallel with ENGINE004..006 once ENGINE002 exists.

## 14. Open questions and assumptions

- ASSUMPTION: pid + start-time liveness is sufficient (no native flock).
