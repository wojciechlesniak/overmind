---
id: OVE_ENGINE019
title: "api-client core: typed client from generated route table, Transport, error decoding"
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH008, OVE_ARCH010, OVE_ENGINE007, OVE_ENGINE011]
soft_depends_on: []
provides: ["lib:api-client", "lib:api-client-transport", "contract:Transport", "lib:api-client-core"]
needs: ["lib:contract-pipeline", "contract:AppError", "lib:error-catalogue", "contract:EventEnvelope"]
owns: ["packages/api-client/package.json", "packages/api-client/tsconfig.json", "packages/api-client/src/index.ts", "packages/api-client/src/client/**", "packages/api-client/src/transport/transport.ts", "packages/api-client/src/errors/**"]
reads: ["packages/api-client/src/generated/routes.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13"]
adr_refs: [6, 18]
---

# OVE_ENGINE019: api-client core: typed client from generated route table, Transport, error decoding

## 1. Summary

The typed client that every consumer (desktop UI, Telegram adapter, future CLI, tests) uses. It is generated from the route table of the contract pipeline, so there is no hand-written URL anywhere. Transports are pluggable: the client only knows `Transport.send(request)` and `Transport.stream(request)`.

## 2. Context

ARCH008 generates `packages/api-client/src/generated/{types.ts,routes.ts}` (a table `{ [routeId]: { method, path, request, response } }`). The browser-safe package may depend only on `contracts` (CONVENTIONS). Transports: in-process (ENGINE020), Node socket (ENGINE021), Tauri bridge (ENGINE022), loopback dev (ENGINE023).

## 3. Scope (in)

- `createClient({ transport, protocol, onUnauthorized })`, `client.call(route, input)`, typed per-area wrapper convention, error decoding, request id and idempotency key generation, retry policy, handshake hook.

## 4. Out of scope

- Transports (ENGINE020-023). Event subscription client (ENGINE027). Per-area wrappers (areas, under `packages/api-client/src/<area>/`).

## 5. Detailed requirements

1. `Transport` contract (browser-safe, no Node types): `send(req: { method, path, headers, body?: Uint8Array | string, signal? }): Promise<{ status, headers, body: Uint8Array }>` and `stream(req, onChunk, signal): Promise<StreamHandle>` (used by SSE). Transports never parse JSON or add business headers except authentication (which some transports own, ENGINE022).
2. `client.call<R extends RouteId>(route: R, input: InputOf<R>, opts?: { signal?, idempotencyKey?, timeoutMs? }): Promise<Result<OutputOf<R>, AppError>>`: splits `input` into params/query/body per the route table, builds the path (percent-encode params), validates the INPUT with the route's request zod schema before sending (fail early, same schema as the server), sends `Accept: application/json`, `X-Request-Id` (new `req_` ULID from an injected id function), `X-Overmind-Protocol`, `Idempotency-Key` for `key-required` routes (generated once per call and reused across retries), parses the envelope, validates the response data in dev/test builds, returns `Result` (never throws for expected failures).
3. Error decoding: non-2xx or `ok:false` -> `AppError` from the envelope; unknown codes handled by `isKnownCode` fallback using `retryable` and status class (ARCH003); network errors -> `internal.transport_unavailable` (retryable), timeout -> `internal.timeout`, aborted -> `internal.cancelled`; response that is not valid JSON/envelope -> `internal.protocol_violation`. The decoded error includes `correlationId` for support.
4. Retry: GET and idempotent routes retry network errors and `503/429` honouring `Retry-After`, max 3 attempts, exponential backoff 200/600/1800 ms with jitter (injectable `sleep`); mutating non-idempotent calls retry ONLY when an idempotency key is present. `401`: call `onUnauthorized()` once (transport re-reads token) then retry once; second 401 returned.
5. Handshake: `connect()` runs `performHandshake` (ENGINE007) and exposes `client.status` (`connecting | ready | incompatible | unavailable`) with a subscribe function for the UI.
6. Per-area wrappers follow the convention `export const workspaces = (c: ApiClient) => ({ list: (q) => c.call('workspaces.list', q), ... })` in `packages/api-client/src/<area>/`; a generated barrel (ARCH009) exposes them as `client.api.<area>`.
7. No global singleton: clients are constructed by the host (UI shell, engine for Telegram, tests).
8. Package has zero Node-only imports (`node:*`), runs in browser, Node and the Tauri webview; bundle size budget 30 KiB gz excluding zod.
9. Cancellation: every call supports `AbortSignal`; abort propagates to the transport.
10. Logging hook `onRequest/onResponse` receives method, route id, status, duration only (no bodies/headers).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Generated route table and types (ARCH008), `AppError`/`Result` (ARCH003), envelope schema (ENGINE011), id generation function injected (browser uses crypto API wrapper; engine uses `IdGenerator`).

## 8. Architecture and code placement

`packages/api-client/src/{client,transport,errors,handshake}/`; depends only on `contracts`. Transports implement the interface in separate files so adding one is OCP.

## 9. Security and safety

The client never stores or exposes tokens (transports own credentials; the Tauri transport has none). Responses are untrusted input: validated against schemas in dev, strictly parsed always; errors from the engine are displayed only via `userMessage` keys. Idempotency keys prevent duplicate approvals/creations on retry.

## 10. Errors and edge cases

- Server newer than client: unknown fields ignored, unknown enum member for open enums mapped to `unknown`.
- Path params with slashes: rejected before sending (ids are prefixed ULIDs).
- Double abort / abort after completion: no-op.
- `Retry-After` HTTP-date form: supported.
- Response too large (> 16 MiB): `internal.protocol_violation`.

## 11. Acceptance criteria

- [ ] `client.call('system.health', {})` is fully typed from the generated table (type test).
- [ ] Invalid input fails locally with `validation.invalid_input` without calling the transport.
- [ ] A non-idempotent POST without a key is not retried; with a key it is, and the same key is reused.
- [ ] 401 triggers `onUnauthorized` once.
- [ ] Unknown error code decodes to a generic AppError preserving `retryable`.
- [ ] Package builds for browser without Node globals.

## 12. Test plan

Unit tests with a fake `Transport`; type tests (`expectTypeOf`); retry timing with fake sleep; browser-compat build check. Commands: `pnpm vitest run packages/api-client`.

## 13. Parallelization notes

First api-client task; ENGINE020-023 and ENGINE027 depend on `contract:Transport`. Areas add `src/<area>/` wrappers independently.

## 14. Open questions and assumptions

- ASSUMPTION: client-side input validation duplicates server validation using the same zod schema (cheap, avoids a round trip).
