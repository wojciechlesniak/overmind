---
id: OVE_PROV004
title: Implement the herdr JSON-lines client with version pin, schema tolerance and reconnect
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH007, OVE_BOX002, OVE_BOX020, OVE_SETUP015, OVE_TEST009]
soft_depends_on: [OVE_TEST009, OVE_BOX020]
provides: ["lib:herdr-client", "contract:HerdrConfig"]
needs: ["lib:herdr-bundle", "port:Clock", "port:Logger", "port:SandboxSocketBridge", "lib:redaction", "lib:fake-herdr"]
owns:
  - packages/adapters/herdr/package.json
  - packages/adapters/herdr/tsconfig.json
  - packages/adapters/herdr/src/client/**
  - packages/contracts/src/config/sections/herdr.config.ts
reads: ["docs/research/herdr-analiza.md", "docs/research/box-channels-spike.md", "vendor/herdr/api-schema.*.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 13", "SPECIFICATION 17"]
adr_refs: [5, 26]
---

# OVE_PROV004: Implement the herdr JSON-lines client with version pin, schema tolerance and reconnect

## 1. Summary

A small, dependency-free client for the herdr public API (newline-delimited JSON over a Unix socket, methods like `agent.start`, `pane.read`, `events.subscribe`). It enforces the pinned herdr version, socket permissions, request timeouts, additive-schema tolerance and automatic reconnect with event cursors. It is the only code that speaks herdr's wire protocol.

## 2. Context

ADR 0026: herdr runs inside the isolation; Overmind uses its local JSON API only through its own adapter interface. The prototype's adapter was about 25 lines of Node; herdr's schema is generated from code (`herdr api schema --json`, 128 methods in 0.9.3) with additive-only changes. The socket reaches the host through the `SandboxSocketBridge` (OVE_BOX020; the transport decision is OVE_BOX002). herdr facts: two sockets with mode 0600 (public JSON and private binary; only the public one is used), subscription buffer of 512 events, `agent.prompt --wait` start-detection of 5 s, errors with codes such as `agent_not_found`.

## 3. Scope (in)

- `HerdrClient` (connect, call, subscribe, close) over an injected `HerdrTransport`.
- Version check against the pinned version and schema snapshot compatibility check.
- Typed method wrappers for the subset Overmind uses; unknown methods callable through a guarded generic path.
- Config section `herdr`.

## 4. Out of scope

- TerminalLayer semantics and state mapping (PROV005, PROV006). Starting the herdr server in the Environment (BOX020/PROV009). Real herdr integration tests beyond opt-in (later).

## 5. Detailed requirements

1. **Transport:** `interface HerdrTransport { connect(): Promise<Result<Duplex>>; describe(): { path: string } }`. Default `UnixSocketTransport` takes the host path from `SandboxSocketBridge.open(envId, 'herdr')`. Before use it checks with `lstat`: it is a socket, owned by the current user, mode `0600`, parent directory `0700` and not a symlink; otherwise `herdr.socket_insecure` (fake-herdr has the `socketPermsWrong` fault for this test).
2. **Framing:** one JSON object per line, UTF-8, max line 1 MiB (longer closes the connection with `herdr.protocol_error`). Requests `{ id, method, params }`, responses `{ id, result }` or `{ id, error: { code, message } }`, events `{ event, data }`. Ids are monotonically increasing strings per connection. Unknown fields in any response or event are ignored (additive changes); a missing required field yields `herdr.protocol_error`, not a crash.
3. **Calls:** `call<M extends HerdrMethod>(method, params, { timeoutMs = 10000, signal })` returns `Result<HerdrResult<M>, HerdrError>`. The error mapping: herdr `agent_not_found` -> `HerdrError.agent_not_found`, `blocked` -> `blocked`, `stalled` -> `stalled`, other codes preserved as `unknown_error` with the code string. The `message` text from herdr is never forwarded to users (kept only in debug logs after redaction).
4. **Typed subset:** `server.ping`, `server.version`, `workspace.create|list|close`, `pane.create|list|read|send_text|close`, `agent.start|list|get|rename|prompt|wait|explain`, `events.subscribe`, `session.save|restore`, `integration.status`. Zod schemas for params/results live in `src/client/methods/*.ts` (one file per method group), derived by hand from the committed schema snapshot `vendor/herdr/api-schema.<version>.json` (SETUP015); a CI check compares method names and required params with the snapshot and fails on removals (additive-only guard).
5. **Version pin:** on connect call `server.version`; compare to `HERDR_PINNED_VERSION` (compiled from `vendor/herdr/VERSION`). Same version: ok. Different patch/minor within the same major: `degraded` with warning `herdr.version_drift` and allowed only if `herdr.config.allowVersionDrift` (default false); different major or lower: blocked `herdr.version_unsupported`. The bundled binary is the source of truth, so a mismatch normally means a tampered or wrong binary: audit event `provider.herdr_version_mismatch`.
6. **Subscription:** `subscribe({ since?: cursor, filter })` returns an async iterator of events with cursors; on disconnect reconnects with exponential backoff (200 ms to 5 s, jitter) and resumes from the last cursor; if the cursor is older than the 512-event buffer a synthetic `resync_required` event is yielded and the consumer must re-read state via `agent.list`/`pane.read` (state is never reconstructed from events alone).
7. **Reconnect and in-flight calls:** calls in flight when the connection drops fail with `herdr.connection_lost` and are NOT retried automatically if the method is non-idempotent (`agent.prompt`, `pane.send_text`, `agent.start`); idempotent reads (`list`, `get`, `read`, `ping`) are retried once.
8. **Limits:** max 32 concurrent in-flight calls, queue 100, `herdr.overloaded` beyond; per-call timeout default 10 s (`agent.prompt` with `wait` uses its own up to 120 s); heartbeat `server.ping` every 15 s when idle; two missed pings mark the client `disconnected`.
9. **Logging:** log method name, id, duration, outcome class at debug; params only after the redactor and with `pane.send_text`/`agent.prompt` text replaced by length and sha256 prefix (prompts may contain Owner data).
10. **Config `herdr`:** `callTimeoutMs`, `reconnectMaxMs`, `allowVersionDrift` (false), `eventBufferHint` (512); no paths here (paths come from the bridge).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Result`/errors (ARCH003), `Logger` and redaction (ARCH004), `SandboxSocketBridge` (BOX020), fake server (TEST009) for all tests, pinned version constants (SETUP015).

## 8. Architecture and code placement

`packages/adapters/herdr/src/client/{herdr-client.ts,transport.ts,unix-socket-transport.ts,framing.ts,errors.ts,reconnect.ts,methods/*.ts}`. Adapter layer, depends on application ports and contracts; no import of other adapters. SRP: framing, transport, reconnect and method typing are separate files.

## 9. Security and safety

The client talks to a process that controls terminals, so: only a verified-permission Unix socket, no TCP fallback, bounded line and queue sizes, no eval of any response field, no use of herdr messages as user text, prompts never logged, version pin enforced (SR-28). Hostile herdr behaviour (malformed JSON, huge lines, event floods, duplicate ids) must not crash the engine: parser errors close the connection with a protocol error and trigger a bounded reconnect. Remote manifest updates are disabled elsewhere (SETUP015, BOX020 env).

## 10. Errors and edge cases

- Socket path missing because the Environment is not up: `herdr.unavailable`, retry per backoff, give up after 30 s with a typed error.
- herdr restarts and loses in-memory state (fake fault `restartLoss`): subscription resumes with `resync_required`.
- Response for an unknown id: ignored with a debug log.
- Two responses with the same id: second ignored.
- Event flood (> 1000/s): consumer backpressure; the client drops oldest non-state events and emits `events_dropped` count.
- Clock changes during timeouts: monotonic timers.

## 11. Acceptance criteria

- [ ] Against `fake-herdr`: ping, version, start agent, prompt, read pane, subscribe with cursor all work.
- [ ] Wrong socket mode (0666) is refused with `herdr.socket_insecure`.
- [ ] Version mismatch blocks (major) or degrades only when allowed (config); audit event emitted.
- [ ] Unknown extra fields in responses are ignored; missing required fields give `herdr.protocol_error`.
- [ ] Connection loss: reads retry once, `agent.prompt`/`pane.send_text`/`agent.start` never retried.
- [ ] Subscription resumes from cursor; stale cursor yields `resync_required`.
- [ ] Prompt text never appears in logs (`expectNoSecrets` plus length-only assertion).
- [ ] Schema guard test fails when a method present in the snapshot is missing in the typed subset (for the subset names) or removed from the snapshot.

## 12. Test plan

Unit tests for framing and reconnect (fake transport, fake clock); integration tests with `FakeHerdr` (TEST009) including faults `eventDrop`, `restartLoss`, `crashServer`, `socketPermsWrong`, `versionMismatch`; `HerdrClientContract` expectations implemented in PROV024. Commands: `pnpm vitest run packages/adapters/herdr/src/client`.

## 13. Parallelization notes

Needs only the fake herdr minimal slice and the bridge interface (stub with a temp-dir socket). PROV005 builds on it.

## 14. Open questions and assumptions

- ASSUMPTION: method names and shapes follow TEST009's list until the real schema snapshot is committed; fields not in the snapshot are marked `provisional` in the zod files.
- Open: use of herdr `explain` for Activity evidence (kept optional).
