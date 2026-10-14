---
id: OVE_SETUP012
title: "Local development scripts: pnpm dev, isolated dev data directory, mock gateway"
area: SETUP
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_SETUP001, OVE_SETUP002, OVE_SETUP009]
soft_depends_on: [OVE_SETUP016, OVE_SETUP004]
provides: ["lib:dev-environment", "lib:mock-gateway", "lib:dev-data-dir-guard"]
needs: ["lib:data-directory-layout"]
owns:
  - tools/dev/**
  - tools/mock-gateway/**
  - docs/engineering/local-development.md
reads: ["apps/desktop/vite.config.ts", "packages/contracts/src", "package.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 15"]
adr_refs: [5, 20, 22]
---

# OVE_SETUP012: Local development scripts: `pnpm dev`, isolated dev data directory, mock gateway

## 1. Summary

Give every developer and agent a one-command development environment that can never touch the Owner's real Overmind data, keychain, repositories or CLI logins: an orchestrator that starts the engine (or a mock gateway) with a throw-away data directory and fake providers, plus the Vite dev server. The mock gateway also serves the UI and Playwright tests without a running engine.

## 2. Context

Several agents work at the same time in separate worktrees (CONVENTIONS section 5), so dev environments must not collide on ports, sockets or data directories, and must be safe: a dev run must never read `~/Library/Application Support/Overmind`, never use the real Keychain, never start real isolation containers or real CLI sessions unless explicitly asked. The gateway is an owner-only Unix socket (PLAN section 1); Unix socket paths are limited to 104 bytes on macOS. The data-directory layout and configuration are OVE_ARCH005; the fake CLI providers are OVE_TEST006; contracts and JSON Schema are OVE_ARCH008; the UI bridge to the socket is OVE_SETUP010.

## 3. Scope (in)

- `tools/dev/run.ts` orchestrator and sub-commands, `tools/dev/data-dir-guard.ts`.
- `tools/mock-gateway/` server, scenario format, a first set of scenarios.
- Root scripts' implementations (names fixed in OVE_SETUP001): `dev`, `dev:mock`, `dev:engine`, `dev:ui`, `dev:reset`, `dev:tauri`.
- `docs/engineering/local-development.md`.

## 4. Out of scope

- The engine entry (OVE_SETUP016) and real gateway routes (ENGINE area). Until OVE_SETUP016 exists `pnpm dev` uses the mock gateway.
- The fake CLI simulators: OVE_TEST006 (this task only sets the environment switch to use them).
- Playwright harness and fixtures beyond the shared mock server: OVE_TEST004 builds on `lib:mock-gateway`.
- Tauri shell bridge: OVE_SETUP010.

## 5. Detailed requirements

1. **Commands.** `pnpm dev`: starts engine (if `apps/engine` entry exists, else mock gateway) + Vite; `pnpm dev:mock`: mock gateway + Vite; `pnpm dev:engine`: engine only; `pnpm dev:ui`: Vite only (expects a gateway at the configured address); `pnpm dev:reset`: deletes the dev data directory after confirming it is inside the repository; `pnpm dev:tauri`: `tauri dev` with the same environment. Options: `--real-providers`, `--real-isolation`, `--port-offset N`, `--keep-data`.
2. **Environment set by the orchestrator** (names are defaults; the authoritative names are those of OVE_ARCH005, adapt and keep one constants file `tools/dev/env.ts`): `OVERMIND_ENV=dev`, `OVERMIND_DATA_DIR=<repo>/.dev-data/<worktree-hash>/` (the hash is the first 8 hex chars of SHA-256 of the absolute worktree path, so two worktrees never share data), `OVERMIND_PROVIDER_MODE=fake` (fake-claude/fake-codex), `OVERMIND_KEYCHAIN=memory`, `OVERMIND_SANDBOX=fake` (fake container CLI), `OVERMIND_TELEGRAM=disabled`, `OVERMIND_LOG_LEVEL=debug`. Real modes require explicit flags and print a red warning banner naming the risk.
3. **Data-directory guard (`data-dir-guard.ts`).** Before starting anything: resolve `OVERMIND_DATA_DIR` with `realpath`; refuse to start (exit 2) if it equals, contains, or is inside `~/Library/Application Support/Overmind`, `~/Library/Logs/Overmind`, `~/Library/Containers`, `~/.claude`, `~/.codex`, or the home directory; refuse if it is a symlink pointing outside the repository; create it with mode 0700. `dev:reset` additionally requires the target to be under `<repo>/.dev-data/`. The guard is a pure function with an injected `homedir` so it is unit-testable; the engine repeats the check in its own bootstrap (ENGINE area, port `lib:data-directory-layout`).
4. **Sockets and ports.** Runtime directory `OVERMIND_RUN_DIR` = `${TMPDIR}/ovm-<hash>/` (short, mode 0700) holding `gateway.sock` and `engine.sock`; the orchestrator asserts the final socket path is < 100 bytes. TCP ports (loopback only): Vite 5173 + offset, dev HTTP gateway 7878 + offset, Storybook 6006 + offset. Port offset defaults to `hash(worktree) % 50 * 10` so parallel worktrees do not collide; printed at startup.
5. **Browser-only mode.** A plain browser (and Playwright) cannot reach a Unix socket, so in `OVERMIND_ENV=dev` the mock gateway and the dev engine expose the same API on `127.0.0.1:<port>` with the same bearer token mechanism; Vite proxies `/v1` to it (`server.proxy`, configured by the orchestrator through an env var read by `vite.config.ts`; if `vite.config.ts` needs a new line for that, it is added through a proposal to OVE_SETUP009, see 13). This path is dev-only and excluded from production builds (ASSUMPTION; the transport decision belongs to ENGINE, see OVE_SETUP010 question 1).
6. **Orchestrator behaviour.** Written with `node:child_process` only (no `concurrently`): spawn children with prefixed, colourised output; wait for readiness (socket file exists and answers `GET /v1/health`, Vite port open); on SIGINT/SIGTERM or when any child exits non-zero, terminate all children (SIGTERM, then SIGKILL after 5 s) and exit with the failing code; no zombie processes (test). A child that exits 0 unexpectedly is also an error. Logs of children also go to `.dev-data/<hash>/logs/dev-<name>.log` (mode 0600).
7. **Mock gateway.** `tools/mock-gateway/server.ts`: HTTP/1.1 server on a Unix socket (and optionally loopback), routes defined by scenario files `tools/mock-gateway/scenarios/<name>.json`: `{ "name", "routes": [ { "method", "path", "status", "headers"?, "body"? | "bodyFile"?, "delayMs"?, "stream"?: [ { "afterMs", "event", "data" } ] } ], "state"?: {...} }`. Responses are validated at server start against the zod/JSON Schema contracts when `@overmind/contracts` has them (warn-only until OVE_ARCH008 lands; error afterwards). Supports server-sent events for `/v1/events` with scripted sequences, `Retry-After`, 4xx/5xx and slow responses for UI loading/error states. Path parameters `:id` supported with templating `{{params.id}}`. A control endpoint `POST /__mock/scenario` (loopback and token required) switches scenario at runtime for tests. Default scenario `empty-install` (no Workspace), plus `one-workspace`, `engine-unavailable`, `paused` as the first set; other areas add scenario files in their own folder `tools/mock-gateway/scenarios/<area>/` (extension point).
8. **Auth in mocks.** The mock requires `Authorization: Bearer <token>` where the token is generated per run and printed once to the dev console and written to `${OVERMIND_RUN_DIR}/token` (mode 0600). It mimics the real header behaviour so UI auth code paths are exercised; the token is random 32 bytes hex, never a fixed value.
9. **Documentation.** `docs/engineering/local-development.md`: prerequisites (Node 22 via nvm/corepack, Rust only for `dev:tauri`), the command table, environment variables, ports, how to run two worktrees at once, how to use real providers safely, troubleshooting (path too long, stale socket, port in use).
10. **Stale resources.** On start, the orchestrator removes its own stale sockets (only inside `OVERMIND_RUN_DIR`), never kills processes by name; it kills only PIDs it recorded in `${OVERMIND_RUN_DIR}/pids.json` if they still match the recorded start time.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses env constants from OVE_ARCH005 (single `env.ts` adapter), contracts from OVE_ARCH008 for response validation, fake providers from OVE_TEST006, Vite config from OVE_SETUP009. The mock gateway is THE mock used by OVE_TEST004; tests must not create a second one.

## 8. Architecture and code placement

Tooling in `tools/dev/` and `tools/mock-gateway/` (TypeScript run with `tsx`). The mock gateway imports contract schemas (read-only) but no domain or application code, so it cannot drift into business logic. No product package imports `tools/`.

## 9. Security and safety

- **Isolation of dev from real data is the core safety requirement**: data-dir guard, memory Keychain, fake providers, fake sandbox, Telegram disabled by default, real modes behind flags with warnings.
- Sockets in a 0700 directory with 0600 files; tokens random per run; dev HTTP bound to 127.0.0.1 only (never 0.0.0.0); `Host` header checked against `127.0.0.1:<port>` and `localhost:<port>` to prevent DNS rebinding.
- The mock control endpoint cannot be reached without the token and only from loopback.
- Dev logs may contain fixtures; fixtures must not contain real secrets (scanner in OVE_SETUP007 applies).
- A malicious scenario file is repo content, not instructions: scenarios are plain data; the server never executes code from them (no templating beyond `{{params.x}}` substitution of a whitelisted variable set).
- `--real-providers` mode runs real CLIs with the Owner's login; the banner says so; the engine still runs agent commands only in real isolation, which `--real-isolation` must also be set for; real providers without real isolation are refused (fail closed).

## 10. Errors and edge cases

- Worktree path so long the socket path exceeds 100 bytes: shorter hash directory under `TMPDIR`; if still too long, fail with a clear message.
- Port conflict: offset computed; if still busy, increment offset by 10 up to 5 times, else fail.
- Engine crashes on boot: orchestrator exits non-zero and prints the last 50 log lines.
- `.dev-data` present from an older schema: engine migration behaviour applies; `dev:reset` is the documented fix.
- SIGKILL of the orchestrator leaves children: next start finds `pids.json`, verifies start times, terminates only matching leftovers.
- `HOME` unset or weird: guard refuses to run.
- Mock scenario with invalid JSON: server refuses to start and names the file.

## 11. Acceptance criteria

- [ ] `pnpm dev:mock` starts the mock gateway and Vite; `curl` with the printed token on the loopback port returns the `empty-install` scenario; without the token returns 401.
- [ ] Given `OVERMIND_DATA_DIR=$HOME/Library/Application Support/Overmind`, the guard exits 2 and nothing starts (unit test with injected homedir plus a manual check).
- [ ] Given a symlink data dir pointing to `~`, the guard refuses.
- [ ] Two worktrees run `pnpm dev:mock` concurrently without port or socket collisions.
- [ ] Ctrl-C leaves no child process (checked by listing PIDs from `pids.json`).
- [ ] Switching scenario via `/__mock/scenario` changes responses and SSE sequences.
- [ ] Default mode uses fake providers/keychain/sandbox; `--real-providers` without `--real-isolation` is refused.
- [ ] `docs/engineering/local-development.md` contains the command and variable tables.

## 12. Test plan

Unit tests: guard (table of paths), port offset calculation, socket path length, scenario loader/validator, route matcher and templating. Integration tests (`*.int.test.ts`): start the mock server on an ephemeral socket, issue requests with `node:http` (`socketPath`), SSE streaming order and timing with fake timers where possible; orchestrator test using two tiny child scripts (one stays up, one crashes) to verify teardown. Commands: `pnpm test -- tools/dev tools/mock-gateway`, `pnpm test:int`.

## 13. Parallelization notes

Parallel with OVE_SETUP010, 011, 013. Hotspot: `vite.config.ts` (OVE_SETUP009 owns it): the proxy requirement is delivered by a small additive proposal `tasks/_proposals/OVE_SETUP012-vite-proxy.md` unless OVE_SETUP009 already reads `process.env.OVERMIND_DEV_PROXY`; recommended: OVE_SETUP009 reads that variable from the start. Other areas add scenarios in their own subfolders; the scenario loader auto-discovers `scenarios/**/*.json`.

## 14. Open questions and assumptions

- ASSUMPTION: `OVERMIND_*` variable names; adopt OVE_ARCH005's names once they exist.
- ASSUMPTION: dev-only loopback HTTP transport (requirement 5); ENGINE decides the production transport.
- Open question: should the orchestrator also start Storybook? Default no (`pnpm storybook` stays separate to keep `pnpm dev` fast).
