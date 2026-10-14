---
id: OVE_BOARDUI001
title: "Shared gateway resource hooks: cached reads, mutations and event invalidation"
area: BOARDUI
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ENGINE019, OVE_ENGINE027, OVE_SHELL004]
soft_depends_on: []
provides: ["lib:use-gateway-resource", "lib:use-gateway-mutation"]
needs: ["lib:api-client", "lib:api-client-events", "lib:use-api-client", "lib:result", "contract:AppError"]
owns: ["apps/desktop/src/shared/data/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13"]
adr_refs: [5]
---

# OVE_BOARDUI001: Shared gateway resource hooks: cached reads, mutations and event invalidation

## 1. Summary

Builds the one data-access layer every desktop feature view uses: `useGatewayResource` (cached GET with in-flight de-duplication, abort, refetch on push events and on resync) and `useGatewayMutation` (single-flight writes with typed `Result` errors). The Board, Decision, Agent, Skill and Approval views all depend on it so no view re-invents fetching (DRY).

## 2. Context

The desktop UI talks to the engine only through `api-client` (CONVENTIONS 6). The client delivers typed `Result<T, ApiError>` values and an event subscription (`client.events.subscribe`, OVE_ENGINE027) that reconnects and calls `onResync` when the hub says `events.resync_required`. PAUSE010 uses a small module-level store for pause only; every other view needs the same pattern, so it is defined once here. ASSUMPTION: the SHELL area provides `useApiClient()` (capability `lib:use-api-client`) returning the app-wide client from a React context; if SHELL names it differently the linker maps it.

## 3. Scope (in)

- `useGatewayResource`, `useGatewayMutation`, `ResourceKey` helper and the module-level cache in `apps/desktop/src/shared/data/`.
- Event-driven invalidation by event type and optional filter predicate.
- Resync handling, status values, abort on unmount, a test helper `renderWithFakeGateway`.

## 4. Out of scope

- Any view-specific hook (Board, Decisions, Agents, Skills, Approvals own theirs).
- Optimistic updates (forbidden for security-relevant actions; a view may layer its own).
- The api-client itself (OVE_ENGINE019) and the context provider (SHELL).

## 5. Detailed requirements

1. Signature: `useGatewayResource<T>(key: readonly unknown[], fetcher: (client: ApiClient, signal: AbortSignal) => Promise<Result<T, ApiError>>, opts?: { invalidateOn?: Array<string | { type: string; match?: (e: EventEnvelope) => boolean }>; enabled?: boolean; keepPreviousData?: boolean }): { data: T | undefined; error: ApiError | undefined; status: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error'; refetch(): Promise<void> }`.
2. Cache key = `JSON.stringify(key)` with sorted object keys; entries live in a module-level `Map`; entries with no subscribers are dropped after 60 s. Two components using the same key share one in-flight request.
3. On mount fetch once; `refreshing` is used while data exists and a refetch runs (UI keeps showing old data, no flicker). `keepPreviousData` keeps data of the previous key while a new key loads (used by filters).
4. Event invalidation: for each `invalidateOn` entry the hook subscribes through ONE shared subscription per distinct event-type set (ref-counted, OVE_ENGINE027). A matching event schedules a refetch debounced by 150 ms and coalesced; refetch never runs more than once concurrently per key.
5. `onResync` from the client: refetch every mounted key once, then continue. Connection status `reconnecting` is exposed through `useGatewayStatus()` for views that show an offline note.
6. `useGatewayMutation<I, O>(fn: (client: ApiClient, input: I) => Promise<Result<O, ApiError>>): { run(input: I): Promise<Result<O, ApiError>>; pending: boolean; error?: ApiError; reset(): void }`. Single-flight: a second `run` while pending returns the same promise (double-click safe). `run` never throws; it returns the `Result`.
7. Mutations accept an `idempotencyKey` option: when set, the hook passes it in the `Idempotency-Key` header through the client call options; keys are generated with a ULID helper from `lib:ids` once per user intent (not per retry).
8. After a successful mutation the caller may pass `invalidate: ResourceKey[]` to refetch those keys immediately (do not wait for push).
9. Errors are never swallowed or logged with payloads; `ApiError` is passed through unchanged. A helper `isVersionConflict(err)` returns true for codes ending `.version_conflict` and exposes `err.details.currentVersion` safely typed as `number | undefined`.
10. Unmount aborts in-flight requests via `AbortSignal`; results arriving after unmount are ignored.
11. Additive escape hatch `mutateCache<T>(key, updater: (old: T | undefined) => T | undefined)` patches a cached entry and notifies subscribers without a request; used only for hint-level data such as progress values, never for security-relevant state.
12. Test helper `renderWithFakeGateway(ui, { client, events })` wraps the tree in the app context with an in-memory client and an `emit(event)` function used by all feature tests.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`@overmind/api-client` (OVE_ENGINE019, OVE_ENGINE027), `Result` and `AppError` (OVE_ARCH003), ULID helper (OVE_ARCH007). New reusable pieces created here: the two hooks and the test helper; every other view task consumes them.

## 8. Architecture and code placement

Layer: UI shared. `apps/desktop/src/shared/data/{use-gateway-resource.ts,use-gateway-mutation.ts,cache.ts,keys.ts,events.ts,testing.tsx}`. Pure cache logic is separate from React bindings (`useSyncExternalStore`) so it is unit-testable. Depends on api-client types only. No feature code may reach into `cache.ts`; the public surface is the barrel `index.ts` (generated by the barrel generator, ARCH009).

## 9. Security and safety

This is a trust boundary helper: it never persists data (no localStorage), never logs response bodies, and clears the cache on Workspace switch events and on `workspace.deleted` so one Workspace's data cannot appear in another view. Cache keys MUST include the Workspace id for every Workspace-scoped resource (enforced by a lint-like unit test on key helpers). All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Fetcher returns `Err` on first load: status `error`, `data` undefined, retry via `refetch`.
- Fetcher returns `Err` during refresh: keep old `data`, status `error` with `error` set (views show a non-blocking banner).
- Event storm (100 events in 1 s): one refetch after the debounce.
- Component unmounts while the fetch is in flight: abort, no state update warning.
- Two windows: independent caches, both converge through push events.
- Event for another Workspace: ignored when `match` rejects it.
- Gateway unreachable: status `error` with code `gateway.unreachable`; automatic retry only through reconnect `onResync`.

## 11. Acceptance criteria

- [ ] Given two components with the same key, Then exactly one request is made.
- [ ] Given an invalidating event, Then one debounced refetch happens and `status` goes `refreshing` then `ready` without data flicker.
- [ ] Given `onResync`, Then all mounted keys refetch once.
- [ ] Given a double `run`, Then the fetcher is called once and both callers get the same `Result`.
- [ ] Given unmount mid-request, Then the request is aborted and no state is set.
- [ ] Given a Workspace switch event, Then Workspace-scoped cache entries are cleared.
- [ ] Given a `version_conflict` error, Then `isVersionConflict` is true and `currentVersion` is typed.

## 12. Test plan

Vitest unit tests for the cache (`cache.test.ts`: dedupe, expiry, key ordering, abort), hook tests with `@testing-library/react` (`use-gateway-resource.test.tsx`, `use-gateway-mutation.test.tsx`), fake event emitter. No UI visuals. Command: `pnpm --filter @overmind/desktop test shared/data`.

## 13. Parallelization notes

First task of the wave on the desktop side: every `*UI` data task in BOARDUI, DECUI, AGUI, SKUI and APPRUI depends on it. SHELL, CHATUI and others may also need it; if SHELL already ships an equivalent, the linker should keep one and re-point `needs`.

## 14. Open questions and assumptions

- ASSUMPTION: no TanStack Query dependency (KISS, ADR 0019 spirit); if a later decision adds it, only this folder changes.
- OPEN: owner of `useApiClient()`: assumed SHELL (reported to the linker).
- ASSUMPTION: 60 s cache retention and 150 ms debounce.
