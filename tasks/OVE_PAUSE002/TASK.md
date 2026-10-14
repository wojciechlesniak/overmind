---
id: OVE_PAUSE002
title: "Persist pause state in SQLite so it survives engine restarts"
area: PAUSE
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DATA001, OVE_PAUSE001]
soft_depends_on: []
provides: ["table:pause_state", "lib:pause-repository-sqlite"]
needs: ["lib:sqlite-core", "port:Clock"]
owns: ["packages/adapters/sqlite/src/pause/**", "packages/adapters/sqlite/migrations/V202610131001__OVE_PAUSE002__pause_state.sql"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5]
---

# OVE_PAUSE002: Persist pause state in SQLite so it survives engine restarts

## 1. Summary

Implements `PauseRepository` on SQLite (WAL) with a migration for the `pause_state` table. The pause flag is durable: after a crash, restart or reboot the engine comes back in the same paused state.

## 2. Context

ADR 0005: Run state is durable and the engine resumes after restart. SPEC 16.7 and 16.14 require that pause is enforced by the engine, so a restart must never silently un-pause the system. The pause table is tiny and written rarely, so correctness matters more than performance.

## 3. Scope (in)

- Migration creating `pause_state`.
- `SqlitePauseRepository` implementing `load`, `save` (compare-and-swap on `version`), `remove`.
- Contract test run against the SQLite adapter and the in-memory fake.

## 4. Out of scope

- Entity definitions: OVE_PAUSE001. Boot-time reading and fail-closed behaviour: OVE_PAUSE008.
- Audit log of changes (written by the use cases through the event store): OVE_PAUSE003.

## 5. Detailed requirements

1. **Table** (migration `V202610131001__OVE_PAUSE002__pause_state.sql`, first line the comment `-- workspace-scoped: yes`, because rows with `scope_key = 'ws:<id>'` belong to a Workspace and are covered by the cascade participant OVE_PAUSE017):
   ```sql
   CREATE TABLE pause_state (
     scope_key   TEXT PRIMARY KEY,          -- 'global' | 'ws:<workspaceId>'
     paused      INTEGER NOT NULL CHECK (paused IN (0,1)),
     since       TEXT,                      -- ISO-8601 UTC, null when not paused
     via         TEXT CHECK (via IN ('desktop','tray','telegram','system')),
     version     INTEGER NOT NULL CHECK (version >= 0),
     updated_at  TEXT NOT NULL
   ) STRICT;
   ```
   No index beyond the primary key (at most one row per Workspace plus one global row).
2. `save(state, expectedVersion)` runs `INSERT ... ON CONFLICT(scope_key) DO UPDATE ... WHERE version = :expectedVersion` inside one transaction; zero rows changed returns `data.conflict`. A new scope uses `expectedVersion = 0` and must not exist yet (or exist at version 0).
3. `load()` returns all rows mapped through the zod schema; a row that fails validation yields `data.corrupt` with the `scope_key` in `details` (boot recovery treats this as `pause.state_unreadable` and starts paused).
4. `remove(scope)` deletes the row (used when a Workspace is deleted, SPEC 10) and is idempotent.
5. Rows for deleted Workspaces are not kept: the migration adds no foreign key (Workspace tables belong to DATA), so cleanup is explicit via `remove`; a defensive `load()` filter drops nothing silently but logs a `warn` with the orphan scope key.
6. Writes use `synchronous = FULL` for this table's transaction path (a lost pause flag after power loss is a safety defect); this is done by wrapping `save` in `BEGIN IMMEDIATE` and relying on the connection's WAL + `synchronous=FULL` setting documented by DATA, not by a per-statement pragma.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:sqlite-core` (connection, transaction helper, migration runner) from DATA; the `PauseRepository` contract test suite is added to `packages/testing/src/contracts/PauseRepository.contract.ts` (TEST003 conventions) and run for both the SQLite adapter and an in-memory fake.

## 8. Architecture and code placement

Adapter layer only: `packages/adapters/sqlite/src/pause/{sqlite-pause-repository.ts,rows.ts}`; no domain logic here (the version check is a storage concern, the transition rules live in the domain). The adapter depends on the port and contracts, never on use cases.

## 9. Security and safety

- Parameterised statements only; `scope_key` is built from a validated ULID, never from request text.
- The table has no free-text column, so an attacker cannot persist content through it.
- A corrupt row is surfaced as an error, never defaulted to 'not paused' (fail closed).

## 10. Errors and edge cases

- Two engine components save the same scope concurrently: one gets `data.conflict` and re-reads.
- Database locked (`SQLITE_BUSY`) during save: retried by the core busy handler; after the timeout `data.busy` is returned and the use case reports failure instead of pretending success.
- Downgrade/restore of an older database without the table: the migration runner creates it empty (not paused); post-restore start applies the restore step (OVE_PAUSE008).

## 11. Acceptance criteria

- [ ] Given a saved paused global state, When the adapter is closed and reopened, Then `load()` returns the identical state.
- [ ] Given a stale `expectedVersion`, Then `save` returns `data.conflict` and the row is unchanged.
- [ ] `remove` on a missing scope succeeds.
- [ ] A row with `paused = 2` is impossible (CHECK) and a hand-edited bad `via` makes `load()` fail with `data.corrupt`.
- [ ] The `PauseRepository` contract suite passes for both SQLite and the in-memory fake.

## 12. Test plan

Contract suite (shared with the fake), `sqlite-pause-repository.test.ts` using a temp database file, crash simulation (kill the process handle after commit, reopen). Commands: `pnpm vitest run packages/adapters/sqlite/src/pause`.

## 13. Parallelization notes

Runs in parallel with OVE_PAUSE003/004/005 (they use the in-memory fake). Migration file name is unique per task, no conflicts. Do not edit migrations of other tasks.

## 14. Open questions and assumptions

- ASSUMPTION: DATA exposes a `transaction()` helper and busy-timeout configuration; if it provides only a raw handle, this task wraps it locally without adding public API.
