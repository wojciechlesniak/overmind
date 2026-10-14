---
id: OVE_AGENT005
title: Expose Agent CRUD and version history through gateway routes and api-client
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_ARCH009, OVE_ENGINE012, OVE_ENGINE019]
soft_depends_on: []
provides: ["api:agents.list", "api:agents.get", "api:agents.create", "api:agents.update", "api:agents.archive", "api:agents.versions", "lib:api-client-agents"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:api-client-core"]
owns: ["packages/gateway/src/routes/agent/agents.route.ts", "packages/gateway/src/routes/agent/agent-versions.route.ts", "packages/contracts/src/agent/api/**", "packages/api-client/src/agent/**"]
reads: ["packages/application/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 16.2"]
adr_refs: [5, 7]
---

# OVE_AGENT005: Expose Agent CRUD and version history through gateway routes and api-client

## 1. Summary

HTTP-like routes over the owner-only gateway for listing, reading, creating, updating and archiving Agents and for reading version history, plus typed `api-client` functions that the desktop (AGUI), Telegram adapter and future CLI use. Routes are thin: parse, call the use case, map the `Result`.

## 2. Context

ARCH008 defines `defineRoute` and the contract pipeline; ARCH009 auto-registers `*.route.ts`; ENGINE owns authentication and framing. This task owns only the Agent route modules and their request/response schemas. The Agents view needs list rows with state, a profile with versions, "Nowy" and "Zapisz jako vN".

## 3. Scope (in)

- Routes: `GET /v1/agents?workspaceId=&lifecycle=&query=&includeArchived=`, `GET /v1/agents/{id}?version=`, `POST /v1/agents`, `PATCH /v1/agents/{id}`, `POST /v1/agents/{id}/archive`, `GET /v1/agents/{id}/versions?cursor=&limit=`.
- Request and response zod schemas in `packages/contracts/src/agent/api/`.
- api-client functions `agents.list/get/create/update/archive/versions`.
- Push event subscription mapping helpers for `agent.*` events (types only; the hub is ENGINE).

## 4. Out of scope

- Visibility change route: `OVE_AGENT006`. Dynamic Agent accept/delete: `OVE_AGENT007`. Agent State route: `OVE_AGENT010`. Chat routes: `OVE_CHAT013`.

## 5. Detailed requirements

1. Each route module declares `{ method, path, request, response, requires: [tokens], auth: 'owner' }` via `defineRoute` (ARCH008). The desktop session and the Telegram adapter authenticate as `owner` with a `channel` attribute (ENGINE); agent tokens (CLI sessions) are rejected on these routes with `gateway.forbidden_for_agent`.
2. `GET /v1/agents`: `workspaceId` is REQUIRED (agents are listed per Workspace; see VIS). Response `{ items: AgentSummary[], nextCursor? }` with default `limit` 50, max 200.
3. `POST /v1/agents` body `CreateAgentInput`; returns 201 with `Agent`. `PATCH` body `{ expectedVersion, patch, changeNote? }`; returns 200 with the new `Agent`, or 200 with `{ unchanged: true }` for a no-op. `If-Match`-style header is NOT used; `expectedVersion` is in the body.
4. Error mapping uses `toErrorResponse` (ARCH003): `agent.not_found` 404, `agent.version_conflict` 409 with `currentVersion`, `agent.invalid_config` 422 with `issues[]` (path and code only), `perm.owner_required` 403.
5. Idempotency: `POST /v1/agents` accepts an optional `Idempotency-Key` header (ULID); a repeated key within 24 h returns the original response (key store provided by ENGINE; if not yet available the route ignores the header and documents it).
6. Responses never include fields beyond the contract; `instructions` is included only on `GET /v1/agents/{id}` (not in list rows) to keep list payloads small and logs safer.
7. api-client: typed functions returning `Result<T, ApiError>`, with generated types from the contract pipeline, abort support and no retries on `POST/PATCH` (non-idempotent without key).
8. Live updates: contract constants `AGENT_EVENT_TYPES = ['agent.created','agent.config_changed','agent.archived','agent.state.changed']` exported for clients to subscribe.
9. OpenAPI-like JSON Schema for each route is generated and snapshot-tested (additive only).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineRoute`, `toErrorResponse`, `PageRequest`, api-client core (ENGINE), use cases from `OVE_AGENT004`. Do not parse bodies by hand.

## 8. Architecture and code placement

`packages/gateway/src/routes/agent/*.route.ts` (auto-registered), schemas in `packages/contracts/src/agent/api/`, client in `packages/api-client/src/agent/`. Gateway depends on application use cases through tokens declared by the route, never `engine.get`.

## 9. Security and safety

Owner-only authentication; agent tokens and unauthenticated calls fail closed. No raw `instructions` in list responses or logs. Rate limit: ENGINE default per-route limits apply; `POST` writes limited to 30 per minute per session (ASSUMPTION). Body size limit 64 KB (instructions 20 000 characters in UTF-8 fits). Path ids are validated as `agt_` ULIDs before reaching use cases.

## 10. Errors and edge cases

- Malformed id: 400 `validation.invalid_input`.
- `workspaceId` of an unknown Workspace: 404 `data.not_found`.
- Large patch (> 64 KB): 413 `validation.too_large`.
- Client sends a field the server does not know (older server): strict schema returns 422; client library maps it to a "update the app" message.

## 11. Acceptance criteria

- [ ] Each route has request and response schemas, generated JSON Schema snapshot and a passing route test with a fake use case.
- [ ] Agent tokens receive 403 on every route.
- [ ] A `GET` list without `workspaceId` returns 400.
- [ ] A no-op `PATCH` returns `{ unchanged: true }`.
- [ ] `api-client` functions compile against generated types and return typed errors.
- [ ] Private Agents of another Workspace never appear in a list (integration test with two Workspaces).

## 12. Test plan

Route tests with the ENGINE test harness (in-process gateway, fake use cases); client tests with a mock transport; schema snapshot test. Command: `pnpm vitest run packages/gateway/src/routes/agent packages/api-client/src/agent`.

## 13. Parallelization notes

After AGENT004. AGUI tasks can code against the schemas as soon as the `api/` contracts merge (merge those first). Hotspot: none, one route module per capability.

## 14. Open questions and assumptions

- ASSUMPTION: path prefix `/v1`; final prefixing belongs to ENGINE.
- ASSUMPTION: idempotency key support depends on an ENGINE key store; documented fallback above.
