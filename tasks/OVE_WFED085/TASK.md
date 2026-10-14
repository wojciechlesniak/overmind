---
id: OVE_WFED085
title: "Compose the Workflow page: regions, modes and state coordination"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_DS044, OVE_DS045, OVE_PAUSE010, OVE_SHELL027, OVE_WFED025, OVE_WFED052, OVE_WFED053, OVE_WFED057, OVE_WFED058, OVE_WFED060, OVE_WFED062, OVE_WFED063, OVE_WFED079, OVE_WFED082, OVE_WFED084]
soft_depends_on: []
provides: ["feature:wfed-page", "feature:workflow-page"]
needs: ["ui:PageLayout", "ui:SidePanel", "ui:SubTabs", "feature:editor-canvas-surface", "feature:editor-left-panel", "feature:editor-selection", "feature:editor-edit-mode", "lib:feature-manifest", "lib:app-navigation", "lib:use-pause", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/page/**", "apps/desktop/src/locales/en/wfed-page.json", "apps/desktop/src/locales/pl/wfed-page.json"]
reads: []
design: design.png
design_source: "Main (crop 72,162,1368,738, whole canvas page below the shell)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED085: Compose the Workflow page: regions, modes and state coordination

## 1. Summary

The `WorkflowPage` that assembles every region of the Main view: left panel (part 1), header, supervision strip, notices, canvas stage with overlays (badge, legend, toolbar, minimap), and the Inspector. It owns the page-level state machine (published / draft / viewing old / viewing Run) and layout, not the content of the regions.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). Main layout (1440x900): rail 72 + top bar + tab bar 'Canvas | Runy i Activity', then left panel 240 (Skills + Node palette, part 1), centre column 802 (header 90, strip 94, stage 498), Inspector 290. The mock is clipped by the viewport: palette, stage world and inspector overflow; every column scrolls inside itself, the page never scrolls (styl-wizualny). The Workflow canvas is the first tab of the Workflow rail item; Activity is the second (RUNUI).

## 3. Scope (in)

- `WorkflowPage` layout and slot wiring using `ui:PageLayout`/`SidePanel`.
- Page state machine and URL state (`?version=`, `?run=`, `?mode=edit`).
- Region order, focus order, landmark roles.
- Selection of the Workflow to show (route param) and Workspace guard.
- Responsive behaviour from 1100 px width up; below that the Inspector becomes a drawer.

## 4. Out of scope

- Content of every region (their own tasks).
- Route registration manifest (`feature.manifest.ts` is owned by part 1 and imports `WorkflowPage` from this task's barrel).

## 5. Detailed requirements

1. Regions and sizes: left panel 240 (part 1 component `feature:editor-left-panel`), centre flexible (min 640), Inspector 290; centre column stacks header, strip, notices (pinned-Run notice, Run end banner, dry-run banner, validation-stale notice), stage (fills remaining height, min 360).
2. Page mode: `published | draft | viewing_old | viewing_run`; derived from URL + data; the mode is passed to the canvas surface (`view` vs `edit`), the header and the Inspector in one place.
3. Slot overlays on the stage per DS099/098/100: topRight validation badge, below it the legend, bottomLeft toolbar, bottomRight minimap; the page ensures no overlaps at stage widths from 520 px (toolbar labels collapse).
4. Workflow chosen by route `/workflow/:workflowId`; without an id the page shows the Workspace's default Workflow (the most recently updated) or the empty state (`OVE_WFED086`).
5. Keyboard landmarks: `main` for the centre, `complementary` for the Inspector and left panel, `region` 'Chief nadzoruje'; skip links 'Przejdź do canvasu' and 'Przejdź do Inspektora'; documented tab order: left panel, header, strip, stage, Inspector.
6. Global Pause: page shows no extra banner (the top bar owns it) but passes pause state to children; actions disabled by their own rules.
7. Leaving the page with unsaved changes goes through `OVE_WFED058` guard.
8. Page-level error boundary per region (a crashed region shows an inline error card; others keep working) and a top-level boundary with 'Odśwież widok'.
9. Page title 'Dostarczanie funkcji · Canvas' (document title) reflects the Workflow name and mode.
10. Performance budget: first meaningful render under 500 ms after data for a 50-Node Workflow on a mid-range Mac; the page code-splits the canvas kit (dynamic import) because React Flow is heavy.

## 6. Design notes

`design.png` is the whole Main content area 1368x738 as in the mock (clipped). The implementation shows the same arrangement with each column scrolling; the stage fills the height between the strip and the bottom edge. Not in the mock: draft banner row, Run banners, stale validation notice, narrow-width drawer.

## 7. Reuse

- `ui:PageLayout`, `ui:SidePanel`, region containers from the other tasks, part 1 canvas surface and left panel.

## 8. Architecture and code placement

`@WF/page/` (`WorkflowPage.tsx`, `use-page-mode.ts` pure reducer, `regions.tsx`, `ErrorBoundaries.tsx`). The only file that knows all regions; regions never import each other (DIP via props/slots).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. The page enforces Workspace scoping by passing the active Workspace id to every hook; a route param for a Workflow of another Workspace yields not-found (no cross-Workspace peek).

## 10. Errors and edge cases

- Workflow id not found: not-found state.
- Switching Workspace while on the page: navigates to that Workspace's Workflow list/default and clears caches.
- Window narrower than 1100 px: Inspector as a drawer opened by selection.
- Region crash: isolated by boundary.

## 11. Acceptance criteria

- [ ] Given the mock fixtures, then the page equals `design.png` for the visible area and every column scrolls internally.
- [ ] Given `?version=5`, then mode is `viewing_old` and edit controls are hidden.
- [ ] Given a region throws, then the other regions stay interactive.
- [ ] Given 1000 px width, then the Inspector is a drawer.
- [ ] Landmarks and skip links exist and work.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`use-page-mode.test.ts`, page composition test with fake hooks, Storybook full-page stories (`Published`, `Draft`, `Running`, `ViewingOld`, `Failed`), visual page test in `OVE_WFED088`.

## 13. Parallelization notes

Last composition task of the Main view; all region tasks must be merged. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: part 1 owns `feature.manifest.ts` and the route; it imports `WorkflowPage` from `@WF/page` (flagged: ownership of the route component must be agreed with part 1).
- ASSUMPTION: a Workspace can have several Workflows; the Workflow picker/list lives in WSPACE or a part 1 task; this page takes the id from the route.
