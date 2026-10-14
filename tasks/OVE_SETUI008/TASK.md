---
id: OVE_SETUI008
title: "Backup actions: back up now, export the database and restore from a backup"
area: SETUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BACKUP009, OVE_DS013, OVE_DS024, OVE_DS036, OVE_DS074, OVE_SETUI007, OVE_WSPACE014]
soft_depends_on: []
provides: []
needs: ["ui:Button", "ui:Dialog", "ui:ConfirmDialog", "ui:FolderPicker", "ui:Checkbox", "lib:use-backup", "lib:use-local-approval", "api:backup.run", "api:backup.export", "api:backup.list", "api:backup.restore"]
owns: ["apps/desktop/src/features/app-settings/components/backup-actions/**", "apps/desktop/src/features/app-settings/components/backup/BackupListDialog.tsx", "apps/desktop/src/features/app-settings/components/backup/RestoreWarningDialog.tsx", "apps/desktop/src/features/app-settings/components/backup/ExportDialog.tsx", "apps/desktop/src/features/app-settings/model/restore-eligibility.ts"]
reads: []
design: design.png
design_source: "Ustawienia#settings/backup-actions (crop 766,365,646,80 CSS px)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [3, 5]
---

# OVE_SETUI008: Backup actions: back up now, export the database and restore from a backup

## 1. Summary

Implements the three action buttons of the backup card: 'Zrob kopie teraz' (run now), 'Eksportuj baze...' (export to a user-chosen location, Local Approval) and 'Przywroc z kopii...' (choose a backup, strong warning, Local Approval, engine restart into a paused state).

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. BACKUP007: `POST /v1/backup/run` (desktop-only, returns the started job; 409 `already_running`); `POST /v1/backup/export {destination}` needs Local Approval `backup.export`, destination chosen in the native dialog; BACKUP008: `GET /v1/backup/list` -> `BackupRecord[] {id, createdAt, sizeBytes, appVersion, schemaVersion, ok}`; `POST /v1/backup/restore {backupId}` needs Local Approval `backup.restore`: the engine makes a pre-restore safety copy, restarts and boots PAUSED with the banner 'Przywrocono kopie' (OVE_PAUSE banner host). Errors: `backup_not_found`, `manifest_invalid`, `schema_too_new`, `checksum_mismatch`, `restore_refused`, `already_running`.

## 3. Scope (in)

- `components/backup-actions/RunNow.action.tsx`, `Export.action.tsx`, `Restore.action.tsx` (glob slots of OVE_SETUI007).
- `components/backup/BackupListDialog.tsx`, `RestoreWarningDialog.tsx`, `ExportDialog.tsx`.
- `model/restore-eligibility.ts` (schema/app-version compare, pure).

## 4. Out of scope

- The section rows (OVE_SETUI007); the engine restart and paused boot (BACKUP008, SHELL banner).

## 5. Detailed requirements

1. Run now: secondary button; disabled while `status.running` (visible text 'Backup in progress...'); click -> `POST /backup/run`; shows a spinner then the last-backup row updates through push; failure toast with the error key. Not available from Telegram (desktop-only).
2. Export: click -> native save dialog (`ui:FolderPicker` in save mode, bridge FileDialog) -> `useLocalApproval().run({operation:'backup.export', args:{ destination }, ...})` with describer 'Copy the whole Overmind database to <path>? The copy is not encrypted by Overmind.' -> success toast with the file name; failure keys `disk_full`, `folder_not_writable`.
3. Restore: click -> `BackupListDialog` listing records (date/time, size, app version, ok badge; newest first; incompatible `schema_too_new` rows disabled with reason 'Created by a newer Overmind') -> choose one -> `RestoreWarningDialog` (danger style): 'Restoring replaces ALL current data: Decisions, Board, Agent memory and Workspaces created after <date> will be lost. A safety copy of the current state is made first. Overmind restarts and stays paused until you resume.' plus a required checkbox 'I understand' -> Local Approval `backup.restore {backupId}` -> request -> full-screen 'Restarting...' overlay until the engine reconnects (reuses shell reconnect UI if available) -> the paused banner is shown by the shell.
4. Run now / Restore are blocked with a visible reason while a Run is active? Restore: engine refuses `restore_refused` when Runs are active: dialog shows 'Stop active Runs first'; the UI also pre-checks active Runs via `api:runs.list` if available (best effort, engine is authoritative).
5. All three buttons use `ui:Button` secondary size sm with trailing ellipsis labels as in the mock; focus order left to right.
6. List dialog fetches `GET /backup/list` on open (no stale cache); empty list -> 'No backups yet'.

## 6. Design notes

`design.png`: action row 80px high with three secondary pill buttons left aligned, 12px gap; labels 'Zrob kopie teraz', 'Eksportuj baze...', 'Przywroc z kopii...'. Dialogs derived from `ui:Dialog`/`ConfirmDialog` danger variant.

## 7. Reuse

- `ui:Button`, `ui:Dialog`, `ui:ConfirmDialog`, `ui:FolderPicker`, `ui:Checkbox`, `ui:Skeleton`, `lib:use-backup` (OVE_SETUI007), `lib:use-local-approval`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific (critical): export moves the whole database out of the app and restore replaces it; both need Local Approval bound to the exact `destination`/`backupId` and are impossible from Telegram, Chief and Agents. The destination is a native-dialog handle, never typed text. Restore never auto-resumes work (the app boots paused, BACKUP008) so a restored old state cannot start Agents unseen. A backup record the engine marks not ok is not offered for restore. The pre-restore safety copy is created by the engine, not skippable from the UI.

## 10. Errors and edge cases

- Backup already running: `already_running` -> info toast.
- Restore of a backup from a newer schema: disabled row.
- Engine fails mid-restore: engine rolls back to the safety copy; UI after reconnect shows the engine's `restore.failed` event.
- Connection lost after the restore request: the overlay waits up to 60 s then offers 'Reload'.
- Local Approval expires between choosing and confirming: re-ask.
- Export destination on same volume as data dir: allowed; on a cloud folder: warn like OVE_SETUI007.

## 11. Acceptance criteria

- [ ] Given Run now, Then one request is sent and the last-backup row updates after completion.
- [ ] Given Export, Then a Local Approval is requested and the request carries `localProof` and the destination handle.
- [ ] Given the restore dialog, Then a backup with a newer schema is disabled with the reason.
- [ ] Given restore confirmed with the checkbox, Then a Local Approval for `backup.restore` is requested before the call and the UI shows the restarting overlay.
- [ ] Given Cancel at any step, Then no request is sent.
- [ ] Given no Local Approval, Then restore/export calls are never made (test).

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `restore-eligibility.test.ts`, action component tests per button, `RestoreWarningDialog.test.tsx` (checkbox gating), `backup-actions.security.test.ts` (no call without proof; handle-only destination), Playwright `backup-restore.e2e.ts` with mock engine restart. Commands: `pnpm --filter @overmind/desktop test features/app-settings/backup-actions, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/backup-actions/**`, `apps/desktop/src/features/app-settings/components/backup/BackupListDialog.tsx`, `apps/desktop/src/features/app-settings/components/backup/RestoreWarningDialog.tsx`, `apps/desktop/src/features/app-settings/components/backup/ExportDialog.tsx`, `apps/desktop/src/features/app-settings/model/restore-eligibility.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: `api:runs.list` has no owner; the active-Run pre-check is best effort.
- OPEN: restore from an arbitrary .zip file (import) is not in the mock; only listed backups are restorable (assumption).
- GAP: `localProof` not declared in BACKUP007/008 route contracts.
