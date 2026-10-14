---
id: OVE_ENGINE017
title: UI event push channel - events.subscribe SSE hub with replay, filtering and heartbeat
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA005, OVE_ENGINE013, OVE_ENGINE014]
soft_depends_on: []
provides: ["api:events.subscribe", "lib:event-subscription-hub", "contract:SubscribeRequest", "lib:gateway-push"]
needs: ["port:EventBus", "port:EventStore", "port:Clock", "lib:route-registrar", "lib:gateway-rate-limit"]
owns: ["packages/gateway/src/events/**", "packages/contracts/src/events-api/**", "packages/gateway/src/routes/engine/events-subscribe.route.ts"]
reads: ["docs/architecture/events.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 16"]
adr_refs: [5, 6]
---

# OVE_ENGINE017: Event push channel (`events.subscribe`)

## 1. Summary

Deliver domain events to the desktop UI, tray and CLI in real time over Server-Sent Events: replay from a given event id, then live events, filtered by what the caller may see, with heartbeat, overflow handling and clean close on shutdown. This is how "Telegram and desktop show the same state" (SPEC 16.13) holds for the desktop side.

## 2. Context

ARCH010 requirement 7 is normative: clients subscribe with `{ types?, workspaceId?, afterEventId? }`; the hub replays persisted events with `id > afterEventId` from the store (bounded 5000, else `events.resync_required`), then streams live events de-duplicated by id, filters by `visibleTo` and scope, sends `heartbeat` every 15 s, and on queue overflow closes with `events.resync_required`. The bus is a hint, the store the truth. ENGINE001 fixes the SSE framing.

## 3. Scope (in)

- Route `GET /v1/events/subscribe`, hub, per-subscription queue, replay/live splice, filters, visibility rules, heartbeat, close reasons, stats.

## 4. Out of scope

- Client reconnect logic (ENGINE027). Telegram rendering (TG consumes the bus in-process, not through SSE). Event definitions (areas).

## 5. Detailed requirements

1. Query: `types` (comma list of exact types or prefix `run.*`, max 20), `workspaceId` (optional), `afterEventId` (or `Last-Event-ID` header; header wins when both), `includeEphemeral` (default true). Strict validation; unknown parameters rejected.
2. Caller visibility: Owner sees events whose `visibleTo` includes `owner`; `agent` callers see only events of their own Run with `visibleTo` including `agent`, ignore any `workspaceId` that is not theirs (404); `channel` never uses SSE (in-process). Isolated Workspaces' events are visible only to the Owner and to Chief/agents inside that Workspace; the hub applies the same filter function as `EventStore.readSince` consumers (one shared `canSee(caller, envelope)` in the hub).
3. Splice algorithm (no gap, no duplicate): (a) subscribe to the bus FIRST into a bounded buffer, remember the first buffered `seq`; (b) replay from the store with `readSince(afterEventId)` in batches of 500 until reaching the store head observed after step (a); (c) flush the buffered live events skipping ids already sent; (d) switch to direct live delivery. If `resyncRequired` or more than 5000 events to replay -> send `event: events.resync_required` with `data: {reason}` and close; the client reloads state via normal GET routes and resubscribes without `afterEventId`.
4. Framing: `id: <eventId>`, `event: <type>`, `data: <json envelope>` single line; `retry: 3000` at start; heartbeat `event: heartbeat` every 15 s (monotonic timer) with `data: {"t": nowIso}`; ephemeral events omit `id`.
5. Backpressure: per-subscription queue max 1000 events or 1 MiB; overflow -> `events.resync_required` and close (ARCH010). Critical events are never dropped silently: overflow always closes (fail loud). Writes honour `res.write` backpressure (`drain`).
6. Limits: max 8 SSE connections (ENGINE014); idle detection: if a write stalls > 30 s the stream is destroyed.
7. Close reasons sent as the last event `events.closed {reason}`: `shutdown`, `token_rotated`, `lagging`, `server_error`, `unsubscribed`. During engine shutdown (ENGINE004 `stop_accepting` phase) all streams get `shutdown` and close.
8. Payload safety: the hub forwards stored envelopes unchanged; it never adds fields from other sources; envelope size capped at 64 KiB (ARCH010 payload cap).
9. Stats for diagnostics: active streams, events sent, resyncs, lag max.
10. No server-side filtering by free text, no regexes from the client (types matching uses the registry only).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EventBus.subscribe('*')` (ARCH010), `EventStore.readSince`/`head` (DATA005), pipeline/limits, `canSee` helper shared with future in-process subscribers (Telegram) via `packages/application/src/events/visibility.ts` (owned by ARCH010; used read-only here: if absent, this task creates `packages/gateway/src/events/can-see.ts` and ARCH010 may adopt it).

## 8. Architecture and code placement

`packages/gateway/src/events/{hub.ts,subscription.ts,splice.ts,can-see.ts,sse-writer.ts}`; contract for query/response in `packages/contracts/src/events-api/`; route module in `packages/gateway/src/routes/engine/`.

## 9. Security and safety

The stream is the biggest read surface: strict caller filtering (agents see only their Run), Workspace isolation honoured, no ephemeral hints with secrets (payload rules), bounded queues against slow-consumer memory growth (SR-37), closed on token rotation so a leaked old token cannot keep listening. `afterEventId` is validated as an event id and used as a bound parameter.

## 10. Errors and edge cases

- Unknown `afterEventId`: resync required.
- Client reconnect storm: ENGINE014 limits.
- Replay while many events are appended: splice step (a) guarantees no loss.
- Large burst (10 000 events/s): queue overflow closes the slow client; others unaffected.
- Subscribe during `recovering`: allowed (reads), live events begin when recovery appends.

## 11. Acceptance criteria

- [ ] Given events 1..10 stored and a client with `afterEventId` = 4, then it receives 5..10 followed by live events with no gap or duplicate (race test with concurrent publishers).
- [ ] Agent subscription never receives Owner-only events or other Runs' events.
- [ ] Heartbeat every 15 s on a fake clock.
- [ ] Overflow produces `events.resync_required` then close.
- [ ] Engine shutdown closes streams with reason `shutdown`.
- [ ] Token rotation closes the old stream.

## 12. Test plan

Unit tests for splice with deterministic interleavings (fast-check), `FakeClock` heartbeat, integration with real SSE client over the Unix socket (`createGatewayUnderTest`). Commands: `pnpm vitest run packages/gateway/src/events`.

## 13. Parallelization notes

Parallel with ENGINE016. TEST004 consumes this route in the mock gateway scenarios (SETUP012 `stream` format must mirror these SSE messages).

## 14. Open questions and assumptions

- ASSUMPTION: SSE rather than WebSocket (ENGINE001).
- ASSUMPTION: replay window 5000 events.
