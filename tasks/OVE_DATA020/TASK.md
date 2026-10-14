---
id: OVE_DATA020
title: SQLite composition module - open database, migrate at start, integrity check, shutdown
area: DATA
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH006, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DATA003, OVE_DATA005, OVE_DATA006, OVE_SETUP011]
soft_depends_on: []
provides: ["lib:sqlite-module", "port:DatabaseLifecycle", "port:IntegrityFindings"]
needs: ["lib:di-conventions", "lib:data-dir", "port:Logger", "port:Clock", "port:EventBus"]
owns: ["apps/engine/src/composition/modules/sqlite.module.ts", "packages/adapters/sqlite/src/core/lifecycle.ts", "packages/adapters/sqlite/src/core/startup-checks.ts", "packages/adapters/sqlite/src/core/drivers/selected.ts", "packages/application/src/ports/DatabaseLifecycle.ts"]
reads: ["docs/adr"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5, 18, 19]
---

# OVE_DATA020: SQLite composition module and startup checks

## 1. Summary

Wire the SQLite infrastructure into the engine: open the connections, run migrations, perform quick integrity checks, provide UnitOfWork, EventStore and CheckpointStore tokens, and close cleanly on shutdown.

## 2. Context

The composition root (ARCH006) has `start`/`stop` hooks per module. Startup order matters: data directory initialised (ARCH005), database opened, migrations applied (with backup), integrity checked, only then use cases and the gateway start. Failures must stop the engine rather than run on a doubtful database.

## 3. Scope (in)

- `sqlite.module.ts`, `DatabaseLifecycle` port, startup checks, driver selection constant.

## 4. Out of scope

- Recovery of Runs (ENGINE005). Backup jobs (BACKUP). Restore flow (BACKUP).

## 5. Detailed requirements

1. Module `id: 'sqlite'`, `requires` logger, clock, data-dir layout, bus; `provides` `SqliteDatabaseToken` (internal, only adapters), `UnitOfWorkToken`, `EventStoreToken`, `CheckpointStoreToken`, `DatabaseLifecycleToken`, `IntegrityFindingsToken`. The `build` is synchronous and opens nothing; `start` does the work.
2. `start` sequence: (1) open connections (DATA001), (2) migrate (DATA003; on `schema_newer_than_app` fail with exit code 30 semantic `incompatible`), (3) `PRAGMA quick_check` (fail -> `data.corrupt`: engine refuses to start and reports the latest `snapshots/` backup path to the UI/log so the Owner can restore; no auto-restore), (4) `foreign_key_check` (findings listed, not fatal), (5) `verifyChain` over the newest 1000 events (finding only), (6) register driver info in diagnostics, (7) log a summary line (versions, counts).
3. `IntegrityFindings` port records findings in table `integrity_findings(id, kind, detail_json, found_at)` (created by migration `V202610130060__OVE_DATA020__create_integrity_findings.sql`), consumed by ENGINE health and diagnostics.
4. `stop`: wait for the writer queue to drain (<= engine grace period), `checkpoint(truncate)`, close; idempotent; a `stop` timeout logs and forces close.
5. `selected.ts` exports the driver chosen by the SETUP011 ADR (default `node:sqlite`); a test asserts the selected driver exists in the bundle and the other adapter is excluded from the release bundle (tree-shaking guard).
6. Release builds forbid `:memory:`; tests use `createTestEngine` overrides (ARCH006) that replace `UnitOfWork`/`EventStore` with fakes.
7. Health contributions: registers a `HealthCheck` (multi-token from ENGINE006) reporting `ok|degraded|failed` with details `{ schemaVersion, walSizeBytes, findings }`.
8. WAL size watchdog: every 5 min `checkpoint('passive')`; WAL above 256 MiB logs `warn` and forces `truncate` when idle.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineModule` (ARCH006), `DataDirLayout` (ARCH005), migration runner, verifier, lifecycle hooks consumed by ENGINE004 (shutdown).

## 8. Architecture and code placement

Composition: `apps/engine/src/composition/modules/sqlite.module.ts` (owned here, per-area module rule). Lifecycle code in the adapter package. Nothing else imports driver types.

## 9. Security and safety

Refuse to run on corruption or newer schema (fail closed, SR-03). Database path only from the layout. No automatic restore (could discard data silently). Findings never contain row content.

## 10. Errors and edge cases

- Migration fails: engine exits 20 with the failing version in the log; database unchanged (transaction) and pre-migrate backup available.
- `quick_check` slow on huge DB: runs with a 60 s budget, then continues with `degraded`.
- Disk almost full at start: warning finding `low_disk`.
- Driver native addon missing (better-sqlite3 variant): exit 20 with `data.sqlite_feature_missing`.

## 11. Acceptance criteria

- [ ] Fresh data dir: engine module start creates the database with all migrations and passes checks.
- [ ] A truncated database file makes start fail with `data.corrupt` and the engine does not serve requests.
- [ ] A database with a newer schema yields the `incompatible` outcome.
- [ ] `stop` leaves no `-wal` content beyond the checkpoint (file truncated).
- [ ] Release bundle contains exactly one driver adapter (test).

## 12. Test plan

Integration tests with temp dirs for each outcome; kill -9 then restart test (TEST011 R-11 relies on it). Commands: `pnpm vitest run apps/engine/src/composition packages/adapters/sqlite/src/core`.

## 13. Parallelization notes

After DATA005/006. ENGINE001 composes this module. Migration `V202610130060` reserved.

## 14. Open questions and assumptions

- ASSUMPTION: no auto-restore; the UI offers restore from backup (BACKUP).
- ASSUMPTION: WAL watchdog thresholds 256 MiB / 5 min.
