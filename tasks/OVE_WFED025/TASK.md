---
id: OVE_WFED025
title: "Wire selection and multi-select: controlled sync, group rules, Inspector target"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS095, OVE_WFED019, OVE_WFED024]
soft_depends_on: []
provides: ["lib:editor-selection"]
needs: ["lib:editor-session", "ui:WorkflowCanvasPane", "ui:FlowCanvas"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/selection.ts", "apps/desktop/src/features/workflow-editor/canvas/useSelectionSync.ts", "apps/desktop/src/features/workflow-editor/canvas/useInspectorTarget.ts", "apps/desktop/src/features/workflow-editor/canvas/selection*.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED025: Wire selection and multi-select: controlled sync, group rules, Inspector target

## 1. Summary

Defines how selection works in the editor: the kit selection (click, Shift/Cmd toggle, box select, select all, Escape) is mirrored into the session, selection survives undo/redo where elements still exist, and a single hook tells PART 2 which element the Inspector shows.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The mock shows one selected tile (violet 4 px ring, Developer) with the Inspector on the right. DS096 provides the gestures: click selects, Shift/Cmd click toggles, drag on empty pane draws a selection box, Cmd/Ctrl+A selects all, Esc clears; selection changes are reported through `onSelectionChange`; the Inspector follows the single selection. The selection itself is editor state held in the session (WFED019), not in React Flow.

## 3. Scope (in)

- `SelectionState` helpers (pure): `selectOnly`, `toggle`, `selectAll`, `clear`, `prune`.
- `useSelectionSync` between kit and session.
- `useInspectorTarget()` for PART 2.
- Selection after commands (new elements become selected).
- Group selection rules.

## 4. Out of scope

- The gestures themselves (kit DS096).
- Inspector UI (PART 2).
- Keyboard bindings outside the kit (WFED038).

## 5. Detailed requirements

1. `selection.ts` (pure): `SelectionState { nodes, edges, groups, focus? }` operations return new objects only when something changed (identity stable for equal content so React does not re-render).
2. `useSelectionSync`: kit `onSelectionChange({nodeIds, edgeIds})` -> `session.setSelection` (groups are selected through the frame label strip, kit emits group ids as node ids prefixed by the kit group id scheme; the hook splits them using the document group map). The `selection` prop of `FlowCanvas` is derived from the session; the sync is idempotent (no echo loop: ignore a kit event equal to the current session selection).
3. Rules: (1) click on a node replaces the selection; (2) Shift/Cmd toggles; (3) clicking a frame label selects the GROUP only (the Inspector shows frame properties), Cmd+click on the label adds all members to the node selection; (4) Esc and click on empty pane clear; (5) selecting an edge clears nodes (edges and nodes are not mixed, simplest Inspector contract), except in box select which only selects nodes; (6) in `view` mode selection works the same (read-only Inspector); (7) the selection is cleared on `initialise`.
4. After commands: the effects `selection` field (WFED007) sets the selection (paste selects the pasted nodes, add selects the new node, group create selects the group, delete clears); undo/redo restore the recorded selection pruned to existing elements (`prune(selection, doc)` runs on every document change).
5. `useInspectorTarget()` returns the discriminated union the Inspector needs: `{ kind: "none" } | { kind: "node"; key } | { kind: "edge"; id } | { kind: "group"; id } | { kind: "multiple"; nodes: NodeKey[]; edges: EdgeId[] }`, memoised, re-rendering only when the target changes. PART 2 MUST use this hook (single contract, DRY) and MUST NOT read the kit selection.
6. `selectAll` selects nodes only (not edges, not groups); a count over 200 is impossible by limits.
7. Selection never changes the document and never enters history (as in most editors); it is only stored in history entries as before/after hints.
8. Focus: `selection.focus` is the element that has keyboard focus (for Tab order and screen readers); updated from the kit focus events; used by shortcuts (WFED038) to know the node `C` (connect) starts from.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `SelectionState` from WFED019; kit selection callbacks (DS095/DS096); announcer for "Zaznaczono 3 Węzły" (WFED024).

## 8. Architecture and code placement

Layer: `canvas/` wiring plus pure helpers. Depends on session and the kit; PART 2 depends on `useInspectorTarget`.

## 9. Security and safety

Selection holds ids only. It cannot be used to address elements of another Workflow (ids are validated against the document on every sync).

## 10. Errors and edge cases

- Kit reports an id that is not in the document (stale event): ignored.
- Delete of the selected node: selection pruned in the same notification.
- Box select while panning with Space: kit decides; no selection change.
- Selecting a group whose members are all deleted: group pruned only if the group is removed.
- Multiple edges selected via Shift: allowed, Inspector shows `multiple`.

## 11. Acceptance criteria

- [ ] Given a click on Developer, Then `useInspectorTarget` returns `{kind:"node", key:"developer"}`.
- [ ] Given Shift-click on QA, Then target `multiple` with 2 nodes.
- [ ] Given undo of a node add, Then the selection no longer contains the removed node and no error occurs.
- [ ] Given a kit event equal to the session selection, Then no state change and no re-render.
- [ ] Given `initialise`, Then the target is `none`.

## 12. Test plan

Unit tests of pure helpers (including identity stability), hook tests with a fake kit event source, render-count tests. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/selection`.

## 13. Parallelization notes

Parallel with WFED026..WFED029. PART 2 depends on `useInspectorTarget`.

## 14. Open questions and assumptions

- ASSUMPTION: edges and nodes are never selected together (except box select = nodes only).
