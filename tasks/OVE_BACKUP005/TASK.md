---
id: OVE_BACKUP005
title: "Apply retention: keep 14 scheduled backups, protect manual and pre-restore ones"
area: BACKUP
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_BACKUP001, OVE_BACKUP003, OVE_ENGINE016]
soft_depends_on: []
provides: ["usecase:ApplyBackupRetention", "lib:backup-catalog-fs"]
needs: ["port:BackupCatalog", "port:AuditSink"]
owns: ["packages/application/src/backup/retention/**", "packages/adapters/backup/src/catalog/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [8]
---

# OVE_BACKUP005: Apply retention: keep 14 scheduled backups, protect manual and pre-restore ones

## 1. Summary

Keeps the folder from growing forever: removes old scheduled backups beyond the retention count while never touching manual, export or pre-restore ones.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`. ADR 0008: nothing is silently removed; deletions are audited.

## 3. Scope (in)

- File-system `BackupCatalog` implementation (scan manifests).
- Retention rule.
- Audit of removals.

## 4. Out of scope

- Creating backups: BACKUP002.

## 5. Detailed requirements

1. `BackupCatalog` reads manifests in the folder; files without a valid manifest are listed as `unknown` and never deleted.
2. Retention applies to `kind: scheduled` only: keep the newest N (setting, default 14), remove older ones (db and manifest together, manifest last). `manual`, `export` and `pre_restore` are kept; pre_restore keeps the last 3.
3. Retention runs after a successful backup only (never after a failed one, so a failing job cannot erode history).
4. Each removal writes an audit entry with record id and kind. Dry-run preview function for Settings.
5. Never removes the most recent verified backup regardless of settings.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Manifest reader (BACKUP003).

## 8. Architecture and code placement

Use case in application; catalog adapter in `packages/adapters/backup/src/catalog/`.

## 9. Security and safety

- Only files matching the strict name pattern with a valid manifest are candidates; no glob deletes.

## 10. Errors and edge cases

- N lowered from 14 to 3: next run removes the surplus, audited.
- Clock skew: ordering by manifest `createdAt`, ties by name.

## 11. Acceptance criteria

- [ ] 16 scheduled backups -> 14 remain; manual untouched.
- [ ] Unknown files untouched.
- [ ] Failed backup triggers no removal.
- [ ] Latest verified is never removed.

## 12. Test plan

Integration with temp dir: `retention.test.ts`, `catalog-fs.test.ts`. Command: `pnpm vitest run packages/application/src/backup/retention packages/adapters/backup/src/catalog`.

## 13. Parallelization notes

Parallel with BACKUP006.

## 14. Open questions and assumptions

- None.
