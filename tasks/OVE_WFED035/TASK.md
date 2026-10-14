---
id: OVE_WFED035
title: "Add grouping interactions: Subworkflow, Loop, Lane and free frames, ungroup, rename"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS026, OVE_DS028, OVE_DS029, OVE_DS092, OVE_WFED011, OVE_WFED024, OVE_WFED025, OVE_WFED026, OVE_WFED038]
soft_depends_on: []
provides: ["lib:editor-group-wiring"]
needs: ["lib:editor-commands-group", "lib:editor-selection", "lib:editor-snap", "ui:WorkflowCanvasPane", "ui:GroupFrame", "ui:Menu", "ui:Popover", "ui:TextField", "lib:editor-shortcuts", "lib:editor-announcer", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/useGroupWiring.ts", "apps/desktop/src/features/workflow-editor/canvas/GroupKindMenu.tsx", "apps/desktop/src/features/workflow-editor/canvas/FrameRenamePopover.tsx", "apps/desktop/src/features/workflow-editor/canvas/membership.ts", "apps/desktop/src/features/workflow-editor/canvas/limit-label.ts", "apps/desktop/src/features/workflow-editor/canvas/group.shortcuts.ts", "apps/desktop/src/features/workflow-editor/canvas/membership.test.ts", "apps/desktop/src/features/workflow-editor/canvas/limit-label.test.ts", "apps/desktop/src/features/workflow-editor/canvas/GroupKindMenu.stories.tsx", "apps/desktop/src/locales/en/wfc-group.json", "apps/desktop/src/locales/pl/wfc-group.json"]
reads: []
design: design.png
design_source: "Main#canvas/group-frame-loop (crop 340,668,790,218 CSS px; the lower part is covered by the toolbar and minimap in the mock)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED035: Add grouping interactions: Subworkflow, Loop, Lane and free frames, ungroup, rename

## 1. Summary

Lets the Owner draw frames around parts of the graph: group the selection as a free frame, a Loop frame, a Subworkflow frame or a Lane (TOR) frame, ungroup, rename, and change membership by moving a node into or out of a frame; with a "frame this Loop" action that fills the caption from the Loop limits.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. Frames are visual only (WFRT003 `GroupDef`; semantics come from Loop nodes and Lane definitions). The mock frame (design.png): mint rounded rectangle, label top-left `Pętla jakości · Build → QA → Review · iteracja 2 z 5`, limit label top-right `limit 90 min · 5 iteracji`. The persisted `GroupDef` has no rectangle, so the frame is computed from its members (WFED015) and is not resizable; the kit `ResizeGroupIntent` is ignored (WFED016). The iteration text "iteracja 2 z 5" is a Run state shown by the run overlay (PART 2), the editor writes only the static label and limit caption.

## 3. Scope (in)

- Group creation from the selection (`mod+g`, context menu, menu of kinds).
- Ungroup (`mod+shift+g`) and rename.
- Membership changes after a node drag.
- `formatLimitLabel(loopConfig)` and the Loop frame suggestion.
- Keyboard alternatives for membership.

## 4. Out of scope

- Commands (WFED011), frame geometry and drawing (WFED015, DS092), Lane definitions and binding (WFED036).

## 5. Detailed requirements

1. Create: with at least one selected node, `mod+g` (and the context menu item `Grupuj jako…`) opens `GroupKindMenu` (`ui:Menu`): `Grupa` (free), `Pętla` (loop), `Subworkflow`, `Tory (TOR)` (lane). Choosing one runs `buildGroupFromSelection` (WFED011) in one dispatch, selects the new group and opens `FrameRenamePopover` (`ui:Popover` + `ui:TextField`, preselected default label `Pętla 1`, Enter commits `group.update` with coalescing, Esc keeps the default). Disabled when no node is selected.
2. Ungroup: `mod+shift+g` or `Rozgrupuj` removes the selected frame(s) only (`group.remove`), members untouched. Rename: context menu `Zmień nazwę` on a frame opens the same popover; the Inspector (PART 2) may also call `group.update`.
3. Frame kind mapping for display is fixed in WFED015; this task states the semantics shown to the Owner: Pętla = visual frame for a Loop body (limits live in the Loop node), Subworkflow = visual frame (the runnable Subworkflow node is a later node type), Tory = frame around lane work, Grupa = free.
4. `formatLimitLabel(config)` (pure): from a Loop config `limits { maxIterations, maxDurationMs, maxCost }` produce the caption `limit 90 min · 5 iteracji` (duration in minutes when divisible by 60 000 else seconds, hours when >= 120 min: `limit 2 h`; iterations with the PL plural: 1 iteracja, 2-4 iteracje, 5+ iteracji; cost omitted from the caption). Used for `limitLabel` of Loop frames created by `Obramuj pętlę`.
5. `Obramuj pętlę` (context menu on a Loop node): `suggestLoopFrame` (WFED011) -> one transaction `group.create` kind `loop` with members = the Loop node and its body, label `Pętla {n}` and `limitLabel = formatLimitLabel`. If the Loop has no body yet: disabled with reason "Połącz najpierw wyjście `body`".
6. Membership by dragging: after `node.move` commits (WFED026), `membership.ts` evaluates the moved nodes against the OLD frame rectangles (computed before the move): (a) the node centre lies inside another frame rectangle it is not a member of and that frame is not a member-ancestor -> add it to that frame (the innermost frame wins when several contain the point); (b) the node centre lies more than 12 px outside every rectangle of a frame it belongs to -> remove it from that frame; changes are applied in the same transaction as the move (one undo). Moving a whole selected frame moves members and changes nothing.
7. Keyboard alternative for membership (WCAG 2.5.7): context menu items `Dodaj do grupy ▸` (list of frames) and `Usuń z grupy` on a node (WFED037 builds the menu, this task supplies the actions `addToGroup(nodeKeys, groupId)` and `removeFromGroup`).
8. Resize handles are never shown (frames auto-fit); an empty frame disappears from the canvas and is cleaned by `Rozgrupuj` or by deleting.
9. Strings in `wfc-group`: kinds, `defaultLabel` ("Grupa {n}", "Pętla {n}", "Subworkflow {n}", "Tory {n}"), `rename.title` "Nazwa grupy", `ungroup`, `loopFrame`, `loopFrameNoBody`, announcements `created`, `removed`, `memberAdded`.

## 6. Design notes

`design.png`: frame radius 28, 2 px border `rgba(98,227,180,.5)`, fill `rgba(98,227,180,.035)`, label mono 15/500 `#BFF3DF`, limit label mono 12 `#8C80A6`; below tiles. The crop also shows the toolbar and minimap overlays that cover the lower part in the mock (not part of this task). Variants (kit): loop mint, parallel violet (Subworkflow), generic grey (free, Tory). States not in the mock: selected frame (violet 2 px outline offset 4), rename popover, kind menu, empty frame hint. Use `ui:Menu`, `ui:Popover`, `ui:TextField` from the kit; no new styles.

## 7. Reuse

- `buildGroupFromSelection`, `buildUngroup`, `suggestLoopFrame` (WFED011), computed frames (WFED015), `ui:GroupFrame` (DS092), `ui:Menu`, `ui:Popover`, `ui:TextField`, move handling (WFED026), registry (WFED038).

## 8. Architecture and code placement

Shortcut wiring (contract of WFED038): the bindings live in the `*.shortcuts.ts` file owned by this task (`ShortcutBinding[]`, labels come from `wfc-keys`); the behaviour is registered with `useEditorAction(actionId, handler, { enabled })`; the registry applies the guards (view mode, editable focus, open dialogs, IME composition). Layer: `canvas/` wiring plus pure `membership.ts` and `limit-label.ts`. Geometry reads the projection (old rectangles) and never writes coordinates.

## 9. Security and safety

Frame labels are untrusted display text (bounded, rendered as text). Frames carry no semantics, so a malicious label cannot alter execution. The limit caption is derived from the real config but remains informational (the engine enforces limits, WFRT023).

## 10. Errors and edge cases

- Moving a node between two overlapping frames: innermost wins.
- Grouping nodes already in a frame: nested frame (allowed).
- Selection of one node grouped: frame of one member.
- Group of 0 members after deletes: frame hidden, group kept.
- Rename to empty: refused (min 1 char).
- Loop config without limits (invalid draft): caption omitted.
- Dragging a node out by 5 px (within 12 px margin): membership unchanged.

## 11. Acceptance criteria

- [ ] Given Developer, QA, Security selected and `Pętla` chosen, Then a loop group with those members exists and the popover opens with `Pętla 1`.
- [ ] Given Loop limits 5400000 ms and 5 iterations, Then `formatLimitLabel` returns `limit 90 min · 5 iteracji`.
- [ ] Given a node dragged into a frame, Then one undo reverts position and membership together.
- [ ] Given `Rozgrupuj`, Then members remain and the group is removed.
- [ ] Keyboard-only: context menu `Dodaj do grupy` achieves the membership change.
- [ ] Frame matches `design.png` styling via the kit within tolerance.

## 12. Test plan

Pure tests for `membership` (table of positions), `formatLimitLabel` (plural table), hook tests with the real session, Storybook for the kind menu and rename popover, Playwright in WFED047. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/membership src/features/workflow-editor/canvas/limit-label`.

## 13. Parallelization notes

Parallel with WFED032..WFED034 and WFED036.

## 14. Open questions and assumptions

- ASSUMPTION: membership-by-drag uses the node centre and the OLD frame rectangles to avoid the circularity of frames computed from their members.
- OPEN: manual frame size (needs an additive `rect` in WFRT003 `GroupDef`).
