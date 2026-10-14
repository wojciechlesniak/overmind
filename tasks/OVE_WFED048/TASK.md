---
id: OVE_WFED048
title: "Visual regression of canvas, left panel, toolbar and minimap against the Main crops"
area: WFED
kind: test
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST004, OVE_TEST005, OVE_WFED014, OVE_WFED017, OVE_WFED024, OVE_WFED027, OVE_WFED029, OVE_WFED035, OVE_WFED042, OVE_WFED044]
soft_depends_on: []
provides: ["suite:editor-visual"]
needs: ["ui:EditorSideRail", "ui:WorkflowCanvasPane", "ui:EditorViewControls", "ui:EditorLegendOverlay", "lib:workflow-mapper-fixtures", "lib:visual-regression", "lib:design-crop-compare", "lib:playwright-harness", "lib:e2e-fixtures"]
owns: ["apps/desktop/e2e/workflow-editor/visual/**", "apps/desktop/src/features/workflow-editor/testing/visual/**"]
reads: []
design: design.png
design_source: "Main#canvas/stage (crop 330,386,802,498 CSS px: the whole stage of the Main view; other regions are compared from the crops of WFED014, 024, 027, 029, 030, 036, 040, 042, 044)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED048: Visual regression of canvas, left panel, toolbar and minimap against the Main crops

## 1. Summary

Checks that what the editor renders for the mock Workflow looks like the design: the stage, the loop frame, the tiles with their tabs, the toolbar, the minimap, the legend and the left panel, using the kit visual harness and the design-crop comparison with explicit allowances for the places where the mock is clipped or covered.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The visual regression harness (TEST005, `lib:visual-regression` and `lib:design-crop-compare`) compares a rendered story or page region with a `design.png` crop and a tolerance, and has a review report. Every UI task of PART 1 owns a `design.png` crop of the Main view; this task renders the SAME state through the real editor (the mock Workflow fixture of WFED017 loaded in `view` mode with the run-state stub that makes Developer `done` and selected (violet ring), QA `working` (magenta glow), Security `waiting` for an approval (amber glow) and Senior Reviewer `queued` (`czeka na Quality Gate`)) and runs all comparisons in one place. The mock is a static screenshot with known artefacts: the lower part of the stage is covered by the toolbar and the minimap and the world is clipped at the stage bottom (y 884), so the comparison masks those regions and the editor viewport is set to the mock viewport (zoom 0.7, origin at the stage top-left, world 1120x760).

## 3. Scope (in)

- Rendering harness page `visual/mock-main.tsx` mounting `EditorProvider` + `EditorSideRail` + `WorkflowCanvasPane` with fixed viewport, run-state stub and drag-state stub.
- Comparison specs per region with masks and tolerances.
- Allowance list with a reason per mask.
- A state matrix: tile states not in the mock (hover, selected, multi-select, drop-armed valid and invalid, refused connection flash, disabled palette, view-mode cursor) as baseline screenshots reviewed once (golden images owned here).

## 4. Out of scope

- The kit component visuals themselves (DS tasks own those and their own stories).
- Pixel-perfect equality (tolerances per TEST005).
- PART 2 regions (header, Inspector, strip).

## 5. Detailed requirements

1. Viewport and fixture: window 1440x900 at device scale factor 2 (as the mock render), the stage region at (330, 386) of size 802x498 as in the crop box, editor in `view` mode with the published v7 fixture; fonts loaded from the app (wait for `document.fonts.ready`), animations disabled with `prefers-reduced-motion` and the harness freeze; the run-state stub sets Developer `done` (`✓ 4 pliki · testy 112 z 112`) and selected (violet ring), QA `working` (magenta glow, `testy e2e 38 z 52`), Security `waiting` (amber glow, `oczekuje na zgodę · npmjs.org`), Senior Reviewer `queued` (`czeka na Quality Gate`), and the drop-armed state of the Reviewer is a separate case.
2. Comparisons (each uses `design-crop-compare` with the crop file of the owning task and a tolerance object `{ maxDiffPixelRatio, threshold }`): stage top (WFED024 crop), loop frame (WFED024 `design-loop.png`), tile and tabs (WFED014), toolbar and minimap (WFED027), legend (WFED029), palette (WFED030), Skills panel (WFED040), full left panel (WFED044), drop-armed tile (WFED042), TOR tiles (WFED014 `design-lane.png`), connection details (WFED032 crop), group frame (WFED035 crop), and this task full-stage crop. Default tolerance `maxDiffPixelRatio 0.02`, `threshold 0.2` (anti-aliasing), tighter (0.005) for flat regions such as the toolbar.
3. Masks and allowances (`allowances.ts`, each with `region`, `reason`, `owner`): the area covered in the mock by the toolbar and minimap (the editor renders them in the same place, so the mask is only applied to the nodes that the mock hides), the clipped world bottom, text anti-aliasing differences inside the font metric band of 1 px, the live validation badge (PART 2 content, masked), the mock static `iteracja 2 z 5` text if the run stub differs, and the dashed pattern phase of animated dashes. A mask without a reason fails the lint of the suite.
4. Layout reconciliation: the harness calls `design-crop-compare` in `layout` mode first, which compares node rectangles from the DOM (`data-node-id` bounding boxes) with rectangles measured from the mock HTML source (`_design/source/Main.dc.html`) within 2 px; a failure prints the node id and the delta (this finds position bugs of the mapper before pixel diffs do).
5. State matrix baselines: a Storybook-less Playwright page renders each extra state on the mock graph and stores a golden screenshot under `visual/__golden__/` (first run requires `--update-snapshots` and review through `lib:vr-review-report`, never auto-updated in CI); the states: idle, hover tile, selected, multi-selected with box, node `acceptsSkills` armed, valid drop over, invalid drop over, connection preview with legal and illegal targets, refused flash, palette disabled in view mode, toolbar zoom limit, empty document with hint, 200-node overview with the minimap.
6. Both colour modes: the product is dark only (styl-wizualny); no light theme baseline. Forced colors baseline is owned by WFED046.
7. Review workflow: a failing comparison attaches expected, actual and diff images plus the allowance list to the report; updating a golden requires a PR label `visual-update` and a link to the Owner approval in the PR text; the allowance list changes need a reason in the diff.
8. Runtime: under 3 minutes; screenshots clipped to the region, not the whole page.

## 6. Design notes

`design.png` is the whole stage region of the Main view (802x498 CSS px at 2x = 1604x996 px): top-left Start pill, tiles Product Owner and Designer with PUBLICZNY tabs, Join ring with caption, DYSKUSJA tile, edges with captions, the mint loop frame with its label and the amber return edge, tiles Developer (done, selected), QA (working glow), Security (private, waiting glow), Senior Reviewer (queued; drop-armed in `design.png` of WFED042), the toolbar bottom-left and the minimap bottom-right covering parts of the stage. Compare per region as listed above; the stage clip at the bottom and the covered area are known mock artefacts.

## 7. Reuse

- `lib:visual-regression`, `lib:design-crop-compare`, `lib:vr-review-report` (TEST005); the mock Workflow fixture (WFED017); the design crops of the other PART 1 tasks (never duplicated: this task reads them by path); `lib:e2e-fixtures`.

## 8. Architecture and code placement

Layer: test only. The harness page lives in `testing/visual/` and is excluded from the production bundle by the layering test; the comparison specs sit in `e2e/workflow-editor/visual/`.

## 9. Security and safety

No user data. The harness page is only built in test mode and is unreachable from the production router. Golden images contain only synthetic text.

## 10. Errors and edge cases

- Font loading late: the harness waits for fonts; a missing font fails the run instead of comparing fallback glyphs.
- Different GPU rasterisation: tolerance and `threshold` absorb anti-aliasing; golden images are generated on the CI image only.
- The mock changes (new crop): the crop files of the owning tasks are the source of truth; the suite fails with the crop path when a file is missing.
- Run state stub drift: the stub is a typed object compared in a unit test with the mock expectations.
- A masked region grows over time: an allowance report counts masked pixels and fails above 8 % of the stage.

## 11. Acceptance criteria

- [ ] Given the mock fixture in `view` mode, Then every listed region matches its crop within tolerance after applying the documented allowances.
- [ ] Given a node position shifted by 6 px, Then the layout reconciliation fails naming the node and the delta.
- [ ] Given a missing `design.png` of an owning task, Then the suite fails with that path.
- [ ] Given the state matrix, Then each state has a reviewed golden image.
- [ ] Given an allowance without a reason, Then the suite fails.
- [ ] Given masked area above 8 % of the stage, Then the suite fails.

## 12. Test plan

Playwright with the visual harness (`pnpm --filter @overmind/desktop e2e --grep @visual`), plus Vitest for the allowance lint and the run-state stub (`vitest run src/features/workflow-editor/testing/visual`).

## 13. Parallelization notes

Needs the rendering tasks merged; can start with the harness page and the layout reconciliation earlier. Conflict hotspot: golden images (single owner).

## 14. Open questions and assumptions

- ASSUMPTION: TEST005 supports a layout mode that reads rectangles from the mock HTML; if not, the rectangles are extracted once into a JSON file by a script in this task.
- OPEN (Owner): approve the allowance list (areas hidden by the toolbar and minimap in the mock).
- OPEN: golden images generated on the CI image only; developers update them through the CI job, not locally.
