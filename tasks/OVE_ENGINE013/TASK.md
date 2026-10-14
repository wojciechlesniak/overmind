---
id: OVE_ENGINE013
title: Route registrar and authorisation by route scope (owner, agent, channel, local-only)
area: ENGINE
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_ARCH008, OVE_ARCH009, OVE_ENGINE011, OVE_ENGINE012]
soft_depends_on: []
provides: ["lib:route-registrar", "lib:gateway-authorization", "contract:RouteScope", "lib:gateway-routes"]
needs: ["lib:route-module", "lib:composition-root", "lib:gateway-auth", "lib:gateway-pipeline", "contract:RouteContract"]
owns: ["packages/gateway/src/routing/**", "packages/gateway/src/authz/**", "packages/gateway/src/routes/index.generated.ts"]
reads: ["packages/gateway/src/route-module"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [3, 6]
---

# OVE_ENGINE013: Route registrar and authorisation

## 1. Summary

Register every route module found by the generator, resolve each route's required use cases from the composed engine, match requests to routes, and enforce the route `scope` before any handler runs. A route without a scope is denied.

## 2. Context

ARCH009 defines `defineRouteModule` (route, `requires` tokens, `handle`) and the generated list; ARCH008 gives `scope` (`owner`, `agent`, `channel:telegram`, local-only flag). SEC005 test 8 generates an authorisation matrix from the registry. SR-16, SR-25, SR-31: agents and Telegram cannot reach Owner-only or permission-expanding routes.

## 3. Scope (in)

- Registrar, router (method + path template match, params), scope evaluation, `local-only` rule, registry introspection for tests.

## 4. Out of scope

- Handlers (areas). The `defineRouteModule` helper (ARCH009).

## 5. Detailed requirements

1. Startup: import `routes/index.generated.ts`; for each module resolve `requires` from the composed engine (ARCH006) and call `handle(deps)` once to obtain the handler; build `RouteTable`. Duplicate `(method, path)` or duplicate route ids abort startup (`gateway.route_conflict`). A module whose required token has no provider aborts startup (fail closed, not "route missing").
2. Router: static segments before parameters, `{id}` params validated by the route's `params` schema (prefixed ULID), trailing slash not equivalent (404), case-sensitive. Unknown path -> 404 `gateway.not_found`; known path wrong method -> 405 with `Allow`.
3. Scope model (`RouteScope`): `scope: Array<'owner' | 'agent' | 'channel:telegram' | 'system'>` plus `local?: boolean` (requires `caller.local === true`, i.e. Owner desktop session through the bridge) and `agentBinding?: 'own-run' | 'own-workspace'`. Evaluation: caller kind must be listed; `channel:telegram` callers are `kind:'channel'`; `system` is internal-only (in-process calls) and never reachable from the socket.
4. Agent binding: for `kind:'agent'` the pipeline injects `caller.runId/agentId/workspaceId` from the token; route param or body ids that name another Run/Workspace are rejected with 404 (no enumeration, SEC005 test 8) by a helper `assertAgentOwns(caller, resourceRef)` the route handler must call; the registrar additionally checks `params.runId`/`params.workspaceId` automatically when `agentBinding` is declared.
5. Permission-expanding routes: contracts mark `expandsPermissions: true`; the authorizer requires `owner` + `local: true` for those and ignores any other declared scope (belt and braces for SR-16/SR-25). Telegram and agents never pass even if mistakenly listed (a contract check in ARCH008 tooling plus a runtime assertion at registration: `expandsPermissions` with `agent` or `channel` scope aborts startup).
6. Missing or empty `scope` -> registration fails (`gateway.route_unscoped`) in all builds.
7. Denials: `403 gateway.forbidden_scope` (no hint about which scope), written to the access log and passed to the audit middleware (`audit: true` for all denials on mutating or `expandsPermissions` routes).
8. Introspection (tests/diagnostics): `registry.list(): RouteInfo[]` with id, method, path, scope, flags; used by SEC005's matrix generator and by `GET /v1/system/routes` (owner only, diagnostics).
9. Hot paths: router is a precomputed trie; match cost O(path length); no regex built from user input.
10. Route modules never receive the container: only resolved use cases (ARCH006 req. 9).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineRouteModule`, generated index (ARCH009), `composeEngine` resolution (ARCH006), `RouteContract` metadata (ARCH008).

## 8. Architecture and code placement

`packages/gateway/src/routing/{registrar.ts,router.ts,route-table.ts}`, `authz/{evaluate-scope.ts,agent-binding.ts}`. Gateway depends on contracts and application tokens only.

## 9. Security and safety

Default deny: unscoped route cannot exist; unknown scope string aborts startup. Scope is enforced before body parsing for cheap rejection, and handlers cannot widen it. No enumeration: other agents' resources look absent. The startup assertion keeps a future mistake in a contract from exposing a permission-expanding route to agents or Telegram.

## 10. Errors and edge cases

- Encoded slashes or dots in path (`%2F`, `%2e%2e`): path decoded once, `..` and empty segments rejected (404/400).
- Path param not a valid id: 400 `validation.invalid_input`.
- Two routes differing only by param name: conflict at startup.
- HEAD/OPTIONS handled by the pipeline.

## 11. Acceptance criteria

- [ ] SEC005 authorisation matrix passes for all registered routes and fails for a route without scope.
- [ ] Agent token calling an Owner route gets 403; accessing another Run's id gets 404.
- [ ] `expandsPermissions` + `local` rule: Owner CLI token (local false) gets 403; bridge session passes.
- [ ] Duplicate route registration aborts startup.
- [ ] Router resolves 10 000 routes in constant time per lookup (benchmark informational).

## 12. Test plan

Unit tests for router and evaluator (table-driven); integration through gateway-under-test; matrix test. Commands: `pnpm vitest run packages/gateway/src/routing packages/gateway/src/authz`.

## 13. Parallelization notes

After ENGINE012. All areas' routes appear automatically; no edits here.

## 14. Open questions and assumptions

- ASSUMPTION: `expandsPermissions` is a boolean route flag added to `defineRoute` metadata; if ARCH008 lacks it, it is requested by proposal (flagged in report).
