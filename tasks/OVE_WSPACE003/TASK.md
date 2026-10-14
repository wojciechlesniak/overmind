---
id: OVE_WSPACE003
title: Pulpit route, feature manifest, i18n namespace and page layout with header
area: WSPACE
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_DS005, OVE_DS032, OVE_DS044, OVE_DS045, OVE_WSPACE001]
soft_depends_on: []
provides: ["ui:WorkspacesPage", "lib:ws-dashboard-slots"]
needs: ["ui:PageLayout", "ui:SidePanel", "ui:PageHeader", "ui:Text", "ui:Skeleton", "lib:feature-manifest", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workspaces/routes/**", "apps/desktop/src/features/workspaces/feature.manifest.ts", "apps/desktop/src/locales/en/workspaces.json", "apps/desktop/src/locales/pl/workspaces.json", "apps/desktop/src/features/workspaces/components/DashboardHeader.tsx"]
reads: []
design: design.png
design_source: "Pulpit#dash/page-header (crop 88,80,1016,82 CSS px)"
spec_refs: ["SPECIFICATION 4"]
adr_refs: [10]
---

# OVE_WSPACE003: Pulpit route, feature manifest, i18n namespace and page layout with header

## 1. Summary

Creates the `workspaces` feature skeleton: feature manifest (rail item 'Workspace\'y', route `/workspaces`), the i18n namespace file and the Pulpit page layout (main column + 320px side column, page header with date and title, 'New Workspace' button slot). Sections are mounted by later tasks through named slots so the files they own never overlap.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Layout truth: `Pulpit` regions `dash/main` (72,67,1048x833), `dash/page-header` (100,93,992x57) and `dash/notifications` (1120,67,320x833). The shell (rail, top bar 67px) is SHELL's; this task fills the content area only. Inventory E6: page padding 24; E7: `title-page` 26/700 (the mock shows 32/700 for this title: the title token wins per E7, say so in the PR).

## 3. Scope (in)

- `feature.manifest.ts` (defineFeature, id `workspaces`, namespaces `['workspaces','common']`, route `/workspaces`, nav rail order 10 icon `home`).
- `routes/WorkspacesRoute.tsx`: `ui:PageLayout` main + `ui:SidePanel` (320) composing the five slots collected from `components/slots/`.
- `components/DashboardHeader.tsx`: mono date line (`dddd, D MMMM` via `formatDate`, PL 'wtorek, 13 października'), `title-page` 'Workspaces' and the action slot (button is OVE_WSPACE011).
- i18n namespace files `en/workspaces.json`, `pl/workspaces.json` with the keys of this task (later tasks add their keys by editing the same file ONLY through the proposal rule in section 13).

## 4. Out of scope

- Chief strip, grid, notifications, system list content (OVE_WSPACE004, 005, 008, 009).
- New Workspace dialog (OVE_WSPACE011).
- Rail and top bar (SHELL).

## 5. Detailed requirements

1. Manifest: `titleKey 'workspaces:nav.title'`, `nav: [{ id:'workspaces', area:'rail', labelKey:'workspaces:nav.label', icon:'home', order:10 }]`, `requiresCapabilities: ['api:workspaces.list']`. Route element lazy-imported. ASSUMPTION: SHELL defines the final path prefix; this feature declares `/workspaces`.
2. Layout: main column padding `24` (E6), content max width 992 (mock) and centred when wider; section gap 20 (mock: header 93..150, strip 170, grid 284 => gap 20); side column 320 with padding 21 (mock x=1141 inside 1120), `bg` per `ui:SidePanel`, divider `line`. The page scrolls INSIDE the main and side containers, never the window (styl-wizualny).
3. Header row: date (mono 12, `text-muted`) above title (`title-page`); the action slot is right-aligned and vertically at the title baseline (mock: button 164x40 at x=928,y=110). `aria-labelledby` of the main region points to the title; the title is the page `h1`.
4. Slots: each section is a file `components/slots/<Name>.slot.tsx` whose default export is the connected component and which exports `slotId` (`'chiefSummary'|'grid'|'notifications'|'system'|'headerAction'`). The route collects them with `import.meta.glob('../components/slots/*.slot.tsx', { eager: true })` (ARCH009 extension-point style), so tasks 004/005/008/009/011 each ADD one file and never edit the route. This task ships `routes/placeholders.tsx` (a skeleton per slot) used when no slot file exists yet; duplicate `slotId` fails a unit test.
5. Focus order: header action, Chief strip action, grid cards (DOM order = visual order), then the side column (notifications, system). Landmarks: `main`, `aside aria-label` = `workspaces:aside.label` ('Notifications and system').
6. i18n keys (EN / PL): `nav.label` 'Workspaces' / 'Workspace\'y', `page.title` 'Workspaces' / 'Workspace\'y', `aside.label`, `page.dateFormat` is not a string: use `formatDate`.
7. Document title: `Workspaces · Overmind` set through the shell's `useDocumentTitle` if present.

## 6. Design notes

`design.png` shows the page header (date, 'Workspace\'y', violet 'Nowy Workspace' button) and the top of the main column. Tokens: `--om-text-muted`, `--om-title-page`, spacing 20 between sections. States not in the mock: loading (skeleton placeholders from `ui:Skeleton`), narrow window (< 1280 not supported by the mocks, question 7 of the inventory: the side column collapses under the main column below 1100 as a derived rule), long titles.

## 7. Reuse

- `ui:PageLayout`, `ui:SidePanel`, `ui:PageHeader` (OVE_DS044/045), `ui:Text`, `ui:Skeleton`.
- `defineFeature` (OVE_ARCH009), `useT`, `formatDate` (OVE_ARCH011).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components. This task creates the folder skeleton (`routes/`, `components/`, `locales`) for the whole feature.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. The route is owner-only content: it renders nothing until the session is established by the shell; no data is fetched here.

## 10. Errors and edge cases

- Date in a locale without a long format: falls back to ISO date.
- Window narrower than the minimum: horizontal scroll inside the main, never the page.
- Feature manifest invalid (duplicate id): `collectFeatures` fails at startup (ARCH009 test), covered by a unit test.
- Slot component throws: an error boundary per slot shows the section error state (OVE_WSPACE010) so one section never blanks the page.

## 11. Acceptance criteria

- [ ] Given the app boots, Then `/workspaces` renders header and four slot placeholders without console errors.
- [ ] Given PL locale, Then the date reads like 'wtorek, 13 października' and the title 'Workspace\'y'.
- [ ] Given Tab navigation, Then focus order follows the specified order and every stop shows the global focus ring.
- [ ] Visual comparison of the header region with `design.png` is within tolerance.
- [ ] `pnpm i18n:check` is green for namespace `workspaces`.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `manifest.test.ts` (zod validity, unique route), `DashboardHeader.test.tsx` (date formatting EN/PL, heading level), `WorkspacesRoute.test.tsx` (slots, landmarks, error boundary isolation), story `Page/Loading`, visual `header.visual.ts`. Commands: `pnpm --filter @overmind/desktop test routes`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/routes/**`, `apps/desktop/src/features/workspaces/feature.manifest.ts`, `apps/desktop/src/locales/en/workspaces.json`, `apps/desktop/src/locales/pl/workspaces.json` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Later tasks add i18n keys to `workspaces.json`: to avoid merge conflicts each later task puts its keys in a JSON sub-object it alone owns (`card.*`, `notifications.*`, `system.*`, `newWorkspace.*`, `empty.*`) and rebases; key-lint (ARCH011) catches duplicates. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the page title is `title-page` 26/700 (E7) although the mock draws 32.
- OPEN: whether the dashboard is also the default route at launch (SHELL decides).
