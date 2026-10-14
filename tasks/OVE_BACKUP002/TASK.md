---
id: OVE_BACKUP002
title: "Create consistent SQLite snapshots with the backup API and verify integrity"
area: BACKUP
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH013, OVE_BACKUP001, OVE_DATA001]
soft_depends_on: []
provides: ["lib:backup-snapshotter"]
needs: ["port:SqliteDatabase", "lib:atomic-fs", "port:Clock"]
owns: ["packages/adapters/backup/src/snapshot/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5]
---

# OVE_BACKUP002: Create consistent SQLite snapshots with the backup API and verify integrity

## 1. Summary

Produces a point-in-time copy of the live database without stopping the engine, then proves it opens and passes `integrity_check`.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`.

## 3. Scope (in)

- Snapshot into a temporary file in the destination directory.
- Integrity and schema checks on the copy.
- Atomic publish by rename.

## 4. Out of scope

- Manifest and file naming: BACKUP003. Folder policy: BACKUP004.

## 5. Detailed requirements

1. Use `SqliteDatabase.backupTo(tmp)` (SQLite online backup API / `VACUUM INTO`); never copy the `.sqlite` file while the engine writes (WAL would be inconsistent).
2. Temp name `.tmp-<random>` in the destination (same filesystem), mode 0600; fsync; open the copy read-only; run `PRAGMA integrity_check` (must return `ok`) and read `schema_migrations` max version.
3. On any failure delete the temp file and return `backup.snapshot_failed` or `backup.integrity_failed`; never leave a half-written final file.
4. Compute sha256 while streaming the finished file; return `{ path, sizeBytes, sha256, schemaVersion }`.
5. Disk space check before start: free space at least 2x database size, else `backup.disk_full`.
6. Runs on the engine's maintenance worker or yields between page batches so the UI and Runs are not blocked more than 100 ms; documented measurement on a 500 MB database.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `backupTo` (DATA001), `AtomicFileWriter` rename helpers (ARCH013).

## 8. Architecture and code placement

`packages/adapters/backup/src/snapshot/{snapshotter.ts,verify.ts,hash.ts}`; depends on ports only.

## 9. Security and safety

- Snapshot file mode 0600; temp file in the destination, never world readable.
- The copy is read-only opened for verification; no SQL from the copy is executed beyond pragmas.

## 10. Errors and edge cases

- Engine writes during snapshot: consistent by API.
- Destination on a different filesystem: temp is created there, so the rename stays atomic.
- Cancelled by shutdown: temp deleted on next start (BACKUP004 sweep).

## 11. Acceptance criteria

- [ ] Snapshot of a database under concurrent writes passes `integrity_check`.
- [ ] Corrupted copy (test injection) returns `integrity_failed` and leaves no file.
- [ ] Disk-full simulation returns `disk_full`.
- [ ] sha256 matches an independent hash.

## 12. Test plan

Integration with real SQLite in temp dirs: `snapshot.test.ts`, `snapshot-concurrent.test.ts`, `snapshot-failure.test.ts`. Command: `pnpm vitest run packages/adapters/backup/src/snapshot`.

## 13. Parallelization notes

Parallel with BACKUP003 and BACKUP004.

## 14. Open questions and assumptions

- ASSUMPTION: no compression in MVP (SQLite files are fine to store as is).
