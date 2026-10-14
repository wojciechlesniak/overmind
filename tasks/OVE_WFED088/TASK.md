---
id: OVE_WFED088
title: "Add visual regression tests of the Workflow page against Main.png (full canvas)"
area: WFED
kind: test
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS107, OVE_TEST004, OVE_TEST005, OVE_WFED082, OVE_WFED085]
soft_depends_on: []
provides: ["lib:wfed-visual-suite"]
needs: ["lib:visual-regression", "lib:design-crop-compare", "lib:visualPagesC", "lib:e2e-fixtures", "lib:mock-gateway-control"]
owns: ["apps/desktop/src/features/workflow-editor/__visual__/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED088: Add visual regression tests of the Workflow page against Main.png (full canvas)

## 1. Summary

Crop-by-crop visual tests of every region of the Workflow page against `Main.png` (header, strip, canvas stage, inspector sections, badge, legend) plus full-canvas screenshots for states the mock clips or does not show (the lower part of the stage, Run states, error states).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). `Main.png` is clipped at the viewport bottom: the stage world is 1120x760 at zoom 0.7 and extends below 900 px (Security node, Quality Gate caption, return edge label, minimap area) and the left palette scrolls. The visual harness (TEST005) reconciles layout against design crops; DS107 covers kit-level canvas pages. This task covers the composed, data-driven page.

## 3. Scope (in)

- Playwright visual specs per region with the region boxes from VIEWS.md.
- Full-world canvas screenshot (zoom-to-fit and 100% scroll captures) as baselines without a design reference.
- State matrix baselines: draft, viewing old, running, waiting for Approval, failed, cancelled, escalated, empty, error.
- Fixtures: a recorded Run (`run-14`) replayed to a fixed event index through the mock gateway.

## 4. Out of scope

- Kit component visuals (DS105-107).
- Functional e2e (`OVE_WFED089`).

## 5. Detailed requirements

1. Boxes (CSS px, from VIEWS.md `Main`): header 330,178,802,95; strip 330,280,802,94; stage 330,386,802,498; badge 949,397,171,28; legend 889,423,217,123; inspector 1150,162,290,738 and its section boxes (state 1169,248,253,100; visibility 1169,362,253,119; model 1169,495,253,84; skills 1169,593,253,77; permissions 1169,684,253,53; open chat 1169,836,253,46).
2. Each design crop comparison uses tolerance defined by TEST005 (default 2% pixel diff, anti-aliasing tolerant); text is compared after font loading (fonts self-hosted, DS004); failing diffs upload the review report (`lib:vr-review-report`).
3. Deterministic data: fixed Workspace and Workflow fixtures, fixed clock (`2026-10-13T14:21:07`), fixed event index; animations disabled via `prefers-reduced-motion` and a test flag.
4. Baselines for clipped areas are generated from the implementation (no design reference) and reviewed by a human in the PR; they are marked `baseline-only` in the manifest.
5. State matrix: for each state a screenshot of the stage region and one of the header; a table `states.visual.json` documents expectations (word + glyph present).
6. Dark theme only (MVP); no light theme baselines.
7. CI job `visual-wfed` runs in the Playwright container with pinned Chromium; baseline update requires an explicit `--update-snapshots` commit by a human.

## 6. Design notes

N/A, tests only. Mock note: 'the mock is clipped; design for the full canvas'.

## 7. Reuse

- TEST005 harness, TEST004 Playwright + mock gateway, DS visual helpers.

## 8. Architecture and code placement

`@WF/__visual__/` specs and fixtures; no production code.

## 9. Security and safety

Fixtures contain no real paths or secrets; the mock gateway runs on loopback with a test token.

## 10. Errors and edge cases

- Font loading differences: wait for `document.fonts.ready`.
- Flaky glow animation: disabled by flag.
- Baseline drift after a ui-kit change: diff report points to the region.

## 11. Acceptance criteria

- [ ] All listed crops pass against `Main.png` within tolerance.
- [ ] Clipped-area baselines exist and are labelled `baseline-only`.
- [ ] State matrix screenshots exist for every state in the list.
- [ ] CI fails on a diff and attaches the report.

## 12. Test plan

`pnpm --filter desktop test:visual -g wfed`; update via `pnpm --filter desktop test:visual:update -g wfed` (human only).

## 13. Parallelization notes

After page composition. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: tolerance 2% per crop; tighten later.
