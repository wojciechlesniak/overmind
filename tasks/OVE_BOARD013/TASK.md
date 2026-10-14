---
id: OVE_BOARD013
title: "Expose Board routes, push events and api-client for the Task Board"
area: BOARD
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_BOARD006, OVE_BOARD008, OVE_BOARD009, OVE_BOARD011, OVE_BOARD012, OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE019, OVE_SHELL006]
soft_depends_on: ["OVE_BOARD007"]
provides: ["api:board.view", "api:board.task.get", "api:board.task.create", "api:board.task.move", "api:board.task.assign", "api:board.task.defer", "api:board.task.unblock", "api:board.task.note", "api:board.progress", "api:board.search", "lib:api-client-board"]
needs: ["lib:gateway-routes", "lib:caller-context", "lib:event-hub", "lib:api-client-core", "lib:error-catalogue"]
owns: ["packages/gateway/src/routes/board/**", "packages/api-client/src/board/**"]
reads: ["packages/contracts/src/board/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 23]
---

# OVE_BOARD013: Expose Board routes, push events and api-client for the Task Board

## 1. Summary

Expose the Board backend through the authenticated local gateway: typed route modules (read views, task operations, progress), request and response schemas, push event subscription mapping, and the typed `api-client` functions the desktop UI and the Telegram adapter use. No business logic here: routes validate, derive the caller identity and call use cases.

## 2. Context

ARCH008/ARCH009: one `*.route.ts` per capability, auto-registered; contract first; responses use the error envelope of ARCH003; events flow to clients through the hub of ARCH010 (replay by `afterEventId`). The gateway is reachable only by the owner over a Unix socket (ENGINE); the caller context (`owner` via desktop, `channel` Telegram, `agent` from the overmind Skill session) is produced by the gateway authenticator (ENGINE/PERM) and is never taken from a request body.

## 3. Scope (in)

- Route modules and zod request/response schemas (importing entity schemas from BOARD001).
- Event visibility mapping for `task.*`, `board.lanes_changed`, `board.progress_changed`.
- api-client functions and types.
- Contract tests with a gateway test harness.

## 4. Out of scope

- UI: BOARDUI/WSPACE. Gateway infrastructure (server, auth, SSE/WebSocket framing): ENGINE. Agent-facing Skill commands that report progress: SKILL/AGENT (they call these routes as `agent` actor).

## 5. Detailed requirements

1. **Routes** (prefix `/api/v1`, JSON; `:wid` WorkspaceId, `:id` TaskId); every route is Workspace-scoped:
   | Method and path | Use case | Callers |
   |---|---|---|
   | `GET /workspaces/:wid/board?scope=&assignee=&q=&doneVisible=` | get-view | owner, chief, channel |
   | `GET /workspaces/:wid/board/lanes/:laneId/tasks?cursor=&limit=` | list lane (older done) | owner, chief |
   | `GET /workspaces/:wid/tasks/:id` | get-task-detail | owner, chief, channel; agent only for its own Task (summary shape without timeline of others) |
   | `GET /workspaces/:wid/tasks?q=` | search | owner, chief |
   | `POST /workspaces/:wid/tasks` | create-task | owner, chief (Owner: the `+ Zadanie z Dokumentacji` button) |
   | `POST /tasks/:id/move` `{ toLaneId, reason, expectedVersion, overrideWip? }` | move-task | owner, chief, channel |
   | `POST /tasks/:id/assign` `{ agentId|null, reason?, expectedVersion }` | assign | owner, chief, channel |
   | `POST /tasks/:id/defer`, `/block`, `/unblock` | defer-block | owner, chief |
   | `POST /tasks/:id/progress` `{ done, total, label? }` | report-progress | agent (own), system |
   | `POST /tasks/:id/evidence` `{ artifactId, kind }` | add-evidence | agent (own), owner, chief |
   | `POST /tasks/:id/directive-notes` | note-directive | chief, system |
   | `GET /workspaces/progress?ids=a,b,c` | get-progress-batch | owner only |
   | `GET /workspaces/:wid/board/progress` | get-progress | owner, channel |
   Task ids in `/tasks/:id/*` routes are resolved WITH the Workspace of the caller context where it exists (agent sessions are Workspace-bound); for the owner the Task's Workspace is looked up and used, and the response never discloses existence differences beyond 404.
2. **Request validation:** strict zod; the body may not contain `workspaceId`, `actor`, `createdBy`, `provenance.createdBy`, `seq`, `version` (except `expectedVersion`): unknown keys are rejected with `validation.invalid_input`. `Idempotency-Key` header supported on `POST /workspaces/:wid/tasks` (maps to `provenance.draftKey` with source `api:<callerId>`), so UI double submits do not duplicate Tasks.
3. **Caller context to actor:** use `lib:caller-context` (`Actor`); the route modules declare allowed caller kinds in a `defineRoute({ callers: [...] })` option; a disallowed kind gets 403 `board.move_not_permitted` or `gateway.forbidden` per ARCH003 and an audit event.
4. **Responses:** `Result` mapped via `toErrorResponse`; `409 board.version_conflict` includes the current `version` in `details` (safe) so the UI can reload; `422 board.doc_ref_*` carry `details.reason`.
5. **Push events:** register the Board events with the hub visibility: `task.*` and `board.lanes_changed` -> owner, channel (summary only), agent only for events of Tasks assigned to it; `task.progress_reported` ephemeral. Event payloads are the BOARD001 shapes; the hub filters.
6. **api-client:** `packages/api-client/src/board/{board.client.ts,tasks.client.ts,progress.client.ts}` with typed functions returning `Result<T, ApiError>`, generated from route schemas where the ARCH008 pipeline supports it, otherwise thin hand-written wrappers over the shared fetch core; includes `subscribeBoard(workspaceId, handler)` helper delegating to the core subscription with the Board event type filter.
7. **Rate limits:** per-caller soft limits (agent `progress` 1 call/s per Task, `create` 30/min); exceeding returns `429` with retry-after.
8. **Docs:** OpenAPI-like route table generated; no hand-written docs.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`defineRoute`, auth and error mapping from ENGINE/ARCH003/ARCH008; use cases from BOARD005-BOARD012; api-client core from ENGINE. No business logic, no SQL, no direct repository access in route modules.

## 8. Architecture and code placement

`packages/gateway/src/routes/board/{board-view.route.ts,task-detail.route.ts,task-create.route.ts,task-move.route.ts,task-assign.route.ts,task-defer-block.route.ts,task-progress.route.ts,task-evidence.route.ts,progress.route.ts,search.route.ts,schemas.ts}`; `packages/api-client/src/board/**`. Gateway depends on application use cases and contracts only.

## 9. Security and safety

The gateway is the trust boundary for the Board: identity from the authenticated session; strict schemas stop mass-assignment of server-owned fields; per-route allowed caller kinds enforce the BOARD008 matrix a second time (defence in depth: use cases still enforce it); Agent callers are Workspace-bound and may only touch their own Task; Telegram caller kind gets summaries (no description or docRef quote) and cannot create Tasks; progress/evidence are rate limited; errors never include paths or SQL; every denial audited. Task `description` returned to clients is data (UI must sanitise Markdown, SR-35); the route never returns the raw `provenance.createdBy` actor internals beyond `kind` and `id`.

## 10. Errors and edge cases

- `expectedVersion` missing: 422.
- Unknown lane id for another Workspace: 404 (no oracle).
- Agent session for Workspace A calls a Task of Workspace B: 404.
- Large `q`: 422 over 200 chars.
- Telegram caller requests detail: summary shape only.
- Hub reconnect with `afterEventId` beyond retention: `events.resync_required` (ARCH010); client refetches view.

## 11. Acceptance criteria

- [ ] Every route has a request/response schema, allowed callers, and a contract test of happy path plus error mapping.
- [ ] Mass assignment attempts (`workspaceId`, `createdBy`, `seq`, `status` on create) are rejected.
- [ ] Agent callers cannot call move/assign/defer/create and can report progress only on their own Task.
- [ ] Telegram caller receives the summary shape.
- [ ] `Idempotency-Key` prevents duplicate Task creation.
- [ ] api-client functions typecheck against the schemas and are covered by tests against the gateway test harness.
- [ ] Event visibility filtering verified per caller kind.

## 12. Test plan

- `packages/gateway/src/routes/board/*.route.test.ts` with the gateway test harness (ENGINE) and fake use cases/fakes from BOARD003.
- `packages/api-client/src/board/*.test.ts` against a mock server.
- Visibility matrix test (caller kind x route x outcome).
- Commands: `pnpm vitest run packages/gateway/src/routes/board packages/api-client/src/board`.

## 13. Parallelization notes

Last implementation task of BOARD; BOARDUI and WSPACE view tasks mock these routes with the api-client types. One route module per file avoids conflicts.

## 14. Open questions and assumptions

- ASSUMPTION: path style REST under `/api/v1`; if ENGINE chooses NDJSON/RPC framing the route table maps 1:1 to method names.
- ASSUMPTION: Telegram receives the summary shape (title, status, lane, assignee) only.
