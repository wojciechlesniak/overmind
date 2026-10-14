---
id: OVE_BACKUP001
title: "Define the backup contracts: BackupRecord, status, settings, events and errors"
area: BACKUP
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH005, OVE_ARCH007, OVE_ARCH010]
soft_depends_on: []
provides: ["contract:BackupRecord", "contract:BackupSettings", "contract:BackupStatus", "event:backup.completed", "event:backup.failed", "lib:backup-errors", "port:BackupCatalog", "port:BackupJobRunner"]
needs: ["contract:AppConfig", "contract:EntityId"]
owns: ["packages/contracts/src/backup/**", "packages/contracts/src/errors/backup.errors.ts", "packages/application/src/ports/BackupCatalog.ts", "packages/application/src/ports/BackupJobRunner.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 10]
---

# OVE_BACKUP001: Define the backup contracts: BackupRecord, status, settings, events and errors

## 1. Summary

Shared shapes for the backup area: what a backup is, what Settings shows, the events and errors, and the two ports that separate the job from its storage.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`. Settings row shows 'Ostatnia kopia: dziś 03:00 · 48 MB · OK'.

## 3. Scope (in)

- Zod schemas and types.
- Errors `backup.*`.
- Events `backup.completed`, `backup.failed`.
- Ports `BackupCatalog` and `BackupJobRunner`.

## 4. Out of scope

- Implementations: BACKUP002-BACKUP008. Routes: BACKUP009.

## 5. Detailed requirements

1. `BackupRecord = { id, kind: 'scheduled'|'manual'|'pre_restore'|'export', createdAt, sizeBytes, schemaVersion: string, appVersion: string, sha256: string, fileName: string, verified: boolean }`. File names never contain user text.
2. `BackupSettings = { enabled: boolean, time: 'HH:MM', retentionCount: 1..60 (default 14), folder?: { displayPath: string, status: 'ok'|'missing'|'not_writable'|'inside_data_dir'|'cloud_synced_warning' } }`. Absolute paths are shown to the Owner only; never to agents.
3. `BackupStatus = { lastSuccess?: { at, sizeBytes, kind }, lastFailure?: { at, code }, running: boolean, nextRunAt?: IsoDateTime, restorePending: boolean }`.
4. Errors: `folder_missing`, `folder_not_writable`, `folder_inside_data_dir`, `disk_full`, `snapshot_failed`, `integrity_failed`, `already_running`, `backup_not_found`, `manifest_invalid`, `schema_too_new`, `checksum_mismatch`, `restore_refused` (each with message key `errors:backup.<code>`).
5. `backup.failed` payload `{ code, kind }` only, no path; `visibleTo: ['owner']`, audit true. `backup.completed` payload `{ recordId, kind, sizeBytes }`.
6. `BackupCatalog`: `list()`, `get(id)`, `add(record)`, `remove(id)`, `latest()`. `BackupJobRunner`: `run(kind): Promise<Result<BackupRecord>>` (single-flight).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `defineErrors`, `defineEvent`, `EntityId` (ARCH).

## 8. Architecture and code placement

`packages/contracts/src/backup/{record.ts,settings.ts,status.ts,index.ts}`; ports in application ports. New files only.

## 9. Security and safety

- No schema carries paths of agent-visible directories or secrets.
- `displayPath` is a read-model field restricted to the Owner.

## 10. Errors and edge cases

- Retention bounds validated (1..60).
- `time` validated as 00:00-23:59.

## 11. Acceptance criteria

- [ ] Schemas strict with fixtures.
- [ ] Error and event catalogue tests pass.
- [ ] Ports compile with stubs.

## 12. Test plan

Unit: `backup-schemas.test.ts`. Command: `pnpm vitest run packages/contracts/src/backup`.

## 13. Parallelization notes

First task of the area; all others follow.

## 14. Open questions and assumptions

- ASSUMPTION: retention counts files (14 scheduled), not days, because ARCH005 names it `retentionDays` but daily cadence makes them equal; BACKUP005 maps the key.
