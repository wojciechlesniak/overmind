---
id: OVE_SETUI003
title: "Notifications section: delivery selects per event type and Telegram switch"
area: SETUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS023, OVE_DS030, OVE_DS040, OVE_DS078, OVE_NOTIF010, OVE_SETUI001, OVE_TG012]
soft_depends_on: ["OVE_SETUI005"]
provides: ["lib:use-notification-preferences"]
needs: ["ui:SettingsSection", "ui:SettingRow", "ui:Select", "ui:Switch", "ui:InfoNote", "api:notifications.preferences", "api:telegram.status"]
owns: ["apps/desktop/src/features/app-settings/components/sections/Notifications.section.tsx", "apps/desktop/src/features/app-settings/api/useNotificationPreferences.ts", "apps/desktop/src/features/app-settings/model/notification-preferences.ts"]
reads: []
design: design.png
design_source: "Ustawienia#settings/notifications (crop 100,430,646,432 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12"]
adr_refs: [6]
---

# OVE_SETUI003: Notifications section: delivery selects per event type and Telegram switch

## 1. Summary

Implements the 'Powiadomienia' card: five delivery selects (Access Request, Approval, escalation and Run error, Run finished, Discussion started by Chief) and the 'also send to Telegram' switch, persisted through `api:notifications.preferences`.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. Mock copy: rows 'Prosba o dostep' (help 'Agent czeka, dopoki nie odpowiesz.', 'Dzwiek + baner'), 'Zgoda' ('Dzwiek + baner'), 'Eskalacja i blad Runu' ('Baner'), 'Zakonczenie Runu' ('Tylko Centrum'), 'Dyskusja zaczeta przez Chiefa' ('Baner'), switch 'Wysylaj tez na Telegram' (help 'Zgody z Telegrama dzialaja tylko w biezacym Runie.'). NOTIF010: `GET/PUT /v1/notifications/preferences` -> `NotificationPreferences { access_request, approval, escalation_and_error, run_completed, discussion_started: 'sound_banner'|'banner'|'center_only', telegram:{enabled:boolean}, doNotDisturb, sound{...} }` (extras in OVE_SETUI004). ADR 0006.

## 3. Scope (in)

- `components/sections/Notifications.section.tsx` (id `notifications`, left, order 20) containing the six rows.
- `api/useNotificationPreferences.ts` (query + mutation, push refresh `notification.preferences.changed` if provided, else refetch on focus).
- `model/notification-preferences.ts` (row table: key, labelKey, helpKey?, allowed options; pure).
- i18n keys `notifications.*`.

## 4. Out of scope

- Do-not-disturb, sounds, reminders, macOS permission hint (OVE_SETUI004); the Telegram connection itself (OVE_SETUI005/006).

## 5. Detailed requirements

1. Row table in `model/notification-preferences.ts` drives rendering (OCP): `{ key:'access_request', label, help, options:['sound_banner','banner','center_only'] }` etc. Option labels: 'Sound + banner', 'Banner', 'Center only' (PL mock: 'Dzwiek + baner', 'Baner', 'Tylko Centrum'). The in-app Notification Centre always receives every notification: 'Center only' means no banner and no sound; the UI never offers 'off' (a missed Access Request would stall an Agent), shown as help in the section footer.
2. Selecting a value sends `PUT /v1/notifications/preferences` with the full object and the previous `version`; success replaces the cache from the response. Per-row pending state; revert on error.
3. Telegram switch 'Also send to Telegram': writes `telegram.enabled`. When Telegram is not connected/paired (status from OVE_SETUI005 `useTelegramStatus`), the switch is disabled with the visible text 'Connect Telegram first' and a link button 'Open Telegram settings' scrolling to the Telegram section. Help text copied from the mock, EN 'Approvals from Telegram only work for the current Run.'
4. Privacy of Telegram: when turned on for the first time show an `ui:InfoNote` once-per-session: 'Telegram messages go through Telegram's servers. Use it for short status and Approvals; sensitive content stays in the app.' (ADR 0006 trade-off).
5. Ordering and wording of rows exactly as the mock; selects are `ui:Select` pills of width fitting content, right aligned.

## 6. Design notes

`design.png`: card rows 66-67px with 1px separators; select pill r12 with chevron; last row has help text; switch violet on.

## 7. Reuse

- `ui:SettingsSection`, `ui:SettingRow`, `ui:Select`, `ui:Switch`, `ui:InfoNote`, `useTelegramStatus` (OVE_SETUI005).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: preferences cannot disable the Notification Centre, so a pending Access Request or Approval is always visible. Enabling Telegram delivery does not give Telegram any new authority (Approvals from Telegram remain limited to the current Run by the engine, ADR 0006).

## 10. Errors and edge cases

- Preferences GET fails: rows disabled with skeleton + retry.
- Version conflict: refetch and re-apply the single changed key.
- Telegram disconnected while the switch is on: the row shows 'Telegram not connected' warning, value kept.
- Unknown option value from a newer engine: displayed as raw key, selectable options remain the three.

## 11. Acceptance criteria

- [ ] Given the section, Then it matches `design.png`.
- [ ] Given I choose 'Banner' for Run finished, Then one PUT with the full preferences object is sent and the select shows 'Banner'.
- [ ] Given Telegram is not paired, Then the switch is disabled with the visible reason.
- [ ] Given a failing save, Then the previous value is restored and an error is announced.
- [ ] Given the select options, Then there is no 'Off' option.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `notification-preferences.test.ts`, `Notifications.section.test.tsx` (each row, telegram disabled, first-time note, error revert), visual. Commands: `pnpm --filter @overmind/desktop test features/app-settings/notifications, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/sections/Notifications.section.tsx`, `apps/desktop/src/features/app-settings/api/useNotificationPreferences.ts`, `apps/desktop/src/features/app-settings/model/notification-preferences.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Own key prefix `notifications.*`. OVE_SETUI004 adds its rows through a row registry file `components/notification-extras/*.extra.tsx` collected by glob, rendered after the Telegram row. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: `NotificationPreferences` is replaced as a whole (PUT) per NOTIF010; if PATCH exists use it.
- OPEN: mock has `Eskalacja i blad Runu` grouped; NOTIF010 `escalation_and_error` matches.
- CONFLICT: `NotificationPreferences.sound` (NOTIF010) vs `AppConfig.notifications.sound` (ENGINE024): this feature uses NOTIF010; see OVE_SETUI004.
