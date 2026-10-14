---
id: OVE_BOARDUI006
title: "Board route frame and header region: title, Workflow badge, filters, new-Task button"
area: BOARDUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI003, OVE_BOARDUI005, OVE_DS013, OVE_DS019, OVE_DS025, OVE_DS044, OVE_DS045, OVE_DS062, OVE_SHELL012]
soft_depends_on: []
provides: ["lib:board-route"]
needs: ["ui:PageLayout", "ui:PageHeader", "ui:BoardFilterBar", "ui:VersionBadge", "ui:SegmentedControl", "ui:Button", "lib:shell-page", "lib:feature-regions", "lib:use-board"]
owns: ["apps/desktop/src/features/board/routes/BoardRoute.tsx", "apps/desktop/src/features/board/regions/header.region.tsx", "apps/desktop/src/features/board/regions/index.ts", "apps/desktop/src/locales/en/board-header.json", "apps/desktop/src/locales/pl/board-header.json"]
reads: []
design: design.png
design_source: "Tablica#board/header (crop 84,127,1024,112 CSS px)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11]
---

# OVE_BOARDUI006: Board route frame and header region: title, Workflow badge, filters, new-Task button

## 1. Summary

Builds the lazy `BoardRoute` (mounts `BoardProvider`, composes the shell page with region slots) and the header region that renders `ui:BoardFilterBar`: title `Tablica Zadań`, the badge `Tory z Workflow „board” v3`, the segmented filter with counts, the `Odłożone · N` button and the new-Task button.

## 2. Context

The Task Board view (`Tablica`) is a shell page with the Board main column (lanes) and a 320px Task detail panel on the right (mock: `board/main`, `board/task-inspector`). The header region is the first of several regions: lanes (OVE_BOARDUI007), detail (OVE_BOARDUI009) and dialogs (OVE_BOARDUI012) are discovered through `RegionSlot`. The filter semantics come from OVE_BOARDUI005. The badge text comes from `Board.laneSourceLabel` (for example `Workflow "board" v3`): lanes are defined by the Workflow, so the Owner sees which Workflow Version they follow.

## 3. Scope (in)

- `routes/BoardRoute.tsx` (default export, lazy-loaded by the manifest): `BoardProvider`, `ShellPage` with `detailWidth=320`, `RegionSlot` for `header`, `main`, `detail`, `overlay`.
- `regions/header.region.tsx` wiring `ui:BoardFilterBar` to `useBoardFilter` and `useBoardView`.
- Filter counts: `Moje Zgody`/`Zablokowane` counts are optional (shown only when the view response contains them), `Odłożone · N` uses `deferredCount`.
- The new-Task button opens the dialog owned by OVE_BOARDUI012 through a tiny shared event (`useBoardDialogs().open('create-task')`, defined here in `routes/dialogs-context.ts`).

## 4. Out of scope

- Lane rendering (OVE_BOARDUI007), detail (OVE_BOARDUI009), dialogs (OVE_BOARDUI010, OVE_BOARDUI012), empty and error screens (OVE_BOARDUI014), manifest (OVE_BOARDUI015).

## 5. Detailed requirements

1. `BoardRoute` renders `<BoardProvider><ShellPage layout={{ detailWidth: 320, mainPadding: 'dense' }} detail={<RegionSlot name="detail"/>}>` with the main column containing `RegionSlot header` then `RegionSlot main`, and `RegionSlot overlay` outside. Regions are collected with `import.meta.glob('./*.region.tsx', { eager: true })` from `regions/` (the glob lives in `regions/index.ts`).
2. The page `h1` is `board:title` (PL `Tablica Zadań`); the document title is set through the shell's `usePageTitle` (reported).
3. Header region maps to `BoardFilterBarProps`: `title`, `sourceBadge` = `t('board:laneSource', { name })` when the Board has `laneSourceLabel`, otherwise omitted; `filters` = `[{id:'all'}, {id:'my_approvals'}, {id:'blocked'}, {id:'deferred', count: deferredCount}]` with PL labels `Wszystkie`, `Moje Zgody`, `Zablokowane`, `Odłożone`; `activeFilter` from the URL; `onFilter` = `setFilter`.
4. The segmented filter is a button group with `aria-pressed` (ui-kit). The `Odłożone · N` entry is shown even when N = 0 (disabled look, still pressable to show an empty deferred list message).
5. `newTask` = `{ label: t('board:header.newTask'), onClick: openCreateTask, disabled: paused || !canCreate }`; PL `Zadanie z Dokumentacji` with a plus icon (the mock label is `+ Zadanie z Dokumentacji`). `paused` comes from `useGlobalPause` only if available through `lib:use-pause-guard` (OVE_PAUSE012): creating a Task is not work-starting, so it stays enabled while paused (ASSUMPTION).
6. While the view is loading the header still renders (filters disabled, counts omitted); on error the header renders and the error is shown by the states region.
7. The route sets `aria-busy` on the main region during `refreshing` only.
8. Responsive rule from DS045: if the actions wrap, the new-Task button moves to row 2, as in the mock; no custom CSS in this task.
9. `regions/index.ts` collects with `import.meta.glob(['./*.region.tsx', '../live/*.region.tsx'], { eager: true })` so the live-updates task (OVE_BOARDUI013) can register without editing this file.
10. Route-level code splitting: the route module is the only import of `BoardProvider`; nothing here imports other features.

## 6. Design notes

`design.png` shows the header: title `Tablica Zadań` 26/700, the badge `Tory z Workflow „board” v3`, the segmented control with `Wszystkie` selected, the secondary `Odłożone · 1` button and, wrapped to the second row, the violet primary `+ Zadanie z Dokumentacji`. All of it is rendered by `ui:BoardFilterBar` (OVE_DS062); this task adds no styles. Not in the mock: disabled filters while loading (ui-kit disabled rule, opacity .45), the filter chip with an active filter of `Zablokowane` (same selected look as `Wszystkie`), narrow widths (PageHeader wrap rule).

## 7. Reuse

`ui:BoardFilterBar` (OVE_DS062), `ui:PageLayout`/`ui:SidePanel` via the shell's `ShellPage` (SHELL), `RegionSlot` (OVE_BOARDUI003), `useBoardFilter`/`useBoardView` (OVE_BOARDUI005). Creates `useBoardDialogs` (dialog open/close signals) used by the dialog tasks.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `routes/BoardRoute.tsx`, `routes/dialogs-context.ts`, `regions/index.ts`, `regions/header.region.tsx`; this task owns the `board-header` locale files (keys `header.newTask`, `header.deferred`, `filters.*`).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- `laneSourceLabel` missing: no badge.
- Count for `Odłożone` > 99: shown as `99+` with the full number in `title`.
- URL filter `deferred` while no deferred Tasks exist: list region (OVE_BOARDUI011) shows its empty message.
- Region fails to render: boundary shows retry, header stays.
- Workspace deleted while open: shell redirects; the route unmounts cleanly (no pending state updates).

## 11. Acceptance criteria

- [ ] Given the Board loads, Then the header shows `Tablica Zadań`, the Workflow badge and the filter with `Wszystkie` selected (matches `design.png` within tolerance).
- [ ] Given the Owner clicks `Zablokowane`, Then the URL gets `?filter=blocked` and the view reloads with `scope=blocked`.
- [ ] Given 1 deferred Task, Then the button reads `Odłożone · 1` and selecting it sets `filter=deferred`.
- [ ] Given the new-Task button is pressed, Then the create dialog open signal fires (dialog itself tested in OVE_BOARDUI012).
- [ ] Given a failing region, Then the header remains usable.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `BoardRoute.test.tsx` (slots and providers), `header.region.test.tsx` (props mapping, URL changes, counts), a Storybook story `Board/Header` with loading, filtered and 99+ states; visual test of the header against `design.png`. Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Hotspot: `routes/BoardRoute.tsx` is owned here; other tasks add regions only.

## 14. Open questions and assumptions

- ASSUMPTION: the new-Task button is enabled while Global Pause is active (adding a Task starts no work).
- OPEN: `Moje Zgody` count source: if the view response lacks it, the chip shows no count.
