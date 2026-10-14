---
id: OVE_SETUI009
title: "Security and logs section: redaction, secrets count and isolation escape test"
area: SETUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS023, OVE_DS078, OVE_ENGINE006, OVE_ENGINE024, OVE_SETUI001]
soft_depends_on: []
provides: []
needs: ["ui:SettingsSection", "ui:SettingRow", "ui:Switch", "ui:Button", "api:config.get", "api:system.health"]
owns: ["apps/desktop/src/features/app-settings/components/sections/Security.section.tsx", "apps/desktop/src/features/app-settings/api/useSecurityStatus.ts", "apps/desktop/src/features/app-settings/model/security-view.ts"]
reads: []
design: design.png
design_source: "Ustawienia#settings/security (crop 766,462,646,197 CSS px)"
spec_refs: ["SPECIFICATION 14", "SPECIFICATION 16"]
adr_refs: [4, 20]
---

# OVE_SETUI009: Security and logs section: redaction, secrets count and isolation escape test

## 1. Summary

Implements the 'Bezpieczenstwo i logi' card: log redaction switch, the Keychain secrets count and the status of the last isolation escape test.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. Mock copy: 'Redakcja sekretow i danych osobowych w logach' (switch on), 'Sekrety' / 'Tylko w peku kluczy macOS (Keychain).' value `3 wpisy`, 'Test ucieczki z izolacji' value `zaliczony · wczoraj` (green). Spec 14/16: secrets only in Keychain; isolation is real OS isolation (ADR 0004/0020) verified by an escape test. ENGINE024 `AppConfig.logging` has redaction flags but the engine keeps redaction mandatory for the support bundle (ENGINE025). Neither a secrets-count API nor an escape-test status API exists yet.

## 3. Scope (in)

- `components/sections/Security.section.tsx` (id `security`, right, order 20).
- `api/useSecurityStatus.ts` (`GET /v1/system/security-status` ASSUMPTION; falls back to `api:system.health` checks `sandbox`/`isolation_test`).
- `model/security-view.ts`.

## 4. Out of scope

- Running the escape test (BOX area); revealing secrets (never possible).

## 5. Detailed requirements

1. Redaction row: `ui:Switch` reflecting `config.logging.redaction`. Turning it OFF is NOT allowed from the UI: the switch is rendered ON and `disabled` with help 'Always on. Logs never contain secrets or personal data.' ASSUMPTION following ENGINE025 (bundle redaction is mandatory); if the engine exposes it as writable, turning OFF requires Local Approval `logs.redaction.disable` (not registered: open question).
2. Secrets row: label 'Secrets', help 'Only in the macOS Keychain.'; value `<n> entries` in mono (`secretsCount` from the status API: count only, never names or values), plural keys.
3. Escape test row: value from `isolationTest {status:'passed'|'failed'|'never_run'|'running', at}`: passed -> green `passed · yesterday` (relative via `formatRelative`), failed -> red 'failed · <date>' with a 'View details' link to Connections environment card (OVE_CONNUI011), never_run -> amber 'not run yet', running -> spinner. A 'Run again' ghost button is shown only when the API offers `POST /v1/system/isolation-test` (feature-detected via capability flag).
4. Unknown/failed status calls render '-' in muted and a retry link; never a green value by default (fail closed).
5. Refresh on window focus and on `isolation.test.completed` event if available.

## 6. Design notes

`design.png`: 3 rows with 1px separators; value column in mono; green tone for `passed`, muted grey for the count.

## 7. Reuse

- `ui:SettingsSection`, `ui:SettingRow`, `ui:Switch`, `ui:StatusText` (mono value), `ui:Button` ghost.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: only aggregate counts are shown; the section must never display secret names, key prefixes or token fragments. A failed or unknown escape test must never render as OK. The redaction control cannot be turned off from the UI by default.

## 10. Errors and edge cases

- Keychain locked: count shown as '-' with 'Keychain locked'.
- Test result older than 30 days: amber 'stale'.
- API missing (older engine): section shows the two rows it can and hides the third.

## 11. Acceptance criteria

- [ ] Given a passed test yesterday, Then the row shows 'passed · yesterday' in green and matches `design.png`.
- [ ] Given failed, Then red and the details link.
- [ ] Given an error loading, Then no green value is displayed.
- [ ] Given the redaction row, Then it cannot be turned off from the UI.
- [ ] Given the count, Then no secret names appear anywhere in the DOM.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `security-view.test.ts` (status -> tone), `Security.section.test.tsx` (each state, fail-closed), visual. Commands: `pnpm --filter @overmind/desktop test features/app-settings/security, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/sections/Security.section.tsx`, `apps/desktop/src/features/app-settings/api/useSecurityStatus.ts`, `apps/desktop/src/features/app-settings/model/security-view.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Own key prefix `security.*`. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: no API for the Keychain secrets count nor for the isolation escape test status; assumed `GET /v1/system/security-status {secretsCount, isolationTest{status,at}}` (owner: ENGINE/BOX).
- OPEN: whether redaction may ever be disabled.
