---
id: OVE_ENGINE001
title: Decide and document the gateway wire protocol (HTTP over Unix socket, SSE push, envelopes)
area: ENGINE
kind: decision
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH001, OVE_ARCH008, OVE_ARCH003, OVE_SEC001]
soft_depends_on: [OVE_SETUP011]
provides: ["decision:gateway-protocol", "doc:gateway-protocol"]
needs: []
owns: ["docs/architecture/gateway-protocol.md", "docs/adr/gateway-wire-protocol.md"]
reads: ["docs/security/requirements.md", "docs/architecture/contracts-pipeline.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 6, 18]
---

# OVE_ENGINE001: Gateway wire protocol decision

## 1. Summary

Write down, once, how clients talk to the engine so that gateway, api-client, the Rust bridge, the mock gateway and the security tests all implement the same thing: HTTP/1.1 with JSON bodies over an owner-only Unix socket, Server-Sent Events for push, fixed headers, envelopes and limits. Output is a protocol document plus an ADR (number assigned at merge by OVE_OSS006 rules).

## 2. Context

Other tasks already assume parts of this: SETUP010 (bridge writes an HTTP/1.1 request and reads the bytes; streams as SSE or NDJSON), SETUP012 (mock gateway: HTTP/1.1 on a Unix socket, SSE `/v1/events`), SEC005 (Bearer token, 401/413/429, `Idempotency-Key`), ARCH008 (`/v1/<resource>/<action>`, route `scope`), ARCH010 (events, `afterEventId`, heartbeat 15 s, `events.resync_required`). A WebKit webview cannot open Unix sockets, hence the Tauri bridge (ENGINE022).

## 3. Scope (in)

- Protocol document and ADR with rationale and rejected alternatives (WebSocket, custom framing, gRPC, loopback TCP by default, JSON-RPC).

## 4. Out of scope

- Implementations (ENGINE010..) and individual routes.

## 5. Detailed requirements

1. **Transport:** HTTP/1.1 over the Unix domain socket `run/gateway.sock` (path rules ARCH005). Keep-alive allowed; pipelining not supported; HTTP/2 not used. Rationale: debuggable with `curl --unix-socket`, trivial in Node (`node:http`) and Rust (hyper or raw), works with the bridge byte forwarding, no new dependency.
2. **Request:** `Authorization: Bearer <token>` mandatory; `Content-Type: application/json` for bodies; `X-Request-Id` optional (ULID with `req_` prefix; else generated); `Idempotency-Key` (ULID) for routes declaring `key-required`; `X-Overmind-Protocol: <int>` (client protocol version, used by the handshake ENGINE007); `X-Overmind-Channel: desktop|cli` informational only (authority comes from the token, never from this header).
3. **Success response:** status 200/201/204, body `{ "ok": true, "data": <response schema>, "requestId": "req_..." }`. Lists use `data: { items, nextCursor? }`. Header `X-Request-Id` echoed. Unknown response fields are ignored by clients (additive evolution).
4. **Error response:** the `ErrorResponse` of ARCH003 (`{ ok:false, error:{ code, message, details?, retryable, correlationId, userMessage:{key,params} } }`) with the HTTP status from the error registry. `Retry-After` for 429 and 503.
5. **Push:** `GET /v1/events/subscribe?types=&workspaceId=&afterEventId=` returns `text/event-stream`; each SSE message `id: <eventId>`, `event: <type>`, `data: <JSON envelope>`; heartbeat comment/event every 15 s; terminal events `events.resync_required` and `events.closed` (reason). Clients reconnect with `Last-Event-ID` or `afterEventId`. Ephemeral events have no `id`.
6. **Versioning:** path prefix `/v1`; additive-only changes within a major; `GET /v1/system/version` returns `{ appVersion, protocol, apiVersion, minClientProtocol }`. Incompatible clients get `412 gateway.incompatible_protocol`.
7. **Limits (defaults, see SEC005 G9):** body 1 MiB (route override up to 8 MiB), 64 connections, headers complete within 10 s, idle 60 s, SSE connections max 8.
8. **Content rules:** UTF-8 only, JSON depth <= 32, no duplicate keys accepted (rejected), `__proto__`/`constructor` keys rejected by the parser guard.
9. **Paths:** IDs in paths are prefixed ULIDs; no query string carries secrets; unknown route -> `404 gateway.not_found`; wrong method -> `405` with `Allow`.
10. **Streaming of large bodies** (artifact content): `GET` with `Content-Length` and `Range` support; uploads are not supported over the gateway in MVP (agents report artifacts as bounded JSON).
11. **Health endpoints:** `GET /v1/system/health` and `GET /v1/system/version` require the token like any other route (the shell reads the token file). NOTE for SETUP012: its readiness probe `GET /v1/health` must use `/v1/system/health`.
12. **Document sections:** diagrams of request flow, header table, status table, SSE examples, curl examples, and "how to write a client in 30 lines".

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Error envelope (ARCH003), event envelope (ARCH010), route metadata (ARCH008), limits (SEC005).

## 8. Architecture and code placement

Docs only: `docs/architecture/gateway-protocol.md` and one ADR file. No code.

## 9. Security and safety

The document is normative for security headers: token only in `Authorization`; never in URL, cookie or body; no CORS headers on the Unix socket; unknown headers ignored; request smuggling avoided by rejecting requests with both `Content-Length` and `Transfer-Encoding`, and any `Transfer-Encoding` other than none (chunked request bodies are not supported in MVP).

## 10. Errors and edge cases

- Client sends HTTP/1.0: accepted, no keep-alive.
- `Expect: 100-continue`: answered with 417.
- Very long URLs: > 2048 chars -> 414.
- Duplicate headers (`Authorization` twice): 400.

## 11. Acceptance criteria

- [ ] Document covers all 12 items, with curl examples that work against the mock gateway.
- [ ] ADR lists rejected alternatives with one reason each.
- [ ] Open assumptions raised in SETUP010 and SETUP012 are answered explicitly (token handling, health path, no `engine.sock`).

## 12. Test plan

Review by owners of SETUP010, SETUP012, SEC005, TEST004; an "executable doc" check script runs each curl snippet against the mock gateway in CI (`pnpm docs:check-protocol`, created in ENGINE018).

## 13. Parallelization notes

Merge early; blocks ENGINE010 and ENGINE019 start only softly (they may begin from this task's text in review).

## 14. Open questions and assumptions

- ASSUMPTION: SSE over HTTP/1.1 (not WebSocket) because the Rust bridge and Node both handle it without frames.
- ASSUMPTION: no separate `engine.sock` control socket; liveness is `GET /v1/system/health` with the token (SETUP010 must adapt its ping step).
