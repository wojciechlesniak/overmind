---
id: OVE_WFED029
title: "Add the canvas legend overlay, empty-canvas hint and read-only chip"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS015, OVE_DS017, OVE_DS032, OVE_DS098, OVE_WFED019, OVE_WFED024]
soft_depends_on: []
provides: ["ui:EditorLegendOverlay", "ui:EditorEmptyHint"]
needs: ["ui:WorkflowCanvasPane", "ui:CanvasLegend", "ui:EmptyState", "ui:Pill", "ui:IconButton", "lib:editor-session", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/LegendOverlay.tsx", "apps/desktop/src/features/workflow-editor/canvas/EmptyHint.tsx", "apps/desktop/src/features/workflow-editor/canvas/ReadOnlyChip.tsx", "apps/desktop/src/features/workflow-editor/canvas/useLegendPreference.ts", "apps/desktop/src/features/workflow-editor/canvas/LegendOverlay*.test.tsx", "apps/desktop/src/features/workflow-editor/canvas/LegendOverlay.stories.tsx", "apps/desktop/src/locales/en/wfc-legend.json", "apps/desktop/src/locales/pl/wfc-legend.json"]
reads: []
design: design.png
design_source: "Main#canvas/legend-card (crop 880,392,245,160 CSS px, includes the validation badge above it, which is PART 2)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED029: Add the canvas legend overlay, empty-canvas hint and read-only chip

## 1. Summary

The floating legend card "ZAKŁADKA NA KAFELKU" explaining the tile tabs, with a dismiss and re-open preference; the hint shown on an empty canvas; and the chip that says the canvas is read-only (published version).

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The mock shows the legend card top-right of the stage under the validation badge with four rows: `PUBLICZNY` "we wszystkich Workspace'ach", `PRYWATNY` "tylko w tym Workspace", `TOR` "prowadzi Zadania po Tablicy", the Skills tab `2 skille` "tu upuszczasz Skille". Visibility words are never colour alone (ADR 0028). VIEWS lists as states NOT shown: empty canvas (new Workflow) and read-only published mode. DS098 provides `CanvasLegend` (dismissible, collapsible, `role="note"`, samples rendered with the same `NodeTab`/`SkillsTab` primitives as the tile).

## 3. Scope (in)

- `LegendOverlay` using `ui:CanvasLegend` with the mock copy; preference open/collapsed/dismissed.
- Re-open affordance after dismissal.
- `EmptyHint` for an empty or Start-only document.
- `ReadOnlyChip` for `view` mode.

## 4. Out of scope

- The kit components (DS098, DS087 `empty`).
- Validation badge (PART 2) in the same top-right stack.
- Palette (WFED030).

## 5. Detailed requirements

1. `LegendOverlay` rows (i18n `wfc-legend`): heading `ZAKŁADKA NA KAFELKU` (`heading`), rows `{ tab: public }` "we wszystkich Workspace'ach" (`rows.public`), `{ tab: private }` "tylko w tym Workspace" (`rows.private`), `{ tab: lane }` "prowadzi Zadania po Tablicy" (`rows.lane`), `{ tab: skills, label: "2 skille" }` "tu upuszczasz Skille" (`rows.skills`). Tab words come from the kit `NodeTab` (`PUBLICZNY`, `PRYWATNY`, `TOR`), the Skills sample label uses the same plural message as the tile (`wfc-canvas:skills.count`).
2. Preference `overmind.wfc.legend` in `localStorage`: `"open"` (default), `"collapsed"`, `"dismissed"`; try/catch, in-memory fallback; one preference for the whole app (not per Workflow). Dismiss (kit close button) -> `dismissed` and a small `ui:IconButton` (`help` icon, label "Pokaż legendę zakładek") takes its place in the same corner so the Owner can bring it back; collapse toggles a one-line chip "Legenda zakładek".
3. Placement: `topRight` stack below the validation badge slot (pane, WFED024), `right 10`, below the badge (`top` = badge height + 8), width 217-310 px; below stage width 900 the legend starts collapsed (chip). It never overlaps the toolbar or the minimap (they are in the bottom corners) and has `pointer-events` only on the card itself.
4. `EmptyHint`: shown when the document has no nodes (kit `empty` prop with `ui:EmptyState`: icon `workflow`, title "Przeciągnij Węzeł z palety, aby zacząć", text "Dodaj Agenta, połącz go ze Startem i zapisz wersję roboczą.") or only a Start node (a lightweight card placed to the right of Start with the same title and the arrow glyph `←` in the text, `pointer-events: none`, disappears with the second node). In `view` mode (published version without nodes) the text is "Ta wersja jest pusta".
5. `ReadOnlyChip`: `ui:Pill` with a lock icon and the words "Tylko do odczytu", `aria-label` "Wersja opublikowana, tylko do odczytu"; rendered in `topLeft` when `mode === "view"`; with `readOnlyReason: "from_future"` or `"unreadable"` the words are "Tylko do odczytu · nie można edytować" and the pill uses the amber tone from the kit.
6. All strings are i18n keys; the kit components take them as props (G3).

## 6. Design notes

`design.png`: card `rgba(20,15,32,.92)`, radius 16-18, 1 px `line`, padding 12-16, gap 10; heading mono 11 `#8C80A6`, letter-spacing 0.1em; rows with the filled tab (`#6FA8FF` public, `#9B7BFF` private, `#62E3B4` lane) and 14 px text `#EFE9F7`; Skills tab outlined blue with the cube icon. The mock shows it overlapping the validation badge; in the implementation the badge sits above it. Not in the mock: collapsed chip, dismissed state with the re-open button, empty hint, read-only chip. Derive: chip = `Pill` neutral (`bg-surface`, 1 px `line`), amber tone for non editable data; focus rings from the global style; reduced motion: no slide.

## 7. Reuse

- `ui:CanvasLegend` (DS098) renders the card; `ui:EmptyState`, `ui:Pill`, `ui:IconButton`; the plural message from WFED024. No custom tab styling (the kit tab components are the single source of truth).

## 8. Architecture and code placement

Layer: UI in `canvas/`. Components exported for the pane to place; the pane owns placement (WFED024).

## 9. Security and safety

Static copy only; no untrusted data. The preference is non sensitive.

## 10. Errors and edge cases

- Storage blocked: legend stays open each session.
- Very narrow stage: collapsed chip.
- Document gets its first node while the hint is visible: hint disappears.
- Reduced motion: no transitions.
- High contrast: tab words remain readable (kit tokens).

## 11. Acceptance criteria

- [ ] Given the default state, Then the card shows the four rows with the specified copy and matches `design.png` within tolerance.
- [ ] Given dismiss then reload, Then the re-open button is shown instead of the card.
- [ ] Given an empty document, Then the hint text is present and the role is `status`.
- [ ] Given `view` mode, Then the read-only chip is rendered with the words "Tylko do odczytu".
- [ ] axe is clean for all stories.

## 12. Test plan

RTL tests, Storybook stories `Legend/Open`, `Collapsed`, `Dismissed`, `EmptyHint`, `ReadOnlyChip` with play functions, visual test vs `design.png`. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/LegendOverlay` plus Storybook test runner.

## 13. Parallelization notes

Parallel with WFED025..WFED028; the pane mounts these components in its slots (no edits to the pane).

## 14. Open questions and assumptions

- OPEN (DS): a `help` icon in the kit icon set; fallback `info`.
- ASSUMPTION: legend visible by default and dismissible (DS098 open question).
