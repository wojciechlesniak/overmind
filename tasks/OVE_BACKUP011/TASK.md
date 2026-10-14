---
id: OVE_BACKUP011
title: "Test backup and restore end to end and document the data it does not cover"
area: BACKUP
kind: test
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_BACKUP008, OVE_BACKUP009, OVE_ENGINE018, OVE_TEST002]
soft_depends_on: []
provides: ["lib:backup-e2e-suite"]
needs: ["lib:test-engine-harness", "lib:fake-keychain"]
owns: ["tests/integration/backup/**", "docs/operations/backup.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 20"]
adr_refs: [5]
---

# OVE_BACKUP011: Test backup and restore end to end and document the data it does not cover

## 1. Summary

Integration suite for the full cycle and a short operations document explaining what a backup contains and what it does not.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`.

## 3. Scope (in)

- Scenarios below.
- Operations doc.

## 4. Out of scope

- Unit tests inside each task.

## 5. Detailed requirements

1. Scenarios: scheduled backup on a fake clock; catch-up after sleep; retention; failure then notification; folder changes (approval, rejection cases); export; restore happy path with all required sanitisers (paused after boot, Telegram unpaired, pending approvals expired); restore fault injection; newer-schema refusal.
2. Concurrency: backup during heavy writes yields a restorable database (restore it and run `integrity_check` plus audit chain verification).
3. Secrets sweep over backup files, manifests, logs and audit with `expectNoSecrets`.
4. `docs/operations/backup.md` (English): what is included (database), excluded (Keychain secrets, CLI credentials, logs, artifact blobs until covered), where files live, how to restore manually, cloud-sync warning. Cascade note: BACKUP owns only installation-level tables or none, so it ships no WorkspaceCascadeParticipant (DATA012 test lists this exemption).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Harness, fakes from every area.

## 8. Architecture and code placement

`tests/integration/backup/*.test.ts`; one Markdown file.

## 9. Security and safety

- The suite proves restores cannot revive old approvals or pairings.

## 10. Errors and edge cases

- Fake clock only; temp dirs removed after each test.

## 11. Acceptance criteria

- [ ] Suite passes in CI under 90 seconds.
- [ ] Doc exists and lists exclusions matching BACKUP003's test.

## 12. Test plan

Command: `pnpm vitest run tests/integration/backup`.

## 13. Parallelization notes

Last task of the area.

## 14. Open questions and assumptions

- None.
