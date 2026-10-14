---
id: OVE_DATA003
title: Implement the forward-only migration runner with checksums and pre-migration backup
area: DATA
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH009, OVE_ARCH013, OVE_DATA001]
soft_depends_on: []
provides: ["lib:migration-runner", "table:schema_migrations"]
needs: ["port:Logger", "port:Clock", "port:AtomicFileWriter"]
owns: ["packages/adapters/sqlite/src/core/migrations/**", "packages/adapters/sqlite/migrations/V202610130001__OVE_DATA003__create_schema_migrations.sql"]
reads: ["packages/adapters/sqlite/migrations"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 14"]
adr_refs: [8, 19]
---

# OVE_DATA003: Implement the forward-only migration runner

## 1. Summary

Apply the SQL files in `packages/adapters/sqlite/migrations/` in order at engine start, record each with a checksum, refuse to run when history was tampered with or the database is newer than the app, and take a backup before any migration that changes the schema.

## 2. Context

Spec 14 requires migrations. Many areas add tables in parallel, each in its own file named `V<YYYYMMDDHHmm>__<TASKID>__<name>.sql` (ARCH009 validates names; this task is the runtime). Merged migrations are immutable. Because the file set is only known at build time, the runtime reads a generated manifest (`migrations.generated.json`, ARCH009) embedded in the bundle, not the filesystem.

## 3. Scope (in)

- Runner, `schema_migrations` table, checksum verification, ordering, dry-run.
- Pre-migration backup via `backupTo`.
- Downgrade protection and result report.

## 4. Out of scope

- Naming validation and generator: `OVE_ARCH009`. Daily backups and restore UX: BACKUP. Individual area tables: the areas.

## 5. Detailed requirements

1. Table (created by this task's migration): `schema_migrations(version TEXT PRIMARY KEY, task_id TEXT NOT NULL, name TEXT NOT NULL, checksum TEXT NOT NULL /* sha256 hex of file bytes with LF endings */, applied_at TEXT NOT NULL, duration_ms INTEGER NOT NULL, app_version TEXT NOT NULL, destructive INTEGER NOT NULL DEFAULT 0)`.
2. Order: ascending by `version`, tie-break by `task_id` (as in ARCH009). `migrate(db, manifest, opts)` returns `Result<MigrationReport>` with `applied[]`, `skipped[]`, `backupPath?`.
3. Each migration runs in its own `BEGIN IMMEDIATE` transaction together with its `schema_migrations` insert; failure rolls back that file and stops (no later file runs). `PRAGMA foreign_keys` is off during a migration only when the file header declares `-- foreign-keys: off`; a `foreign_key_check` runs after and must be empty.
4. Checksum verification before applying anything: every applied row must match the manifest file with the same version (`data.migration_checksum_mismatch`), no applied version may be missing from the manifest (`data.migration_missing`), and no unapplied file may sort BEFORE the newest applied version unless its task id is allow-listed (out-of-order merge; default refuse with `data.migration_out_of_order`; the escape hatch is `--allow-out-of-order <version>` for dev only).
5. Downgrade protection: if the database contains versions unknown to this build (app older than data), the runner returns `data.schema_newer_than_app` and the engine starts in read-only/refuse mode (OVE_ENGINE005 decides: refuse to start, tell the UI via the `incompatible` state). `PRAGMA user_version` stores the highest numeric version prefix for quick check and for external tooling.
6. Backup before migrate: if at least one pending migration exists and the database is not empty, create `db/snapshots/pre-migrate-<version>-<ts>.sqlite` using `backupTo` (consistent), mode 0600, verify with `PRAGMA quick_check` on the copy, keep the newest 5 pre-migrate backups. Failure to back up aborts the migration (fail closed). First install (empty database) skips the backup.
7. Forward only: no down migrations. A broken migration is fixed by a NEW file. Files containing `DROP TABLE`/`DROP COLUMN` need the header `-- destructive: <reason>`; the runner records `destructive=1` and logs `warn`; the extra backup is mandatory then.
8. Execution guard: migration SQL runs through the privileged `execMigration` (allows `PRAGMA user_version`, `CREATE VIRTUAL TABLE ... fts5`), still blocks `ATTACH` and `load_extension`.
9. Concurrency: runner runs only under the engine lock and on the writer connection; a second runner call in the same process returns immediately with the in-progress state.
10. Report event: after success the engine emits non-persisted event `system.migrated` with the list of versions; the UI shows nothing unless the Owner opens diagnostics.
11. Dry-run: `migrate(..., { dryRun: true })` opens an in-memory copy (`VACUUM INTO :memory:` is not available, so it uses a temp file copy) and applies pending files, used by CI (`pnpm db:check-migrations`) to prove a fresh DB and an upgrade from the previous release snapshot both reach the same schema (`sqlite_master` dump compared).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`SqliteDatabase` (DATA001), manifest from ARCH009 generator, `AtomicFileWriter` for backup metadata if needed, `Clock`, `Logger`.

## 8. Architecture and code placement

`packages/adapters/sqlite/src/core/migrations/{runner.ts,manifest.ts,checksum.ts,backup.ts,report.ts}`. Migration SQL lives in `packages/adapters/sqlite/migrations/` (owned per task via `owns` of the task that adds the table). The runner depends on `SqliteDatabase`, not on a driver.

## 9. Security and safety

Checksums detect edited or injected migrations (a tampered schema could weaken audit tables). The manifest is embedded in the signed bundle, so the files on disk are not trusted at runtime. Backups stay inside the 0700 data directory and contain no secrets (none are stored). Refusing newer schemas prevents an older build from corrupting data.

## 10. Errors and edge cases

- Two files with the same version and different task ids: both run in task id order; ARCH009 forbids duplicates of version+task.
- Crash mid-migration: transaction rolled back; next start retries; the backup already exists.
- Disk full while backing up: abort with `data.disk_full`, nothing applied.
- A migration takes longer than 60 s: logged `warn`; no timeout (SQLite is synchronous), but the engine health says `migrating`.
- Manifest empty and DB empty (tests): creates only `schema_migrations`.

## 11. Acceptance criteria

- [ ] Given an empty DB and N migrations, then all apply in order and `schema_migrations` has N+1 rows (including its own).
- [ ] Given an applied migration whose file bytes changed, then `data.migration_checksum_mismatch` and nothing runs.
- [ ] Given a DB with a version unknown to the build, then `data.schema_newer_than_app`.
- [ ] Given pending migrations on a non-empty DB, then a verified backup exists before the first one runs.
- [ ] Given a failing migration, then its changes are rolled back and later ones do not run.
- [ ] `-- destructive:` is required for DROP statements (test with and without).

## 12. Test plan

Unit: checksum normalisation, ordering, out-of-order detection. Integration with temp DB and fixture migration sets (good, failing, tampered, destructive, newer). Dry-run upgrade test uses the schema snapshot of the previous tag (fixture). Commands: `pnpm vitest run packages/adapters/sqlite/src/core/migrations`.

## 13. Parallelization notes

After DATA001. Other areas' migrations only need ARCH009 naming and can be written before this lands. The first migration file here is a hotspot only for the version string; use `V202610130001` reserved for this task.

## 14. Open questions and assumptions

- ASSUMPTION: keep 5 pre-migrate backups; BACKUP may change retention.
- ASSUMPTION: no checksum "repair" command; a mismatch requires restoring a snapshot or a new migration.
