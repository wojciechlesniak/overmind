---
id: OVE_WFED026
title: "Wire node moving: snap-to-grid preference, keyboard nudge coalescing and frame-aware moves"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS096, OVE_WFED008, OVE_WFED009, OVE_WFED016, OVE_WFED019, OVE_WFED024]
soft_depends_on: []
provides: ["lib:editor-snap"]
needs: ["lib:canvas-intent-translator", "ui:WorkflowCanvasPane", "lib:editor-session", "lib:editor-commands-node", "lib:canvasKeymap"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/snap.ts", "apps/desktop/src/features/workflow-editor/canvas/useSnapPreference.ts", "apps/desktop/src/features/workflow-editor/canvas/useMoveHandling.ts", "apps/desktop/src/features/workflow-editor/canvas/snap.test.ts", "apps/desktop/src/features/workflow-editor/canvas/useMoveHandling.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED026: Wire node moving: snap-to-grid preference, keyboard nudge coalescing and frame-aware moves

## 1. Summary

Makes moving nodes behave: the 22 px grid snap (default on, toggleable, remembered per user), exact `snapPoint` used by every creation path, a drag that becomes one history entry, and keyboard nudges that coalesce into one undo step.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The canvas has a 22 px dot grid (DS087: `snap(p, grid=22)`, snapping opt-in at the geometry level); DS096 snaps node positions to 22 when snapping is on (default on; `Alt` disables it while dragging) and moves selected nodes with the arrow keys by 22 (Shift = 110) in edit mode. Positions are persisted as integers (WFED013), so snapping must produce integers.

## 3. Scope (in)

- `snapPoint(point, { enabled, grid = 22 })`, `snapDelta`.
- `useSnapPreference()` (localStorage, try/catch).
- Move handling: drag end and nudge -> `node.move` commands with the right coalescing and transactions.
- Selection of frames moving members.

## 4. Out of scope

- The drag gesture and auto-pan (kit).
- Palette drop position (WFED031 uses `snapPoint`).
- Align and distribute (not planned).

## 5. Detailed requirements

1. `snapPoint(p, o)`: when `enabled`, `round(p.x / grid) * grid` for both axes (grid 22), otherwise `Math.round`; always finite and clamped by `clampPosition`. Pure, exported as `lib:editor-snap` for WFED031 and WFED034.
2. Preference: key `overmind.wfc.snap` value `"on" | "off"`, default `"on"`; read/write wrapped in try/catch (private window, blocked storage: fall back to in-memory, never throw); changes broadcast through a small store so toolbar/context menu stay in sync. The toggle is offered in the context menu of WFED037 (`Przyciąganie do siatki`) and by the shortcut `Shift+G` registered in WFED038.
3. `useMoveHandling`: receives `onNodesMove(moves)` from the kit (already snapped by the kit when its snap is on; the kit is told `snap = preference`), builds the plan (WFED016) and dispatches one `node.move`; a drag of several selected nodes is one command (one history entry); when a frame (group) is selected and moved, the move set is the frame members (frames have no position of their own).
4. Keyboard nudge (arrows with a selection, edit mode, canvas focused): the kit emits move intents; each nudge dispatches `node.move` with the coalesce key of the node set, so repeated presses within 800 ms are one undo step (WFED008). Shift multiplies by 5 (110 px). With snap off the step is 1 px (Shift 10 px).
5. Clamping: positions beyond +-100 000 are clamped; the user sees no error (the canvas cannot reach it by dragging).
6. View mode: nothing is dispatched (kit does not drag, handler also guards).
7. Moving does not reorder z-order (`nodeOrder` untouched). Clicking a node to select does not change `nodeOrder` either (no bring-to-front in MVP).
8. The document stores integer positions only (assertion in tests).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:canvasGeometry` `snap` (DS087) is the kit-level primitive; `snapPoint` wraps it with rounding to integers and the preference (no second grid constant: import the grid value from the kit export `CANVAS_GRID`).
- `node.move` builder (WFED009), plans (WFED016).

## 8. Architecture and code placement

Layer: `canvas/` wiring + pure `snap.ts`. localStorage access only in `useSnapPreference` (one place, wrapped).

## 9. Security and safety

Preference storage is a per-user convenience only (never for state that must be reliable); it can be empty, blocked or throw, and the editor must work without it. No secrets.

## 10. Errors and edge cases

- Storage throws: in-memory default on.
- Drag of 200 nodes (select all): one command of 200 moves, applied in one update.
- Snap on and a node at 10 000.5: rounds to the grid.
- A nudge on a view-mode document: ignored.
- Frame selected with no members: no-op.

## 11. Acceptance criteria

- [ ] Given snap on and a drag ending at (101, 53), Then the stored position is (110, 44).
- [ ] Given snap off, Then the stored position is (101, 53).
- [ ] Given 5 arrow presses within 800 ms, Then one undo returns the node to the start.
- [ ] Given a selected frame moved by 44 px, Then all member nodes moved by 44 px in one command.
- [ ] Given blocked localStorage, Then snap defaults to on and nothing throws.

## 12. Test plan

Unit tests for `snapPoint` (table + property: idempotent, integer output), hook tests with fake session and fake storage. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/snap src/features/workflow-editor/canvas/useMoveHandling`.

## 13. Parallelization notes

Parallel with WFED025, WFED027..WFED029. WFED031 and WFED034 import `snapPoint`.

## 14. Open questions and assumptions

- ASSUMPTION: the kit exports `CANVAS_GRID = 22` (DS087 text calls it the dot grid); if not, a proposal to DS adds it.
