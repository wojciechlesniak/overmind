---
id: OVE_SHELL005
title: "Provide the desktop data layer: QueryClient, gateway query and mutation hooks"
area: SHELL
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_DS032, OVE_ENGINE015, OVE_ENGINE019, OVE_SHELL004]
soft_depends_on: []
provides: ["lib:use-gateway-query", "lib:use-gateway-mutation", "lib:query-keys", "lib:desktop-test-providers", "lib:desktop-query-layer"]
needs: ["lib:api-client", "lib:error-catalogue", "ui:Skeleton", "ui:EmptyState", "lib:gateway-idempotency"]
owns: ["apps/desktop/src/app/data/**", "apps/desktop/src/app/testing/render-with-providers.tsx", "apps/desktop/src/app/testing/fake-api-client.ts", "docs/architecture/desktop-data-layer.md"]
reads: ["docs/dependencies.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 6, 18]
---

# OVE_SHELL005: Provide the desktop data layer: QueryClient, gateway query and mutation hooks

## 1. Summary

Establishes the one way all desktop features read and change engine data: TanStack Query configured for the gateway (typed `useGatewayQuery(routeId, input)` and `useGatewayMutation(routeId)`, key factory, error mapping, connection-aware enabling). It gives every UI area caching, request de-duplication and event-driven invalidation without each inventing its own fetch hooks.

## 2. Context

CONVENTIONS 5 and 6: many agents write views in parallel; they need one convention for loading, error and refetch states (the DS has Skeleton and EmptyState for loading/empty). The api-client (ENGINE019) returns `Result<T, AppError>` and already retries transient failures; the UI still needs caching, shared subscriptions between components, mutation state, and invalidation when push events arrive (OVE_SHELL006). Dependency decision (CONVENTIONS 6: a new dependency needs a justification): `@tanstack/react-query` v5 - value: cache, dedupe, background refetch, mutation lifecycle, devtools in dev, mature; maintenance cost: low, large community; licence MIT; alternatives: SWR (weaker mutation and invalidation model), hand-written hooks with `useSyncExternalStore` (more code to maintain, each area would reinvent), Redux Toolkit Query (pulls Redux). ASSUMPTION until the Owner objects; entry for `docs/dependencies.md` is part of this task (SETUP008 policy).

## 3. Scope (in)

- Dependency `@tanstack/react-query` (pinned via the catalog) and its entry in `docs/dependencies.md`.
- `QueryProvider` with a `QueryClient` factory `createQueryClient()`.
- `useGatewayQuery`, `useGatewayMutation`, `queryKeys` factory, `unwrapResult`.
- Connection-aware behaviour: queries disabled while the engine is not `ready`; refetch on reconnect.
- UI-facing error type `GatewayError` and the helper component hook `useQueryErrorState(query)` returning `{ kind: 'loading'|'empty'|'error'|'ready', error?: UiError, retry }`.

## 4. Out of scope

- Event subscription and invalidation rules (OVE_SHELL006).
- Optimistic updates (not used: the engine is the single source of truth, ADR 0006; a mutation result refetches).
- Persisted cache (never: data may be Private or isolated, nothing is written to localStorage/IndexedDB).

## 5. Detailed requirements

1. `createQueryClient()`: `defaultOptions.queries = { staleTime: 15_000, gcTime: 5 * 60_000, retry: false /* the api-client already retries */, refetchOnWindowFocus: false, refetchOnReconnect: false /* handled by the shell */ }`, `mutations: { retry: false }`. Errors are returned as `GatewayError` (wraps `AppError`), never thrown as raw `Error` from the client.
2. `useGatewayQuery<R extends RouteId>(route: R, input: InputOf<R>, opts?: { enabled?: boolean; staleTime?: number; select?: ...; refetchInterval?: number | false })` calls `client.call(route, input, { signal })` with the query's `AbortSignal`; the query key is `queryKeys.route(route, input)` = `['gw', route, stableStringify(input)]` (stable key order, no functions). Returns the typed data; a `Result.err` becomes a query error.
3. `useGatewayMutation<R>(route, opts?: { invalidate?: RouteId[] | ((vars,data)=>QueryKey[]); idempotencyKey?: 'auto' })`: generates one idempotency key per `mutate` call (stable across retries of the same call) for `key-required` routes (ENGINE015); on success invalidates the listed keys (prefix match on `['gw', route]`).
4. Connection awareness: a wrapper reads `useConnection()` (SHELL004): when state is not `ready`, queries are `enabled: false` and report `status: 'paused-offline'` (exposed through `useQueryErrorState` as kind `error` with `UiError` `errors:engine.unavailable` only after 2 s, so short reconnects do not flash errors). When state returns to `ready`, all active queries are invalidated once (single `invalidateQueries()`), not one by one.
5. `useQueryErrorState(query)` rules: `isPending` -> `loading`; success with empty array / null per optional `isEmpty` predicate -> `empty`; error -> `error` with `toUiError` and `retry = query.refetch`; refetching with data keeps `ready` plus `isRefreshing`. Feature tasks use this instead of branching on three flags (DRY).
6. Query key conventions documented in `docs/architecture/desktop-data-layer.md`: `['gw', routeId, input]` for server data, `['ui', feature, ...]` for client-only state that must be cacheable, never secrets in keys; helper `invalidateRoutes(queryClient, routeIds)`.
7. Testing helpers `renderWithProviders(ui, { client: fakeApiClient })` and `createFakeApiClient(handlers)` exported from `apps/desktop/src/app/testing/` (used by every feature's tests; TEST004 uses the real mock gateway for e2e).
8. StrictMode and Suspense safe; no `suspense: true` queries in the MVP (explicit loading states are the DS rule: skeletons).

## 6. Design notes

N/A, functionality only. (Loading and empty visuals come from `ui:Skeleton` and `ui:EmptyState`, composed by feature tasks.)

## 7. Reuse

- `useApiClient`/`useConnection` (OVE_SHELL004), `InputOf/OutputOf/RouteId` types from the generated api-client, `toUiError` (SHELL004).
- Do not wrap TanStack Query in a second abstraction beyond these three hooks.

## 8. Architecture and code placement

`apps/desktop/src/app/data/{create-query-client.ts,query-provider.tsx,use-gateway-query.ts,use-gateway-mutation.ts,query-keys.ts,use-query-error-state.ts}`, `apps/desktop/src/app/testing/render-with-providers.tsx` and `fake-api-client.ts`, `docs/architecture/desktop-data-layer.md`. UI layer only; knows nothing about specific routes (OCP: features pass route ids).

## 9. Security and safety

- Cache is in memory only and cleared on window close: no Private or isolated Workspace data persisted to disk by the webview.
- Query keys never contain secrets (inputs with `token`, `code`, `localProof` fields are NOT cached: `useGatewayQuery` refuses routes flagged `sensitiveInput` in the route contract; mutations are never cached).
- A failed query never shows stale data as fresh after an engine restart (invalidate on reconnect).
- Mutations carry idempotency keys so a retry after a lost response cannot double-apply (ENGINE015).

## 10. Errors and edge cases

- Two components using the same query: one request.
- Route returns `gateway.not_ready`: the api-client retries; the hook shows loading, then error after its retries.
- Unmounted component: request aborted via `AbortSignal`.
- Mutation while `unavailable`: rejected immediately with `engine.unavailable`, no queue (no hidden replay of user actions).
- Input objects with different key order: same cache key (stable stringify test).
- Very large responses (10k rows) are not copied by `select` helpers unnecessarily (use structural sharing defaults).

## 11. Acceptance criteria

- [ ] Given two components calling `useGatewayQuery('workspaces.list', {})` then the fake client receives one call.
- [ ] Given the connection state `unavailable` then no call is made and after 2 s the error kind is returned.
- [ ] Given reconnect then active queries refetch exactly once.
- [ ] Given a `key-required` route then the mutation sends one `Idempotency-Key` per mutate and the same key on a retry.
- [ ] Given a route flagged `sensitiveInput` then `useGatewayQuery` throws in development.
- [ ] `docs/dependencies.md` contains the justification entry.

## 12. Test plan

- Vitest + Testing Library with the fake client: dedupe, enable/disable, reconnect, mutation invalidation, key stability (fast-check on key order), abort on unmount.
- Commands: `pnpm --filter @overmind/desktop test data`.

## 13. Parallelization notes

Parallel with SHELL006/007 once SHELL004's hook signatures are agreed (fake `useConnection`). All feature tasks depend on this one for fetching; the `renderWithProviders` helper is the shared test entry point, kept backwards compatible.

## 14. Open questions and assumptions

- ASSUMPTION: TanStack Query is accepted (decision recorded in `docs/dependencies.md`); if rejected, only this task's internals change because features use the three hooks.
- OPEN: `staleTime` 15 s default is a guess; event-driven invalidation (SHELL006) makes it mostly irrelevant.
- ALIASES: this task also provides `lib:desktop-query-layer`, the names other view areas reported; they are the same module as the primary capability (no second implementation).
