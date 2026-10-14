---
id: OVE_PROV021
title: Implement the connections gateway routes and api-client functions
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH008, OVE_ARCH009, OVE_ENGINE013, OVE_ENGINE018, OVE_ENGINE019, OVE_PROV002, OVE_PROV014, OVE_PROV017, OVE_PROV019, OVE_PROV020, OVE_PROV022]
soft_depends_on: [OVE_PROV018, OVE_PROV023]
provides: ["api:connections.list", "api:connections.detect", "api:connections.test", "api:connections.status", "api:connections.login.start", "api:connections.login.status", "api:connections.login.cancel", "api:connections.remove", "lib:api-client-connections"]
needs: ["lib:route-module", "lib:route-registrar", "lib:gateway-authorization", "contract:RouteContract", "usecase:ListConnections", "usecase:GetConnection", "usecase:RemoveConnection", "usecase:DetectConnections", "usecase:TestConnection", "usecase:StartCliLogin", "usecase:CancelCliLogin", "usecase:GetCliLoginStatus", "usecase:GetUsageSnapshot", "lib:api-client", "lib:gateway-test-support"]
owns:
  - packages/gateway/src/routes/prov/**
  - packages/api-client/src/prov/**
  - packages/contracts/src/provider/connection-login-routes.schema.ts
  - docs/api/examples/connections-login.md
reads: ["packages/contracts/src/connection/", "docs/api/examples/connections.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 14", "SPECIFICATION 15"]
adr_refs: [7, 10, 22]
---

# OVE_PROV021: Implement the connections gateway routes and api-client functions

## 1. Summary

Expose the Connections capability to the desktop UI (CONNUI, ONB wizard), Telegram status and future CLI through the authenticated local gateway: list, detect, test, status (contracts from PROV002) plus the login start/status/cancel and remove routes that PROV014 and PROV020 need. Typed client functions are provided for all of them.

## 2. Context

PROV002 defined `connections.list`, `connections.detect`, `connections.test`, `connections.status` (scope `owner`, status also readable by `channel:telegram` as a summary) with the path pattern `/v1/<resource>/<action>`. The login and removal use cases exist (PROV014, PROV020) but have no routes yet. The gateway pipeline (ENGINE011), auto-registered route modules (ARCH009 `*.route.ts`), authorization and rate limits are ENGINE's; this task only writes route modules and the client. No route ever returns a secret; login routes never carry tokens, codes or callback URLs in responses.

## 3. Scope (in)

- Route modules for the eight routes with request/response validation, scopes, idempotency declarations and error mapping.
- The login route contracts (new schema file) and examples.
- `api-client` functions and types.
- Gateway-level tests with the ENGINE test support.

## 4. Out of scope

- Use case logic (PROV014/017/019/020/022), the Telegram route for entering a bot token (TG), UI (CONNUI, ONB), route infrastructure (ENGINE).

## 5. Detailed requirements

1. **Routes (all under `/v1`, JSON, scopes per `RouteScope` of ENGINE013):**
   - `GET /connections` -> `{ items: Connection[] }` (scope `owner`).
   - `POST /connections/detect` -> `{ items, started }` (scope `owner`, idempotency `natural`); request `{ providers?: ProviderId[], workspaceId?: WorkspaceId }` (the optional Workspace selects the probe Environment, PROV022).
   - `POST /connections/{id}/test` -> `{ connection, checks[] }` (scope `owner`).
   - `GET /connections/{id}/status` -> `{ connection, usage?: ModelUsage, activeAgents: number, limit: number, queued: number }` (scope `owner` and `channel:telegram` read-only summary: the Telegram view omits `models` details and `statusDetail.code`, keeps status words and the CLI-reported limit text).
   - `POST /connections/{id}/login` -> `{ loginId, method, instructionKey, instructionParams, hostCommand?: { display: string }, forward?: { hostPort: number }, expiresAt }` (scope `owner`, `local: true` required because it opens a forward and a host command; idempotency by `Idempotency-Key`); request `{ workspaceId, method?: 'paste_code'|'device_code'|'browser_callback' }`.
   - `GET /connections/{id}/login/{loginId}` -> `{ loginId, state, expiresAt }` (scope `owner`).
   - `POST /connections/{id}/login/{loginId}/cancel` -> `{ state }` (scope `owner`, idempotent).
   - `DELETE /connections/{id}` -> `{ removed: true }` (scope `owner`, `local: true`, requires the local confirmation proof header of PERM009; request body `{ alsoSignOut?: boolean }`).
2. **Callback paste route:** the "paste redirect URL" step of browser login (BOX015 `loginCallbackExec`) is NOT a gateway route in this task: it is a separate, local-only route owned by the wizard task because it carries a secret-like string; this task lists it as a gap. (If ONB needs it, it will use the `StartCliLogin` session and a route that never logs the body; see SEC009.)
3. **Validation and errors:** request bodies are strict zod (unknown fields rejected), ids validated (`cn_` ULID), responses validated in dev/test. Error mapping per ARCH003: `provider.not_found` 404, `provider.busy` 409/429, `box.isolation_unavailable` 503, `perm.local_only` 403, `provider.needs_login` 409. Messages are generic keys.
4. **No secrets, no CLI text:** responses contain only i18n keys, ids, enum values, timestamps and the CLI-reported limit text field already sanitised by PROV017. The host command shown for login contains only the program and the container name placeholder (`container exec -it <name> claude`), no arguments with tokens.
5. **Rate limits:** `detect` and `test` at most 1 per 5 s per Connection; `login` start at most 3 per minute (gateway rate-limit declarations, ENGINE014); the UI polling of `login/{loginId}` at most 1 per second.
6. **Audit:** mutating routes are audited by the pipeline (ENGINE016); `login` and `remove` add domain audit through their use cases.
7. **Client:** `packages/api-client/src/prov/connections.ts` exposes `listConnections()`, `detectConnections(req)`, `testConnection(id)`, `getConnectionStatus(id)`, `startCliLogin(id, req)`, `getCliLoginStatus(id, loginId)`, `cancelCliLogin(id, loginId)`, `removeConnection(id, req)` with generated types; no hand-written duplicates of contract types.
8. **OpenAPI/JSON schema:** all routes appear in the generated schema (ARCH008) and the additive-only check passes.
9. **Examples:** `docs/api/examples/connections-login.md` generated from schemas.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Route module pattern and registrar (ARCH009, ENGINE013), pipeline/auth/rate limit/idempotency (ENGINE011-015), contracts from PROV002, use cases from PROV014/017/019/020/022, `api-client` core (ENGINE019). No business logic in handlers beyond mapping.

## 8. Architecture and code placement

`packages/gateway/src/routes/prov/{connections.list.route.ts,connections.detect.route.ts,connections.test.route.ts,connections.status.route.ts,connections.login.route.ts,connections.remove.route.ts}`; client in `packages/api-client/src/prov/`; login route schemas in `packages/contracts/src/provider/connection-login-routes.schema.ts`. Handlers are thin: parse, call the use case through its port, map result (Clean Architecture, SRP).

## 9. Security and safety

Owner-only routes with local-only variants for those that open forwards or delete (a Telegram or Agent-scoped caller can read a status summary and nothing more; an Agent token can never reach these routes, ESC-041). Login and remove require the local flag and, for remove, the Local Approval proof. Responses never include tokens, codes, callback URLs, raw CLI output, file paths of credential volumes or secret references. Strict input validation, bounded bodies (16 KiB), rate limits against trial storms. Errors fail closed.

## 10. Errors and edge cases

- Detect while isolation is unavailable: `box.isolation_unavailable` with remediation keys.
- Login start while another login is active: `provider.busy` (409).
- Status for an unknown id: 404 `provider.not_found`.
- Telegram caller requests `test` or `detect`: 403.
- Remove without proof: 403 `perm.local_only`/`perm.proof_required`.
- Idempotent repeat of `login` with the same key returns the same login session.
- Response for a Connection with a corrupt row: excluded from list; status returns 404.

## 11. Acceptance criteria

- [ ] All eight routes are registered automatically and appear in the generated schema; additive check passes.
- [ ] Owner session can list/detect/test/status; Telegram channel can only read the status summary; Agent token receives 403/404 on all.
- [ ] `login` and `DELETE` fail without `local: true`; `DELETE` fails without the proof header.
- [ ] Response bodies never contain secret-like strings in a sweep over all fixtures (`expectNoSecrets`).
- [ ] Rate limits trigger at the declared thresholds.
- [ ] Client functions round-trip against the gateway-under-test with typed results.

## 12. Test plan

Gateway route tests with the ENGINE test support (`gateway-under-test`) and fake use cases; contract snapshot tests; authz matrix test (owner / telegram / agent / unauthenticated); client tests with the in-process transport. Commands: `pnpm vitest run packages/gateway/src/routes/prov packages/api-client/src/prov`.

## 13. Parallelization notes

After the use case tasks expose their ports (stubs allowed). CONNUI and ONB depend on the client functions. One route module per file avoids conflicts.

## 14. Open questions and assumptions

- Gap: the "paste redirect URL" route for the Codex callback workaround and the Telegram bot token route are owned elsewhere (ONB/TG with SEC009); not defined here.
- ASSUMPTION: `activeAgents`, `limit`, `queued` come from the limiter status (PROV019) and apply to the whole installation, repeated in each Connection's status for convenience.
