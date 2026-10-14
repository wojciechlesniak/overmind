---
id: OVE_ENGINE009
title: ensure-running command - start, adopt or replace the engine and report one JSON line
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH012, OVE_ENGINE003, OVE_ENGINE007, OVE_ENGINE008, OVE_ENGINE021, OVE_SETUP016]
soft_depends_on: []
provides: ["lib:ensure-running", "lib:engine-service-entry"]
needs: ["port:ServiceManager", "port:InstanceLock", "lib:engine-cli-contract", "lib:api-client-socket-transport", "port:Clock"]
owns: ["apps/engine/src/service/**", "apps/engine/src/commands/ensure-running.ts"]
reads: ["apps/engine/src/exit-codes.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5]
---

# OVE_ENGINE009: ensure-running

## 1. Summary

Implement the `ensureRunning()` hook behind `overmind-engine ensure-running --json`: make sure exactly one compatible engine is running, install or repair the LaunchAgent, start it if needed, wait until healthy, and print one JSON line with exit code 0 / 10 / 20 / 30.

## 2. Context

SETUP010 (shell) calls the sidecar on app start and on window focus. SETUP016 fixed the CLI contract (stdout exactly one JSON line `{status, pid, socket, version, protocol, detail}`; exit 0 running, 10 already running, 20 cannot start, 30 incompatible). ENGINE003 provides lock info; ENGINE007 the handshake; ENGINE008 the service.

## 3. Scope (in)

- `ensureRunning(options)` algorithm, JSON mapping, replacement of an older engine, timeouts.

## 4. Out of scope

- The Rust shell side. Engine boot (ENGINE002).

## 5. Detailed requirements

1. Algorithm (budget 15 s total): (a) read `run/engine.lock` and the socket pointer; (b) if a live engine exists, call `GET /v1/system/version` over the socket using the session token file (read with a mode check: 0600, owner uid) with a 1.5 s timeout; (c) compatible and healthy-or-starting -> status `already_running`, exit 10; (d) incompatible (engine older than this binary's protocol): ask it to stop via `POST /v1/system/shutdown` (Owner token), wait up to 10 s for lock release, then continue to start the new one; if it does not stop -> status `incompatible`, exit 30 with detail; (e) no live engine: `ServiceManager.install(spec)` (idempotent) then `start()`; if the service route is unavailable or not permitted, fall back to spawning the engine detached (`run --foreground` as an unref'd child with `detached: true`, stdio to the log file) and warn in `detail`; (f) poll `GET /v1/system/health` every 200 ms until `state` in `ready|degraded|recovering|migrating` or the budget expires (then status `failed`, exit 20).
2. Output: exactly one JSON line on stdout; all diagnostics to stderr; no extra characters even on failure (tests assert). `socket` is the resolved absolute socket path; `pid` from the lock file.
3. Race safety: concurrent `ensure-running` calls (shell on focus + LaunchAgent) are safe: the second sees the lock or loses `O_EXCL`; both report the same running engine.
4. Token handling: reads `run/session-token` only after verifying owner and mode; the token is never printed, logged, or put in argv/env of the child.
5. Rate limiting: if the last failed start was < 10 s ago (stamp in `run/ensure.stamp`) return the previous failure immediately (prevents a focus-event restart storm, SETUP010 rate limit).
6. After a macOS login with KeepAlive the engine may already run: the command is then a cheap health check (< 100 ms typical).
7. `--json` absent: human readable lines on stderr, still exit codes.
8. Update flow: the app bundle replaced -> executable path differs -> ENGINE008 rewrites the plist -> old engine replaced via step (d).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ServiceManager`, `InstanceLock`, api-client socket transport (ENGINE021) for the two HTTP calls, exit-code table (SETUP016), `Clock`.

## 8. Architecture and code placement

`apps/engine/src/service/{ensure-running.ts,spawn-detached.ts,result.ts}` and the command wiring. Outermost layer; no business logic.

## 9. Security and safety

Validates the socket and token file ownership before connecting (a planted socket from another user is refused, exit 20). Never kills processes; replacement is by asking the Owner-authenticated shutdown route. Detached spawn uses argv arrays, minimal env, the engine binary path derived from `process.execPath` (not from input). Output has no token or home path beyond the socket path (acceptable for the shell, which already knows it).

## 10. Errors and edge cases

- Token file missing while lock is live: engine starting; poll until it appears (<= 5 s).
- Engine hung (no answer): exit 20 with detail `engine_unresponsive`, no kill.
- Disk full / read-only data dir: exit 20 with the config error code.
- Two app versions installed: protocol check decides.
- Launchd refuses (login item disabled): fallback spawn, detail `service_not_permitted`.

## 11. Acceptance criteria

- [ ] No engine: command installs the service, starts it and prints `status: running`, exit 0 (fake service/engine in test).
- [ ] Live compatible engine: exit 10, nothing restarted.
- [ ] Older engine: replaced, exit 0; stuck engine: exit 30.
- [ ] stdout contains exactly one JSON line in every outcome.
- [ ] Insecure socket (mode 0666) refused.
- [ ] Ten parallel invocations result in one engine.

## 12. Test plan

Unit tests with fake service manager, fake socket server, `FakeClock`; process-level tests spawning the real entry; TEST011 R-15. Commands: `pnpm --filter @overmind/engine test`.

## 13. Parallelization notes

Takes over `commands/ensure-running.ts` from SETUP016 (ownership statement in PR).

## 14. Open questions and assumptions

- ASSUMPTION: 15 s budget (SETUP010 waits 15 s); startup beyond that reports `starting` via `status: running` with `detail: starting` once the lock is held.
