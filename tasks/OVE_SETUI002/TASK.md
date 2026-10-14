---
id: OVE_SETUI002
title: "General section: language, launch at login, work after closing the window"
area: SETUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS023, OVE_DS030, OVE_DS037, OVE_DS078, OVE_ENGINE024, OVE_SETUI001]
soft_depends_on: []
provides: []
needs: ["ui:SettingsSection", "ui:SettingRow", "ui:Select", "ui:Switch", "ui:useToast", "lib:use-app-config", "api:config.update"]
owns: ["apps/desktop/src/features/app-settings/components/sections/General.section.tsx", "apps/desktop/src/features/app-settings/components/general/**", "apps/desktop/src/features/app-settings/model/general.ts"]
reads: []
design: design.png
design_source: "Ustawienia#settings/general (crop 100,183,646,228 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [17, 5]
---

# OVE_SETUI002: General section: language, launch at login, work after closing the window

## 1. Summary

Implements the 'Ogolne' card: interface language select (EN/PL), 'launch at login' switch and 'keep working after the window is closed' switch, each persisted through the app config and applied live.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. Mock copy: 'Jezyk interfejsu' / 'Kod i dokumentacja projektu sa po angielsku.' with a select showing 'Polski'; 'Uruchamiaj przy logowaniu' / 'Silnik startuje jako usluga uzytkownika.' (switch on); 'Pracuj po zamknieciu okna' / 'Praca staje dopiero przy uspieniu lub wylaczeniu Maca.' (switch on). ADR 0017: code and project docs are English; the UI language is EN by default with PL available. ENGINE008 only defines the ServiceManager port (launchd agent); config keys for these two switches do not exist yet (gap).

## 3. Scope (in)

- `components/sections/General.section.tsx` (id `general`, left, order 10).
- `components/general/LanguageRow.tsx`, `LaunchAtLoginRow.tsx`, `KeepWorkingRow.tsx`.
- `model/general.ts` (pure: config <-> row state).
- i18n keys `general.*`.

## 4. Out of scope

- Implementing the launchd service itself (ENGINE008) or the Tauri window-close behaviour (SHELL/TRAY), Telegram (OVE_SETUI006).

## 5. Detailed requirements

1. Language row: `ui:Select` options `English`, `Polski` (endonyms, never translated). Selecting writes `config.locale`; the shell reloads the i18n resources and the page re-renders in the new language without restart. Help text 'Code and project documentation are in English.' (mock: 'Kod i dokumentacja projektu sa po angielsku.').
2. Launch at login: `ui:SettingRow` with `ui:Switch`; help 'The engine starts as a user service.' Writes `config.app.launchAtLogin` (ASSUMPTION key, see section 14). On success the engine installs/removes the launchd agent through the ServiceManager port; the row shows the engine's reported result (`installed:boolean`) not the click.
3. Keep working after closing the window: switch; help 'Work only stops when the Mac sleeps or shuts down.' Writes `config.app.keepRunningWhenWindowClosed`; when OFF closing the window quits the engine only after confirming no Run is active (the confirm is the shell's job: out of scope); this task only writes the value.
4. Each row shows a 16px spinner and is disabled while its key is in `pending` (OVE_SETUI001); on error the control reverts and an inline error line 'Could not save. Try again.' (i18n by error code) appears for 5 s plus `useToast` error.
5. Rows are keyboard operable: Select via arrow keys, Switch via Space; labels are programmatically associated; `aria-live=polite` for save result.
6. If the engine reports the ServiceManager as unavailable (`config.app.*` read-only or `service_unsupported`), both switches render disabled with a visible reason 'Not available on this system.'.

## 6. Design notes

`design.png`: card r16, rows 96/~96px high with 1px separators, label 15/500 and help 12/muted, select pill on the right with chevron, switch violet when on. Language select shows current value with the chevron `>` glyph per mock.

## 7. Reuse

- `ui:SettingsSection`, `ui:SettingRow`, `ui:Select`, `ui:Switch`, `useToast`, `lib:use-app-config`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: launch-at-login installs a persistent background service; it is a local desktop preference and not exposed to Telegram. Turning it on/off never changes Allowed Directories or permissions. The locale value is validated against the enum before sending.

## 10. Errors and edge cases

- Locale resource fails to load: stay on the previous language, show error.
- Launchd install denied by macOS: engine returns `service_install_failed`; switch reverts.
- Value in config missing (older engine): default ON/ON as in the mock only for display, flagged 'default'.
- Language switched while a toast is shown: toast text is not re-translated (acceptable).

## 11. Acceptance criteria

- [ ] Given the section, Then it matches `design.png` in PL.
- [ ] Given I pick English, Then `PATCH /v1/config {locale:'en'}` is sent and the page re-renders in English without reload.
- [ ] Given a failing save, Then the control reverts and an error is announced.
- [ ] Given the service is unsupported, Then both switches are disabled with the visible reason.
- [ ] Given keyboard only, Then all three rows are operable.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `general.test.ts` (mapping), `General.section.test.tsx` (each row, revert on error, unsupported), `LanguageRow.test.tsx` live language switch, story + visual. Commands: `pnpm --filter @overmind/desktop test features/app-settings/general, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/sections/General.section.tsx`, `apps/desktop/src/features/app-settings/components/general/**`, `apps/desktop/src/features/app-settings/model/general.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Own i18n key prefix `general.*`. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: no config keys / API for launch-at-login and keep-working-after-close (ENGINE024 AppConfig lacks them; ENGINE008 has only the port). Assumed `config.app.launchAtLogin` and `config.app.keepRunningWhenWindowClosed`, both boolean default true; needs an owner in ENGINE.
- OPEN: should closing the window with the switch OFF warn about active Runs (SHELL)?
