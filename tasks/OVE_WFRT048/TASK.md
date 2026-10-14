---
id: OVE_WFRT048
title: "Expose Workflow read routes: list, get, versions, node types and evidence catalog"
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH009, OVE_ENGINE011, OVE_ENGINE013, OVE_WFRT002, OVE_WFRT005, OVE_WFRT010]
soft_depends_on: []
provides: ["api:workflows.list", "api:workflows.get", "api:workflows.versions.list", "api:workflows.versions.get", "api:workflows.node-types", "api:workflows.evidence-catalog", "contract:NodeTypeCatalog"]
needs: ["lib:route-module", "lib:gateway-principal", "lib:result", "contract:Workflow", "contract:WorkflowVersion", "lib:node-registry", "contract:NodeTypeDefinition", "port:ReferenceCatalog"]
owns: ["packages/gateway/src/routes/wfrt/workflows-read.route.ts", "packages/contracts/src/workflow/api/read/**", "packages/contracts/src/node-type-catalog/**", "packages/application/src/wfrt/read/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 13"]
adr_refs: [2, 19]
---

# OVE_WFRT048: Expose Workflow read routes: list, get, versions, node types and evidence catalog

## 1. Summary

Adds the owner-only read routes for Workflows: list and get, version history and a single version, the catalogue of node types available to the editor, and the evidence catalog that Quality Gates may reference. `NodeTypeCatalog` is the serialisable projection of the node registry.

## 2. Context

The Workflows list (OVE_WSPACE018) and the editor (OVE_WFED005, OVE_WFED018, OVE_WFED059, OVE_WFED076) read Workflows through the gateway only (CONVENTIONS section 6). The registry (OVE_WFRT005) lives in the engine; the UI needs its port templates, defaults and palette metadata without importing engine code. A Workflow Version is immutable and a Run is pinned to it.

## 3. Scope (in)

- `GET /workflows` (filters: workspaceId, visibility, archived, text; cursor).
- `GET /workflows/{id}` (head metadata, current published version id, draft flag).
- `GET /workflows/{id}/versions` and `GET /workflows/{id}/versions/{versionId}` (full WorkflowDefinition).
- `GET /workflows/node-types` returning `NodeTypeCatalog` (types, port templates, config schema as JSON Schema, defaults, palette group, `mvp` flag).
- `GET /workflows/evidence-catalog` returning the evidence kinds a Quality Gate may require (tests, build, lint, artifact, diff).
- Use cases `ListWorkflows`, `GetWorkflow`, `ListWorkflowVersions`, `GetWorkflowVersion`, `GetNodeTypeCatalog`, `GetEvidenceCatalog`.

## 4. Out of scope

- Draft read and write, publish: OVE_WFRT049.
- api-client functions: OVE_WFRT050.
- Visibility change route (`api:workflows.visibility`): VIS and WSPACE area.
- Run routes: OVE_WFRT051.

## 5. Detailed requirements

1. Each route lives in its own `*.route.ts` module under the owned path and is auto-registered through `lib:route-module` (OVE_ARCH009) and `lib:route-registrar` (OVE_ENGINE013). The task MUST NOT edit any shared registry file.
2. Request and response schemas are zod objects in `packages/contracts/src/<entity>/api/`; the route table, JSON Schema and api-client types are generated from them (OVE_ARCH008). Changes are additive only.
3. Handlers are thin: parse input, read the caller from `GatewayCaller` (OVE_ENGINE011), call exactly one use case, map `Result<T, AppError>` to the envelope with the error catalogue (OVE_ARCH003). No business logic, no SQL and no file access in a handler.
4. Route scope is `owner` unless stated otherwise (`RouteScope`, OVE_ENGINE013). Agent and channel callers get `403 forbidden` without reaching the use case. Channel-limited views are out of scope here.
5. List endpoints use cursor pagination (`cursor`, `limit` default 50, max 200) from `lib:cursor-pagination` (OVE_DATA007). Unknown query parameters are rejected with `validation_failed`.
6. Mutating routes require an `Idempotency-Key` header handled by `lib:gateway-idempotency` (OVE_ENGINE015) and write an audit event through the gateway audit hook (OVE_ENGINE016).
7. `NodeTypeCatalog = { version: number, types: NodeTypeEntry[] }`; `NodeTypeEntry = { type, label, group, mvp, ports: PortDecl[], configSchema (JSON Schema), defaults, description }`. The catalogue is generated from `NodeTypeDefinition` (OVE_WFRT005) so a new node type appears without editing this task (OCP).
8. `GET /workflows/node-types` is cacheable: response carries `catalogVersion` and `ETag`; `If-None-Match` returns 304.
9. Visibility is enforced in the use case: a Private Workflow of another Workspace is `404`, not `403`, to avoid existence leaks (ADR 0028).
10. `versions.get` returns the definition in canonical form (OVE_WFRT003 `lib:definition-canonical`) with its content hash.
11. Evidence catalog entries are `{ kind, label, requiresArtifact, producedBy }` and are static data owned by the quality gate node task (OVE_WFRT056) registered through an extension point; this route only lists them.
12. Responses never include agent prompts of other Workspaces; Agent nodes carry `agentId` only.
13. List default sort is `updatedAt desc` with ULID tiebreak; `limit` max 200.

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

- [ ] List respects visibility and workspace filters.
- [ ] Node-types response validates against the generated schema and returns 304 on matching ETag.
- [ ] Private Workflow of another Workspace returns 404.
- [ ] `versions.get` returns the canonical definition and hash.
- [ ] Registering a new node type in a test registry adds it to the catalogue without code changes here.

## 12. Test plan

- Contract tests (`createGatewayUnderTest`, OVE_ENGINE018): one per route covering success, validation failure, 404, scope denial with agent and channel principals.
- Schema tests: generated JSON Schema matches the zod source and the additive-only check (OVE_ARCH008) passes.
- Hostile-client tests: oversized body, wrong content type, unknown query parameter, repeated idempotency key.
- Commands: `pnpm --filter @overmind/gateway test`, `pnpm --filter @overmind/contracts test`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Independent of the other WFRT route tasks except through the contracts they import. Conflict hotspot: none if each route keeps its own `*.route.ts` file and its own `contracts/<entity>/api/` file. Use the generators from OVE_ARCH009 to create the files.

## 14. Open questions and assumptions

- ASSUMPTION: evidence kinds are fixed for MVP (tests, build, lint, diff, artifact).
- Open: pagination of versions (default: 50 per page).
