---
id: OVE_DATA001
title: Define the SqliteDatabase interface and connection factory (WAL, pragmas, single writer)
area: DATA
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH005, OVE_ARCH006, OVE_ARCH007]
soft_depends_on: [OVE_SETUP011, OVE_ARCH004]
provides: ["port:SqliteDatabase", "lib:sqlite-connection", "lib:sqlite-driver-adapter", "lib:sqlite-core"]
needs: ["port:Logger", "port:Clock", "lib:data-dir"]
owns: ["packages/adapters/sqlite/src/core/database.ts", "packages/adapters/sqlite/src/core/connection.ts", "packages/adapters/sqlite/src/core/pragmas.ts", "packages/adapters/sqlite/src/core/drivers/**", "packages/adapters/sqlite/package.json", "packages/adapters/sqlite/tsconfig.json", "docs/architecture/sqlite.md", "packages/contracts/src/errors/data.errors.ts"]
reads: ["docs/research/engine-packaging-spike.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [5, 8, 18, 19]
---

# OVE_DATA001: Define the SqliteDatabase interface and connection factory (WAL, pragmas, single writer)

## 1. Summary

Create the thin `SqliteDatabase` interface that hides the SQLite driver, the connection factory that opens `overmind.sqlite` with WAL and safe pragmas, and the single-writer discipline. Every repository in every area depends on this interface, never on a driver.

## 2. Context

ADR 0018/0019 and SPEC 12: SQLite in WAL mode is the store for state and the Run event stream. The driver is decided by `OVE_SETUP011` (default `node:sqlite`, fallback `better-sqlite3@13`, candidate `bun:sqlite` only if the Owner approves a runtime split). This task MUST NOT choose: it implements the interface plus a driver adapter for each of the two Node candidates (`node:sqlite`, `better-sqlite3`), and the composition root selects one by the ADR outcome (a single constant `SQLITE_DRIVER` in `packages/adapters/sqlite/src/core/drivers/selected.ts`). A `bun:sqlite` adapter is out of scope unless the ADR picks Bun.

## 3. Scope (in)

- Interface `SqliteDatabase` (the minimal surface from SETUP011 req. 11) and `SqliteStatement`.
- Driver adapters `NodeSqliteDatabase` and `BetterSqlite3Database` behind it.
- `openDatabase({ path, readonly?, role })` factory, pragma application, connection roles.
- Single-writer discipline helper and the doc `docs/architecture/sqlite.md`.

## 4. Out of scope

- Transactions as a use-case port: `OVE_DATA002`. Migrations: `OVE_DATA003`. FTS5 helper: `OVE_DATA004`. Backup scheduling: BACKUP area (this task only exposes `backupTo`).
- Choosing the driver: `OVE_SETUP011`.

## 5. Detailed requirements

1. Interface (no driver types leak; rows are plain objects, blobs `Uint8Array`, integers as `number` unless flagged `bigint: true` per statement):
   ```ts
   interface SqliteDatabase {
     exec(sql: string): void;                                   // multi-statement, no parameters, for DDL only
     prepare<R = Row>(sql: string): SqliteStatement<R>;         // cached by sql string (LRU 256)
     transaction<T>(mode: 'deferred'|'immediate', fn: () => T): T;   // synchronous, rolls back on throw
     pragma(name: string, value?: string | number): unknown;    // whitelist of names
     backupTo(destPath: string): void;                          // VACUUM INTO or driver backup API; dest must not exist
     checkpoint(mode: 'passive'|'truncate'): { busy: number; log: number; checkpointed: number };
     readonly path: string; readonly inTransaction: boolean; close(): void;
   }
   interface SqliteStatement<R> { run(...p): { changes: number; lastInsertRowid: number }; get(...p): R | undefined; all(...p): R[]; iterate(...p): Iterable<R>; }
   ```
   Parameters are positional or one named object; string interpolation of values into SQL is forbidden (lint rule proposal to ARCH002: no template literals in `prepare`/`exec`, except identifiers from a whitelist helper `ident()`).
2. Connection roles: `writer` (exactly one per process, opened first, `BEGIN IMMEDIATE` for writes) and `reader` (up to 4, `query_only=ON`, used for list/search/replay). The synchronous drivers mean only one JS thread touches the writer; the factory returns a `ConnectionSet { writer, readers: ReaderPool }` and throws `data.writer_already_open` if a second writer is requested in the same process.
3. Pragmas applied on open, in this order, verified by reading them back: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`, `wal_autocheckpoint=1000`, `journal_size_limit=67108864`, `temp_store=MEMORY`, `trusted_schema=OFF`, `cell_size_check=ON` (writer), `secure_delete=ON`. If `journal_mode` does not come back as `wal` (for example a network volume) the open fails with `data.wal_unavailable` (fail closed, no silent downgrade).
4. The database file and `-wal`/`-shm` are created with mode 0600 under `layout.dbFile` (ARCH005); after open the factory `lstat`s all three and fixes or refuses (`data.db_insecure`). The path must come from `DataDirLayout`; the factory rejects any other directory unless `:memory:` in tests.
5. Extension loading is disabled (`enableLoadExtension(false)`); `ATTACH`, `load_extension` and `PRAGMA writable_schema` are blocked by the pragma whitelist and a statement guard that rejects SQL containing them from non-migration callers (migrations use a privileged `execMigration`).
6. Error mapping: driver errors become `AppError` via `mapSqliteError(e)`: `SQLITE_BUSY/LOCKED` -> `data.busy` (retryable), `SQLITE_CONSTRAINT_UNIQUE` -> `data.conflict`, `SQLITE_CONSTRAINT_FOREIGNKEY` -> `data.integrity_violation`, `SQLITE_FULL` -> `data.disk_full`, `SQLITE_CORRUPT/NOTADB` -> `data.corrupt` (fatal), others -> `data.query_failed`. `message`/`details` never contain SQL text or parameter values (ARCH003 rule).
7. Busy handling: `busy_timeout` plus a bounded retry (3 attempts, 20/60/150 ms with jitter from `Clock`-independent `setTimeout`) only for `data.busy` on the writer in `BEGIN IMMEDIATE`.
8. `close()` runs `PRAGMA optimize` then a `truncate` checkpoint on the writer, then closes readers, then the writer; idempotent.
9. A `driverInfo()` function returns `{ driver, sqliteVersion, compileOptions }`; the factory fails with `data.sqlite_feature_missing` if FTS5, JSON1 and `RETURNING` are not available.
10. Slow query logging: statements above 200 ms log `warn` with a statement id (hash of the SQL), never the SQL parameters.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Logger` (ARCH004), `Clock` (ARCH007), `defineErrors` (ARCH003). This task creates and OWNS `packages/contracts/src/errors/data.errors.ts`, the single catalogue for every `data.*` code used by the DATA tasks (the list is in `docs/architecture/sqlite.md` section "Error codes" and includes the codes named in OVE_DATA001..DATA018: busy, conflict, not_found, immutable, integrity_violation, disk_full, corrupt, query_failed, wal_unavailable, db_insecure, writer_already_open, sqlite_feature_missing, transaction_timeout, transaction_aborted, nested_conflict, migration_checksum_mismatch, migration_missing, migration_out_of_order, schema_newer_than_app, event_chain_broken, event_gap, idempotency_conflict, cursor_invalid, version_conflict, workspace_not_empty, workspace_name_taken, cascade_failed, rule_version_conflict, blob_missing, checksum_mismatch, path_not_allowed, write_failed, read_failed, permission_denied, symlink_refused). Later DATA tasks MUST NOT edit the file; a missing code is requested by proposal to this task's owner. ARCH013 uses the file-write/read/permission/symlink codes from here.

## 8. Architecture and code placement

Adapter layer: `packages/adapters/sqlite/src/core/`. The interface lives in the adapter package because only adapters use it; application code uses `UnitOfWork` and repository ports (`OVE_DATA002`). Adapters never import each other. Dependency direction: sqlite adapter -> application ports, contracts. One driver adapter per file (OCP).

## 9. Security and safety

The database holds Decisions, rules, audit events: file mode 0600, directory 0700, symlink refusal inherited from the data-dir initializer. Parameter binding only; extension loading and `ATTACH` disabled. `trusted_schema=OFF` prevents malicious schema objects from running functions. Secrets are never stored (SR-06), only Keychain refs. Fail closed on corrupt DB or unavailable WAL.

## 10. Errors and edge cases

- Database locked by a zombie process: `data.busy` after timeout, startup aborts with message to restart (engine lock should prevent it).
- Disk full during checkpoint: reported, writes fail with `data.disk_full`, engine enters degraded mode (`OVE_ENGINE006` health).
- `:memory:` path used outside tests: refused unless `OVERMIND_DEV`.
- Driver returns `bigint` for large integers: converted to `number` when safe, else the statement must declare `bigint`.
- Read connection sees stale data after a write: WAL gives snapshot per transaction; readers open a read transaction per call.

## 11. Acceptance criteria

- [ ] Given a fresh path, when opened, then `PRAGMA journal_mode` returns `wal`, `foreign_keys` returns 1, files are mode 0600.
- [ ] Given a second writer request in one process, then `data.writer_already_open`.
- [ ] Given both driver adapters, the same contract test file passes for each (`describeContract`).
- [ ] Given a unique constraint violation, then `data.conflict` and the AppError contains no SQL text.
- [ ] Given SQL containing `ATTACH` passed to `prepare` by a repository, then it is rejected.
- [ ] Given a volume without WAL support (simulated by a driver stub), then open fails closed.

## 12. Test plan

Unit: `mapSqliteError`, pragma whitelist, statement guard. Integration (temp dir): `database.contract.test.ts` run against each driver adapter (skip with reason if a driver is not installed), crash test via `kill -9` of a child writing in a loop then reopening (WAL recovery). Commands: `pnpm vitest run packages/adapters/sqlite/src/core`.

## 13. Parallelization notes

Merge first in the DATA area; everything else depends on it. Hotspot: `packages/adapters/sqlite/package.json` (owned here; other tasks add files only). Can start against the SETUP011 default while the ADR is in review.

## 14. Open questions and assumptions

- ASSUMPTION: default driver `node:sqlite` (SETUP011 default rule); both adapters ship until the ADR is final, then the unused one is deleted by a follow-up.
- ASSUMPTION: 1 writer + up to 4 readers is enough; revisit if replay reads contend.
