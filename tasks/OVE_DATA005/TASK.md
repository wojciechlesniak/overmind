---
id: OVE_DATA005
title: Create the append-only event_log table and the EventStore port
area: DATA
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA003, OVE_ARCH007, OVE_ARCH010]
soft_depends_on: []
provides: ["port:EventStore", "table:event_log", "lib:event-store"]
needs: ["port:UnitOfWork", "port:Clock", "port:IdGenerator"]
owns: ["packages/application/src/ports/EventStore.ts", "packages/adapters/sqlite/src/events/event-log-repository.ts", "packages/adapters/sqlite/src/events/row-mapper.ts", "packages/adapters/sqlite/migrations/V202610130010__OVE_DATA005__create_event_log.sql"]
reads: ["packages/contracts/src/events"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14", "SPECIFICATION 15"]
adr_refs: [5, 8, 19]
---

# OVE_DATA005: Create the append-only event_log table and the EventStore port

## 1. Summary

The durable, ordered, append-only record of every persisted domain event (Run, Node, Approval, Pause, Decision, Task events). It is the source of truth for Run state and replay (ADR 0005, 0019). This task delivers the table, the `EventStore` port and its SQLite implementation.

## 2. Context

ARCH010 defines the envelope and the outbox rule; WFRT defines Run event types and checkpoint semantics; ENGINE replays into the UI push channel. Audit events of PERM (`aud_` ids) live in their own table but may reuse the chain utility of OVE_DATA006. The event log never stores secrets, prompts or file contents (ARCH010 req. 8).

## 3. Scope (in)

- Migration creating `event_log` with indexes and immutability triggers.
- `EventStore` port: `append`, `appendMany`, `readByRun`, `readSince`, `readByWorkspace`, `head`.
- SQLite implementation using the UnitOfWork transaction.

## 4. Out of scope

- Hash chain and integrity verification: `OVE_DATA006`. Checkpoints table and replay folding: `OVE_DATA006` and WFRT. Which events exist: owning areas.

## 5. Detailed requirements

1. Table `event_log`:
   - `seq INTEGER PRIMARY KEY AUTOINCREMENT` (global monotonic order, never reused),
   - `id TEXT NOT NULL UNIQUE` (`evt_` ULID from the envelope),
   - `type TEXT NOT NULL`, `schema_version INTEGER NOT NULL`, `occurred_at TEXT NOT NULL`,
   - `workspace_id TEXT NULL`, `run_id TEXT NULL`, `run_seq INTEGER NULL` (per-run sequence starting at 1, gap-free),
   - `actor_kind TEXT NOT NULL`, `actor_id TEXT NULL`, `channel TEXT NULL`,
   - `correlation_id TEXT NULL`, `causation_id TEXT NULL`,
   - `payload TEXT NOT NULL` (JSON, max 64 KiB, validated against the registry schema before insert),
   - `prev_hash TEXT NULL`, `hash TEXT NULL` (filled by DATA006).
   Constraints: `CHECK (json_valid(payload))`, `CHECK (length(payload) <= 65536)`, `UNIQUE(run_id, run_seq)` where `run_id IS NOT NULL`.
2. Indexes: `(run_id, run_seq)`, `(workspace_id, seq)`, `(type, seq)`, `(correlation_id)`.
3. Immutability: `BEFORE UPDATE` and `BEFORE DELETE` triggers call `RAISE(ABORT, 'event_log is append-only')`. The only deletion path is the Workspace cascade (`OVE_DATA012`): the DELETE trigger carries `WHEN (SELECT allow_delete FROM event_log_admin) = 0`; the one-row table `event_log_admin(allow_delete INTEGER NOT NULL DEFAULT 0)` is set to 1 only by the cascade routine inside its own transaction and reset to 0 before commit (a rollback restores 0). Triggers are never dropped. A test proves that no repository method can delete or update rows.
4. Port:
   ```ts
   interface EventStore {
     append(tx: TxContext, e: EventEnvelope): Result<StoredEvent>;               // StoredEvent = EventEnvelope & { seq: number; runSeq?: number }
     appendMany(tx, es: EventEnvelope[]): Result<StoredEvent[]>;                  // atomic, order preserved
     readByRun(runId, opts: { afterRunSeq?: number; limit?: number /* default 1000, max 5000 */ }): Promise<Result<StoredEvent[]>>;
     readSince(afterEventId: string | null, opts: { types?, workspaceId?, limit }): Promise<Result<{ events: StoredEvent[]; resyncRequired: boolean }>>;
     head(): Promise<Result<{ seq: number; id: string } | null>>;
   }
   ```
   `append` computes `run_seq` as `max+1` for the run inside the writer transaction (no gaps), validates payload with the schema from the generated event registry (unknown type -> `validation.unknown_event_type`), rejects `persisted:false` types, and registers `afterCommit(bus.publish)` (DATA002).
5. `readSince` uses `seq` of the given event id; unknown id or older than the retention window -> `resyncRequired: true` with no events.
6. Upcasting (ARCH010): readers pass events through `upcast(type, schemaVersion, payload)`; stored rows are never rewritten.
7. Payload safety: before insert run the shared redaction check (`expectEventSafe` logic from ARCH010 as `assertEventPayloadSafe`) in non-release builds; in release a scan for token-like patterns that blocks the append with `data.write_failed`-class error `validation.unsafe_payload` (fail closed, logged without the value).
8. Volume: designed for 10 M rows; no per-event fsync beyond WAL; bulk append of 1000 events under 100 ms (informational).
9. Retention: no deletion in MVP except Workspace cascade; compaction is post-MVP and recorded as ADR-needed.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EventEnvelope`/`defineEvent` (ARCH010), `UnitOfWork`/`TxContext` (DATA002), `IdGenerator`, base repository helpers (DATA007) for row mapping and cursor encoding.

## 8. Architecture and code placement

Port in `packages/application/src/ports/EventStore.ts`. SQLite implementation `packages/adapters/sqlite/src/events/`. Domain/application code appends events only through this port inside a `UnitOfWork`. The event bus remains separate (ARCH010).

## 9. Security and safety

The log is the audit-grade history of Runs: immutability triggers, no UPDATE path, bounded payloads, redaction gate. Events carry ids and refs, never secrets. Workspace-scoped reads filter by `workspace_id` so an agent-scope subscription cannot see another Workspace (enforced again in the gateway hub). Failure to persist an event fails the whole transaction (fail closed), so no state change exists without its event.

## 10. Errors and edge cases

- Two writers appending to one run: serialised by the writer mutex; `run_seq` unique constraint is the safety net (`data.conflict`).
- Payload over 64 KiB: rejected with `validation.payload_too_large`; large data goes to Artifacts by reference.
- Event with `workspaceId` of a deleted Workspace: allowed only for the cascade's own tombstone event `workspace.deleted` (no FK, because events outlive rows they describe).
- Clock goes backwards: `occurred_at` may decrease, ordering uses `seq`.

## 11. Acceptance criteria

- [ ] Given appended events for a run, then `run_seq` is 1..n without gaps even under concurrent appends.
- [ ] Given an UPDATE or DELETE on `event_log` from a repository, then it fails.
- [ ] Given a rolled-back transaction, then no event row exists and nothing was published.
- [ ] Given a committed append, then the bus publishes the stored envelope once.
- [ ] Given `readSince` with an unknown id, then `resyncRequired` is true.
- [ ] Given an oversized or secret-bearing payload, then the append is rejected.

## 12. Test plan

Repository contract (`EventStore.contract.ts`, harness TEST003 `repositoryContract` append-only variant) against SQLite and the in-memory fake (DATA008); concurrency test with 50 parallel appends; trigger tests; benchmark. Commands: `pnpm vitest run packages/adapters/sqlite/src/events`.

## 13. Parallelization notes

Blocks WFRT persistence, ENGINE events hub (ENGINE014), recovery (ENGINE005) and TEST011 (`table:event_log`). Migration version `V202610130010` is reserved to keep ordering after DATA003.

## 14. Open questions and assumptions

- ASSUMPTION: one global log table (not per-aggregate) for simplicity and a single ordered stream.
- ASSUMPTION: 64 KiB payload cap.
