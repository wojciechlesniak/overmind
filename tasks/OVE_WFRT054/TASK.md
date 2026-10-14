---
id: OVE_WFRT054
title: "Provide the api-client functions for Runs"
area: WFRT
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH009, OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE019, OVE_ENGINE027, OVE_WFRT051, OVE_WFRT052]
soft_depends_on: []
provides: ["lib:api-client-runs"]
needs: ["lib:route-module", "lib:gateway-principal", "lib:result", "lib:api-client", "contract:Transport", "lib:api-client-events"]
owns: ["packages/api-client/src/wfrt/runs/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 13"]
adr_refs: [2, 19]
---

# OVE_WFRT054: Provide the api-client functions for Runs

## 1. Summary

Adds typed `api-client` functions for every Run route (list, get, node executions, events, tool calls, export, start, pause, resume, cancel) and a helper that merges the live Run event subscription with paged history.

## 2. Context

The Runs view and the editor run overlay (OVE_RUNUI001, OVE_RUNUI017, OVE_WFED050, OVE_WFED053) call `lib:api-client-runs`. Live updates come from `events.subscribe` (OVE_ENGINE017) through `lib:api-client-events` (OVE_ENGINE027).

## 3. Scope (in)

- Functions `runs.list/get/nodeExecutions/events/toolCalls/export/start/pause/resume/cancel` returning typed results.
- `followRun(runId, afterSeq)` helper: history pages then live events, de-duplicated by `seq`, with resync handling.
- Fixtures and fake transport recipes.

## 4. Out of scope

- Hooks and caching in the desktop: OVE_SHELL005.
- Save-to-file for export: OVE_SHELL003.
- Server routes: OVE_WFRT051, OVE_WFRT052.

## 5. Detailed requirements

1. Each route lives in its own `*.route.ts` module under the owned path and is auto-registered through `lib:route-module` (OVE_ARCH009) and `lib:route-registrar` (OVE_ENGINE013). The task MUST NOT edit any shared registry file.
2. Request and response schemas are zod objects in `packages/contracts/src/<entity>/api/`; the route table, JSON Schema and api-client types are generated from them (OVE_ARCH008). Changes are additive only.
3. Handlers are thin: parse input, read the caller from `GatewayCaller` (OVE_ENGINE011), call exactly one use case, map `Result<T, AppError>` to the envelope with the error catalogue (OVE_ARCH003). No business logic, no SQL and no file access in a handler.
4. Route scope is `owner` unless stated otherwise (`RouteScope`, OVE_ENGINE013). Agent and channel callers get `403 forbidden` without reaching the use case. Channel-limited views are out of scope here.
5. List endpoints use cursor pagination (`cursor`, `limit` default 50, max 200) from `lib:cursor-pagination` (OVE_DATA007). Unknown query parameters are rejected with `validation_failed`.
6. Mutating routes require an `Idempotency-Key` header handled by `lib:gateway-idempotency` (OVE_ENGINE015) and write an audit event through the gateway audit hook (OVE_ENGINE016).
7. Built on `lib:api-client` and imports only `contracts`.
8. `start`, `pause`, `resume`, `cancel` send an `Idempotency-Key` generated per call and reuse it on transport-level retry only.
9. `followRun` MUST never emit an event twice or skip a `seq`; on `resync` it re-reads history from the last seen `seq`.
10. `export` returns a `Blob`-like handle and never holds more than the response body in memory (size cap from OVE_WFRT051).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:route-module` and `lib:route-registrar` (OVE_ARCH009, OVE_ENGINE013) for registration; do not hand-edit registries.
- `lib:gateway-pipeline` envelope, correlation ids and error mapping (OVE_ENGINE011); `lib:result` and `lib:error-catalogue` (OVE_ARCH003).
- `lib:cursor-pagination` (OVE_DATA007), `lib:gateway-idempotency` (OVE_ENGINE015), `lib:gateway-audit` (OVE_ENGINE016).

## 8. Architecture and code placement

Layer: adapter (gateway). Dependency direction: `routes/<area>` -> `application` use cases -> ports; contracts are shared with the api-client. Route modules never import another area's route module or any adapter. New behaviour is added by adding a route module (OCP); the registrar discovers it. Handlers contain no branching on business state (SRP).

## 9. Security and safety

- Trust boundary: the desktop UI over the Unix socket (owner token, OVE_ENGINE012). Deny by default: every route declares its scope; a route without a scope fails the registrar check at startup.
- All input is untrusted. Ids are validated as ULIDs; free text (names, comments) is length-capped and never interpolated into prompts, shell commands or file paths here.
- Workflow, Run and Activity content may contain text produced by agents or repositories. It is returned as data only; no route interprets it.
- Fail closed: if the use case or its policy check is unavailable the route returns `service_unavailable` and writes a denial audit event.

## 10. Errors and edge cases

- Unknown id -> `404 not_found` with the typed error code from the owning contract; never a stack trace.
- Invalid body or query -> `400 validation_failed` with field paths and no echo of secret-looking values (redactor, OVE_ARCH004).
- Caller is an agent or a channel -> `403 forbidden`; the denial is audited.
- Global Pause active: read routes keep working; mutating routes that start work return `409 paused` (OVE_PAUSE005).
- Retried mutation with the same `Idempotency-Key` returns the stored response; with a different body it returns `409 idempotency_conflict`.

## 11. Acceptance criteria

- [ ] Given overlapping history and live events, then `followRun` emits each `seq` once in order.
- [ ] Given a resync signal, then history is re-read from the last seq.
- [ ] Given a retry after network error, then the same idempotency key is sent.
- [ ] Given a new route in the table, then a client function is generated.

## 12. Test plan

- Contract tests (`createGatewayUnderTest`, OVE_ENGINE018): one per route covering success, validation failure, 404, scope denial with agent and channel principals.
- Schema tests: generated JSON Schema matches the zod source and the additive-only check (OVE_ARCH008) passes.
- Hostile-client tests: oversized body, wrong content type, unknown query parameter, repeated idempotency key.
- Commands: `pnpm --filter @overmind/gateway test`, `pnpm --filter @overmind/contracts test`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Independent of the other WFRT route tasks except through the contracts they import. Conflict hotspot: none if each route keeps its own `*.route.ts` file and its own `contracts/<entity>/api/` file. Use the generators from OVE_ARCH009 to create the files.

## 14. Open questions and assumptions

- ASSUMPTION: the export helper hands the bytes to the caller; the desktop task owns saving.
