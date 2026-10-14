---
id: OVE_WFED030
title: "Build the Nodes palette panel from the catalogue (MVP nodes enabled, later nodes disabled)"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS022, OVE_DS028, OVE_DS032, OVE_DS098, OVE_WFED005, OVE_WFED016, OVE_WFED019]
soft_depends_on: []
provides: ["ui:NodesPalettePanel"]
needs: ["lib:editor-node-catalog", "lib:editor-session", "lib:canvas-intent-translator", "ui:CanvasPalette", "ui:PaletteChip", "ui:SectionLabel", "ui:Skeleton", "ui:Tooltip", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/palette/NodesPalettePanel.tsx", "apps/desktop/src/features/workflow-editor/palette/palette-items.ts", "apps/desktop/src/features/workflow-editor/palette/useNodesPalette.ts", "apps/desktop/src/features/workflow-editor/palette/*.test.ts", "apps/desktop/src/features/workflow-editor/palette/NodesPalettePanel.test.tsx", "apps/desktop/src/features/workflow-editor/palette/NodesPalettePanel.stories.tsx", "apps/desktop/src/locales/en/wfc-palette.json", "apps/desktop/src/locales/pl/wfc-palette.json"]
reads: []
design: design.png
design_source: "Main#canvas/node-palette (crop 72,744,240,156 CSS px; the mock palette is clipped by the viewport, it scrolls)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED030: Build the Nodes palette panel from the catalogue (MVP nodes enabled, later nodes disabled)

## 1. Summary

The "Węzły" section of the left panel: draggable chips for Agent, Parallel, Join, IF, Loop, Dyskusja and Review (plus Quality Gate and Zapisz Decyzje), followed by the later node types as disabled entries. The list is derived from the engine catalogue, so a new MVP node type appears without editing the palette.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. ADR 0024 MVP catalogue: Agent, Parallel, Join, IF, Loop, Dyskusja, Review (and Start/End). SPEC 7 later nodes: Switch, Retry/Fallback, Approval, Memory Read/Write, Subworkflow, Transform, Trigger/Wait, Notification, Model Router. The mock palette (design.png) lists seven chips in a wrapping flex (Agent, Parallel / Join, IF / Loop, Dyskusja / Review), each 40 px high with an icon and a label. DS098 provides `CanvasPalette` and `PaletteChip` (custom MIME `application/x-overmind-node+json` with `{ v: 1, kind }` validated against the `NodeKind` allowlist, `Enter`/`Space` = `onAdd(kind)` as the keyboard alternative, disabled chips with a reason tooltip).

## 3. Scope (in)

- `useNodesPalette()`: derives the ordered item list from the catalogue and session mode.
- `NodesPalettePanel` composing `ui:CanvasPalette`.
- Icons, labels and disabled reasons.
- The `kindToNodeType` table reuse for drag payload kinds.

## 4. Out of scope

- Adding the node on drop or key press (WFED031).
- Skills section and the panel layout (WFED040, WFED044).
- Search over node types (not planned).

## 5. Detailed requirements

1. Order (stable, a constant `PALETTE_ORDER` in `palette-items.ts`): `agent`, `parallel`, `join`, `if`, `loop`, `discussion`, `review` (the seven of the mock, in mock order), then any other catalogue type with `mvp && addable` and a kit kind (`quality_gate`, `save_decisions`) in catalogue order, then a `SectionLabel` "Wkrótce" followed by disabled entries for every `LATER_NODE_TYPES` item (WFED005) that the catalogue does not list as available. `start` and `end` are NOT chips (Start is created with the Workflow, End is added through the quick-add menu of WFED031 because the kit has no End kind for the drag payload).
2. Item model: `{ type, kind: NodeKind, labelKey, icon, disabled, disabledReason?, mvp }`. Kit kind via `kindForType(type)` (the inverse of `kindToNodeType`, WFED016: the palette Agent chip uses `agent-public` as its visual blueprint). Icons (DS098): Agent `users`, Parallel `workflow`, Join `workflow`, IF `branch`, Loop `refresh`, Dyskusja `discussion`, Review `check`; Quality Gate `check` variant `shield` if the icon exists else `check`; Zapisz Decyzje `board`; later nodes `lock` suffix glyph in the disabled style. Missing icons fall back to `workflow` (never throw).
3. Disabled rules: (a) `session.mode === "view"` -> every chip disabled with reason `wfc-palette:disabled.view` ("Otwórz wersję roboczą, aby dodawać Węzły"); (b) catalogue type flagged `unavailable` -> `disabled.unavailable` ("Niedostępny w tej wersji aplikacji"); (c) later nodes -> `disabled.later` ("Dostępne w późniejszej wersji"); (d) node count at 200 -> `disabled.limit` ("Osiągnięto limit 200 Węzłów"); (e) `maxPerWorkflow` reached -> `disabled.max`. Disabled chips are `aria-disabled` (not removed from the tab order so the reason is reachable) and carry the reason as tooltip text.
4. Labels (`wfc-palette`, EN default / PL as the mock): `heading` "Nodes"/"Węzły", `agent` "Agent", `parallel` "Parallel", `join` "Join", `if` "IF", `loop` "Loop", `discussion` "Discussion"/"Dyskusja", `review` "Review", `quality_gate` "Quality Gate", `save_decisions` "Save Decisions"/"Zapisz Decyzje", later: `switch` "Switch", `retry_fallback` "Retry / Fallback", `approval` "Approval", `memory_read` "Memory Read", `memory_write` "Memory Write", `subworkflow` "Subworkflow", `transform` "Transform", `trigger_wait` "Trigger / Wait", `notification` "Notification", `model_router` "Model Router"; `later` "Wkrótce"; `list` aria label "Paleta Węzłów". Unknown catalogue types use `node.displayKey` from the catalogue.
5. Loading: while the catalogue is loading the panel shows 7 `ui:Skeleton` chips of 40 px; on catalogue error it shows nothing (the loader gate already blocks the editor, WFED020).
6. Behaviour is delegated: `onAdd(kind)` calls the add-node service of WFED031; the drag payload is produced by the kit chip (do not build `dataTransfer` here).
7. The panel reads the node count with a narrow selector (`nodeCount`) so adding nodes re-renders only the disabled flags, not the whole panel.

## 6. Design notes

`design.png`: heading `Węzły` 18/700; chips on `bg-surface` (`#140F20`) with `1px line`, radius 12, padding 0 14, gap 8, icon 16 `#D6C9FF` and label 14/600; wrapping rows `Agent`, `Parallel` / `Join`, `IF` / `Loop`, `Dyskusja` / `Review` (the mock is clipped after the third row; in the app the panel scrolls). Chip widths are content-driven (Agent 83.6 px). The later section: `SectionLabel` "WKRÓTCE" mono 11 `#8C80A6` +0.1em, chips at opacity .4 with a lock icon. States not in the mock: hover (border `line-strong`), focus ring, pressed, disabled + tooltip, drag source dim, skeleton.

## 7. Reuse

- `ui:CanvasPalette`, `ui:PaletteChip` (DS098), `ui:SectionLabel`, `ui:Skeleton`, `ui:Tooltip`; catalogue queries and `LATER_NODE_TYPES` (WFED005); `kindToNodeType` table (WFED016).

## 8. Architecture and code placement

Layer: UI in `palette/` (items derivation is a pure function with its own tests). Depends on catalogue and session selectors.

## 9. Security and safety

Chip kinds come from a fixed allowlist, never from catalogue strings; a catalogue type with an unknown kind is shown disabled. Reasons are static i18n text.

## 10. Errors and edge cases

- Catalogue with a new MVP type and no kit kind: not shown as a draggable chip, listed disabled with reason `unavailable`.
- 200 nodes reached: all chips disabled with the limit reason.
- View mode: all chips disabled; the panel stays visible.
- Very narrow panel (< 160 px): chips wrap one per row.
- Missing translation: EN fallback (i18n infra).

## 11. Acceptance criteria

- [ ] Given the MVP fixture catalogue, Then the first seven chips are Agent, Parallel, Join, IF, Loop, Dyskusja, Review in that order.
- [ ] Given `view` mode, Then all chips are `aria-disabled` with the view reason.
- [ ] Given a catalogue without `subworkflow`, Then a disabled "Subworkflow" appears under "Wkrótce".
- [ ] Given 200 nodes, Then chips are disabled with the limit reason.
- [ ] The panel matches `design.png` for the visible rows within tolerance.

## 12. Test plan

Unit tests of `palette-items` (ordering, disabled rules), RTL tests, Storybook stories `Palette/Default`, `View`, `Loading`, `AtLimit` with play functions (keyboard Enter on a chip calls `onAdd`), visual test vs crop, axe. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/palette` plus Storybook test runner.

## 13. Parallelization notes

Parallel with WFED031 and WFED040. WFED044 composes this panel.

## 14. Open questions and assumptions

- ASSUMPTION: Quality Gate and Zapisz Decyzje chips are added beyond the seven of the mock because the Loop flow cannot be built without a gate and the mock shows both nodes on the canvas. Owner to confirm.
- OPEN (DS): icons for Quality Gate and Save Decisions (fallbacks defined).
