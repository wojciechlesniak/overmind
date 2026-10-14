---
id: OVE_DATA002
title: Define the UnitOfWork port and the transaction helper with outbox publishing
area: DATA
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_DATA001]
soft_depends_on: []
provides: ["port:UnitOfWork", "lib:transaction-helper", "lib:outbox"]
needs: ["port:EventBus", "port:Logger", "port:Clock"]
owns: ["packages/application/src/ports/UnitOfWork.ts", "packages/adapters/sqlite/src/core/unit-of-work.ts", "packages/adapters/sqlite/src/core/outbox.ts"]
reads: ["docs/architecture/events.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [5, 19]
---

# OVE_DATA002: Define the UnitOfWork port and the transaction helper with outbox publishing

## 1. Summary

Give use cases one way to run several repository operations and event appends in a single SQLite transaction, and to publish the persisted events on the bus only after commit (the outbox rule of ARCH010).

## 2. Context

ARCH010 requirement 5: state change and event row are written in the same transaction, then the stored envelope is published. SQLite drivers here are synchronous, but use cases are async; the port hides this. Repositories get their transaction-bound database through the unit of work, never through a global.

## 3. Scope (in)

- Port `UnitOfWork` in application and its SQLite implementation.
- Repository access inside a transaction (`tx.repo(Token)` pattern replaced by explicit factories, see 5.3).
- Post-commit hook queue (`afterCommit(fn)`), used for bus publishing.

## 4. Out of scope

- The `EventStore` port and event table: `OVE_DATA005`. Retry policy of use cases: owners of use cases.

## 5. Detailed requirements

1. Port:
   ```ts
   interface UnitOfWork {
     run<T>(work: (tx: TxContext) => Result<T> | Promise<Result<T>>, opts?: { mode?: 'immediate'|'deferred'; name: string }): Promise<Result<T>>;
   }
   interface TxContext { readonly db: TxDatabase; afterCommit(fn: () => void): void; readonly events: TxEventAppender }   // db is an opaque handle only adapters understand
   ```
   `run` commits when `work` resolves `ok`, rolls back when it resolves `err` or throws (throw -> `internal.unexpected`, original in `cause`). `name` appears in slow-transaction logs.
2. Repositories are constructed once with a `DbProvider` (`current(): SqliteDatabase`) that returns the transaction database inside `run` and the pooled reader/writer outside it (AsyncLocalStorage-based, inside the adapter only). A repository method called outside `run` that mutates uses its own short immediate transaction (autocommit-per-call), so simple use cases need no unit of work.
3. Nested `run` calls join the outer transaction (savepoints are NOT used; the inner `err` marks the outer for rollback via a `rollbackOnly` flag and the outer receives the same `err`). 
4. The work function MUST NOT perform async I/O other than other repository calls (documented, and enforced by a runtime guard: a transaction open longer than 2 s logs `error`, longer than 10 s is aborted with `data.transaction_timeout`). Network, process and filesystem calls belong before or after the unit of work.
5. `afterCommit` callbacks run in registration order after the COMMIT returns, each in try/catch (failure logged, never rethrown). They are discarded on rollback. `ctx.events.append(env)` (from `OVE_DATA005`) automatically registers `bus.publish(env)` as an afterCommit callback for `persisted` events.
6. Writes are serialised: `run` takes an async mutex around the writer (FIFO) so concurrent use cases queue instead of colliding on `SQLITE_BUSY`. Queue length > 200 logs `warn`; the metric is exposed to diagnostics.
7. Read-only operations use `unitOfWork.read(fn)` on a reader connection with a snapshot (`BEGIN` deferred) so lists and replays are consistent.
8. The in-memory fake `InMemoryUnitOfWork` (OVE_DATA008) provides the same semantics (rollback restores snapshots of fake repositories, afterCommit discarded).
9. Error codes: `data.transaction_timeout`, `data.transaction_aborted`, `data.nested_conflict` registered in `data.errors.ts`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EventBus` (ARCH010) for publishing, `Result` (ARCH003), `Logger`. Every area's multi-step use case uses this port; none opens its own transaction.

## 8. Architecture and code placement

Port: `packages/application/src/ports/UnitOfWork.ts` (interface, token, `TxContext`; no driver types). Implementation: `packages/adapters/sqlite/src/core/{unit-of-work.ts,outbox.ts}`. Application depends on the port only; the adapter depends on `SqliteDatabase` (DATA001).

## 9. Security and safety

Atomic state + audit/event writes prevent a security decision without its audit record (SR-17): a use case that records an approval MUST do both in one `run`. Rollback on any error means partial permission changes never persist (fail closed). The timeout prevents a hung transaction from blocking all writes.

## 10. Errors and edge cases

- Work throws after partial writes: full rollback, `internal.unexpected` returned.
- `afterCommit` callback publishes to a bus subscriber that itself calls `run`: allowed, queued after the first commit completes.
- COMMIT fails with `SQLITE_FULL`: rollback attempted, `data.disk_full` returned, callbacks discarded.
- Engine shutdown during a transaction: shutdown waits for the writer mutex to drain (up to the grace period), then closes.

## 11. Acceptance criteria

- [ ] Given work returning `err`, then no row written and no event published.
- [ ] Given work returning `ok` with an appended persisted event, then the event is published exactly once, after commit.
- [ ] Given two concurrent `run` calls, then they execute one after another and both succeed.
- [ ] Given a transaction open for 11 s, then it is aborted with `data.transaction_timeout`.
- [ ] Given a nested `run` whose inner returns `err`, then the outer rolls back.
- [ ] The same behaviour holds for `InMemoryUnitOfWork` (contract suite).

## 12. Test plan

Contract suite `UnitOfWork.contract.ts` (TEST003 harness; file owned by DATA008) run against both SQLite and in-memory implementations; fake clock for timeouts; property test: random interleavings keep invariants (sum of balances toy table). Commands: `pnpm vitest run packages/adapters/sqlite/src/core/unit-of-work`.

## 13. Parallelization notes

Parallel with DATA003/004 after DATA001. Port file is small: merge it early so use-case authors can code against it.

## 14. Open questions and assumptions

- ASSUMPTION: no savepoints in MVP (KISS); revisit if a use case needs partial rollback.
- ASSUMPTION: transaction time limits 2 s warn / 10 s abort.
