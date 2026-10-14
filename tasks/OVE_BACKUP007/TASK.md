---
id: OVE_BACKUP007
title: "Run backup now, export a copy and notify the Owner about failures"
area: BACKUP
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BACKUP006, OVE_ENGINE011, OVE_ENGINE016, OVE_NOTIF004, OVE_PERM031]
soft_depends_on: ["OVE_NOTIF005"]
provides: ["usecase:RunBackupNow", "usecase:ExportBackup", "lib:backup-failure-notifier"]
needs: ["usecase:CreateNotification", "lib:gateway-principal", "port:AuditSink", "port:LocalApprovalGate"]
owns: ["packages/application/src/backup/manual/**", "packages/application/src/backup/notify/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [10]
---

# OVE_BACKUP007: Run backup now, export a copy and notify the Owner about failures

## 1. Summary

Owner-triggered backups and exports, and the notification when any backup fails (kind `backup_failed`).

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`.

## 3. Scope (in)

- `RunBackupNow` (kind manual).
- `ExportBackup` to a path the Owner picks.
- Failure notification.

## 4. Out of scope

- Routes: BACKUP009.

## 5. Detailed requirements

1. `RunBackupNow`: desktop principal only; returns the `BackupRecord` or the typed error.
2. `ExportBackup(destFolder)`: copies the latest verified backup (or creates a fresh one) to a folder chosen in a native dialog; requires Local Approval with action `backup.export` because the file contains everything; result kind `export`; the destination is not recorded as the backup folder.
3. Failure notifier subscribes to `backup.failed` and creates a notification kind `backup_failed` (critical enough for a banner, not for sound) with deduplication per day and error code; text via i18n `backup:failure.*` (added in BACKUP009).
4. Audit entries for manual and export operations.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Runner (BACKUP006), NOTIF `CreateNotification`, `LocalApprovalGate`.

## 8. Architecture and code placement

`packages/application/src/backup/{manual,notify}/`.

## 9. Security and safety

- Telegram and agents cannot trigger export or backup now (principal check).
- Export destination validated like BACKUP004 except it may be anywhere writable the Owner chooses.

## 10. Errors and edge cases

- Export while a scheduled run is active: waits for it and reuses its output.
- Destination equals the backup folder: allowed, becomes a plain copy.

## 11. Acceptance criteria

- [ ] Manual run produces a record of kind manual.
- [ ] Export asks for Local Approval; without it nothing is written.
- [ ] Failure creates exactly one notification per day per code.

## 12. Test plan

Unit with fakes: `run-now.test.ts`, `export.test.ts`, `failure-notifier.test.ts`. Command: `pnpm vitest run packages/application/src/backup/manual packages/application/src/backup/notify`.

## 13. Parallelization notes

Parallel with BACKUP008.

## 14. Open questions and assumptions

- None.
