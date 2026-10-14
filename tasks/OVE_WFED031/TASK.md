---
id: OVE_WFED031
title: "Add nodes from the palette: drop, keyboard add and the quick-add menu"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS029, OVE_DS037, OVE_DS096, OVE_WFED009, OVE_WFED016, OVE_WFED024, OVE_WFED025, OVE_WFED026, OVE_WFED030, OVE_WFED038]
soft_depends_on: []
provides: ["lib:editor-add-node", "ui:QuickAddMenu"]
needs: ["ui:NodesPalettePanel", "lib:editor-snap", "lib:editor-selection", "lib:canvas-intent-translator", "ui:WorkflowCanvasPane", "ui:CanvasInteractions", "ui:Menu", "ui:useToast", "lib:editor-shortcuts", "lib:editor-announcer", "lib:editor-commands-node"]
owns: ["apps/desktop/src/features/workflow-editor/palette/add-node.ts", "apps/desktop/src/features/workflow-editor/palette/useAddNode.ts", "apps/desktop/src/features/workflow-editor/palette/QuickAddMenu.tsx", "apps/desktop/src/features/workflow-editor/palette/quick-add.shortcuts.ts", "apps/desktop/src/features/workflow-editor/palette/add-node*.test.ts", "apps/desktop/src/features/workflow-editor/palette/QuickAddMenu.stories.tsx", "apps/desktop/src/locales/en/wfc-add.json", "apps/desktop/src/locales/pl/wfc-add.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED031: Add nodes from the palette: drop, keyboard add and the quick-add menu

## 1. Summary

Creates nodes from every entry point with identical behaviour: drag a palette chip onto the canvas, press Enter on a chip, use the quick-add menu (Shift+A or pane context menu). Position is snapped, collisions are avoided, the new node is selected and announced.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. DS096: a palette drag carries `{ v:1, kind }`; on drop over the pane the screen point becomes a world point (`screenToWorld`), then snaps, and the interactions emit `AddNodeIntent { kind, position }`; dropping outside the pane cancels; WCAG 2.5.7 requires a non-drag alternative: palette item `Enter` adds a node at the viewport centre. The mock palette has no End chip, so End and other non-chip types are added through the quick-add menu.

## 3. Scope (in)

- `addNodeAt(type, worldPoint, opts)` service shared by all entry points.
- Collision avoidance and placement rules.
- Quick-add menu and its shortcut.
- Post-add behaviour: select, announce, optional Inspector focus.

## 4. Out of scope

- Chip rendering (WFED030), command handlers (WFED009), context menu shell (WFED037 calls this service).

## 5. Detailed requirements

1. `addNodeAt(ctx, { type, at: Point, source: "drop" | "keyboard" | "menu" }): Result<NodeKey, CommandError>`: builds `buildAddNode` (WFED009) with the snapped point (`snapPoint`, WFED026), dispatches inside `session.transaction`, selects the new node (effects), announces `Dodano Węzeł {label}`, and for types with `usesAgent` and no Agent calls `onOpenInspector({ kind: "node", id, section: "agent" })` (PART 2 focuses the Agent picker) so the author is led to the next required step. `Start` is refused (`type_limit`), existing Start is never duplicated.
2. Drop path: the kit emits `AddNodeIntent`; the pane (WFED024) forwards it to `addNodeAt` through the plan translator; the position is the pointer point in world coordinates centred on the tile (the tile top-left = point minus half the default size of the kind from the kit `kinds`) then snapped. A drop that lands on an existing tile is shifted by the collision rule.
3. Keyboard path: palette chip `Enter`/`Space` -> `onAdd(kind)` -> world point of the visible stage centre (`controller.screenToWorld({ x: w/2, y: h/2 })` from `EditorViewContext`, WFED027), snapped. Collision rule (all paths): if the tile rectangle (kit default size + 8 px margin) overlaps any existing node rectangle, shift by `(44, 44)` repeatedly up to 20 times, then give up shifting; the node is created anyway (overlap is legal).
4. Quick-add menu: `Shift+A` (shortcut registered in `quick-add.shortcuts.ts`, WFED038 registry) or pane context menu item `Dodaj Węzeł`: a `ui:Menu` listing all addable catalogue types (`addable && !maxReached`), the seven MVP ones first, then End, Quality Gate, Save Decisions; type-ahead filters by label; opened at the pointer (context menu) or at the stage centre (keyboard). Selecting an item calls `addNodeAt(..., source: "menu")`. Later nodes are not listed.
5. After adding: focus moves to the new tile (`selection.focus`) so Tab continues from it; the minimap and viewport are not moved unless the point is outside the visible rectangle, in which case the viewport pans minimally to reveal it (150 ms ease, instant under reduced motion).
6. Failure feedback: `limit_exceeded` -> toast (`ui:useToast`) "Osiągnięto limit 200 Węzłów" and an assertive announcement; `type_limit` -> "Workflow ma już Start"; `read_only` -> nothing (chips are disabled).
7. Messages in `wfc-add` (`added` "Dodano Węzeł {label}", `limit`, `maxStart`, `quickAdd.title` "Dodaj Węzeł", `quickAdd.search` "Szukaj typu Węzła", `quickAdd.empty`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `buildAddNode`, `session.transaction` (WFED009, WFED019); `snapPoint` (WFED026); `ui:Menu`, `ui:useToast`; kit `kinds` default sizes and `controller.screenToWorld` (DS087); announcer (WFED024); shortcut registry (WFED038).

## 8. Architecture and code placement

Shortcut wiring (contract of WFED038): the bindings live in the `*.shortcuts.ts` file owned by this task (`ShortcutBinding[]`, labels come from `wfc-keys`); the behaviour is registered with `useEditorAction(actionId, handler, { enabled })`; the registry applies the guards (view mode, editable focus, open dialogs, IME composition). Layer: `palette/` service + hooks; the menu component in the same folder. No document logic here (commands own it).

## 9. Security and safety

The drop payload is validated by the kit against the `NodeKind` allowlist; the service additionally maps kind -> type through a fixed table and ignores anything else. Position is clamped by the builder. A foreign page cannot add nodes: payloads from other origins fail MIME validation.

## 10. Errors and edge cases

- Drop outside the pane: kit cancels.
- Drop in view mode: ignored.
- Drop while a Skill drag is active: separate MIME, ignored.
- Stage hidden (0x0): the keyboard path refuses with a message instead of NaN coordinates.
- Add while the Inspector is closed: callback optional.
- Rapid double Enter: two nodes at shifted positions.

## 11. Acceptance criteria

- [ ] Given an empty stage and a drop at (500, 300) with snap on, Then an Agent node exists at the snapped world position and is selected.
- [ ] Given Enter on the Agent chip, Then the node appears at the stage centre; a second Enter yields a node shifted by 44 px.
- [ ] Given `Shift+A` and choosing End, Then an `end` node is added.
- [ ] Given 200 nodes, Then a toast shows the limit message and nothing changes.
- [ ] Given a new Agent node, Then `onOpenInspector` is called with section `agent`.
- [ ] Given view mode, Then no node is added by any path.

## 12. Test plan

Unit tests for the placement/collision function; RTL tests of the menu; Playwright coverage in WFED047 (drag with a synthetic DataTransfer). Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/palette/add-node src/features/workflow-editor/palette/QuickAddMenu`.

## 13. Parallelization notes

Needs the shortcut registry (WFED038) merged for the shortcut file; otherwise parallel.

## 14. Open questions and assumptions

- ASSUMPTION: the `AddNodeIntent.position` from the kit is the pointer point (not the tile top-left); if the kit already centres the tile, remove the half-size adjustment in one place (`add-node.ts`).
- OPEN (DS): an `end` NodeKind for the drag payload (then End can become a chip).
