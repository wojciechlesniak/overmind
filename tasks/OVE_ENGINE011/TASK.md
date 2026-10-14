---
id: OVE_ENGINE011
title: "Gateway request pipeline: parsing, validation, correlation ids, errors, envelope"
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH007, OVE_ARCH008, OVE_ENGINE010]
soft_depends_on: []
provides: ["lib:gateway-pipeline", "lib:gateway-middleware", "contract:GatewayCaller", "lib:gateway-principal", "lib:caller-context"]
needs: ["lib:gateway-server", "lib:error-mapper", "lib:log-context", "lib:contract-pipeline", "port:IdGenerator"]
owns: ["packages/gateway/src/pipeline/**", "packages/gateway/src/middleware/**", "packages/contracts/src/errors/gateway.errors.ts", "packages/contracts/src/gateway/**"]
reads: ["packages/contracts/src/api/define-route.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 15"]
adr_refs: [6]
---

# OVE_ENGINE011: Gateway request pipeline: parsing, validation, correlation ids, errors, envelope

## 1. Summary

The ordered chain every request passes through: framing checks, request id, authentication hook, route lookup, scope check hook, input validation with the route's zod schemas, handler call, output validation (dev), `Result` to HTTP mapping, response envelope, logging context. Cross-cutting concerns are middleware; routes only contain handlers.

## 2. Context

ARCH003 gives `toErrorResponse`; ARCH008 gives route metadata and schemas; ARCH009 gives `defineRouteModule` and handler shape `({ body, params, query, caller, ctx }) => Promise<Result<Response>>`. Handlers never touch the transport (ARCH009). Logging context with `requestId` uses ARCH004.

## 3. Scope (in)

- Middleware chain framework, standard middleware (request id, body parse, validation, error boundary, envelope, access log), `gateway.*` error catalogue, `GatewayCaller` contract.

## 4. Out of scope

- Auth (ENGINE012), authorisation and registrar (ENGINE013), rate limiting (ENGINE014), idempotency (ENGINE015), audit (ENGINE016), SSE (ENGINE017).

## 5. Detailed requirements

1. Chain order (fixed, documented): `framing -> requestId -> logContext -> lifecycleGate -> authenticate -> rateLimit -> route -> authorize -> protocolCheck -> parseBody -> validate -> idempotency -> audit(begin) -> handler -> validateResponse(dev) -> audit(end) -> envelope -> accessLog`. Each middleware is `(ctx, next) => Promise<void>` with a typed `ctx`; additions use a registration order number from a table in `pipeline/order.ts` so areas cannot reorder security middleware (only ENGINE adds middleware; areas add routes).
2. `GatewayCaller` (contract): `{ kind: 'owner' | 'agent' | 'channel' | 'system', channel?: 'desktop'|'cli'|'telegram', agentId?, runId?, workspaceId?, local: boolean, sessionId? }`. `local: true` only for the Owner desktop session established through the shell bridge (ENGINE022). Built by ENGINE012 from the token, never from request fields.
3. Request id: accept valid `X-Request-Id` (`req_` ULID) else generate; set response header; run the rest inside `withLogContext({ requestId, channel })`.
4. Body parsing: only `application/json` (charset utf-8) for POST/PUT/PATCH; empty body allowed when the route has no request schema; parser rejects duplicate keys, depth > 32, `__proto__`/`constructor`/`prototype` keys, invalid UTF-8, numbers beyond safe integer range -> `validation.malformed_json` (400) / `validation.unsupported_media_type` (415).
5. Validation: `params`, `query`, `body` against route zod schemas (strict requests). Failures -> `validation.invalid_input` with `issues[]` (path, code, safe message, max 20, `truncated`). Unknown query parameters rejected.
6. Output: `Result.ok` -> envelope `{ ok: true, data, requestId }` with the route's declared status (200/201/204); `Result.err` or thrown -> `toErrorResponse` (ARCH003) with HTTP status from the registry. Dev/test builds validate the response against the route response schema and turn mismatches into a 500 `internal.contract_violation` (test failure); release logs `error` and sends the response unchanged.
7. Error boundary: any exception becomes `internal.unexpected` (500) with generic text; the original goes to the logger redacted. Aborted client connection cancels the handler via `ctx.signal`.
8. Lifecycle gate: while engine state is `starting|migrating|recovering` only `system.health` and `system.version` pass; others get 503 `gateway.engine_not_ready` + `Retry-After: 1`; during `draining` mutating calls get 503 `gateway.shutting_down`.
9. `gateway.errors.ts` registers: `gateway.unauthenticated` (401), `gateway.forbidden_scope` (403), `gateway.not_found` (404), `gateway.method_not_allowed` (405), `gateway.request_timeout` (408), `gateway.payload_too_large` (413), `gateway.unsupported_media_type` (415), `gateway.rate_limited` (429), `gateway.incompatible_protocol` (412), `gateway.engine_not_ready` (503), `gateway.shutting_down` (503), `gateway.too_many_connections` (503), `gateway.idempotency_key_required` (400), `gateway.idempotency_conflict` (409). `telegramSafe` true for all except details-bearing ones.
10. Access log line (debug): `{ requestId, method, routeId, status, durationMs, callerKind }`; no query strings values, headers or bodies.
11. Handler timeout: default 30 s per route (route metadata may declare longer); on timeout cancel signal, respond 504-like `gateway.request_timeout` (408 mapped) and log.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`toErrorResponse`, `fromThrown`, `defineErrors` (ARCH003), `withLogContext` (ARCH004), `IdGenerator`, route table from ARCH008/009.

## 8. Architecture and code placement

`packages/gateway/src/{pipeline,middleware}/`. Contracts: `packages/contracts/src/gateway/{caller.schema.ts,envelope.schema.ts}` so api-client shares the envelope schema. Gateway depends on application ports and contracts only (no domain).

## 9. Security and safety

Validation is the untrusted-input boundary for Agents, Telegram and the UI; strict schemas reject unexpected fields. The parser guards against prototype pollution and JSON bombs. Errors are generic; internals only in logs. Security middleware order is fixed in code and tested. The caller is derived from credentials only.

## 10. Errors and edge cases

- HEAD/OPTIONS: OPTIONS answered 204 with `Allow` and no CORS headers; HEAD mapped to GET without body.
- Handler returns neither Result nor throws (undefined): `internal.contract_violation`.
- Both `Content-Length` and chunked: rejected earlier (ENGINE010).
- Large `issues[]`: truncated at 20.
- Response body not serialisable (cycle): `internal.unexpected`.

## 11. Acceptance criteria

- [ ] A malformed JSON body returns 400 `validation.malformed_json` with no parser internals.
- [ ] Unknown field in a strict request returns 400 with `issues` path.
- [ ] Thrown handler error returns 500 `internal.unexpected` and the secret in the message does not appear in the body.
- [ ] Middleware order test fails if a middleware is moved after the handler.
- [ ] Response mismatch in dev fails the test via `internal.contract_violation`.
- [ ] During `migrating`, a normal route returns 503 with `Retry-After`.

## 12. Test plan

Unit tests per middleware with fake ctx; pipeline integration via the in-process transport; hostile corpus (SEC005 test 13). Commands: `pnpm vitest run packages/gateway/src/pipeline packages/gateway/src/middleware`.

## 13. Parallelization notes

After ENGINE010. Later ENGINE tasks register their middleware into the fixed order table by editing only `order.ts`? That file is owned here: they request positions through the table already declared (all names listed in item 1), so no edits needed.

## 14. Open questions and assumptions

- ASSUMPTION: handler default timeout 30 s.
- ASSUMPTION: the envelope `{ ok, data, requestId }` (ENGINE001).
