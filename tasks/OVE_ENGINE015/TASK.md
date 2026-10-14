---
id: OVE_ENGINE015
title: Idempotency keys for mutating gateway calls with a persisted dedupe store
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DATA002, OVE_DATA007, OVE_ENGINE011]
soft_depends_on: []
provides: ["lib:gateway-idempotency", "table:idempotency_keys", "port:IdempotencyStore"]
needs: ["port:UnitOfWork", "port:Clock", "lib:canonical-json", "lib:gateway-pipeline"]
owns: ["packages/gateway/src/idempotency/**", "packages/application/src/ports/IdempotencyStore.ts", "packages/adapters/sqlite/src/idempotency/**", "packages/adapters/sqlite/migrations/V202610130070__OVE_ENGINE015__create_idempotency_keys.sql"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5]
---

# OVE_ENGINE015: Idempotency keys

## 1. Summary

A retried mutating request (UI double-click, bridge retry after a timeout, Telegram redelivery) must execute once. Routes declared `idempotency: 'key-required'` need an `Idempotency-Key` header; the gateway stores key, request hash and response and replays the stored response for 24 h.

## 2. Context

SR-34, SEC005 G8 test 11, SPEC 12 (never repeat non-idempotent actions). Keys are ULIDs chosen by the client. This protects API-level duplicates; Run-level duplicate side effects are handled by event-log action tracking (ENGINE005).

## 3. Scope (in)

- Middleware, store port and SQLite adapter, table, cleanup, conflict rules.

## 4. Out of scope

- Per-action idempotency inside workflows (WFRT). Approvals' single-use semantics (PERM).

## 5. Detailed requirements

1. Header `Idempotency-Key: <ulid>` (26 chars Crockford). Missing on a `key-required` route -> `400 gateway.idempotency_key_required`. Optional on `natural` routes (ignored), forbidden to rely on for `none`.
2. Table `idempotency_keys(key TEXT NOT NULL, caller_id TEXT NOT NULL, route_id TEXT NOT NULL, request_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('in_progress','done')), status INTEGER, response_json TEXT, created_at TEXT NOT NULL, completed_at TEXT, expires_at TEXT NOT NULL, PRIMARY KEY(caller_id, key))`; index `(expires_at)`. `caller_id` = owner/agent id/channel so keys of different callers never collide.
3. Flow: `begin(caller, key, routeId, requestHash)`: insert `in_progress` (atomically); if a row exists: same `route_id` and `request_hash` and `done` -> replay stored status/body with header `Idempotent-Replay: true`; `in_progress` -> `409 gateway.idempotency_conflict` with `Retry-After: 1` (concurrent duplicate); different hash or route -> `422 gateway.idempotency_conflict` (key reuse with another request). `request_hash = sha256(canonicalJson({method, path, query, body}))`.
4. Completion: after the handler, store `done` with status and response JSON (max 64 KiB; routes that can return more MUST NOT be `key-required`, enforced by a contract check on route metadata `maxResponseBytes <= 65536`).
5. Only successful and 4xx deterministic outcomes are stored; 5xx and `retryable` errors delete the row so the client may retry with the same key.
6. Crash between handler commit and completion write: the in_progress row remains; a retry after `expires_at_in_progress` (60 s) is allowed ONLY for routes flagged `naturallyIdempotent` (handler is a pure upsert); otherwise the response is `409 gateway.idempotency_conflict` with `details.reason: 'outcome_unknown'` and the client must check state (documented). Handlers that write domain data in a transaction MAY write the idempotency completion in the same transaction via `ctx.idempotency.completeIn(tx)` to close this window (preferred for create-type routes; DATA011 uses it).
7. Retention 24 h; cleanup job every 15 min (batch 1000) via the `Clock` interval registered by the module; startup also purges expired.
8. Stored responses must not contain secrets: they are exactly what was sent to the client (already redacted); the table is in the 0600 database.
9. Size guard: max 10 000 live keys per caller; beyond -> `429 gateway.rate_limited`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`UnitOfWork`, `canonicalJson` (DATA007), `Clock`, pipeline slot `idempotency`.

## 8. Architecture and code placement

Port in application (`begin`, `complete`, `abandon`, `purge`), adapter in `packages/adapters/sqlite/src/idempotency/`, middleware in `packages/gateway/src/idempotency/`.

## 9. Security and safety

Replay protection for approvals and destructive calls. Keys are scoped per caller so one caller cannot probe or replay another's key. Request hash binding stops key reuse for a different action. No response content from other callers is ever replayed.

## 10. Errors and edge cases

- Same key concurrently: second gets 409 until first finishes.
- Client changes body slightly with same key: 422.
- Clock backwards: expiry uses stored timestamps, harmless.
- DB busy: request fails 503 retryable; key row not left `in_progress` (begin and handler use separate transactions, begin rolled back).

## 11. Acceptance criteria

- [ ] Same key twice on a create route executes the handler once and returns the same response with `Idempotent-Replay: true` (SEC005 test 11).
- [ ] Different body with same key returns 422.
- [ ] 5xx does not poison the key.
- [ ] Concurrent duplicates: one executes, the other gets 409.
- [ ] Expired keys are purged; table stays bounded.

## 12. Test plan

Unit (store contract `IdempotencyStore.contract.ts` for SQLite and in-memory fake), middleware tests, concurrency test with 20 parallel duplicates. Commands: `pnpm vitest run packages/gateway/src/idempotency packages/adapters/sqlite/src/idempotency`.

## 13. Parallelization notes

Migration `V202610130070` reserved. In-memory fake lives in `packages/testing/src/fakes/InMemoryIdempotencyStore.ts` created here.

## 14. Open questions and assumptions

- ASSUMPTION: 24 h retention, 64 KiB stored response cap; large-response routes cannot be `key-required`.
