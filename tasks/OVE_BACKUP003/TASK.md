---
id: OVE_BACKUP003
title: "Define the backup file format, manifest and exclusions"
area: BACKUP
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH013, OVE_BACKUP001, OVE_BACKUP002]
soft_depends_on: []
provides: ["lib:backup-format", "lib:backup-manifest", "port:BackupContributor"]
needs: ["lib:backup-snapshotter", "lib:atomic-fs"]
owns: ["packages/adapters/backup/src/format/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 10]
---

# OVE_BACKUP003: Define the backup file format, manifest and exclusions

## 1. Summary

Fixes what a backup consists of, how it is named and described, and what is deliberately left out.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`.

## 3. Scope (in)

- File and manifest naming.
- Manifest schema with checksum.
- Exclusion list and its test.
- Reader that validates a backup before restore.

## 4. Out of scope

- Encryption: BACKUP010. Retention: BACKUP005.

## 5. Detailed requirements

1. Artifacts: `overmind-<YYYYMMDDTHHmmssZ>-<schemaVersion>.sqlite` and `overmind-<same>.manifest.json` (0600). Timestamp in UTC.
2. Manifest: `{ formatVersion: 1, kind, createdAt, appVersion, schemaVersion, sizeBytes, sha256, hostFingerprint (hash of machine id, to warn when restoring on another Mac) }`, zod-validated, unknown keys rejected.
3. Contents: the SQLite database only (includes the audit chain, Workspaces, memory, Runs). Excluded and asserted by a test: Keychain secrets, CLI credentials volume (ADR 0020), logs, `run/` sockets, config files with secrets, herdr state, artifact blobs larger than the database cap (artifacts are outside the database; their handling is a documented gap, see open question).
4. `readBackup(path)` verifies: manifest valid, file size and sha256 equal, `schemaVersion` not newer than the app (`backup.schema_too_new`), integrity check passes; returns a typed `VerifiedBackup`.
5. Backups never contain a secret: a test scans a snapshot for the known fixture secret strings and for Keychain labels.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Snapshotter, atomic writes.

## 8. Architecture and code placement

`packages/adapters/backup/src/format/{names.ts,manifest.ts,reader.ts,exclusions.ts}`.

## 9. Security and safety

- A backup is as sensitive as the database: 0600 files, folder rules in BACKUP004.
- `hostFingerprint` is a salted hash, never the raw id.

## 10. Errors and edge cases

- Manifest present, db missing: `manifest_invalid`.
- Hand-edited manifest: checksum mismatch.
- Older schema: allowed, migrated after restore by the normal runner.

## 11. Acceptance criteria

- [ ] Round trip write then read passes.
- [ ] Tampered db or manifest is rejected with the right error.
- [ ] No secret fixture appears in the backup (scan test).
- [ ] Newer-than-app schema is refused.

## 12. Test plan

Unit and integration: `manifest.test.ts`, `reader.test.ts`, `exclusions.test.ts`. Command: `pnpm vitest run packages/adapters/backup/src/format`.

## 13. Parallelization notes

After BACKUP002.

## 14. Open questions and assumptions

- OPEN: artifact blobs (DATA019) live outside the database. DEFAULT MVP: backup covers the database and the metadata of artifacts only; BACKUP011 documents the gap and a follow-up task can add blobs.
