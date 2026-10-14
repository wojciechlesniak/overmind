---
id: OVE_BACKUP004
title: "Enforce the backup folder policy: validation, permissions and cloud-sync warning"
area: BACKUP
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_BACKUP001, OVE_ENGINE016, OVE_PERM031]
soft_depends_on: ["OVE_PERM031"]
provides: ["usecase:SetBackupFolder", "usecase:ValidateBackupFolder", "port:BackupFolderGuard"]
needs: ["port:ConfigStore", "port:LocalApprovalGate", "port:AllowedDirectoryReader", "port:AuditSink", "lib:data-dir"]
owns: ["packages/application/src/backup/folder/**", "packages/adapters/backup/src/folder/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [3, 10, 21]
---

# OVE_BACKUP004: Enforce the backup folder policy: validation, permissions and cloud-sync warning

## 1. Summary

Rules for where backups may be written: an installation-level directory chosen by the Owner, never visible to agents, never inside the data directory, with safe permissions.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`. Changing the folder is an Owner operation protected by Local Approval (PERM031).

## 3. Scope (in)

- Validation of a candidate folder.
- `SetBackupFolder` use case with Local Approval.
- Startup sweep of leftover temp files.
- Warning when the folder looks cloud-synced.

## 4. Out of scope

- Writing backups: BACKUP002. UI: SETUI.

## 5. Detailed requirements

1. Default folder: `~/Documents/Overmind Backups` created 0700 on first use after the Owner confirms in Settings; before confirmation backups go to `dataDir/backups/` (0700).
2. A candidate is rejected when: not absolute, a symlink, not a directory, not writable (probe file created and removed), inside `dataDir`, inside any Workspace Allowed Directory (`folder_inside_data_dir` / `restore_refused`-class error `backup.folder_not_writable` as appropriate), or the filesystem root or home directory itself.
3. The folder is registered as an installation-level Allowed Directory with purpose `backup` through the PERM reader/registry port so that the sandbox mounts never expose it to agents; agents' path checks treat it as denied (a test through the permission evaluator when PERM provides it).
4. Cloud-sync heuristic: path under `~/Library/Mobile Documents`, `~/Dropbox`, `~/Library/CloudStorage`, `~/OneDrive*`, `~/Google Drive*` yields status `cloud_synced_warning`: allowed, but the Owner sees a warning that backups leave the Mac (database content in the cloud).
5. `SetBackupFolder` requires a Local Approval bound to action `backup.change-folder` and the new path; writes `backups/backup-target.json` atomically (0600) and an audit entry (old and new path).
6. On every start remove stale `.tmp-*` files older than 1 hour in the folder; permissions of existing backup files are repaired to 0600 and logged.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `LocalApprovalGate`, `AllowedDirectoryReader` (PERM031), `ConfigStore`, atomic write (ARCH013).

## 8. Architecture and code placement

Use cases in `packages/application/src/backup/folder/`, path checks in `packages/adapters/backup/src/folder/`.

## 9. Security and safety

- Agents never see or reach the backup folder: it is outside every mount and denied by the evaluator.
- Folder change cannot be triggered by an agent or Telegram (desktop principal and Local Approval).
- Path normalisation resolves `..` and symlinks before checks (reuse PERM002 normaliser).

## 10. Errors and edge cases

- Folder on an unmounted external drive: status `missing`, scheduled run reports `backup.folder_missing` and notifies.
- Folder renamed by the Owner: same as missing.
- Network volume: allowed with no extra check.

## 11. Acceptance criteria

- [ ] Each rejection case has a test.
- [ ] Change without Local Approval is refused.
- [ ] Cloud path yields the warning status.
- [ ] Backup folder is denied to an agent path check.
- [ ] Stale temp files are removed at start.

## 12. Test plan

Integration with temp dirs and fake gate: `folder-validate.test.ts`, `set-folder-approval.test.ts`, `folder-sweep.test.ts`. Command: `pnpm vitest run packages/application/src/backup/folder packages/adapters/backup/src/folder`.

## 13. Parallelization notes

Parallel with BACKUP002.

## 14. Open questions and assumptions

- OPEN: Should the default be outside Documents to avoid iCloud Desktop and Documents sync? DEFAULT `~/Documents/Overmind Backups` with the cloud warning if iCloud Documents is detected.
