---
id: OVE_WFRT049
title: "Expose Workflow draft, publish, validate and expression-check routes"
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH009, OVE_ENGINE011, OVE_ENGINE013, OVE_PERM020, OVE_WFRT002, OVE_WFRT010, OVE_WFRT017, OVE_WFRT048]
soft_depends_on: []
provides: ["api:workflows.draft.get", "api:workflows.draft.save", "api:workflows.draft.from-version", "api:workflows.publish", "api:workflows.edit-as-new-version", "api:workflows.validate", "api:workflows.expression.check"]
needs: ["lib:route-module", "lib:gateway-principal", "lib:result", "contract:WorkflowDraft", "usecase:ValidateWorkflow", "lib:expression-typecheck", "port:AuditLog"]
owns: ["packages/gateway/src/routes/wfrt/workflows-write.route.ts", "packages/contracts/src/workflow/api/write/**", "packages/application/src/wfrt/write/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 13"]
adr_refs: [2, 19]
---

# OVE_WFRT049: Expose Workflow draft, publish, validate and expression-check routes

## 1. Summary

Adds the owner-only routes that the editor uses to work on a Workflow draft: read and save a draft, create a draft from an existing version, publish a draft as a new immutable version, start "edit as new version", run static validation and check a single expression.

## 2. Context

A published Workflow Version is immutable (SPEC 11, OVE_WFRT002). Editing always happens on a draft; publishing validates (OVE_WFRT010) and writes a new version. The editor autosaves drafts and needs fast, side-effect-free validation and expression checks (OVE_WFED057, OVE_WFED058, OVE_WFED061, OVE_WFED070).

## 3. Scope (in)

- `GET /workflows/{id}/draft`, `PUT /workflows/{id}/draft` (optimistic concurrency with `baseRevision`).
- `POST /workflows/{id}/draft/from-version` and `POST /workflows/{id}/edit-as-new-version`.
- `POST /workflows/{id}/publish` with `{ draftRevision, changeNote }`.
- `POST /workflows/validate` (definition in body, returns `ValidationReport`) and `POST /workflows/expression/check`.
- Use cases wrapping WFRT002/WFRT010 domain rules; audit of publish.

## 4. Out of scope

- Read routes: OVE_WFRT048.
- api-client: OVE_WFRT050.
- Validation rules themselves: OVE_WFRT010 to OVE_WFRT017.
- Running a Workflow: OVE_WFRT052.

## 5. Detailed requirements

1. Each route lives in its own `*.route.ts` module under the owned path and is auto-registered through `lib:route-module` (OVE_ARCH009) and `lib:route-registrar` (OVE_ENGINE013). The task MUST NOT edit any shared registry file.
2. Request and response schemas are zod objects in `packages/contracts/src/<entity>/api/`; the route table, JSON Schema and api-client types are generated from them (OVE_ARCH008). Changes are additive only.
3. Handlers are thin: parse input, read the caller from `GatewayCaller` (OVE_ENGINE011), call exactly one use case, map `Result<T, AppError>` to the envelope with the error catalogue (OVE_ARCH003). No business logic, no SQL and no file access in a handler.
4. Route scope is `owner` unless stated otherwise (`RouteScope`, OVE_ENGINE013). Agent and channel callers get `403 forbidden` without reaching the use case. Channel-limited views are out of scope here.
5. List endpoints use cursor pagination (`cursor`, `limit` default 50, max 200) from `lib:cursor-pagination` (OVE_DATA007). Unknown query parameters are rejected with `validation_failed`.
6. Mutating routes require an `Idempotency-Key` header handled by `lib:gateway-idempotency` (OVE_ENGINE015) and write an audit event through the gateway audit hook (OVE_ENGINE016).
7. `PUT draft` requires `baseRevision`; mismatch -> `409 draft_conflict` with the current revision; body size cap 1 MiB and node cap from OVE_WFRT003 limits (reject before parsing deeply).
8. `publish` re-runs full validation server side; any `error` severity issue -> `422 validation_failed` with the report; `warning` issues are returned but do not block. The new version number is `max+1` assigned inside one `UnitOfWork`; concurrent publishes get exactly one winner.
9. `edit-as-new-version` copies the published version into the draft (replacing an empty draft only; otherwise `409 draft_exists`).
10. `validate` and `expression/check` are pure and never persist; they are rate-limited (OVE_ENGINE014 class `compute`) and have a 2 s budget; expression checks use the safe evaluator only (OVE_WFRT015, OVE_WFRT016) and never execute user code.
11. Publish writes audit event `workflow.published` (OVE_PERM019 registry) and emits `event:workflow.published` (OVE_WFRT002).
12. Global Pause does not block draft edits; publishing during pause is allowed because it starts nothing.

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

- [ ] Given a stale `baseRevision`, then 409 with the current revision.
- [ ] Given a definition with a dead-end node, then publish returns 422 and creates no version.
- [ ] Given two concurrent publishes, then one version is created.
- [ ] Given a hostile expression (deep nesting, huge literal), then check returns a typed error within the time budget.
- [ ] Given `edit-as-new-version` while a draft exists, then 409.

## 12. Test plan

- Contract tests (`createGatewayUnderTest`, OVE_ENGINE018): one per route covering success, validation failure, 404, scope denial with agent and channel principals.
- Schema tests: generated JSON Schema matches the zod source and the additive-only check (OVE_ARCH008) passes.
- Hostile-client tests: oversized body, wrong content type, unknown query parameter, repeated idempotency key.
- Commands: `pnpm --filter @overmind/gateway test`, `pnpm --filter @overmind/contracts test`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Independent of the other WFRT route tasks except through the contracts they import. Conflict hotspot: none if each route keeps its own `*.route.ts` file and its own `contracts/<entity>/api/` file. Use the generators from OVE_ARCH009 to create the files.

## 14. Open questions and assumptions

- Open: whether publish also needs Owner Local Approval when permissions widen (default: no; widening is validated by OVE_WFRT014 and shown as a warning).
