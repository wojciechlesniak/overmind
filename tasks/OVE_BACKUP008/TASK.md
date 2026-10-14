---
id: OVE_BACKUP008
title: "Restore from a backup with staging, a safety copy and sanitising steps"
area: BACKUP
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH013, OVE_BACKUP003, OVE_BACKUP004, OVE_BACKUP006, OVE_DATA003, OVE_DATA020, OVE_PERM031]
soft_depends_on: ["OVE_PERM031"]
provides: ["usecase:RequestRestore", "lib:restore-boot-step", "port:RestoreSanitizerStep", "port:RestoreSanitizerStepRegistry"]
needs: ["port:DatabaseLifecycle", "port:LocalApprovalGate", "lib:atomic-fs", "lib:migration-runner"]
owns: ["packages/application/src/backup/restore/**", "packages/adapters/backup/src/restore/**", "apps/engine/src/composition/modules/backup.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [3, 5, 10]
---

# OVE_BACKUP008: Restore from a backup with staging, a safety copy and sanitising steps

## 1. Summary

Restore is two-phase: the Owner requests it (with Local Approval), the engine restarts and swaps the database at boot before anything else opens it, after taking a safety copy and then running sanitising steps registered by other areas.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`. The database cannot be replaced while open, hence the marker file and boot-time swap. An old snapshot may contain approvals, pairings and unpaused state that must not come back to life.

## 3. Scope (in)

- `RequestRestore` use case writing `restore-pending.json`.
- Boot step that performs the swap.
- Pre-restore safety copy.
- `RestoreSanitizerStep` multi-token and its runner.
- Module wiring for the area.

## 4. Out of scope

- Step implementations by other areas: PAUSE008, TG015, PERM (approvals). UI: SETUI.

## 5. Detailed requirements

1. `RequestRestore(backupId)`: desktop principal, Local Approval bound to action `backup.restore` and the record id; re-verifies the backup (BACKUP003 reader); writes `dataDir/restore-pending.json` `{ backupId, path, sha256, requestedAt }` atomically (0600); asks the shell to restart the engine. Nothing else changes yet.
2. **Boot step** (runs before the database opens, first in the composition order): reads the marker; re-verifies the file and checksum; takes a pre-restore safety copy of the current database (kind `pre_restore`, verified); moves the live DB and WAL aside to `db/replaced-<ts>/`; copies the backup into place; deletes the marker; continues normal boot where the migration runner brings the schema forward (older backup) or refuses (newer, `schema_too_new`, then the previous DB is put back).
3. Failure at any point before the final rename restores the original database and logs `backup.restore_refused`; the marker is moved to `restore-failed.json` so boot does not loop. Test with fault injection at each step.
4. **Sanitising steps:** after migrations and before services start, run every registered `RestoreSanitizerStep` (multi-token `multiToken('port:RestoreSanitizerStep')`, ordered, each idempotent, failures abort the restore into the revert path). Required steps, owned elsewhere: expire all pending approvals (PERM/APPR), revoke Telegram pairing (TG015), start globally paused (PAUSE008), mark Runs that were in flight as `interrupted` (WFRT), invalidate agent session tokens. This task ships the runner and a `lib:fake-sanitizer-step`; a boot test fails if fewer than the required step ids are registered in the full composition (list in one file).
5. Audit: a restore writes `backup.restored` with record id and counts into the NEW database's audit chain, and keeps the old chain file in `replaced-<ts>/`.
6. The Owner sees after boot: Overmind is paused with the banner reason 'Przywrócono kopię' and must press Resume (PAUSE design).
7. Replaced databases are kept 7 days then removed by the retention sweep (audited).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Reader (BACKUP003), migration runner, `LocalApprovalGate`, atomic fs.

## 8. Architecture and code placement

Use case in application; the boot step and swap in `packages/adapters/backup/src/restore/`; the module file registers the step first and exposes the registry.

## 9. Security and safety

- Restore is destructive: Local Approval is mandatory, desktop only; agents and Telegram can never request it.
- The sanitisers prevent a stale snapshot from reviving permissions, pairings or running state.
- The pre-restore safety copy makes the operation reversible.

## 10. Errors and edge cases

- Backup from another Mac (hostFingerprint differs): warning shown in the request response; allowed.
- Power loss during swap: next boot sees the marker and `db/replaced-<ts>/` and completes or reverts deterministically (state machine in a doc comment).
- Restore of the same backup twice: allowed.

## 11. Acceptance criteria

- [ ] Happy path swaps DB and runs all registered steps in order.
- [ ] Fault injection at each step leaves the original DB intact.
- [ ] Newer-schema backup is refused and the original stays.
- [ ] Boot test fails if a required sanitiser id is missing.
- [ ] Restore without Local Approval is refused.

## 12. Test plan

Integration with real SQLite and temp dirs: `restore-happy.test.ts`, `restore-fault-injection.test.ts`, `restore-sanitizers.test.ts`, `restore-required-steps.test.ts`. Command: `pnpm vitest run packages/application/src/backup/restore packages/adapters/backup/src/restore`.

## 13. Parallelization notes

After BACKUP006; parallel with BACKUP007 and BACKUP009.

## 14. Open questions and assumptions

- OPEN: restart mechanism (shell relaunch vs launchd KeepAlive) is owned by ENGINE/SHELL; DEFAULT the engine exits with code 75 and the supervisor restarts it.
