---
id: OVE_WFRT051
title: "Expose Run read routes: list, get, node executions, events, tool calls and export"
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT018, OVE_ARCH003, OVE_ARCH009, OVE_DATA005, OVE_ENGINE011, OVE_ENGINE013, OVE_WFRT006, OVE_WFRT007]
soft_depends_on: []
provides: ["api:runs.list", "api:runs.get", "api:runs.node-executions", "api:runs.events", "api:runs.tool-calls", "api:runs.export", "contract:RunSummary"]
needs: ["lib:route-module", "lib:gateway-principal", "lib:result", "contract:WorkflowRun", "contract:NodeExecution", "contract:RunTrace", "port:EventStore", "port:RunReader"]
owns: ["packages/gateway/src/routes/wfrt/runs-read.route.ts", "packages/contracts/src/run/api/read/**", "packages/application/src/wfrt/runs-read/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 13"]
adr_refs: [2, 19]
---

# OVE_WFRT051: Expose Run read routes: list, get, node executions, events, tool calls and export

## 1. Summary

Adds the owner-only read routes for Runs: filtered list, a single Run with trace summary, node executions, the event stream of a Run (paged), tool calls and an export of a Run as a JSON document. All data comes from the append-only event log and read models, never from agent claims.

## 2. Context

The Runs view (OVE_RUNUI001 to OVE_RUNUI017), the editor run overlay (OVE_WFED081, OVE_WFED083) and Workspace views (OVE_WSPACE001, OVE_WSPACE002) need Run data. The event log (OVE_DATA005) is the source of truth; agent state from herdr is a hint (ADR 0026). `contract:RunSummary` is the list row projection (id, workflowId, versionId, status, startedAt, duration, cost, current node labels).

## 3. Scope (in)

- `GET /runs` (filters: workspaceId, workflowId, status, from, to; cursor).
- `GET /runs/{id}` (summary plus trace head), `GET /runs/{id}/node-executions`, `GET /runs/{id}/events` (cursor on seq), `GET /runs/{id}/tool-calls`.
- `GET /runs/{id}/export` returning a JSON document with a content hash.
- `RunSummary` contract and mappers from WorkflowRun.

## 4. Out of scope

- Run commands (start, pause, resume, cancel): OVE_WFRT052.
- Run client: OVE_WFRT054.
- `ActivityEntry` and `api:activity.list`: OVE_WFRT057.
- Desktop save dialog: OVE_SHELL003.

## 5. Detailed requirements

1. Each route lives in its own `*.route.ts` module under the owned path and is auto-registered through `lib:route-module` (OVE_ARCH009) and `lib:route-registrar` (OVE_ENGINE013). The task MUST NOT edit any shared registry file.
2. Request and response schemas are zod objects in `packages/contracts/src/<entity>/api/`; the route table, JSON Schema and api-client types are generated from them (OVE_ARCH008). Changes are additive only.
3. Handlers are thin: parse input, read the caller from `GatewayCaller` (OVE_ENGINE011), call exactly one use case, map `Result<T, AppError>` to the envelope with the error catalogue (OVE_ARCH003). No business logic, no SQL and no file access in a handler.
4. Route scope is `owner` unless stated otherwise (`RouteScope`, OVE_ENGINE013). Agent and channel callers get `403 forbidden` without reaching the use case. Channel-limited views are out of scope here.
5. List endpoints use cursor pagination (`cursor`, `limit` default 50, max 200) from `lib:cursor-pagination` (OVE_DATA007). Unknown query parameters are rejected with `validation_failed`.
6. Mutating routes require an `Idempotency-Key` header handled by `lib:gateway-idempotency` (OVE_ENGINE015) and write an audit event through the gateway audit hook (OVE_ENGINE016).
7. `events` pages by `seq` ascending, max 500 per page; each event is the stored envelope (OVE_ARCH010) with payload fields redacted for secrets (OVE_ARCH004).
8. `export` streams at most 50 MiB; larger Runs return `413 export_too_large` with a hint to use the paged routes. The export includes `integrityHash` from the event chain (OVE_DATA006).
9. `tool-calls` returns `ToolCallRecord` (OVE_WFRT057) derived from node events; it never returns raw tool output above 8 KiB per call (truncated flag set).
10. `list` default sort `startedAt desc`; counts in the list use the read model and are eventually consistent within 1 s (`ASSUMPTION`).
11. Workspace visibility rules apply to every route; a Run of a Private Workspace is not visible from another Workspace context.

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

- [ ] Given 1,000 events, when paging with limit 500, then two pages and no duplicates or gaps.
- [ ] Given a Run over 50 MiB, then export returns 413.
- [ ] Given a tool call with 1 MiB output, then the route returns 8 KiB and `truncated: true`.
- [ ] Given a secret in an event payload, then it is redacted.
- [ ] Given an agent token, then 403.

## 12. Test plan

- Contract tests (`createGatewayUnderTest`, OVE_ENGINE018): one per route covering success, validation failure, 404, scope denial with agent and channel principals.
- Schema tests: generated JSON Schema matches the zod source and the additive-only check (OVE_ARCH008) passes.
- Hostile-client tests: oversized body, wrong content type, unknown query parameter, repeated idempotency key.
- Commands: `pnpm --filter @overmind/gateway test`, `pnpm --filter @overmind/contracts test`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Independent of the other WFRT route tasks except through the contracts they import. Conflict hotspot: none if each route keeps its own `*.route.ts` file and its own `contracts/<entity>/api/` file. Use the generators from OVE_ARCH009 to create the files.

## 14. Open questions and assumptions

- Open: export format version field `exportVersion: 1` (default). Whether to include artifact blobs: no, only references (default).
