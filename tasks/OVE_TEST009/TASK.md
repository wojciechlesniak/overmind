---
id: OVE_TEST009
title: Build the fake herdr server simulator for provider adapter tests
area: TEST
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST001, OVE_TEST006]
soft_depends_on: [OVE_ARCH014]
provides: ["lib:fake-herdr", "bin:fake-herdr"]
needs: []
owns: ["tools/fake-herdr/**", "packages/testing/src/fake-herdr/**", "docs/testing/fake-herdr.md"]
reads: ["docs/research/herdr-analiza.md", "docs/research/prototyp-wnioski.md", "docs/adr/0026-herdr-jako-warstwa-terminali.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [26, 22, 5]
---

# OVE_TEST009: Build the fake herdr server simulator for provider adapter tests

## 1. Summary

A scriptable stand-in for the herdr background server: a Unix-socket JSON-lines API implementing the subset of methods Overmind uses (workspace, pane, agent start/prompt/wait/read/send_text, state subscription, session restore), with controllable agent states and the failure behaviours observed in the prototype (false `done`, missing `blocked` for login/choice dialogs, `agent_not_found` for manually started agents, silently rejected resume commands). It allows the herdr adapter, the command gate and the recovery logic to be tested without herdr, CLIs or containers.

## 2. Context

ADR 0026: Overmind controls herdr only through its adapter; herdr state is a hint; the command gate ("do not send to a blocked agent") always lives in Overmind; agents are started via `agent.start` with a name; resume commands must be program names from `PATH`. herdr facts: two Unix sockets with 0600, JSON lines, methods like `workspace.create`, `agent.wait`, event subscription with a 512 event buffer, schema obtainable via `herdr api schema --json` (128 methods), states `idle`, `working`, `blocked`, `done`, `unknown`. The prototype wrote a ~25 line Node adapter against it. A fake server makes the adapter contract testable and lets TEST006 CLI simulators run in a realistic host.

## 3. Scope (in)

- Node server `tools/fake-herdr/server.mjs` (zero dependencies) + CLI `fake-herdr` (`serve --socket <path> --scenario <name>`).
- Implemented API subset with exact request/response shapes captured from the real `herdr api schema` (committed snapshot `tools/fake-herdr/schema.snapshot.json`, version 0.9.3).
- State machine, scripted behaviours and fault injection control API.
- TypeScript controller `packages/testing/src/fake-herdr/` (start/stop, scenario control, assertions).

## 4. Out of scope

- The herdr adapter (PROV area) and its contract suite (TEST003 harness used by PROV). Real herdr integration tests (opt-in, later). PTY emulation fidelity beyond what the adapter reads.

## 5. Detailed requirements

1. **Transport:** Unix domain socket created with mode 0600 in a 0700 directory (path rules of ARCH005); newline-delimited JSON requests `{ "id": "...", "method": "agent.start", "params": {...} }` and responses `{ "id", "result" }` or `{ "id", "error": { "code", "message" } }`; events pushed on a subscribed connection as `{ "event": "agent.state_changed", "data": {...} }` with a 512-event ring buffer and `subscribe` accepting `since` cursor; the real error code strings are reproduced (`agent_not_found`, `blocked`, `stalled`, ...).
2. **Methods implemented (names as in the real API snapshot):** `server.ping`, `server.version` (returns `0.9.3-sim`), `workspace.create/list/close`, `pane.create/list/read/send_text/close`, `agent.start` (name, kind `claude|codex`, pane, cwd, env), `agent.list`, `agent.get`, `agent.rename`, `agent.prompt` (with `wait`, 5 s start-detection window, returns `done|blocked|stalled|working`), `agent.wait`, `agent.explain` (returns rule and evidence strings), `events.subscribe`, `session.save/restore` (state persisted in `FAKE_HERDR_STATE_DIR/session.json` atomically), `integration.status`. Unknown methods return `method_not_found`. Additive fields in responses may be injected by a scenario (`extraFields`) to prove the adapter tolerates additions.
3. **Agent hosting:** `agent.start` launches the configured child (the TEST006 simulators by default via a pty when `node-pty` exists, else pipes) with cwd and env; the server screen-scrapes the child's output buffer (ring buffer of last N lines) to implement `pane.read`; state is derived by herdr-like rules: process alive and output recently -> `working`; idle prompt -> `idle`; **blocked only when a permission dialog with a diff is visible** (matches the Claude/Codex permission screens), NOT for login errors or choice dialogs (reproducing the prototype bug); after a prompt completes herdr reports `done` until the result is "collected" (`agent.get` with `ack`), matching the fifth state.
4. **Prototype failure modes as switchable behaviours** (`faults`): `falseDone` (report `done` regardless of effects), `missedLoginRequired` (idle/done on 401 text), `missedChoiceDialog`, `agentNotFoundForManual` (agents started via `pane.send_text`/manual process are not addressable by `agent.prompt` until renamed), `silentResumeReject` (resume command given as a path is dropped and the report vanishes with no error), `promptWhileBlocked` (accepts a prompt even when blocked — the real herdr rejects, the fake can do both to test the gate), `stalledWait` (`--wait` returns `stalled` after 5 s), `eventDrop` (drops events beyond buffer), `restartLoss` (server restarts losing in-memory state but restoring `session.json`), `slowStart`, `crashServer` (exit mid-request), `socketPermsWrong` (0666, to test adapter refusal), `versionMismatch` (reports a different version string for pin checks).
5. **Control API:** a second socket (or in-process JS API for the controller) not part of herdr: `setState(agent, state)`, `emitEvent`, `injectFault(name, opts)`, `clearFaults()`, `restart({ crash?: boolean })`, `snapshot()`, `calls()` (recorded requests with redacted params; used to assert the adapter never sent `agent.prompt` to a blocked agent and did not retry a timed-out prompt).
6. **Naming rule reproduced:** resume command given to `agent.report`/session restore must resolve to a bare program name; a path is silently ignored, as in the prototype; the adapter test asserts it validates this before sending (checks `calls()` and response).
7. **Schema fidelity check:** `tools/fake-herdr/check-schema.ts` compares the fake's method list and param shapes against `schema.snapshot.json`; the snapshot is refreshed only deliberately by a script run against a real herdr (opt-in) so drift between the real API and the fake is visible in a PR diff.
8. **Controller library** `FakeHerdr.start({ scenario, childCli: 'fake-claude' | 'fake-codex', faults? })` returns `{ socketPath, control, stop() }`; scenarios reuse TEST006 names for the hosted CLI behaviours; deterministic time via `FAKE_HERDR_TIME_SCALE`.
9. **Contract suite for herdr adapter:** this task contributes `HerdrClientContract` expectations (list in the doc) used by PROV: start named agent; prompt gate; blocked handling; state mapping to Overmind `AgentState` (`working`, `waiting_approval`, `needs_login`, `idle`, `done_unclaimed`); event subscription with cursor; reconnect after server restart; schema tolerance; permissions of the socket; version pin.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

TEST006 simulators as hosted children; atomic file writes for `session.json` (reimplemented minimally, no ARCH013 dependency to keep the tool standalone); ARCH005 socket path rules; TEST003 harness.

## 8. Architecture and code placement

`tools/fake-herdr/{server.mjs,methods/*.mjs,state-machine.mjs,faults.mjs,schema.snapshot.json,check-schema.ts}`; controller `packages/testing/src/fake-herdr/{launch.ts,control.ts}`. Methods are one file each (OCP). Tool-only; excluded from production bundles.

## 9. Security and safety

The fake intentionally models unsafe herdr behaviours (accepting a prompt while blocked, false done), so it must never be available in release builds (bundle assertion) and its socket is created 0600 in a temp dir. Children are the harmless simulators. No real herdr credentials or config are touched; `HERDR_*` environment is not inherited from the developer's shell (explicit env).

## 10. Errors and edge cases

- Client sends malformed JSON: error response, connection stays open; very long lines (> 1 MiB) closed.
- Two clients subscribe: each gets events independently.
- Agent process exits: state `unknown`/`done` per rules; `agent.get` shows exit info.
- Socket path > 104 bytes: server fails with the same error the adapter must handle (ARCH005 fallback).
- Time-scaled waits: `5 s` detection window scaled; tests use `FAKE_HERDR_TIME_SCALE=0.01`.
- Stale socket file: removed only if no listener.

## 11. Acceptance criteria

- [ ] The fake serves every listed method with response shapes matching `schema.snapshot.json` (schema check passes).
- [ ] Each fault in requirement 4 is switchable and has a test showing the observable behaviour.
- [ ] `blocked` appears only for permission dialogs with diffs; login and choice dialogs yield `idle`/`done` unless a fault changes it (documented prototype bug reproduction).
- [ ] State `done` persists until acknowledged; events carry cursors and respect the 512 buffer.
- [ ] Server restart restores sessions from `session.json`; `restartLoss` drops volatile state.
- [ ] Controller can run the adapter-facing scenario "start named claude agent, prompt, wait, read" with TEST006 hosting.
- [ ] Socket permissions are 0600; wrong-perms fault is available.
- [ ] Docs list methods, faults, scenarios and the adapter contract expectations.

## 12. Test plan

Self-tests with a raw JSON-lines client (`tools/fake-herdr/test/*.test.mjs`): method behaviour, faults, schema check, restart; integration with TEST006 children on pipes/pty. Commands: `pnpm vitest run tools/fake-herdr packages/testing/src/fake-herdr`.

## 13. Parallelization notes

Needed by PROV early; the minimal slice (`agent.start`, `agent.prompt`, `agent.get`, `pane.read`, subscriptions) should merge first, faults later. Method files are independent. Coordinate with PROV on the `AgentState` mapping table.

## 14. Open questions and assumptions

- ASSUMPTION: the real API snapshot is obtained by the Owner or CI once via `herdr api schema --json` (0.9.3); until then the fake uses the shapes documented in the research files and marks unknown fields `provisional`.
- Open: remote-machine (SSH) mode of herdr is not emulated (SPEC 18 open item).
