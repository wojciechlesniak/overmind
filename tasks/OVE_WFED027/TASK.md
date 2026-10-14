---
id: OVE_WFED027
title: "Wire the canvas toolbar and minimap to the viewport controller, history and node search"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS087, OVE_DS099, OVE_DS100, OVE_WFED008, OVE_WFED019, OVE_WFED024, OVE_WFED039]
soft_depends_on: []
provides: ["ui:EditorViewControls"]
needs: ["ui:WorkflowCanvasPane", "ui:CanvasToolbar", "ui:Minimap", "lib:canvasGeometry", "ui:CanvasViewportController", "lib:editor-session", "lib:editor-history", "ui:NodeSearch", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/ViewControls.tsx", "apps/desktop/src/features/workflow-editor/canvas/MinimapConnector.tsx", "apps/desktop/src/features/workflow-editor/canvas/EditorViewContext.tsx", "apps/desktop/src/features/workflow-editor/canvas/useViewport*.ts", "apps/desktop/src/features/workflow-editor/canvas/ViewControls*.test.tsx", "apps/desktop/src/features/workflow-editor/canvas/ViewControls.stories.tsx", "apps/desktop/src/locales/en/wfc-view.json", "apps/desktop/src/locales/pl/wfc-view.json"]
reads: []
design: design.png
design_source: "Main#canvas/zoom-toolbar (crop 333,815,322,66 CSS px); extra: Main#canvas/minimap (crop 970,770,160,110)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED027: Wire the canvas toolbar and minimap to the viewport controller, history and node search

## 1. Summary

Connects the kit `CanvasToolbar` (zoom out, 70% label, zoom in, Cofnij, Ponów, search, fit) and the kit `Minimap` to the real state: the viewport controller of the canvas, the editor history and the node search. Provides the editor view context that other overlays use.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The mock (design.png): a floating bar at the bottom-left of the stage with `−`, `70%`, `+`, a divider, `Cofnij`, `Ponów`, a divider and a search icon; the minimap (140x92, `design-minimap.png`) at the bottom-right shows node rectangles and the violet viewport rectangle. Both are kit components (DS099 `CanvasToolbar`, DS100 `Minimap`) that depend only on the `CanvasViewportController` interface (DS087), `canUndo/canRedo` callbacks and plain props. In the mock the toolbar covers part of the canvas; real nodes must never be trapped under it: the stage overlay slots reserve space and the user can pan.

## 3. Scope (in)

- `EditorViewContext` exposing the controller, the viewport and the container size.
- `ViewControls` (toolbar wiring) and `MinimapConnector`.
- Zoom percent derivation, bounds, labels and tooltips with shortcuts.
- Hooks for fit-view on load.

## 4. Out of scope

- The kit components themselves (DS099, DS100).
- Viewport persistence (WFED028).
- Search popover (WFED039; the toolbar only calls `openSearch`).
- Keyboard shortcuts (WFED038).

## 5. Detailed requirements

1. `EditorViewContext` (React context created by the pane, WFED024): `{ controller: CanvasViewportController | null; viewport: Viewport; containerSize: {w,h}; openSearch(): void; searchOpen: boolean }`; `controller` comes from the `controllerRef` of `FlowCanvas`; `containerSize` from a `ResizeObserver` (debounced to animation frames; ignores 0x0 hidden tab sizes).
2. `ViewControls` props to the kit toolbar: `controller` (zoomIn, zoomOut, fitView), `zoomPercent = Math.round(viewport.zoom * 100)` (mock `70%`), `canUndo/canRedo` from `useHistoryState` (WFED019), `onUndo/onRedo` = `session.undo/redo`, `onSearch = openSearch`, `mode = session.mode` (the kit hides Cofnij/Ponów in `view` mode), labels object from `wfc-view` (`toolbar` "Widok", `zoomIn` "Powiększ", `zoomOut` "Pomniejsz", `undo` "Cofnij", `redo` "Ponów", `search` "Szukaj Węzła", `fit` "Dopasuj widok"). Tooltips carry shortcuts (`Cofnij · Ctrl/Cmd+Z`, `Szukaj Węzła · Ctrl/Cmd+F`); the undo and redo tooltips also show the history labels (`Cofnij: Przesunięto 3 Węzły`) through `nextUndoLabel()`.
3. Zoom bounds 10 %..200 % are enforced by the controller (clamps) and mirrored by the kit disabled states; clicking the percent label resets to 70 % (kit behaviour).
4. `MinimapConnector`: maps the projection (WFED015) to kit `MinimapProps`: `nodes: { id, rect, kind, state }` where `rect` = node position and the default size of its kind (`nodeBounds`, DS087), `groups` = frame rects, `viewport`, `container`, `controller: { setViewport }`, `size` default 140x92. Rect arrays are memoised by projection identity so the minimap does not recompute while only the viewport changes.
5. Fit on load: after the first successful `initialise`, if the viewport store (WFED028) has no saved viewport, call `controller.fitView()` once (instant under reduced motion); never again automatically (the user owns the viewport afterwards). The toolbar `fit` button always fits.
6. Search panel: when `searchOpen` is true `ViewControls` renders `ui:NodeSearch` (WFED039) in the same bottomLeft overlay, stacked directly above the toolbar (the toolbar stays at its mock position); closing the panel returns focus to the toolbar search button. `ViewControls` also implements the reveal callback of the search (`onReveal(key, { commit })`): it centres the node rectangle (`nodeBounds`) in the container keeping the zoom (raised to 40 % when lower), 150 ms ease, instant under reduced motion; `commit: false` is a peek that the search can undo by restoring the saved viewport.
7. Hidden container (0x0): all calls are no-ops until measured (kit rule); no exceptions.
8. Overlay placement: the pane (WFED024) mounts `ViewControls` in `bottomLeft` and `MinimapConnector` in `bottomRight`; at stage width < 520 the kit collapses labels to icons; the minimap hides below 560 (kit container query).
9. Messages in `wfc-view` (EN default, PL) as above plus `minimap` "Minimapa" and `zoomLabel` "Powiększenie {percent}%".

## 6. Design notes

`design.png`: toolbar container radius 14-16, `rgba(20,15,32,.92)`, 1 px `line`, padding 4; icon buttons 40x40 radius 10; zoom label mono 12/500; `Cofnij`/`Ponów` 13 px `#A79BBF`; position `left 10, bottom 10` of the stage (341, 823 in the mock). `design-minimap.png`: 140x92, radius 10-12, bg `#140F20`, 1 px `line`, rectangles per kind colour (blue public, violet private, mint lane, lavender discussion, amber gate, magenta working) and the viewport rectangle 1.5 px `#9B7BFF`. Not in the mock: disabled undo/redo at the ends (opacity .4 + `aria-disabled`), zoom limit disabled states, view-mode toolbar without undo/redo, hover/focus rings (kit global focus ring), narrow collapsed variant. The overlap of the toolbar over the lower tiles in the mock is a screenshot artefact of a clipped stage; the layout reserves the slot but nodes may sit below it, the user pans.

## 7. Reuse

- `ui:CanvasToolbar` and `ui:Minimap` (DS099, DS100) are used as is (no restyling); `nodeBounds`, `graphBounds` from `lib:canvasGeometry`; history state hook (WFED019).

## 8. Architecture and code placement

Layer: UI wiring in `canvas/`. Depends on kit components, session, the projection of WFED015 (through the pane context).

## 9. Security and safety

No trust boundary; labels are i18n keys. Shortcuts in tooltips are static text. The minimap shows only ids and geometry, no node content.

## 10. Errors and edge cases

- Undo at the start of history: button disabled, no error.
- Controller not ready yet: toolbar buttons disabled.
- 200 nodes: minimap updates throttled to animation frames (kit).
- View mode: undo/redo hidden.
- Fit on an empty document: the controller resets to the default 70 % viewport.

## 11. Acceptance criteria

- [ ] Given zoom 0.7, Then the label reads `70%` and `+` increases it by one step (10 %).
- [ ] Given an undoable edit, Then `Cofnij` is enabled with the label of the command in its tooltip and clicking it undoes the edit.
- [ ] Given a pan, Then the minimap viewport rectangle moves; Given a click on the minimap, Then the viewport centres there.
- [ ] Given view mode, Then undo/redo are not rendered.
- [ ] Visual match with `design.png` and `design-minimap.png` within tolerance when rendered with the mock fixture.

## 12. Test plan

RTL tests with a fake controller; Storybook stories `ViewControls/Default`, `Narrow`, `ViewMode`, `Disabled`; visual comparison with both crops; axe; keyboard (roving tabindex arrows). Commands: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/ViewControls` and the Storybook test runner.

## 13. Parallelization notes

Parallel with WFED025, WFED026, WFED028, WFED029. Opens search through `openSearch` implemented by WFED039.

## 14. Open questions and assumptions

- ASSUMPTION: the controller fit uses padding 40 (DS087).
- OPEN: a Snap toggle button is not in the mock toolbar; the toggle lives in the context menu and as shortcut (WFED026, WFED037).
