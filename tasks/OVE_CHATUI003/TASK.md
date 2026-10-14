---
id: OVE_CHATUI003
title: "Provide shared live-data primitives: resource hook, event subscription and Result"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI001, OVE_ENGINE019, OVE_ENGINE027, OVE_SHELL004]
soft_depends_on: []
provides: ["lib:ui-live-data"]
needs: ["lib:api-client", "lib:api-client-events", "contract:EventSubscription", "lib:api-client-provider"]
owns: ["apps/desktop/src/shared/live-data/**", "apps/desktop/src/locales/en/chat-003.json", "apps/desktop/src/locales/pl/chat-003.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 18]
---

# OVE_CHATUI003: Provide shared live-data primitives: resource hook, event subscription and Result

## 1. Summary

Builds the small data layer every live view needs: `useResource` (load, refetch, loading/error/stale state over `Result`), `useEventSubscription` (ref-counted subscription with status, resume and resync callbacks) and error normalisation. Used by CHATUI and DISCUI so there is one implementation of reconnect-aware data access.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. The api-client (ENGINE019, ENGINE027) already gives typed calls returning `Result` and `subscribe(opts,{onEvent,onResync,onStatus})` with reconnect and `afterEventId` resume. SETUP009 deliberately chose no state library. To avoid a new dependency (CONVENTIONS section 6, KISS) this task builds the two hooks on `useSyncExternalStore`; other areas may reuse them.

## 3. Scope (in)

- `createResource` (framework-agnostic store) and `useResource` hook.
- `useEventSubscription` hook.
- `ConnectionStatus` store (`live | reconnecting | offline`) that views use for a banner.
- Error mapping to `MessageRef` for UI text.

## 4. Out of scope

- Chat or Discussion specific queries (CHATUI004, DISCUI003).
- Global engine-offline screen (SHELL).
- Caching across routes beyond the hook lifetime (not needed).

## 5. Detailed requirements

1. `createResource<T,A>({ load:(args,signal)=>Promise<Result<T,ApiError>>, key:(args)=>string })` returns `{ subscribe, getSnapshot, refetch(), set(updater), dispose() }`; snapshot `{ status:'idle'|'loading'|'ready'|'error', data?:T, error?:ApiError, stale:boolean, updatedAt?:number }`.
2. `useResource(args)` re-creates the resource when `key(args)` changes, aborts the in-flight request via `AbortController`, never sets state after unmount, and keeps previous data while refetching (`stale:true`) so lists do not flicker.
3. Requests are de-duplicated per key within 50 ms. Refetch on `onResync` and on window focus after >30 s hidden (via `visibilitychange`).
4. `useEventSubscription({ types, workspaceId?, subjectId?, afterEventId?, onEvent, onResync })` wraps `apiClient.subscribe`: handlers are stored in a ref (no resubscribe on every render), subscription key is the filter set, unsubscribes on unmount; returns `{ status }`. Events are delivered in order; the hook never buffers more than 1000 pending events (api-client already guarantees this).
5. `onResync` handlers may return a Promise; the api-client resubscribes after it resolves (ENGINE027 requirement 4). The hook awaits `Promise.allSettled` of all registered resync handlers before returning.
6. `useConnectionStatus()` aggregates statuses of all active subscriptions: `live` if all live, `reconnecting` if any reconnecting, `offline` if any closed with `gateway.unauthenticated` or the engine reports `shutdown`.
7. `toMessageRef(error: ApiError): MessageRef` maps registered error codes to `errors:*` keys; unknown code -> `errors:generic.unknown`; `retryable` is preserved.
8. Time and timers come from an injected `Scheduler` (`now()`, `setTimeout`) defaulting to the real ones, so tests are deterministic.
9. No `any`; zod validation is done by the api-client, the hooks trust its typed output.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- api-client core and event subscription (OVE_ENGINE019, OVE_ENGINE027).
- `MessageRef` and `renderMessage` (OVE_ARCH011).
- Do not add react-query, SWR or zustand.

## 8. Architecture and code placement

UI infrastructure in `apps/desktop/src/shared/live-data/` (outside feature folders, imported by features). Depends on `api-client` interfaces via a React context `ApiClientProvider` (provided by SHELL, capability `lib:api-client-provider`); tests inject a fake client. Layering: hooks -> resource store -> api-client; no feature code is imported. **i18n namespace:** this task writes its strings into its own namespace `chat-003` (files `locales/en|pl/chat-003.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-003`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Never logs request or response bodies. The subscription filter is passed through unchanged; the client does not filter for security, only for convenience (ENGINE027 requirement 8). A 401 or `token_rotated` is handled by the transport; the hook only shows `offline` and never stores tokens. Errors surfaced to the UI carry codes and params, not raw server text (server text could contain redacted but still sensitive detail).

## 10. Errors and edge cases

- Component unmounts during a request: abort, no state update.
- Same key requested by two components: one request, both receive the result.
- `events.resync_required`: all handlers run, then live resumes.
- Engine down: `status:'offline'`; resources keep stale data and show `error` only when no data exists.
- Handler throws: caught, reported to the logger, subscription stays alive.

## 11. Acceptance criteria

- [ ] A resource refetches on resync and keeps stale data meanwhile.
- [ ] Unmounting aborts the in-flight request (fake client asserts `signal.aborted`).
- [ ] Two hooks with equal filters share one api-client subscription.
- [ ] `useConnectionStatus` reflects reconnecting and offline.
- [ ] No dependency was added (`package.json` diff check).

## 12. Test plan

- Vitest + Testing Library `renderHook` with a fake api-client (`lib:api-client-inprocess-transport` or hand fake): load, error, refetch, abort, dedupe, resync ordering, status aggregation, handler exception.
- Fake timers for focus refetch. Command: `pnpm --filter @overmind/desktop test shared/live-data`.

## 13. Parallelization notes

Everything lives in the new `shared/live-data` folder; DISCUI003 depends on this task. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: SHELL provides `ApiClientProvider` / `useApiClient()` (named `lib:api-client-provider`); if SHELL chooses another shape, adapt only `shared/live-data/context.ts`.
- Open for the Owner: adopt TanStack Query later? Default no (no new dependency in MVP).
