---
id: OVE_PAUSE007
title: "Expose pause through gateway routes, push events and the api-client"
area: PAUSE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE011, OVE_ENGINE017, OVE_ENGINE019, OVE_PAUSE003, OVE_PAUSE004, OVE_PAUSE006]
soft_depends_on: []
provides: ["api:pause.state", "api:pause.global", "api:pause.workspace", "lib:api-client-pause"]
needs: ["lib:route-module", "lib:gateway-principal", "lib:gateway-push", "lib:api-client"]
owns: ["packages/gateway/src/routes/pause/**", "packages/api-client/src/pause/**", "packages/contracts/src/pause/api/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [5, 6]
---

# OVE_PAUSE007: Expose pause through gateway routes, push events and the api-client

## 1. Summary

Adds the HTTP-like routes `GET /v1/pause`, `PUT /v1/pause/global`, `PUT /v1/pause/workspaces/{workspaceId}`, the push events and a typed api-client module so the desktop, tray and Telegram adapter all use the same code path.

## 2. Context

Desktop UI, Tauri tray, the Telegram adapter (in-process transport) and the 'overmind' Skill all need the same operations (ADR 0005: thin clients over one gateway; SPEC 16.13 parity). The gateway authenticates the caller and attaches the principal and channel; this task only declares route modules (auto-registered, CONVENTIONS section 5).

## 3. Scope (in)

- Route module `pause.route.ts` with three routes and their zod request/response schemas.
- Principal-based response filtering (agents see only `{ paused }`).
- Push topics `pause.changed` and `pause.drain.updated` through the gateway subscription hub.
- api-client functions and a React-agnostic subscription helper.
- Rate limit for mutations.

## 4. Out of scope

- UI hooks and components: OVE_PAUSE010 to OVE_PAUSE015.
- Gateway infrastructure (auth, framing, SSE): ENGINE.
- Telegram command handling: OVE_TG007.

## 5. Detailed requirements

1. **Routes** (capabilities in brackets):
   - `GET /v1/pause` [`api:pause.state`] -> `PauseSnapshot`. For principal `agent` the response is `{ paused: boolean }` only (served to the Skill 'overmind').
   - `PUT /v1/pause/global` [`api:pause.global`] body `{ paused: boolean }` -> `{ snapshot: PauseSnapshot, changed: boolean }`.
   - `PUT /v1/pause/workspaces/{workspaceId}` [`api:pause.workspace`] body `{ paused: boolean }` -> same shape.
   The request body has NO field for channel or actor (strict schema; unknown keys rejected with `validation.invalid`).
2. Handlers are thin: map `paused` to `PauseGlobal`/`ResumeGlobal` (or the Workspace pair) and pass the `principal` from the authenticated request context; errors are mapped by the central error mapper (`pause.resume_requires_desktop` -> 403, `pause.forbidden_actor` -> 403, `pause.workspace_not_found` -> 404, `data.conflict` -> 409).
3. **Push**: topics `pause.changed` (payload per OVE_PAUSE001; for `channel` subscribers the `snapshot` is trimmed to global state and counts, no Workspace ids that are isolated) and `pause.drain.updated`. A new subscription immediately receives the current snapshot (initial state event) so the UI never shows a stale banner after reconnect.
4. **Rate limit**: at most 10 mutating calls per minute per principal+channel, `gateway.rate_limited` afterwards, except that a call that would not change state still counts (prevents a loop hammering). Reads are not limited beyond the global limit.
5. **api-client** (`packages/api-client/src/pause/`): `getPauseSnapshot()`, `setGlobalPause(paused)`, `setWorkspacePause(workspaceId, paused)`, `subscribePause(handler): Unsubscribe` returning typed `PauseSnapshot` updates; all return `Result`. A tiny pure helper `selectPauseView(snapshot, workspaceId?)` returns `{ paused, scope: 'global'|'workspace'|null, phase, drain }` for UI reuse.
6. Route schemas live in `packages/contracts/src/pause/api/` and feed the generated JSON Schema/OpenAPI and the client types (ARCH008).
7. While the engine is not ready (boot recovery not finished) all three routes return `gateway.not_ready` with `Retry-After: 1` equivalent field `retryAfterMs`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Route-module conventions and generator (ARCH009), the error mapper (ARCH003), gateway authentication principal (ENGINE/SEC005), push hub (ENGINE), `PauseGlobal`, `ResumeGlobal`, `PauseWorkspace`, `ResumeWorkspace`, `GetPauseSnapshot` (OVE_PAUSE003/004).

## 8. Architecture and code placement

`packages/gateway/src/routes/pause/pause.route.ts` (route module only, no business logic), `packages/api-client/src/pause/{client.ts,select-view.ts,index.ts}`, schemas in contracts. Gateway depends on application use cases via the composition (module `requires` the use case tokens); api-client depends on contracts only.

## 9. Security and safety

- Authority is enforced by the use cases (defence in depth); the route additionally rejects `agent` and `chief` principals for PUT before calling them.
- Body strictness prevents a client from claiming `channel: 'desktop'` over Telegram.
- Agents get the minimal read so they can stop cooperatively, but learn nothing about who paused or when.
- Rate limit protects against a runaway client; limit buckets are per authenticated principal.
- Channel-filtered push payloads: Telegram subscribers never receive isolated-Workspace ids or paths.

## 10. Errors and edge cases

- Duplicate PUT with the same value: 200 with `changed:false`.
- Invalid workspaceId format: 400 `validation.invalid` before any lookup.
- Subscriber reconnects after a gap: gets the initial snapshot event, then deltas.
- Engine shutting down: in-flight PUT completes or returns `gateway.shutting_down`; state is never half-applied (single transaction in the use case).
- Client sends `paused` as a string: rejected by the strict schema.

## 11. Acceptance criteria

- [ ] Given an owner token on channel desktop, When `PUT /v1/pause/global {paused:true}`, Then 200 `changed:true` and a `pause.changed` push arrives at a subscriber.
- [ ] Given an in-process Telegram principal, When `PUT /v1/pause/global {paused:false}`, Then 403 `pause.resume_requires_desktop`.
- [ ] Given an agent principal, Then `GET /v1/pause` returns exactly `{ paused }` and PUT returns 403.
- [ ] Given 11 mutations in a minute, Then the 11th is `gateway.rate_limited`.
- [ ] A new push subscriber receives the current snapshot first.
- [ ] Route schemas appear in the generated JSON Schema and the api-client compiles against them.
- [ ] A body with an extra `channel` key is rejected.

## 12. Test plan

Route tests with the in-memory gateway harness and fake use cases: `pause.route.test.ts`, `pause-push.test.ts`, `pause-principal-filter.test.ts`, `rate-limit.test.ts`; api-client tests with a fake transport: `client.test.ts`, `select-view.test.ts`. Commands: `pnpm vitest run packages/gateway/src/routes/pause packages/api-client/src/pause`.

## 13. Parallelization notes

Starts when PAUSE003, 004 and 006 are merged (contracts available earlier allow a stub). Route modules are auto-registered, nothing in shared files to edit. UI tasks (PAUSE010 onwards) can start against the api-client contract and a mock gateway as soon as the schemas merge.

## 14. Open questions and assumptions

- ASSUMPTION: path prefix `/v1`; ENGINE defines the real prefix and framing; adapt without changing capability names.
- OPEN: should the agent-facing read live under the Skill's own namespace (SKILL area)? DEFAULT: the same `GET /v1/pause`, filtered by principal.
