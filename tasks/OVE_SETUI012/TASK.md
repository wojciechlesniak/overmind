---
id: OVE_SETUI012
title: "Settings states: loading, error, section boundaries and engine unavailable"
area: SETUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS032, OVE_DS040, OVE_SETUI001]
soft_depends_on: []
provides: []
needs: ["ui:Skeleton", "ui:InfoNote", "ui:Button"]
owns: ["apps/desktop/src/features/app-settings/components/boundary/**", "apps/desktop/src/features/app-settings/components/SectionSkeleton.tsx", "apps/desktop/src/features/app-settings/components/SectionError.tsx", "apps/desktop/src/features/app-settings/components/OfflineBanner.tsx", "apps/desktop/src/features/app-settings/components/ConflictNotice.tsx"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14"]
adr_refs: [3]
---

# OVE_SETUI012: Settings states: loading, error, section boundaries and engine unavailable

## 1. Summary

Adds the states missing from the mock for the settings page: skeletons, per-section error boundaries, conflict notice and the offline mode in which every change is disabled.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. VIEWS lists missing states: loading, config load error, save error, restore confirmation, unsaved/pending indicator, narrow layout.

## 3. Scope (in)

- `components/boundary/*.boundary.tsx` glob (error boundary wrapping every section, consumed by the registry from OVE_SETUI001).
- `components/SectionSkeleton.tsx`, `SectionError.tsx`, `OfflineBanner.tsx`, `ConflictNotice.tsx`.

## 4. Out of scope

- Section content.

## 5. Detailed requirements

1. Skeleton: section title + 3 skeleton rows matching row height of the mock.
2. Section error: card with 'Could not load this section.' + 'Retry' + 'Details' (error code, request id).
3. Offline: when the engine is unreachable show an `ui:InfoNote` banner 'Engine not reachable. Showing last known settings; changes are disabled.' and set a context flag `settingsReadOnly` that all rows honour (disabled controls).
4. Conflict: after `config.version_conflict` show 'Settings changed elsewhere. Reload to continue.' with 'Reload'.
5. Boundaries isolate failures: one throwing section never blanks the page.

## 6. Design notes

Derived from kit `Skeleton`, `InfoNote`. No mock.

## 7. Reuse

- `ui:Skeleton`, `ui:InfoNote`, `ui:Button`, `lib:use-app-config`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: when offline all mutating controls are disabled (no queueing of widening actions).

## 10. Errors and edge cases

- Boundary inside a Local Approval dialog: dialog closes, section shows error.
- Repeated errors: no retry loop (manual retry).

## 11. Acceptance criteria

- [ ] Given a throwing section, Then only it shows the error.
- [ ] Given offline, Then all controls are disabled and the banner shows.
- [ ] Given a conflict, Then reload resolves it.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: boundary, offline, conflict tests; stories. Commands: `pnpm --filter @overmind/desktop test features/app-settings/states, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/boundary/**`, `apps/desktop/src/features/app-settings/components/SectionSkeleton.tsx`, `apps/desktop/src/features/app-settings/components/SectionError.tsx`, `apps/desktop/src/features/app-settings/components/OfflineBanner.tsx`, `apps/desktop/src/features/app-settings/components/ConflictNotice.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the context flag `settingsReadOnly` is provided by the route (OVE_SETUI001) from `useAppConfig.status`.
