---
id: OVE_SHELL006
title: "Implement the event hub: one push subscription, topic registry and query invalidation"
area: SHELL
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_ENGINE017, OVE_ENGINE027, OVE_SHELL001, OVE_SHELL004, OVE_SHELL005]
soft_depends_on: []
provides: ["lib:event-hub", "lib:use-event", "lib:use-invalidate-on-events", "lib:fake-event-source"]
needs: ["lib:api-client-events", "api:events.subscribe", "contract:EventEnvelope", "contract:TopBarSummary", "lib:event-bus"]
owns: ["apps/desktop/src/app/events/**", "apps/desktop/src/app/testing/fake-event-source.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 6]
---

# OVE_SHELL006: Implement the event hub: one push subscription, topic registry and query invalidation

## 1. Summary

Builds the desktop event subscription hub on top of the api-client event subscription: components declare the event types they care about, the hub keeps the minimum number of SSE streams, delivers events in order and invalidates data-layer queries or runs handlers, and it reloads state when the engine says a resync is required.

## 2. Context

ENGINE017 serves `events.subscribe` (SSE with replay, heartbeat, max 8 streams, `types` filter of at most 20 exact types or prefixes), ENGINE027 implements the client with reconnect, duplicate suppression and `onResync`. The UI must show the same state as Telegram (ADR 0006): the engine is the single source of truth and pushes events. Two windows exist (main and tray, OVE_TRAY002) so the stream budget is shared: the hub keeps at most 2 streams per window. Events are DATA, not instructions (SEC004).

## 3. Scope (in)

- `EventHubProvider`, `useEvent(types, handler)`, `useInvalidateOnEvents(eventTypes, routeIds | keyFn)`, `useEventStreamStatus()`.
- Subscription grouping algorithm and resync handling.
- A topic registry file `app/events/invalidation-rules.ts` that lists default invalidations for shared routes (top bar summary, workspaces list); feature tasks add their own rules through `useInvalidateOnEvents` in their own code, never by editing this file.
- Document-visibility/focus handling and engine-restart behaviour.

## 4. Out of scope

- Defining event types (backend areas).
- Showing toasts for events (OVE_SHELL022).
- Replay/persistence in the UI (none: reconnect uses `afterEventId` inside the api-client).

## 5. Detailed requirements

1. Hub API: `useEvent(types: EventType[] | prefix strings, handler: (envelope) => void, opts?: { workspaceId?: string })`: registers a listener, unregisters on unmount; handler identity changes do not resubscribe (latest-ref pattern). `useInvalidateOnEvents(types, target)`: on matching events calls `queryClient.invalidateQueries` for the given route ids (prefix match), debounced by 150 ms and coalesced per animation frame so a burst of events causes one refetch.
2. Grouping: the hub computes the union of requested types (exact + prefix), sorts it, and opens one `client.events.subscribe({ types })` per group of at most 20 entries; changes to the union re-subscribe after a 100 ms debounce, preserving `afterEventId` handled by the client. Max 2 groups; beyond that the hub switches the second group to broad prefixes (`run.*`, `approval.*`, ...) and filters locally; never more than 2 streams per window (ENGINE014 cap 8 across main + tray + CLI).
3. Default topics subscribed by the shell itself: `TOP_BAR_INVALIDATING_EVENTS` (SHELL001), `pause.changed`, `workspace.*`, `notification.created`, `notification.changed`, `system.state_changed`, `config.changed`.
4. Resync: `onResync(reason)` -> pause delivery, call `queryClient.invalidateQueries()` for ALL gateway queries and await `queryClient.refetchQueries({ type: 'active' })` (bounded 10 s), then resolve so the client resubscribes live-only (ENGINE027 req. 4). Never apply a partial replay on top of stale caches.
5. `useEventStreamStatus()` returns `connecting | live | reconnecting | closed` from the client; the connection reducer (SHELL004) uses `reconnecting` for more than 10 s as `unavailable`.
6. Ephemeral events (no id) are delivered to handlers but never trigger invalidation unless a rule says so.
7. Backpressure: handlers must be synchronous and cheap; the hub schedules handler calls with `queueMicrotask` in order, catches handler exceptions (log once, never break other handlers) and drops nothing silently: if more than 1000 events queue, it triggers the same resync path.
8. Visibility: the stream stays open while the window is hidden (Runs continue; toasts for Approvals must still arrive when the window is visible again, so the engine's notifications handle background alerts, NOTIF).
9. Typed envelopes: handlers receive `EventEnvelope` from `@overmind/contracts` with the payload narrowed by event type (generated `EventType` union); unknown event types are ignored (forward compatibility).
10. Testing helper `FakeEventSource` for feature tests: `emit(type, payload)`, `emitResync()`, exported from `app/testing/`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- api-client `events` subscription (ENGINE027), `EventEnvelope`/`EventType` (ARCH010/009), `useQueryClient` (SHELL005), `useConnection` (SHELL004).
- `TOP_BAR_INVALIDATING_EVENTS` from OVE_SHELL001.

## 8. Architecture and code placement

`apps/desktop/src/app/events/{event-hub.ts,event-hub-provider.tsx,use-event.ts,use-invalidate-on-events.ts,invalidation-rules.ts,grouping.ts}` plus `app/testing/fake-event-source.ts` (SHELL005 owns the other two files of that folder, listed by name, so the globs do not overlap). Pure `grouping.ts` and the hub class are framework-free; the provider/hooks are thin.

## 9. Security and safety

- The hub never filters for security (the engine does, ENGINE017 `canSee`); it only reduces noise.
- Event payloads are rendered by consumers as text; the hub does not interpret content.
- A flood from a compromised or buggy emitter cannot freeze the UI: bounded queues and coalesced invalidation; overflow triggers resync, not unbounded memory growth.
- Events from isolated Workspaces are visible only because the engine says so; the hub adds no Workspace data to logs (types and ids only).

## 10. Errors and edge cases

- Handler throws: other handlers still run; error logged once per event type.
- Resync arrives while a refetch is running: the refetch is aborted and restarted once.
- Component unmounts between emit and delivery: handler not called.
- Union exceeds 20 types: split into two groups; prefix collapse for the rest.
- Engine restarted (events.closed `shutdown`): client reconnects; hub shows `reconnecting`; on `resync_required` runs the reload.
- Two windows: each has its own hub; total streams stay under the cap.

## 11. Acceptance criteria

- [ ] Given a `provider.concurrency_changed` event then the `shell.top-bar` query is refetched once within 200 ms even if 5 events arrive.
- [ ] Given `events.resync_required` then all active queries refetch before live delivery resumes.
- [ ] Given 25 distinct requested types then two streams are opened and every type is delivered once.
- [ ] Given a throwing handler then other handlers still receive the event.
- [ ] Given an unmounted listener then it is never called.
- [ ] Given reconnect with duplicates the client suppresses and handlers see each id once.

## 12. Test plan

- Unit: grouping (property test: every requested type appears in exactly the groups needed), debounce and coalescing with fake timers, resync flow with the fake event source and fake query client.
- Commands: `pnpm --filter @overmind/desktop test events`.

## 13. Parallelization notes

After SHELL004/005. Parallel with SHELL007..SHELL010. Feature tasks use `useEvent` / `useInvalidateOnEvents` and never open their own streams (rule enforced by a lint restriction on importing `api.events.subscribe` outside `app/events/`, added via proposal to ARCH002 if absent).

## 14. Open questions and assumptions

- ASSUMPTION: at most 2 SSE streams per window.
- OPEN: whether the tray window should rely on a lighter polling loop instead of SSE (TRAY002 decides; default SSE with a tiny topic set).
- Ownership: `app/testing/` is shared by file name between SHELL005 (render helper, fake client) and this task (fake event source).
