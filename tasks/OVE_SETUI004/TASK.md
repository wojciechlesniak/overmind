---
id: OVE_SETUI004
title: "Notification extras: do not disturb, sound, reminders and the macOS permission hint"
area: SETUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS023, OVE_DS026, OVE_DS030, OVE_DS040, OVE_DS078, OVE_ENGINE022, OVE_SETUI003]
soft_depends_on: []
provides: []
needs: ["ui:SettingRow", "ui:Switch", "ui:Select", "ui:TextField", "ui:Button", "ui:InfoNote", "lib:use-notification-preferences", "lib:desktop-bridge-contract"]
owns: ["apps/desktop/src/features/app-settings/components/notification-extras/**", "apps/desktop/src/features/app-settings/model/dnd.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [6]
---

# OVE_SETUI004: Notification extras: do not disturb, sound, reminders and the macOS permission hint

## 1. Summary

Adds the controls that sit under the delivery selects but are not drawn in the mock: Do Not Disturb schedule, sound on/off and volume cue, reminder repeat for waiting Access Requests, and a hint when macOS notification permission is denied.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. NOTIF010 `NotificationPreferences.doNotDisturb { enabled, from:'HH:MM', to:'HH:MM' }`, `sound { enabled, name }`; NOTIF003 reminder cascade for unanswered Access Requests (escalating reminders); macOS notification authorisation is queried through the Tauri bridge (`lib:desktop-bridge`, `notifications.permission` -> 'granted'|'denied'|'not_determined') and the native notifier (NOTIF006). Spec criterion: an Agent waiting for an Access Request must not be forgotten.

## 3. Scope (in)

- `components/notification-extras/Dnd.extra.tsx`, `Sound.extra.tsx`, `Reminders.extra.tsx`, `MacPermissionHint.extra.tsx` (glob-collected by OVE_SETUI003).
- `model/dnd.ts` (validation, overnight window logic).

## 4. Out of scope

- The five selects and the Telegram switch (OVE_SETUI003).

## 5. Detailed requirements

1. DND row: switch + two time inputs (`ui:TimeField` or `ui:TextField type=time`) 'From' / 'To'; overnight windows (22:00-07:00) allowed; from == to is rejected 'Choose different times'. During DND banners and sounds are suppressed by the engine; Access Requests still appear in the Centre and the tray badge. Help: 'Access Requests and Approvals still wait in the Notification Centre.'
2. Sound row: switch + 'Sound' `ui:Select` (system sound names from `sound.available`, default 'Default') + 'Play' button for preview (plays via bridge, no engine call).
3. Reminders row: `ui:Select` 'Remind me about unanswered Access Requests': 'Every 15 min' / 'Every hour' / 'Never' (maps to NOTIF003 setting; 'Never' still shows the badge).
4. macOS hint: when permission is `denied` show an `ui:InfoNote` (amber) 'macOS blocks Overmind notifications. Open System Settings > Notifications to allow them.' with a button 'Open System Settings' calling the bridge `openSystemNotificationSettings`; `not_determined` shows a 'Allow notifications' button that triggers the OS prompt. Permission is re-read on window focus.
5. All writes go through `useNotificationPreferences.update` of OVE_SETUI003; this task never calls the API itself.

## 6. Design notes

Derived from the section style of `design.png` of OVE_SETUI003 (rows below the Telegram row; amber InfoNote variant of the kit). Not in the mock.

## 7. Reuse

- `ui:SettingRow`, `ui:Switch`, `ui:Select`, `ui:TextField`, `ui:Button`, `ui:InfoNote`, `lib:use-notification-preferences`, `lib:desktop-bridge-contract`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: DND and reminder choices must never suppress the Notification Centre entry or the tray badge (engine enforces; UI text says so). Opening System Settings uses a fixed bridge command, no URL from data.

## 10. Errors and edge cases

- Time not parsable: field error, no request.
- Bridge unavailable (browser dev): hint hidden.
- Sound name no longer exists: falls back to Default, shown as such.
- Clock/timezone change: times are local wall-clock, stored as 'HH:MM' + engine uses the system zone.

## 11. Acceptance criteria

- [ ] Given overnight DND 22:00-07:00, Then it is accepted and stored.
- [ ] Given from == to, Then it is rejected with an inline message.
- [ ] Given permission denied, Then the amber hint and the button show; granting it hides the hint on next focus.
- [ ] Given 'Never' reminders, Then the help says the badge still shows.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `dnd.test.ts`, extras component tests, bridge mock for permission states. Commands: `pnpm --filter @overmind/desktop test features/app-settings/notification-extras, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/notification-extras/**`, `apps/desktop/src/features/app-settings/model/dnd.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: reminder cadence setting key is not in `NotificationPreferences` (NOTIF003 has fixed cascade); assumed `reminders.accessRequest: '15m'|'1h'|'never'`, needs NOTIF decision.
- CONFLICT: `sound` lives in NotificationPreferences and in AppConfig.notifications.sound; this task writes NotificationPreferences only.
