---
id: OVE_WFRT052
title: "Implement Run commands: StartRun, Pause, Resume and Cancel with gateway routes"
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH009, OVE_DATA002, OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE029, OVE_PAUSE005, OVE_PERM020, OVE_WFRT002, OVE_WFRT006, OVE_WFRT007, OVE_WFRT051]
soft_depends_on: []
provides: ["usecase:StartRun", "usecase:PauseRun", "usecase:ResumeRun", "usecase:CancelRun", "port:RunExecutor", "api:runs.start", "api:runs.pause", "api:runs.resume", "api:runs.cancel"]
needs: ["lib:route-module", "lib:gateway-principal", "lib:result", "contract:WorkflowRun", "contract:WorkflowVersion", "port:PauseGate", "usecase:AppendAudit", "port:UnitOfWork", "port:Clock"]
owns: ["packages/application/src/wfrt/run-commands/**", "packages/application/src/ports/RunExecutor.ts", "packages/gateway/src/routes/wfrt/runs-write.route.ts", "packages/contracts/src/run/api/write/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 13"]
adr_refs: [2, 19]
---

# OVE_WFRT052: Implement Run commands: StartRun, Pause, Resume and Cancel with gateway routes

## 1. Summary

Implements the application-level commands that change a Run (start, pause, resume, cancel) and the gateway routes for them. Starting creates a Run pinned to a published Workflow Version and hands it to the runtime through the `RunExecutor` port; the commands only append events and validate state transitions.

## 2. Context

Runs start from the Owner (editor, Runs view) or from Chief (OVE_CHIEF011 uses `usecase:StartRun`). The runtime interpreter implements `RunExecutor`; this task defines the port and the commands so UI, Chief and runtime can be built in parallel (OVE_WFED053, OVE_WFED054, OVE_AGENT019). Global Pause blocks starting new work (ADR 0005, SPEC 16).

## 3. Scope (in)

- `StartRun({ workflowId, versionId?, input, workspaceId, budget? , startedBy })` -> `Run` in status `pending`; version defaults to the latest published.
- `PauseRun`, `ResumeRun`, `CancelRun` with the state machine from OVE_WFRT006; cancel is two-step (`cancel_requested` then `cancelled`).
- `RunExecutor` port: `enqueue(runId)`, `signal(runId, "pause"|"resume"|"cancel")`.
- Routes `POST /runs`, `POST /runs/{id}/pause|resume|cancel` with idempotency.

## 4. Out of scope

- Interpreting the graph and executing nodes: OVE_WFRT024 onwards and the runtime tasks.
- Branch-level pause: OVE_WFRT053.
- Run Budget check: OVE_PROV035 via the port, called here before enqueue.

## 5. Detailed requirements

1. Each route lives in its own `*.route.ts` module under the owned path and is auto-registered through `lib:route-module` (OVE_ARCH009) and `lib:route-registrar` (OVE_ENGINE013). The task MUST NOT edit any shared registry file.
2. Request and response schemas are zod objects in `packages/contracts/src/<entity>/api/`; the route table, JSON Schema and api-client types are generated from them (OVE_ARCH008). Changes are additive only.
3. Handlers are thin: parse input, read the caller from `GatewayCaller` (OVE_ENGINE011), call exactly one use case, map `Result<T, AppError>` to the envelope with the error catalogue (OVE_ARCH003). No business logic, no SQL and no file access in a handler.
4. Route scope is `owner` unless stated otherwise (`RouteScope`, OVE_ENGINE013). Agent and channel callers get `403 forbidden` without reaching the use case. Channel-limited views are out of scope here.
5. List endpoints use cursor pagination (`cursor`, `limit` default 50, max 200) from `lib:cursor-pagination` (OVE_DATA007). Unknown query parameters are rejected with `validation_failed`.
6. Mutating routes require an `Idempotency-Key` header handled by `lib:gateway-idempotency` (OVE_ENGINE015) and write an audit event through the gateway audit hook (OVE_ENGINE016).
7. `StartRun` MUST reject when Global Pause or the Workspace is paused (`409 paused`), when the version is not published, when the Workflow is archived, or when `BudgetService.check` reports `exhausted`.
8. Input is validated against the Start node `PortSchema` (OVE_WFRT004) before the Run is created; invalid input creates nothing.
9. State transitions are validated by the domain state machine; illegal transitions return `409 invalid_transition` and write no events. Events are appended in one `UnitOfWork` with the outbox (OVE_DATA002).
10. `RunExecutor.enqueue` is called after commit through the outbox; a crash between commit and enqueue is repaired by crash recovery (OVE_ENGINE005).
11. Concurrency cap (default 4 concurrent Runs, from config) -> `409 run_limit_reached`; Chief receives the same error.
12. Every command writes an audit event with the actor (`contract:Actor`, OVE_PERM008). Agents cannot call the routes; Chief calls the use cases directly with its own Actor.

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

- [ ] Given Global Pause, when starting a Run, then 409 and no Run exists.
- [ ] Given a published version, when starting twice with one idempotency key, then one Run.
- [ ] Given cancel on a finished Run, then 409 `invalid_transition`.
- [ ] Given a crash after commit, then recovery enqueues the pending Run once.
- [ ] Given invalid input, then 422 and no events.

## 12. Test plan

- Contract tests (`createGatewayUnderTest`, OVE_ENGINE018): one per route covering success, validation failure, 404, scope denial with agent and channel principals.
- Schema tests: generated JSON Schema matches the zod source and the additive-only check (OVE_ARCH008) passes.
- Hostile-client tests: oversized body, wrong content type, unknown query parameter, repeated idempotency key.
- Commands: `pnpm --filter @overmind/gateway test`, `pnpm --filter @overmind/contracts test`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Independent of the other WFRT route tasks except through the contracts they import. Conflict hotspot: none if each route keeps its own `*.route.ts` file and its own `contracts/<entity>/api/` file. Use the generators from OVE_ARCH009 to create the files.

## 14. Open questions and assumptions

- ASSUMPTION: default concurrency cap 4 Runs; configurable in `ConfigService`.
- Open: whether cancel should attempt to stop agent sessions immediately (default: runtime handles via `cancel_requested`).
