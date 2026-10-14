---
id: OVE_ONB010
title: "Expose the login terminal routes and the dedicated terminal stream"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE016, OVE_ENGINE018, OVE_ENGINE019, OVE_ENGINE022, OVE_ONB008, OVE_ONB009]
soft_depends_on: []
provides: ["api:onboarding.login.start", "api:onboarding.login.input", "api:onboarding.login.stream", "api:onboarding.login.cancel", "lib:api-client-onboarding-login"]
needs: ["lib:route-registrar", "lib:gateway-pipeline", "lib:gateway-audit", "lib:api-client", "lib:api-client-tauri-transport", "lib:gateway-test-support"]
owns: ["packages/gateway/src/routes/onboarding/login.route.ts", "packages/gateway/src/routes/onboarding/login-stream.ts", "packages/api-client/src/onboarding/login-client.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [5, 22]
---

# OVE_ONB010: Expose the login terminal routes and the dedicated terminal stream

## 1. Summary

Adds the owner-scope routes to start, feed and cancel a CLI login terminal and the dedicated terminal output stream, which deliberately bypasses the global event hub, replay and logging (SEC009 L2), with the matching api-client functions.

## 2. Context

The wizard terminal needs live bytes from the pane (ONB008). The normal push channel (ENGINE017) is wrong for this: it replays events from a log, filters by principal and may be captured by diagnostics; terminal output must never be persisted, replayed or logged. So the stream is a separate, per-session, in-memory channel with backpressure that exists only while the Owner's window is attached.

## 3. Scope (in)

- Routes: `POST /v1/onboarding/login/start`, `POST /v1/onboarding/login/:id/input`, `POST /v1/onboarding/login/:id/resize`, `GET /v1/onboarding/login/:id/stream` (SSE or chunked stream, no replay), `POST /v1/onboarding/login/:id/cancel`, `GET /v1/onboarding/login/:id` (derived state and facts only).
- Facts delivery: a second SSE event type `facts` on the same stream and via the GET (never raw text).
- api-client: `onboarding.login.start/input/resize/cancel/status` and `openLoginStream(id, { onBytes, onFacts, onClose })`.
- Gateway hygiene for this route group: body/stream excluded from logs, audit and metrics content; per-stream backpressure and idle timeout.
- Hostile-client tests.

## 4. Out of scope

- The terminal use cases (ONB008).
- UI terminal pane and keystroke mapping (ONB017).
- General push channel (ENGINE017).

## 5. Detailed requirements

1. **Start.** `POST login/start { providerId, callbackForward?: boolean (default false) }` -> `LoginTerminalSession` (ONB001); errors `onboarding.login_busy`, `provider.not_installed`, `isolation.unavailable`. Requires the ONB006 gate rows `apple_container`, `isolation_test`, `herdr` ready (checked by the use case through `RequireIsolation`).
2. **Input.** `POST login/:id/input { data }` max 4 KiB, rate 64 KiB/min; returns 204; `resize { cols 20..300, rows 5..100 }` 204.
3. **Stream.** `GET login/:id/stream`: `Content-Type: text/event-stream`, events: `output` with base64 of raw bytes (chunks up to 4 KiB, base64 to keep SSE text-safe), `facts` (JSON `LoginScreenFacts`), `state` (JSON session state), `close`. No `id:` fields and no `Last-Event-ID` support (no replay); heartbeat comment every 15 s; the server closes after the session ends, on idle 10 min or when a second consumer attaches (only one subscriber: the new one receives `busy` and closes).
4. **Transport through Tauri.** The Tauri bridge `gateway_subscribe` streams SSE to the webview (ENGINE022); the stream route is allowed through it without special handling; the api-client's `openLoginStream` decodes base64 and exposes `Uint8Array` to the terminal.
5. **No capture rule.** The gateway pipeline marks the route group `sensitiveStream: true`: request/response bodies and stream payloads are not logged, not audited (only start and end events), not counted by size in metrics beyond total bytes, and are excluded from the diagnostics/support bundle (ENGINE025). A test replaces the logger with a spy and asserts no payload byte appears.
6. **Backpressure.** Per-stream ring buffer 256 KiB; when the client is slow oldest bytes are dropped and a `facts` marker `dropped: true` is sent once.
7. **Auth.** Owner token; the stream route checks that the session belongs to the caller's principal id; agent and channel tokens get 403.
8. **Cancel.** `POST cancel` closes the session (ONB008) and the stream emits `close { reason: 'cancelled' }`; idempotent.
9. **Status.** `GET login/:id` returns `LoginTerminalSession` (derived state, `loginUrl` when classified and allowed) for reconnecting UI; never output.
10. **Rate limits.** `start` 6 per minute; `input` per session as above.

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- Route registrar and `sensitiveStream` pipeline flag (ENGINE011/013; if absent, added by this task through the pipeline's middleware extension point), SSE helper from ENGINE017 (heartbeat only), api-client stream helper (ENGINE019/022), use cases ONB008.

## 8. Architecture and code placement

`packages/gateway/src/routes/onboarding/login.route.ts`, `packages/gateway/src/routes/onboarding/login-stream.ts`, `packages/api-client/src/onboarding/login-client.ts`. Gateway adapter and client; no business logic.

## 9. Security and safety

- Terminal bytes never touch the logger, the audit log, the event hub or any persistent store (SEC009 L2); tests with spies.
- Single subscriber per session; owner principal binding; TTL and idle timeouts.
- Input size/rate limits and a closed mapping happen again server-side (defence in depth).
- The stream carries what the CLI prints, which can include login URLs and codes shown to the Owner: it is delivered only to the local owner session and never relayed.
- No CORS or loopback exposure beyond the existing gateway modes.

## 10. Errors and edge cases

- Client reconnects mid-login: it reattaches only if no other consumer is attached; no replay of earlier output (the UI shows a muted line 'Połączenie z terminalem wznowione').
- Session ended but the client keeps the stream: server sends `close` and ends.
- Binary garbage from the CLI: delivered as bytes; the UI sanitiser handles it (DS052).
- Heartbeat missed: the client treats as lost and offers reconnect.
- Engine restart: stream ends; UI shows 'połączenie utracone' state (ONB018).

## 11. Acceptance criteria

- [ ] Given a started session then output bytes arrive through the stream and no logger call contains them.
- [ ] Given a second consumer then it receives `busy` and the first continues.
- [ ] Given an agent token then 403.
- [ ] Given a 5 KiB input then 413/validation error.
- [ ] Given cancel then the stream closes with reason cancelled.
- [ ] Given a slow client then bytes are dropped without memory growth beyond the ring.

## 12. Test plan

- Gateway tests with `createGatewayUnderTest`, fake `LoginTerminalGateway`, spy logger; api-client stream tests with a fake transport.
- Hostile tests: oversized input, wrong principal, double attach.
- Commands: `pnpm vitest run packages/gateway/src/routes/onboarding/login packages/api-client/src/onboarding`.

## 13. Parallelization notes

After ONB001/008/009 (module wiring). Parallel with ONB011+ (UI can use a fake client).

## 14. Open questions and assumptions

- OPEN: `sensitiveStream` pipeline flag may need an ENGINE011/ENGINE016 extension; flagged for the linker.
- ASSUMPTION: the Tauri bridge supports long-lived SSE per call (`gateway_subscribe`, ENGINE022) for non-event routes.
