---
id: OVE_BACKUP009
title: "Expose backup routes and the Settings data contract"
area: BACKUP
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_BACKUP004, OVE_BACKUP005, OVE_BACKUP007, OVE_BACKUP008, OVE_ENGINE011, OVE_ENGINE017, OVE_ENGINE019]
soft_depends_on: []
provides: ["api:backup.status", "api:backup.list", "api:backup.run", "api:backup.settings", "api:backup.folder", "api:backup.restore", "api:backup.export", "lib:api-client-backup"]
needs: ["lib:gateway-principal", "lib:gateway-push", "lib:api-client", "port:ConfigStore"]
owns: ["apps/engine/src/gateway/routes/backup.routes.ts", "packages/api-client/src/backup/**", "packages/application/src/backup/queries/**", "packages/i18n/src/locales/en/backup.json", "packages/i18n/src/locales/pl/backup.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [10, 17]
---

# OVE_BACKUP009: Expose backup routes and the Settings data contract

## 1. Summary

The API the Settings screen needs for the 'Kopie zapasowe' block: status line, list, run now, settings, folder change, export, restore, plus EN and PL strings.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`. Mock line: 'Ostatnia kopia: dziś 03:00 · 48 MB · OK'.

## 3. Scope (in)

- Routes `/v1/backup/*` and push topic `backup.status`.
- `GetBackupStatus` and `ListBackups` queries.
- Settings update (enabled, time, retention).
- api-client and i18n.

## 4. Out of scope

- The Settings UI: SETUI.

## 5. Detailed requirements

1. Routes: `GET /v1/backup/status`, `GET /v1/backup`, `POST /v1/backup/run`, `PUT /v1/backup/settings`, `POST /v1/backup/folder`, `POST /v1/backup/export`, `POST /v1/backup/restore`, `POST /v1/backup/validate-folder`. All desktop principal only.
2. Status read model includes a pre-formatted summary object `{ lastAt, sizeBytes, ok }` so the UI renders 'dziś 03:00 · 48 MB · OK' via the Translator and relative-time formatter; failure shows the error code with a link to the fix (folder missing -> choose folder).
3. Settings updates validate time and retention (BACKUP001) and write through `ConfigStore`; scheduler reacts via event.
4. Strings in `backup` namespace: status line, failure texts, folder warnings (cloud), restore confirmation text (warns that current data is replaced and a safety copy is made), EN and PL.
5. Push topic `backup.status` on start, completion, failure.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Route module pattern, api-client generator.

## 8. Architecture and code placement

Routes in gateway routes folder; queries in application; api-client typed functions.

## 9. Security and safety

- Every route desktop-only; agent or Telegram principals receive `permission.denied`.
- Paths appear only in Owner read models.

## 10. Errors and edge cases

- Backup running: `POST /run` returns 409 `already_running`.
- Restore with missing backup id: `backup_not_found`.

## 11. Acceptance criteria

- [ ] Each route works with fakes and rejects non-desktop principals.
- [ ] Status shows last success line data after a run.
- [ ] EN and PL keys complete (i18n test).

## 12. Test plan

Integration: `backup-routes.test.ts`, `backup-principal.test.ts`, `backup-i18n.test.ts`. Command: `pnpm vitest run apps/engine/src/gateway/routes/backup.routes.test.ts`.

## 13. Parallelization notes

Parallel with BACKUP007 and BACKUP008 once their use cases exist.

## 14. Open questions and assumptions

- None.
