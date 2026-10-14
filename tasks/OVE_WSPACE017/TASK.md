---
id: OVE_WSPACE017
title: Workspace settings route, in-page navigation with scroll-spy and Workspace header
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DATA011, OVE_DS013, OVE_DS017, OVE_DS026, OVE_DS032, OVE_DS037, OVE_DS082, OVE_PAUSE014, OVE_SHELL011]
soft_depends_on: ["OVE_PAUSE014"]
provides: ["lib:ws-settings-sections"]
needs: ["ui:SettingsNav", "ui:TextField", "ui:Pill", "ui:Button", "ui:Skeleton", "ui:useToast", "lib:use-workspace-pause", "lib:current-workspace", "lib:feature-manifest", "api:workspaces.rename", "api:workspaces.get"]
owns: ["apps/desktop/src/features/workspace-settings/routes/**", "apps/desktop/src/features/workspace-settings/feature.manifest.ts", "apps/desktop/src/locales/en/workspace-settings.json", "apps/desktop/src/locales/pl/workspace-settings.json", "apps/desktop/src/features/workspace-settings/components/WorkspaceHeader.tsx", "apps/desktop/src/features/workspace-settings/components/useScrollSpy.ts"]
reads: []
design: design.png
design_source: "Workspace#ws/section-nav (crop 72,162,240,738 CSS px)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 11"]
adr_refs: [3, 28]
---

# OVE_WSPACE017: Workspace settings route, in-page navigation with scroll-spy and Workspace header

## 1. Summary

Creates the `workspace-settings` feature: manifest (settings tab 'Ten Workspace'), the two-column layout with `ui:SettingsNav` and a scrolling column that collects section cards by glob, scroll-spy active state, the Workspace name header with rename, and a pause/resume control for this Workspace.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`).

## 3. Scope (in)

- `feature.manifest.ts` (id `workspace-settings`, route `/workspace/settings`, nav area `settings-tab` order 10 label 'Ten Workspace').
- `routes/WorkspaceSettingsRoute.tsx`: `ui:SettingsNav` + main column; sections discovered from `components/sections/*.section.tsx`.
- Scroll-spy and anchor navigation (`IntersectionObserver`, `scrollIntoView`).
- Workspace header (name 18/700 under the mono eyebrow 'Workspace'), inline rename (`POST /v1/workspaces/{id}/rename`), paused badge + Pause/Resume via `useWorkspacePause`.
- i18n namespace files `workspace-settings.json` EN/PL (skeleton + nav/header keys).

## 4. Out of scope

- Section contents (OVE_WSPACE019..029), delete (OVE_WSPACE030), data hooks (OVE_WSPACE018), states (OVE_WSPACE031).

## 5. Detailed requirements

1. Manifest: `nav: [{ id:'workspace-settings', area:'settings-tab', labelKey:'workspace-settings:nav.label', order:10 }]`; `requiresCapabilities:['api:workspaces.get']`; route lazy. The tab bar itself ('Ten Workspace / Połączenia i modele / Aplikacja') is built by SHELL from the three features' manifests.
2. Layout (mock): nav aside 240 (bg `#0C0814` token, padding 22 14), main column `flex:1`, padding `22 28`, cards gap 16, `max-width: 980` centred left; both columns scroll independently; the nav is sticky within its column.
3. Nav items (from the MOCK, which wins over the DS082 text that also lists 'Workspace'): Dozwolone katalogi (`directories`), Uprawnienia (`permissions`), Reguły Właściciela (`rules`), Dokumentacja projektu (`docs`), Izolacja i budżet (`isolation`). Header of the nav: eyebrow mono 'Workspace' + the Workspace name (`ui:SettingsNav title`). The first item is active by default.
4. Section discovery: each `components/sections/<Name>.section.tsx` default-exports a component and exports `sectionMeta = { id, order, labelKey }`; the route sorts by `order`, renders each inside `<section id={id} aria-labelledby>`, and builds the nav items from `sectionMeta`. A missing section file simply is not listed. Duplicate ids fail a unit test.
5. Scroll-spy: an `IntersectionObserver` with `rootMargin: '-20% 0px -70% 0px'` on the main column sets `activeId`; click on a nav item calls `scrollIntoView({block:'start', behavior: reducedMotion?'auto':'smooth'})`, moves focus to the section heading (`tabIndex=-1`) and sets `aria-current='location'`. URL hash `#directories` is updated and honoured on load.
6. Header: name shown 18/700; an edit icon button 'Rename' turns it into a `ui:TextField` (same validation as OVE_WSPACE011); Enter saves `renameWorkspace({id,name,expectedVersion})`, Escape cancels; `data.workspace_name_taken` shows inline error; success toast. Renaming does not need Local Approval (display only).
7. Pause/resume: below the header a `ui:Pill` state ('Working' / 'Paused') and a `ghost` button `Pause this Workspace` / `Resume` using `useWorkspacePause(workspaceId)`; resume of a single Workspace is confirmation-free (PAUSE014); while Global Pause is active the button is disabled with text 'Global Pause is active' (resume only via Global Pause). Pause is not widening, so no Local Approval.
8. Current Workspace: the page edits the CURRENT Workspace (`lib:current-workspace`); if none is selected, redirect to the dashboard with a toast. Switching Workspace via the top-bar switcher remounts the page with the new id (keyed route).
9. Keyboard: nav items are links/buttons in DOM order; skip link 'Skip to settings content' at the top of the page; focus rings via global style.

## 6. Design notes

`design.png`: the left nav (240px): mono 'Workspace' eyebrow, name 'Aplikacja rezerwacji' 18/700, five items 14/600, active item filled `list-selected` (#1A1422). Not in the mock: scroll-spy transitions, hover/focus, rename field, paused badge/button, narrow window (below 1100 the nav collapses into a top `ui:Select` jump list: derived rule), loading skeleton of the nav.

## 7. Reuse

- `ui:SettingsNav` (OVE_DS082), `ui:TextField`, `ui:Pill`, `ui:Button`, `ui:Skeleton`, `ui:useToast`.
- `useWorkspacePause` (OVE_PAUSE014), `lib:current-workspace` (SHELL), `defineFeature` (ARCH009).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged).

## 10. Errors and edge cases

- Workspace deleted elsewhere while open: push `workspace.deleted` -> redirect to dashboard + toast.
- Rename conflict (`version_conflict`): reload Workspace and re-open the field with the latest name.
- Section file throws: error boundary per section (OVE_WSPACE031).
- Hash points to an unknown section: ignored.
- Window resized: observer recomputed.

## 11. Acceptance criteria

- [ ] Given the page loads, Then five nav items show and the first is active.
- [ ] Given a click on 'Reguły Właściciela', Then the column scrolls to it, focus moves to its heading and `aria-current` updates.
- [ ] Given scrolling, Then the active item follows within one frame.
- [ ] Given rename with a taken name, Then an inline error shows and nothing changes.
- [ ] Given Global Pause active, Then the Workspace pause button is disabled with the explanation.
- [ ] Visual match of the nav with `design.png`.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `WorkspaceSettingsRoute.test.tsx` (glob discovery, order, duplicate id), `useScrollSpy.test.ts` (mock IntersectionObserver), `WorkspaceHeader.test.tsx` (rename, pause), Playwright `settings-nav.e2e.ts`, visual of nav. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/routes`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/routes/**`, `apps/desktop/src/features/workspace-settings/feature.manifest.ts`, `apps/desktop/src/locales/en/workspace-settings.json`, `apps/desktop/src/locales/pl/workspace-settings.json`, `apps/desktop/src/features/workspace-settings/components/WorkspaceHeader.tsx`, `apps/desktop/src/features/workspace-settings/components/useScrollSpy.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Sections are separate files in `components/sections/` owned by their own tasks. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: mock nav (5 items, no 'Workspace' item) wins over DS082's list.
- ASSUMPTION: Workspace pause control is added here although the mock lacks it (needed so a Workspace can be resumed, PAUSE014).
