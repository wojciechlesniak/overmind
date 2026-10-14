---
id: OVE_WFED084
title: "Wire the legend card ('Zakładka na kafelku') and canvas overlay toggles"
area: WFED
kind: ui
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS015, OVE_DS028, OVE_DS098, OVE_WFED050]
soft_depends_on: []
provides: ["feature:wfed-legend"]
needs: ["ui:CanvasLegend", "ui:IconButton", "ui:Tooltip", "lib:i18n-ui", "feature:editor-canvas-surface"]
owns: ["apps/desktop/src/features/workflow-editor/legend/**", "apps/desktop/src/locales/en/wfed-legend.json", "apps/desktop/src/locales/pl/wfed-legend.json"]
reads: []
design: design.png
design_source: "Main#canvas/legend-card (crop 880,415,235,140)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED084: Wire the legend card ('Zakładka na kafelku') and canvas overlay toggles

## 1. Summary

The floating legend card explaining the tile tabs (PUBLICZNY, PRYWATNY, TOR, '2 skille') with a collapse/hide toggle remembered per user, placed so it never overlaps the validation badge, minimap or toolbar.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). Mock region `canvas/legend-card` (889,423,217x123): heading 'ZAKŁADKA NA KAFELKU' with rows 'PUBLICZNY — we wszystkich Workspace'ach', 'PRYWATNY — tylko w tym Workspace', 'TOR — prowadzi Zadania po Tablicy', '2 skille — tu upuszczasz Skille'. DS098 provides `CanvasLegend`.

## 3. Scope (in)

- Container for `ui:CanvasLegend` with copy from i18n.
- Collapse/expand and hide (stored in `localStorage` through a safe wrapper, per user, default expanded).
- Overlap avoidance via the stage slot system.

## 4. Out of scope

- `CanvasLegend` component (DS098).

## 5. Detailed requirements

1. Rows exactly as the mock copy; each tab sample is the real `ui:NodeTab` look (visibility always a word).
2. A small 'Legenda' toggle in the stage corner reopens it after hiding; the collapsed state shows only the heading.
3. Stored preference key `overmind.wfed.legend` guarded by try/catch (storage may throw); the UI works without it.
4. Auto-collapse when the stage is narrower than 720 px.
5. `role=complementary` with `aria-label` 'Legenda zakładek'; collapse button `aria-expanded`.
6. Position: top right below the validation badge (mock: right 10, top 52); when the minimap is visible the legend never covers it (stage slot reservation).

## 6. Design notes

`design.png` shows the card (width 217 screen px, translucent dark card with 4 rows). Collapsed and hidden states are not in the mock: collapsed = heading row only; hidden = toggle chip in the corner.

## 7. Reuse

- `ui:CanvasLegend`, `ui:IconButton`, `ui:Tooltip`.

## 8. Architecture and code placement

`@WF/legend/LegendContainer.tsx`, `use-legend-preference.ts`.

## 9. Security and safety

Local preference only; no sensitive data.

## 10. Errors and edge cases

- localStorage unavailable: default expanded, toggle works for the session.
- Stage extremely narrow: legend hidden, toggle remains.

## 11. Acceptance criteria

- [ ] Given the mock copy, then the card equals `design.png`.
- [ ] Given collapse and reload, then the preference persists when storage works.
- [ ] Given storage throwing, then no error surfaces.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component test with storage stub, stories `Expanded`, `Collapsed`, `Hidden`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- None.
