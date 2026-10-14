---
id: OVE_BACKUP010
title: "Decide whether backups are encrypted and how the key is kept"
area: BACKUP
kind: decision
size: S
priority: P2
mvp: false
status: todo
depends_on: [OVE_ARCH012, OVE_BACKUP003]
soft_depends_on: []
provides: ["doc:backup-encryption-decision"]
needs: ["port:Keychain"]
owns: ["docs/decisions/backup-encryption.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [10]
---

# OVE_BACKUP010: Decide whether backups are encrypted and how the key is kept

## 1. Summary

Writes a short decision record: plain 0600 files (MVP default) versus encryption with a key in the Keychain or a passphrase, including what an attacker with the folder obtains.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`. Backups hold the whole organisation history. They sit in a folder possibly synced to a cloud (BACKUP004 warning).

## 3. Scope (in)

- Options, threat analysis, recommendation.
- Impact on restore and on moving to another Mac.

## 4. Out of scope

- Implementation (a follow-up task if the decision is yes).

## 5. Detailed requirements

1. Compare: (a) none, rely on FileVault and 0600; (b) AES-256-GCM with a random key in the Keychain (lost key = lost backups, no cross-Mac restore); (c) Owner passphrase with a memory-hard KDF (restore anywhere, passphrase loss = data loss).
2. State the recommendation and the migration path for the manifest (`formatVersion` 2 with `encryption` block).
3. Ask for an ADR number from the Owner via the decision flow; do not edit ADRs directly.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Threat notes from SEC area.

## 8. Architecture and code placement

One Markdown file under `docs/decisions/`.

## 9. Security and safety

- The record must say plainly what an attacker gets under each option.

## 10. Errors and edge cases

- None.

## 11. Acceptance criteria

- [ ] File exists with the three options, recommendation and impact on restore.
- [ ] Owner decision recorded or marked pending.

## 12. Test plan

Review only; markdown link check in CI.

## 13. Parallelization notes

Independent after BACKUP003.

## 14. Open questions and assumptions

- DEFAULT recommendation: ship MVP plain (a), offer passphrase (c) in a later release.
