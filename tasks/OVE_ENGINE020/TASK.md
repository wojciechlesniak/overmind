---
id: OVE_ENGINE020
title: In-process transport for the Telegram adapter and tests (channel identity, same pipeline)
area: ENGINE
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE019, OVE_ENGINE013, OVE_ENGINE011]
soft_depends_on: []
provides: ["lib:api-client-inprocess-transport", "lib:channel-caller-binding", "lib:gateway-inprocess-transport"]
needs: ["lib:api-client-transport", "lib:gateway-pipeline", "lib:route-registrar"]
owns: ["packages/api-client/src/transport/inprocess.ts", "packages/gateway/src/inprocess/**"]
reads: ["packages/api-client/src/transport/transport.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16"]
adr_refs: [6]
---

# OVE_ENGINE020: In-process transport

## 1. Summary

Let code inside the engine process (the Telegram adapter, test code, Chief calling the API as itself) use the same typed client and the same pipeline without opening a socket. The caller identity is bound at construction, not by header, so a message cannot claim to be the Owner.

## 2. Context

SEC005 G6: Telegram authenticates in-process as `channel:telegram`; the pipeline still applies scope checks and channel restrictions (Telegram never extends permissions, SR-15, SR-16). The adapter must use only the API (CONVENTIONS: adapters talk to use cases through the gateway/client, never to repositories).

## 3. Scope (in)

- `createInProcessTransport({ dispatcher, caller })`, `Dispatcher` entry in the gateway that skips network framing and token auth but runs every other middleware.

## 4. Out of scope

- Telegram adapter itself (TG). Socket transport (ENGINE021).

## 5. Detailed requirements

1. Gateway exposes `dispatcher.handle(rawRequest, caller)` where the pipeline's `authenticate` step is replaced by a pre-bound `GatewayCaller`. Everything else (rate limit, route, authorize, validate, idempotency, audit, envelope) is identical, so tests of in-process calls prove real behaviour.
2. `createInProcessTransport` accepts only callers of kind `channel` (Telegram), `system` (engine internal jobs), or `agent`-simulating callers in tests; creating an `owner` caller in a release build throws (guard: `__RELEASE__`), because an in-process Owner would bypass the token and the local-approval notion. Dev/test builds permit `owner` for convenience.
3. Channel callers carry `{ kind:'channel', channel:'telegram', local:false }`; routes marked `expandsPermissions` or `local` are unreachable, and Run-scoped approvals from Telegram carry `runScope: true` in `caller` so PERM applies "current Run only" (ADR 0006).
4. Streams: `stream` delegates to the hub (ENGINE017) with an in-memory sink so the Telegram adapter can subscribe to events it may see (`visibleTo` includes `channel`).
5. Requests are serialised to bytes and parsed like network requests (JSON encode/decode round trip) so in-process tests catch non-serialisable payloads; no object sharing between caller and handlers.
6. The transport sets `X-Overmind-Channel` from the bound caller; any caller-supplied value is overwritten.
7. Concurrency and rate limits apply per bound caller id.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Pipeline and registrar (ENGINE011/013), client core (ENGINE019).

## 8. Architecture and code placement

Transport in `packages/api-client/src/transport/inprocess.ts` (Node-agnostic, depends on a structural `Dispatcher` interface from contracts), dispatcher in `packages/gateway/src/inprocess/dispatcher.ts`. The api-client package does not import gateway.

## 9. Security and safety

Identity is fixed at construction by composition code, never by data from Telegram. Channel callers are the least-privileged non-agent identity; permission-expanding routes are unreachable (tested). Release builds forbid in-process Owner callers.

## 10. Errors and edge cases

- Dispatcher throws: mapped by the error boundary to `internal.unexpected`.
- Abort signal: propagated to the handler context.
- Engine draining: 503 like network clients.

## 11. Acceptance criteria

- [ ] A channel client calling an Owner route gets 403 through the same authz path.
- [ ] A payload with a `Date` or function fails serialisation in tests.
- [ ] Creating an Owner in-process caller in release mode throws.
- [ ] Idempotency, rate limiting and audit are exercised by in-process calls (spy test).

## 12. Test plan

Unit and integration tests via `createGatewayUnderTest({ mode: 'inprocess' })`. Commands: `pnpm vitest run packages/api-client/src/transport packages/gateway/src/inprocess`.

## 13. Parallelization notes

TG area depends on `lib:api-client-inprocess-transport`.

## 14. Open questions and assumptions

- ASSUMPTION: Chief's internal calls use use-case tokens directly (no gateway); this transport is for adapters and tests.
