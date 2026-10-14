---
id: OVE_ENGINE010
title: Gateway server core - owner-only Unix socket listener and HTTP/1.1 handling
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH005, OVE_ARCH007, OVE_ENGINE001, OVE_ENGINE002]
soft_depends_on: [OVE_ENGINE026]
provides: ["lib:gateway-server", "port:GatewayListener", "lib:gateway-agent-listener"]
needs: ["lib:data-dir", "port:Logger", "port:Clock", "lib:error-mapper"]
owns: ["packages/gateway/src/server/**", "packages/gateway/package.json", "packages/gateway/tsconfig.json", "apps/engine/src/composition/modules/gateway.module.ts"]
reads: ["docs/architecture/gateway-protocol.md", "docs/security/gateway-auth.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [5, 6, 10]
---

# OVE_ENGINE010: Gateway server core

## 1. Summary

The listener of the local API: a `node:http` server bound to `run/gateway.sock` with mode 0600 created race-free, a connection manager with limits, a graceful stop, and the hook points for the pipeline (ENGINE011), authentication (ENGINE012) and routing (ENGINE013).

## 2. Context

SPEC 13 / SR-10: UI, Telegram and CLI are thin clients through a local owner-only socket. SEC005 G1-G3 and G9 are normative: socket 0600 in 0700 dir, no TCP, umask 077 before bind, stale socket handling, symlink refusal, 64 connections, header timeout 10 s. The protocol is ENGINE001. Socket path rules (104-byte limit and pointer file) are ARCH005.

## 3. Scope (in)

- Server creation, bind sequence, permissions, stale socket logic, connection tracking, stop/drain, listener events.
- Composition module `gateway.module.ts` (start after DB and recovery gate).

## 4. Out of scope

- Authentication, routing, validation, rate limits, SSE hub: ENGINE011-017. Loopback TCP mode: ENGINE023.

## 5. Detailed requirements

1. Bind sequence: resolve socket path (ARCH005 algorithm, with fallback and `.path` pointer); verify the directory (owner uid, mode 0700, not a symlink); if a socket file exists: connect-probe it (500 ms); alive -> `config.already_running` (never take over); dead -> `unlink` (only if the file is a socket owned by us); set `process.umask(0o077)` around `listen`, then `fs.chmod(sock, 0o600)` and verify with `lstat` (mode & 0o777 == 0o600, uid == process uid) BEFORE reporting ready; failure closes the server and aborts startup (fail closed).
2. `GatewayListener` port: `start(handler): Promise<Result<{ socketPath }>>`, `stop(opts: { graceMs })`, `connections(): number`, `onConnection(cb)`. Handler is a single async function `(req: GatewayRequest) => Promise<GatewayResponse | StreamResponse>` supplied by the pipeline so the listener has no routing knowledge (SRP).
3. HTTP parsing is `node:http` with hardened options: `maxHeaderSize` 16 KiB, `headersTimeout` 10 s, `requestTimeout` 60 s, `keepAliveTimeout` 60 s, `maxRequestsPerSocket` 1000, `server.maxConnections` 64 (extra connections get an immediate `503 gateway.too_many_connections` where possible, else are destroyed). `Transfer-Encoding` on requests, `Expect`, duplicated `Authorization`/`Content-Length`, absolute-form request targets and URLs > 2048 are rejected with 400/414/417 before any handler runs (ENGINE001 section 9).
4. Body reading with a hard byte cap (default 1 MiB, route override up to 8 MiB passed by the pipeline) using a streaming counter that aborts the socket at the cap (413); no buffering beyond the cap; JSON parsing happens in ENGINE011 with a depth guard.
5. Peer credentials (optional, ENGINE026): `onConnection` receives a `peer?: { uid, pid }` when the helper exists; if configured `required` and unavailable the listener still runs but marks `peerVerified:false` for the authz layer.
6. `stop({ graceMs })`: `server.close()`, stop accepting, wait for in-flight requests up to `graceMs`, then destroy remaining sockets (SSE streams are told to close by the hub first, ENGINE017); finally unlink the socket file if we created it.
7. Error handling: `clientError` events are answered with a minimal 400 and no body details; `server.on('error')` for EADDRINUSE/EACCES yields typed startup errors; no unhandled exceptions escape (wrapped, logged `error`, connection destroyed).
8. Observability: per-connection id (counter), counters (accepted, rejected, active, bytes) in `stats()` for diagnostics; request log line at `debug` only (method, route template, status, duration; never headers/body).
9. The server never binds TCP; a test enumerates listeners (SEC005 test 5). `NODE_OPTIONS` or env cannot add a port.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Socket path resolver and data-dir initializer (ARCH005), `Logger`, `AppError` mapping (ARCH003), `Clock` for timeouts where testable (`node:http` internals use real timers; wrap with fake-timer-friendly options in tests).

## 8. Architecture and code placement

`packages/gateway/src/server/{listener.ts,bind-socket.ts,socket-security.ts,limits.ts,connection-tracker.ts}`; port `GatewayListener` in `packages/application/src/ports/GatewayListener.ts` is NOT needed by other areas, so it lives in `packages/gateway/src/server/types.ts` (adapter-internal). Module `gateway.module.ts` in the composition root orders start after `sqlite`, `recovery`.

## 9. Security and safety

The socket permission window is closed by umask-before-bind and verified after (SEC005 tests 1-3). No TCP in release. Stale socket handling cannot hijack a live engine or delete a non-socket file. Strict header limits and rejection of ambiguous framing prevent request smuggling and slow-loris. Errors reveal nothing. The listener starts only after recovery gate says reads are ok (ENGINE005/006).

## 10. Errors and edge cases

- Socket path too long: fallback path used; pointer file written atomically.
- Directory permissions wrong: abort with `config.data_dir_insecure`.
- `chmod` fails: abort, remove socket.
- Port of the OS limit on listen backlog: backlog 128.
- Client disconnects mid-request: handler receives abort signal.

## 11. Acceptance criteria

- [ ] Socket mode is 0600 and never wider, even under `umask 000` (watcher test).
- [ ] Live socket is never taken over; stale socket is replaced; a regular file at the path aborts startup.
- [ ] 65th connection is rejected without affecting existing ones.
- [ ] Request with `Transfer-Encoding: chunked` gets 400; oversize body 413 with the socket closed.
- [ ] After stop, the socket file is gone and no handles remain (process exits).
- [ ] `lsof`/`/proc` enumeration shows no TCP listener.

## 12. Test plan

Integration tests with real sockets on temp dirs (short paths), hostile client helper (SEC005), `mode-watcher`. Commands: `pnpm vitest run packages/gateway/src/server`.

## 13. Parallelization notes

First gateway task; ENGINE011-017 plug into the handler it takes. `packages/gateway/package.json` is owned here.

## 14. Open questions and assumptions

- ASSUMPTION: `node:http` over a Unix socket (no extra dependency); revisit only if limits are insufficient.
