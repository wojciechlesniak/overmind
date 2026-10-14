---
id: OVE_ARCH010
title: Implement the in-process event bus and the domain event envelope
area: ARCH
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008]
soft_depends_on: [OVE_ARCH004]
provides: ["port:EventBus", "contract:EventEnvelope", "lib:event-bus", "lib:define-event"]
needs: []
owns: ["packages/contracts/src/events/envelope.ts", "packages/contracts/src/events/define-event.ts", "packages/application/src/ports/EventBus.ts", "packages/application/src/events/**", "docs/architecture/events.md"]
reads: ["docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13", "SPECIFICATION 15", "SPECIFICATION 16"]
adr_refs: [5, 6, 19]
---

# OVE_ARCH010: Implement the in-process event bus and the domain event envelope

## 1. Summary

Define one event envelope, a typed `defineEvent` helper and an in-process `EventBus` with precise delivery semantics, and fix how it relates to the persisted SQLite event log (the source of truth for Run state) and to push events delivered to clients over the gateway. This lets Chief, workflow runtime, notifications, Telegram and UI stay in sync without direct coupling.

## 2. Context

Spec 12: Run state is an append-only event stream in SQLite (ADR 0019); after restart the engine resumes from it. Spec 16.13: Telegram and desktop must show the same state: one source of truth in the engine. Spec 15: Activity, live views, replay. Notifications and UI must react to changes in real time. The bus is a notification mechanism, never the source of truth.

## 3. Scope (in)

- Envelope schema and `defineEvent` helper in `contracts`.
- `EventBus` port (publisher and subscriber interfaces) and `InProcessEventBus` implementation.
- Rules relating bus, event store (persisted events) and gateway push (`EventSubscriptionHub` contract).
- Documentation `docs/architecture/events.md` with delivery guarantees and recipes.

## 4. Out of scope

- The event log table, repositories and replay: DATA. Workflow checkpoints and run-event types: WFRT (they define events with `defineEvent`).
- Gateway subscription endpoint (SSE/WebSocket/NDJSON framing) and client reconnect: ENGINE (this task fixes the semantics they must implement).
- Specific events of each area: that area (one file per event, `packages/contracts/src/events/<type>.event.ts`).

## 5. Detailed requirements

1. **Envelope** (zod, strict):
   ```ts
   EventEnvelope = {
     id: EntityId<'evt'>,                // ULID, unique, sortable
     type: string,                       // dotted lowercase: 'run.node.started', 'approval.requested'
     occurredAt: IsoDateTime,            // from Clock
     schemaVersion: int >= 1,            // version of THIS event type's payload
     workspaceId?: EntityId<'ws'>,
     runId?: EntityId<'run'>,
     actor: { kind: 'owner'|'chief'|'agent'|'system'|'channel', id?: string, channel?: 'desktop'|'telegram' },
     correlationId?: EntityId<'req'>,    // request or causing command
     causationId?: EntityId<'evt'>,      // event that caused this one
     payload: unknown                    // validated per type
   }
   ```
   `defineEvent(type, payloadSchema, { schemaVersion: 1, persisted: boolean, scope: 'workspace'|'global', visibleTo: ('owner'|'agent'|'channel')[] , audit?: boolean })` returns `{ type, schema, create(input, deps): EventEnvelope, is(e): e is Typed }`. `create` takes `Clock`, `IdGenerator` and context, never ambient time/ids.
2. **Naming:** `<aggregate>.<verb-past>` or `<aggregate>.<sub>.<verb-past>`: `run.started`, `run.node.succeeded`, `approval.requested`, `access_request.granted`, `pause.changed`, `agent.state.changed`. Past tense, snake_case segments joined by dots. Registry test enforces the pattern and uniqueness. Payload evolution is additive; breaking payload change = new `schemaVersion` with an upcaster registered via `registerUpcaster(type, from, to, fn)` so replay of old events works (never rewrite stored events).
3. **Bus port:**
   ```ts
   export interface EventPublisher { publish(event: EventEnvelope): void }          // fire-and-forget, never throws
   export interface EventSubscriber {
     subscribe<T extends EventType>(type: T | T[] | '*', handler: (e: EventOf<T>) => void | Promise<void>, opts?: { name: string; filter?: (e) => boolean }): Unsubscribe;
   }
   export interface EventBus extends EventPublisher, EventSubscriber {}
   ```
   Wildcard patterns: exact type, `'*'`, and prefix `'run.*'`.
4. **Delivery semantics** (normative, documented and tested):
   - In-process, single engine process. At-most-once per subscriber; no persistence in the bus itself.
   - Per-publisher ordering is preserved per subscriber: handlers for one subscription are invoked sequentially in publish order (queue per subscription).
   - `publish` returns immediately; dispatch happens on a microtask queue (`queueMicrotask`) so a publisher is never blocked by or exposed to handler failures.
   - Handler exceptions and rejections are caught, logged (`error` with event id/type, subscription name) and counted; they never affect the publisher or other subscribers. A subscriber taking longer than 5 s is logged (`warn`) once per event.
   - A slow subscriber's queue is bounded (default 1000). On overflow the oldest non-critical events are dropped, the subscriber receives a synthetic `bus.overflow` envelope (type reserved, `payload.dropped`) so it can resynchronise from the store, and a metric is logged. Events with `critical: true` metadata (pause, approvals, access requests) are never dropped: overflow of a critical subscriber blocks the subscription and raises `error` (fail loud).
   - Re-entrancy: handlers may publish; those events are queued after the current ones.
   - No cross-process delivery, no replay in the bus.
5. **Source of truth rule (outbox pattern).** For `persisted: true` events (all Run, Node, Approval, AccessRequest, Pause, Decision, Task, Audit events): the use case MUST (a) write state change and event row in the same SQLite transaction through the `EventStore` port (DATA), (b) after commit, `publish` the stored envelope on the bus. Subscribers must treat the bus as a hint to react quickly and tolerate duplicates caused by recovery. After a crash, the engine's startup recovery publishes nothing automatically; consumers rebuild state by reading the store from their last known `id` (ULID order). Ephemeral events (`persisted: false`: typing indicators, agent state hints from herdr, progress ticks) are never stored and may be dropped.
6. **Audit events are separate:** security audit events (`aud_` ids) are written to the audit log table by PERM; they may additionally be published as `audit.recorded` for UI refresh. The bus is never an audit channel.
7. **UI push over the gateway** (contract for ENGINE): clients subscribe with `{ types?, workspaceId?, afterEventId? }`. The hub (a bus subscriber in the gateway) (a) first replays persisted events with `id > afterEventId` from the store (bounded, e.g. 5000, else responds `events.resync_required`), (b) then streams live events, de-duplicated by `id`, (c) filters by the caller's `visibleTo` and scope (agents never receive Owner-only events; Telegram receives only events marked for channels and rendered by the Telegram adapter), (d) sends `heartbeat` events every 15 s, (e) on queue overflow closes with `events.resync_required`. Clients keep the last seen `id` and reconnect with `afterEventId`. Ephemeral events are best-effort and never replayed.
8. **Payload safety:** payload schemas follow the contract rules of ARCH008 (strict, bounded strings). Payloads MUST NOT contain secrets, full prompts or file contents; they contain ids/refs (artifact id, message id). A test helper `expectEventSafe(event)` runs the redaction patterns (ARCH004) over serialised payloads.
9. **Typed registry:** generated `EventType` union and `EventOf<T>` mapped type from `events/registry.generated.ts` (ARCH009), so `subscribe('run.started', e => e.payload.runId)` is typed.
10. **Observability:** the bus exposes `stats()` (published, delivered, failed, dropped per subscription) for the diagnostics endpoint; logs use correlation ids from the event (`runId`, `workspaceId`) via `logger.child`.
11. **Contract test suite** `EventBus.contract.ts` (TEST003): ordering, isolation of failing handlers, wildcard matching, unsubscribe during dispatch, re-entrant publish, overflow behaviour, critical events, `publish` never throws, no delivery after unsubscribe.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Clock`, `IdGenerator` (ARCH007), `Logger` (ARCH004), `Result` (ARCH003), `defineRoute`-style registration and snapshot of events (ARCH008 includes `events/<type>.json` in the snapshot). Areas MUST NOT build their own pub/sub or use Node `EventEmitter` directly in application code.

## 8. Architecture and code placement

- Contracts: `packages/contracts/src/events/{envelope.ts,define-event.ts}`; event files per type (owned by areas).
- Port: `packages/application/src/ports/EventBus.ts` (also exports `EventPublisher`, `EventSubscriber` for ISP; most use cases take only `EventPublisher`).
- Implementation `InProcessEventBus` in `packages/application/src/events/in-process-event-bus.ts`: it has no I/O, only microtasks, so it lives in application (testable without adapters); the logger and clock are injected.
- Upcaster registry in `packages/application/src/events/upcasters.ts`.

## 9. Security and safety

Events carry `visibleTo` and `scope` so the gateway can enforce least privilege per caller (agents get only their own run's events; SR-31). A subscriber bug must not expose data to another channel: filtering happens in the hub, not in each subscriber. Critical events are never silently dropped (approval/pause correctness). Payloads are validated on `create` (fail closed: invalid event is not published and an `internal` error is logged). Telegram-visible events must not contain Owner-only data such as absolute paths (schema marks `telegramSafe` fields).

## 10. Errors and edge cases

- Publishing an unregistered type: `create` fails at compile time (types) and at runtime (`events.unknown_type`).
- Duplicate delivery after recovery: consumers dedupe by `id`.
- Subscriber unsubscribes inside its handler: remaining queued events for it are discarded.
- Event ordering across different publishers is by publish call order only; consumers needing causal order use `causationId` or store order (ULID).
- Clock regression: ULIDs stay monotonic (ARCH007) so replay order is stable.
- Engine shutdown: `bus.close()` drains queues up to 2 s then drops, logging the count.

## 11. Acceptance criteria

- [ ] Envelope schema validates the specified fields; unknown fields rejected.
- [ ] `defineEvent` builds envelopes using injected clock and ids; naming rule enforced by registry test.
- [ ] Contract suite passes for `InProcessEventBus`: sequential per-subscription order, failure isolation, wildcard, unsubscribe, re-entrancy.
- [ ] Overflow produces a `bus.overflow` marker for normal events and blocks/raises for critical events.
- [ ] Upcaster test: an old `schemaVersion` payload is upgraded on read without mutating stored data.
- [ ] `docs/architecture/events.md` documents outbox rule, hub replay protocol (`afterEventId`, `events.resync_required`), ephemeral vs persisted.
- [ ] `expectEventSafe` flags a payload containing a token-like string.

## 12. Test plan

- Unit: `define-event.test.ts`, `in-process-event-bus.test.ts` (fake clock, fake logger), `upcasters.test.ts`, `registry.test.ts`.
- Contract: `EventBus.contract.ts` with TEST003 harness.
- Property test: random interleavings of publish/subscribe/unsubscribe keep per-subscription order.
- Integration (later, DATA): outbox transaction test belongs to DATA/WFRT.
- Commands: `pnpm vitest run packages/application/src/events packages/contracts/src/events`.

## 13. Parallelization notes

Envelope and `defineEvent` first (every area defines events). Event files are per type, barrels generated (ARCH009). The gateway hub implementation (ENGINE) can start once the semantics in requirement 7 are merged as docs. No shared file to edit.

## 14. Open questions and assumptions

- ASSUMPTION: subscription queue default 1000, flush timeout 2 s, heartbeat 15 s; tune with real load.
- ASSUMPTION: the bus lives in `application` (no I/O); if a future multi-process engine appears, a second implementation can be added behind the same port.
- Open: whether `critical` should be an event-definition option (`delivery: 'critical'`); default yes, implemented in `defineEvent` options.
