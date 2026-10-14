---
id: OVE_SETUI001
title: Settings route, feature manifest, page layout and app config hook
area: SETUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_DS045, OVE_DS078, OVE_ENGINE024, OVE_PAUSE015]
soft_depends_on: []
provides: ["lib:use-app-config", "ui:SettingsRoute", "lib:settings-section-registry"]
needs: ["ui:SettingsPage", "ui:SettingsSection", "ui:PageHeader", "ui:GlobalPauseSettingsPanel", "api:config.get", "api:config.update", "event:config.changed", "lib:define-feature", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/app-settings/feature.manifest.ts", "apps/desktop/src/features/app-settings/routes/**", "apps/desktop/src/features/app-settings/components/section-registry.ts", "apps/desktop/src/features/app-settings/components/sections/GlobalPause.section.tsx", "apps/desktop/src/features/app-settings/api/useAppConfig.ts", "apps/desktop/src/locales/en/app-settings.json", "apps/desktop/src/locales/pl/app-settings.json"]
reads: []
design: design.png
design_source: "Ustawienia#settings/page (crop 72,112,1368,690 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12"]
adr_refs: [17, 3]
---

# OVE_SETUI001: Settings route, feature manifest, page layout and app config hook

## 1. Summary

Creates the `app-settings` feature skeleton: lazy route `/settings`, nav entry, i18n namespace, the `ui:SettingsPage` two-column layout with a glob-collected section registry, the `useAppConfig` hook (versioned read/patch of `api:config.*`) and the placement of the existing Global Pause panel.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. This task is the only one that owns the route and layout; every section is a separate task that drops a `components/sections/<Name>.section.tsx` file exporting `{ id, column:'left'|'right', order, Component }`, collected by `import.meta.glob`, so no two tasks edit one file (CONVENTIONS 5).

## 3. Scope (in)

- `feature.manifest.ts` via `defineFeature({ id:'app-settings', routes:[{path:'/settings', lazy}], nav:{labelKey, icon:'settings', order:90}, i18n:['app-settings'] })`.
- `routes/SettingsRoute.tsx`: header 'Ustawienia' (page title style of the mock), `ui:SettingsPage` with two columns and the section registry.
- `components/section-registry.ts` (glob collector, sorting by `column`, `order`, id uniqueness check in dev).
- `api/useAppConfig.ts`: `useAppConfig()` returning `{ config, version, status, update(patch) }` over `GET/PATCH /v1/config` (`api:config.get|update`), with optimistic-free update, `event:config.changed` refresh and error mapping.
- `components/sections/GlobalPause.section.tsx` (right column, order 90) rendering `ui:GlobalPauseSettingsPanel` from OVE_PAUSE015 as is.
- Locale files `locales/en|pl/app-settings.json` with `page.title` and shared keys (`common.saved`, `common.saveFailed`, `section.<id>.title`).

## 4. Out of scope

- Content of the sections (OVE_SETUI002..011), states (OVE_SETUI012), the Global Pause logic (PAUSE010/015: only placed here).

## 5. Detailed requirements

1. Route `/settings`; page title 'Settings' (mock 'Ustawienia', 32px per mock, E7 says 26px: kit decides, see section 14). Left column order: `general`(10), `notifications`(20), `telegram`(30); right column: `backup`(10), `security`(20), `diagnostics`(25), `pause`(90), `about`(100). Orders are constants of the owning tasks; the registry only sorts.
2. Registry contract `SettingsSection = { id:string; column:'left'|'right'; order:number; titleKey:string; Component:React.ComponentType }`. A section whose `Component` throws is isolated by an error boundary supplied by OVE_SETUI012 (until then bare). Duplicate ids are a dev-time error and a no-op in production (first wins, warning counter).
3. `useAppConfig`: query key `['config']`; `AppConfig` fields used by this feature: `locale:'en'|'pl'`, `engine.maxParallelAgents` (owned by CONNUI), `backup{enabled,time,retentionDays}`, `notifications.sound`, `logging{redaction:boolean}` (read-only display here), `providers.fallbackOrder` (CONNUI). `update(patch)` sends `PATCH /v1/config` with only changed keys and `If-Match: version` (ENGINE024); returns the engine's new full config. On `config.version_conflict` the hook refetches and surfaces `conflict`. Updates are serialised (one in flight; later patches merge) so two quick toggles never race.
4. `useAppConfig` exposes `status:'loading'|'ready'|'error'` and `pending: Set<keyPath>` so rows can show a per-row saving indicator and disable themselves.
5. Language change (used by OVE_SETUI002) must re-render the whole app: the shell i18n provider listens to `config.locale`; this hook only writes the value.
6. Global Pause section: `<GlobalPauseSettingsPanel />` imported as a capability (`ui:GlobalPauseSettingsPanel`); this task adds no pause logic and no strings for it.
7. Layout: at width < 1100px the two columns stack (left first). Right column items keep the mock order; gutters per `ui:SettingsPage`. The mono version footer is rendered by OVE_SETUI010 as the last registered right-column section.
8. Dev guard: a Vitest check asserts that every `*.section.tsx` file exports a unique `id` and that each `titleKey` exists in the EN namespace.

## 6. Design notes

`design.png` shows the whole page (main region 1368x690). Left column width = right column width, 24px gap; section title 16/600 over a card (`ui:SettingsSection`) with r16 panel border; page title top-left. Not in the mock: loading, error and narrow layouts (OVE_SETUI012).

## 7. Reuse

- `ui:SettingsPage`, `ui:SettingsSection` (OVE_DS078/080), `ui:PageHeader`, `ui:GlobalPauseSettingsPanel` (OVE_PAUSE015), `defineFeature` (ARCH009), `lib:api-client-config` via `api:config.*`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: `PATCH /v1/config` is owner-only on the desktop transport; the hook sends no identity fields. The config payload never contains secrets (ENGINE024); nothing from it is logged.

## 10. Errors and edge cases

- Config version conflict: refetch, keep local patch visible as 'not saved', show retry.
- Two patches for the same key within 200 ms: merged, last wins.
- Engine unreachable: `status='error'`, last data kept read-only.
- Unknown config keys from a newer engine: ignored, not dropped when patching (patch contains only keys we touch).
- Registry with zero sections: renders an empty-state note (dev only).

## 11. Acceptance criteria

- [ ] Given the route, Then `/settings` renders the two columns and matches `design.png` once all sections exist.
- [ ] Given a new `*.section.tsx` file, Then it appears without editing any shared file.
- [ ] Given two quick patches, Then one request in flight at a time and the final config equals the merged result.
- [ ] Given a version conflict, Then the hook refetches and reports `conflict`.
- [ ] Given width 900px, Then columns stack with no horizontal scroll.
- [ ] Given Global Pause active, Then the panel shows the active state through OVE_PAUSE015 (no logic here).

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `useAppConfig.test.tsx` (merge, serialise, conflict, push refresh), `section-registry.test.ts` (order, duplicate id), `SettingsRoute.test.tsx` (layout, narrow), manifest test, visual of the whole page. Commands: `pnpm --filter @overmind/desktop test features/app-settings, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/feature.manifest.ts`, `apps/desktop/src/features/app-settings/routes/**`, `apps/desktop/src/features/app-settings/components/section-registry.ts`, `apps/desktop/src/features/app-settings/components/sections/GlobalPause.section.tsx`, `apps/desktop/src/features/app-settings/api/useAppConfig.ts`, `apps/desktop/src/locales/en/app-settings.json`, `apps/desktop/src/locales/pl/app-settings.json` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Other SETUI tasks only add their own `*.section.tsx` file and their own i18n keys under a distinct top-level key of the shared namespace JSON (`general.*`, `notifications.*`, ...); JSON key blocks merge cleanly because each task owns its key prefix (stated in each task). Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the i18n namespace file is shared by the whole feature, each task owning its top-level key prefix; if the i18n tooling forbids shared ownership, split into `app-settings.<section>.json` (ARCH011 decision).
- OPEN: page title size 32px (mock) vs 26px (E7).
- GAP: `AppConfig.logging.redaction` is shown in OVE_SETUI009 as read-only because ENGINE024 does not allow turning it off (see there).
