---
id: OVE_ENGINE021
title: Node Unix-socket transport for CLI, tests and tools (token file, 401 refresh, SSE stream)
area: ENGINE
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_ENGINE012, OVE_ENGINE019]
soft_depends_on: []
provides: ["lib:api-client-socket-transport"]
needs: ["lib:api-client-transport", "lib:data-dir", "lib:gateway-auth"]
owns: ["packages/api-client/src/transport/node-socket.ts", "packages/api-client/src/node.ts"]
reads: ["docs/architecture/data-directory.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13"]
adr_refs: [6]
---

# OVE_ENGINE021: Node Unix-socket transport

## 1. Summary

A transport for Node processes (`ensure-running`, the future CLI, TEST011 harness, dev tools) that connects to `run/gateway.sock`, attaches the Owner token read from `run/session-token`, and speaks the protocol of ENGINE001.

## 2. Context

The webview cannot use this (ENGINE022 does). Node tools are separate Unix processes of the same user, so they can read the token file; this is the CLI use case of herdr-style thin clients (SPEC 13). Exported under a separate entry `@overmind/api-client/node` so the browser bundle never includes `node:*`.

## 3. Scope (in)

- `createNodeSocketTransport({ dataDir | socketPath, tokenPath })`, socket path resolution, token loading with checks, request/stream implementation, reconnect on 401.

## 4. Out of scope

- Agent-token transport inside sandboxes (the Skill "overmind" talks to the API with its own tooling, SKILL/ENGINE028).

## 5. Detailed requirements

1. Socket path via the shared resolver of ARCH005 (pointer file `.path`, 104-byte fallback). Before connecting verify: path is a socket, owner uid equals current uid, mode has no group/world bits (`lstat`), parent directory 0700; else `internal.transport_unavailable` with detail `insecure_socket` (do not connect).
2. Token loading: read `session-token` after the same ownership/mode checks; cache in memory; re-read on `onUnauthorized` (engine restarted) at most once per request. Token never logged and never placed in URL or env.
3. HTTP via `node:http` with `socketPath`, `agent: new http.Agent({ keepAlive: true, maxSockets: 8 })`; per-request timeout default 30 s; body as string/Uint8Array; response collected up to 16 MiB.
4. `stream` returns a handle that parses SSE incrementally (line-based, handles split chunks, comments, `retry`, multi-line `data`), invokes `onChunk({ id, event, data })`, and honours abort. Reconnection logic lives one level up (ENGINE027).
5. Connection errors mapping: ENOENT/ECONNREFUSED -> `internal.transport_unavailable` (retryable) with detail `engine_not_running`; EACCES -> detail `permission`; others generic.
6. `Host` header fixed to `localhost` (irrelevant on sockets, required by HTTP/1.1); `User-Agent: overmind-client/<version>`.
7. Exposes `close()` to destroy agent sockets.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Socket-path and permission checks reuse `resolveSocketPath` (ARCH005) rather than re-implementing; SSE parser is a pure function `parseSse(chunk)` exported for ENGINE027 and tests.

## 8. Architecture and code placement

`packages/api-client/src/transport/node-socket.ts`, `sse-parser.ts`; package export map `./node`. Node-only code isolated behind that export.

## 9. Security and safety

Refuses sockets owned by another user or with loose modes (prevents sending the token to a planted socket). Token only in the `Authorization` header. No fallback to TCP. Errors never include the token or file contents.

## 10. Errors and edge cases

- Engine restarted mid-request: socket reset -> retryable error; next call re-reads token.
- Token file missing: `engine_not_running` or `starting`.
- Partial SSE line at chunk boundary: buffered.
- Huge SSE event: > 128 KiB dropped with `internal.protocol_violation`.

## 11. Acceptance criteria

- [ ] Connects to `createGatewayUnderTest` and calls `system.health`.
- [ ] Refuses a 0666 socket and a socket owned by another uid (simulated stat).
- [ ] After engine restart (new token) a call succeeds after one transparent refresh.
- [ ] SSE parser passes a table of split-chunk fixtures.
- [ ] Browser bundle does not include this file (bundle test).

## 12. Test plan

Unit (SSE parser, path checks with fake fs), integration with the gateway under test. Commands: `pnpm vitest run packages/api-client/src/transport`.

## 13. Parallelization notes

ENGINE009 and TEST011 harness use it.

## 14. Open questions and assumptions

- ASSUMPTION: connection pool of 8 sockets is sufficient.
