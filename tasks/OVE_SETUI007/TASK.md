---
id: OVE_SETUI007
title: "Backup section: folder, daily schedule and last backup status"
area: SETUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BACKUP001, OVE_BACKUP009, OVE_DS023, OVE_DS030, OVE_DS040, OVE_DS074, OVE_DS078, OVE_DS080, OVE_SETUI001, OVE_WSPACE014]
soft_depends_on: []
provides: ["lib:use-backup"]
needs: ["ui:SettingsSection", "ui:SettingRow", "ui:FolderPicker", "ui:Select", "ui:Switch", "ui:NumberStepper", "ui:InfoNote", "lib:use-local-approval", "api:backup.status", "api:backup.settings", "api:backup.folder", "lib:backup-errors", "event:backup.completed", "event:backup.failed"]
owns: ["apps/desktop/src/features/app-settings/components/sections/Backup.section.tsx", "apps/desktop/src/features/app-settings/components/backup/**", "apps/desktop/src/features/app-settings/api/useBackup.ts", "apps/desktop/src/features/app-settings/model/backup-view.ts"]
reads: []
design: design.png
design_source: "Ustawienia#settings/backup (crop 766,183,646,259 CSS px)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [3, 5]
---

# OVE_SETUI007: Backup section: folder, daily schedule and last backup status

## 1. Summary

Implements the 'Kopia zapasowa' card rows: backup folder (change via native picker and Local Approval), daily time with enable switch, retention and the last backup status line with failure states.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. Mock copy: 'Folder kopii' `~/Backups/overmind` (mono), 'Codziennie o' `03:00` (time select), 'Ostatnia kopia' `dzis 03:00 · 48 MB · OK` (mono, green). BACKUP001 shapes: `BackupSettings {enabled, time:'HH:MM', retentionCount, folder:{displayPath, status:'ok'|'missing'|'not_writable'|'cloud_synced_warning'|'inside_data_dir'}}`; `BackupStatus {lastAt, sizeBytes, ok, summary, running, nextAt}`. BACKUP004: `PUT /v1/backup/folder {rootId|path}` requires Local Approval (`backup.change-folder`; PERM031 names it `backup.folder.change`) and rejects symlinks, non-writable paths, the data dir, any Workspace Allowed Directory, the filesystem root and the home dir; cloud-synced folders return status `cloud_synced_warning`. Error codes in `lib:backup-errors`.

## 3. Scope (in)

- `components/sections/Backup.section.tsx` (id `backup`, right, order 10) hosting the rows and the actions slot.
- `components/backup/FolderRow.tsx`, `ScheduleRow.tsx`, `LastBackupRow.tsx`.
- `api/useBackup.ts` (`status`, `settings`, `list` queries, `updateSettings`, `changeFolder` mutations; push refresh on `backup.completed|failed`).
- `model/backup-view.ts` (pure: status -> text/tone, bytes formatting, folder status -> warning).
- i18n keys `backup.*`.

## 4. Out of scope

- Run now / export / restore buttons (OVE_SETUI008, inserted through the actions slot `components/backup-actions/*.action.tsx`).

## 5. Detailed requirements

1. Folder row: label 'Backup folder', value = `folder.displayPath` in mono (home-relative, never the real absolute path of other users), right button 'Change...' (secondary small). Status chips under the value for `missing`, `not_writable`, `inside_data_dir` (error) and `cloud_synced_warning` (amber: 'This folder syncs to the cloud. Your database copy will leave this Mac.').
2. Change flow: native folder dialog through `ui:FolderPicker` (bridge FileDialog, returns a root handle/`rootId`, ENGINE022) -> `useLocalApproval().run({operation:'backup.folder.change', args:{ rootId }, call:(proof,args)=> changeFolder({...args, localProof: proof})})`; the approval describer text: 'Store backups in <displayPath>? Backups contain all Decisions and Agent memory.' The returned `displayPath` replaces the old one. Errors map via `lib:backup-errors`: `folder_not_writable`, `folder_inside_data_dir`, 'inside an Allowed Directory' (`backup.folder_in_workspace`), `folder_missing`.
3. Schedule row: `ui:Switch` 'Daily backup' + time select (`03:00` default) with 15-minute steps (00:00-23:45); changing sends `PATCH settings {enabled?, time?}` (no proof: schedule is not widening). Row label 'Daily at' per mock; when disabled the time select is inactive with 'Off'.
4. Retention row (derived): 'Keep last N backups' `ui:NumberStepper` 1..60 default per engine (`retentionCount`); help 'Older backups are deleted automatically.'. Writes `retentionCount` through the same PATCH. NOTE config has `retentionDays` while BACKUP uses `retentionCount` (conflict, section 14).
5. Last backup row: text `today 03:00 · 48 MB · OK` built by `backup-view.ts` from `lastAt` (relative day + HH:MM), `sizeBytes` (MB/GB, one decimal), `ok`; failure -> red 'failed · <reason key>' with a 'Details' disclosure listing the error code (`snapshot_failed`, `disk_full`, `integrity_failed`); running -> 'in progress...'; none -> 'No backup yet'; next run line 'Next: tomorrow 03:00' small muted when enabled.
6. Folder not configured (first launch): the section shows an `ui:InfoNote` 'Choose a backup folder to turn on daily backups.' and the schedule row disabled until a folder is set.
7. Live updates: on `backup.completed|failed` the status refetches; while `running` the row shows a spinner.

## 6. Design notes

`design.png`: rows 83/78/66 px high; folder value mono right aligned; time select pill with chevron; last backup mono green (`ok` tone) with dot separators ` · `.

## 7. Reuse

- `ui:SettingsSection`, `ui:SettingRow`, `ui:FolderPicker`, `ui:Select`, `ui:Switch`, `ui:NumberStepper`, `ui:InfoNote`, `lib:use-local-approval` (OVE_WSPACE014), `lib:backup-errors`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific (critical): choosing the folder is a data-egress decision (backups hold every Decision and memory), so it requires Local Approval, bound to the exact root handle; Telegram/Agents/Chief cannot change it. The UI sends a handle from the native dialog, never a typed path string. The UI shows `displayPath` only and does not resolve symlinks itself (the engine does). Cloud-sync warning is mandatory and cannot be hidden.

## 10. Errors and edge cases

- Folder disappears later (external drive): status `missing` red with 'Choose again'; daily backup shows failed.
- Disk full: `disk_full` message with free space hint.
- Time changed while a backup is running: engine applies on next schedule.
- Local Approval expired: re-ask (OVE_WSPACE014 behaviour).
- User cancels native dialog: nothing changes.
- Large path text: ellipsis in the middle with full text in `title`/tooltip.

## 11. Acceptance criteria

- [ ] Given the section, Then it matches `design.png` for the ok state.
- [ ] Given I change the folder, Then a Local Approval is requested first and the call carries `localProof` with `rootId`.
- [ ] Given the engine rejects the folder (data dir), Then the error is shown and the old folder stays.
- [ ] Given a cloud-synced folder, Then the amber warning is visible.
- [ ] Given a failed last backup, Then the row is red with the reason code.
- [ ] Given the schedule toggle off, Then the time select is inactive.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `backup-view.test.ts` (formatting, states), `FolderRow.test.tsx` (approval, errors, cancel), `ScheduleRow.test.tsx`, `LastBackupRow.test.tsx` (ok/failed/running/none), `backup.security.test.ts` (no widening call without proof), visual. Commands: `pnpm --filter @overmind/desktop test features/app-settings/backup, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/sections/Backup.section.tsx`, `apps/desktop/src/features/app-settings/components/backup/**`, `apps/desktop/src/features/app-settings/api/useBackup.ts`, `apps/desktop/src/features/app-settings/model/backup-view.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Own key prefix `backup.*`; OVE_SETUI008 adds buttons by the glob slot `components/backup-actions/*.action.tsx` rendered by this section's actions row. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- CONFLICT: Local Approval action name `backup.folder.change` (PERM031) vs `backup.change-folder` (BACKUP004); the UI uses the PERM031 registry name and the engine must align.
- CONFLICT: `AppConfig.backup.retentionDays` vs `BackupSettings.retentionCount`; UI follows BACKUP001 and treats the config copy as read-only.
- GAP: BACKUP route contracts (`PUT /backup/folder`) do not declare `localProof` (PERM009 requires it).
- ASSUMPTION: retention stepper is a derived design addition.
