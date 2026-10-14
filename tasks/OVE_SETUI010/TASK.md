---
id: OVE_SETUI010
title: "About footer: versions, licence and environment line"
area: SETUI
kind: ui
size: XS
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS015, OVE_DS037, OVE_ENGINE007, OVE_SETUI001]
soft_depends_on: []
provides: []
needs: ["ui:IconButton", "ui:useToast", "api:system.version"]
owns: ["apps/desktop/src/features/app-settings/components/sections/About.section.tsx", "apps/desktop/src/features/app-settings/api/useVersionInfo.ts", "apps/desktop/src/features/app-settings/model/about-view.ts"]
reads: []
design: design.png
design_source: "Ustawienia#settings/about (crop 766,678,646,140 CSS px; footer line at the bottom, pause panel above is OVE_PAUSE015)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [13]
---

# OVE_SETUI010: About footer: versions, licence and environment line

## 1. Summary

Implements the mono version line at the bottom of the settings page: Overmind version, licence, herdr version and macOS/CPU, with a copy button.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. Mock footer: `Overmind 0.1.0 Apache-2.0 herdr 0.9.2 macOS 26.1 · Apple silicon`. `GET /v1/system/version` (api:system.version) returns `{ app, engine, schema, herdr?, os, arch, licence }` (ENGINE025). ADR 0013 Apache 2.0.

## 3. Scope (in)

- `components/sections/About.section.tsx` (id `about`, right, order 100).
- `api/useVersionInfo.ts`, `model/about-view.ts`.

## 4. Out of scope

- Update checking (not in MVP), release notes.

## 5. Detailed requirements

1. Render one mono, muted, wrapping line: `Overmind {app} · {licence} · herdr {herdr} · macOS {os} · {archLabel}`; `arm64` -> 'Apple silicon', `x86_64` -> 'Intel'; missing herdr -> 'herdr -'.
2. Copy button (icon, `aria-label` 'Copy version info') copies a plain multi-line text of all fields including engine and schema versions for bug reports; toast 'Copied'.
3. Licence text 'Apache-2.0' links to the in-app licences dialog? No: static text only (no links).

## 6. Design notes

`design.png`: footer at the bottom of the right column; mono 12px muted colour; separators are spaces.

## 7. Reuse

- `ui:KeyValueList` (not needed), `ui:IconButton`, `useToast`, `lib:api-client-system`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: version strings are untrusted text; the copied text contains no paths or usernames.

## 10. Errors and edge cases

- Version call fails: footer hidden, no error banner.
- Very long version text: wraps.

## 11. Acceptance criteria

- [ ] Given version data, Then the line matches `design.png`.
- [ ] Given copy, Then the clipboard contains the multi-line info without personal data.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `about-view.test.ts`, component test. Commands: `pnpm --filter @overmind/desktop test features/app-settings/about, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/sections/About.section.tsx`, `apps/desktop/src/features/app-settings/api/useVersionInfo.ts`, `apps/desktop/src/features/app-settings/model/about-view.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: `herdr` version is part of `system.version` (or `system.health` detail).
