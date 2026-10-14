---
id: OVE_ENGINE027
title: api-client event subscription - reconnect, resume with afterEventId, resync handling
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_ENGINE017, OVE_ENGINE019]
soft_depends_on: [OVE_ENGINE022, OVE_ENGINE021]
provides: ["lib:api-client-events", "contract:EventSubscription"]
needs: ["lib:api-client", "api:events.subscribe", "contract:EventEnvelope"]
owns: ["packages/api-client/src/events/**"]
reads: ["packages/api-client/src/transport/transport.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 16"]
adr_refs: [5, 6]
---

# OVE_ENGINE027: api-client event subscription

## 1. Summary

A resilient subscription helper so the UI, tray and tools keep an accurate live view of engine events across disconnects, engine restarts and token rotation, without missing or double-processing events.

## 2. Context

ARCH010 item 7: clients keep the last seen event `id` and reconnect with `afterEventId`; on `events.resync_required` they reload state through normal GET routes and resubscribe. The hub (ENGINE017) sends heartbeats every 15 s; a missing heartbeat means a dead connection. The UI must also show "engine unavailable/reconnecting" (SHELL consumes `status`).

## 3. Scope (in)

- `client.events.subscribe({ types?, workspaceId? }, handlers)` returning an unsubscribe handle; state machine, backoff, de-duplication, resync callback, status stream.

## 4. Out of scope

- Reloading application state after resync (each UI feature supplies `onResync`). Telegram (in-process bus).

## 5. Detailed requirements

1. API: `subscribe(opts, { onEvent(envelope), onResync(reason), onStatus(status) }): Subscription` with `status: 'connecting' | 'live' | 'reconnecting' | 'closed'`. Events are delivered in order, at most once per `id` (a bounded LRU of the last 2000 ids guards against duplicates on resume).
2. Reconnect: on stream end or error, wait with exponential backoff 0.5, 1, 2, 4, 8, 15 s (cap 15 s) with 20% jitter, reconnect with `afterEventId = lastSeenId`; reset backoff after 30 s of healthy streaming. 401 -> `transport.onUnauthorized` then reconnect once immediately; repeated 401 -> status `reconnecting` with backoff and surface `gateway.unauthenticated` to `onStatus`.
3. Heartbeat watchdog: if nothing (event or heartbeat) arrives for 40 s the stream is cancelled and reconnected.
4. `events.resync_required` (and `bridge.closed` with unknown last id): stop delivering, call `onResync(reason)` once, then resubscribe WITHOUT `afterEventId` (live only) after `onResync` resolves (the feature reloads state first). Prevents applying a partial replay on stale state.
5. `events.closed {reason: 'shutdown' | 'token_rotated'}` triggers reconnect with backoff; `shutdown` shows `reconnecting` until the engine is back (and the shell restarts it, SETUP010).
6. Ephemeral events (no id) are delivered but do not advance `lastSeenId`.
7. Multiple subscribers in one app share one underlying stream per distinct filter set (ref-counted, reduces connection use under the 8 stream cap).
8. Visibility change: no special handling (the engine owns what is visible); the client never filters for security, only for convenience.
9. Memory: no unbounded buffering; if the handler is slower than the stream (async handler), events queue up to 1000 then the subscription triggers a resync to protect memory.
10. Unit of time is injectable (`Clock`-like `now/sleep`) for deterministic tests.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Transport.stream` (ENGINE019), SSE parser (ENGINE021 export `parseSse`, used by transports that deliver raw chunks), `EventEnvelope` schema validation for each event (strict parse in dev, tolerant in release).

## 8. Architecture and code placement

`packages/api-client/src/events/{subscription.ts,backoff.ts,dedupe.ts,shared-streams.ts}`; browser-safe.

## 9. Security and safety

Events are untrusted data to the UI: validated against the envelope schema; payload text must be rendered escaped (SR-35, UI concern). The client never uses event content to build requests without validation. Resync-on-gap prevents acting on partial state (e.g., showing an approval as pending after it was resolved).

## 10. Errors and edge cases

- Engine restart (new boot): reconnect with old `afterEventId` still valid because the log persists; recovery events arrive in order.
- Workspace deleted while subscribed: `workspace.deleted` event arrives; later events for it never come.
- Clock jumps: backoff uses monotonic timers.
- Rapid subscribe/unsubscribe: ref-count safe.

## 11. Acceptance criteria

- [ ] After a forced disconnect the client resumes and receives every event exactly once (fake transport test, 1000 events with random drops).
- [ ] `events.resync_required` calls `onResync` once and resumes live only after it resolves.
- [ ] No heartbeat for 40 s triggers reconnect (fake clock).
- [ ] Two subscribers with the same filter share one stream.
- [ ] Slow handler beyond 1000 queued events triggers resync, not memory growth.

## 12. Test plan

Deterministic simulation with a fake transport and fake time; property test for exactly-once; integration with `createGatewayUnderTest` killing the connection. Commands: `pnpm vitest run packages/api-client/src/events`.

## 13. Parallelization notes

SHELL and every UI feature depend on `lib:api-client-events`.

## 14. Open questions and assumptions

- ASSUMPTION: 40 s watchdog (2.5 heartbeats + margin).
