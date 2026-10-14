---
id: OVE_RUNUI022
title: "Add visual regression tests of the Activity page against Activity.png"
area: RUNUI
kind: test
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS106, OVE_RUNUI019, OVE_TEST004, OVE_TEST005]
soft_depends_on: []
provides: ["lib:runs-visual-suite"]
needs: ["lib:visual-regression", "lib:design-crop-compare", "lib:visualPagesB", "lib:e2e-fixtures", "lib:mock-gateway-control"]
owns: ["apps/desktop/src/features/runs/__visual__/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI022: Add visual regression tests of the Activity page against Activity.png

## 1. Summary

Crop-by-crop comparisons of the composed Activity page with `Activity.png` (list, header, trace, events head, usage panel and its sections, reproducibility), plus baselines for states the mock clips or omits (the bottom of the events table, replay bar, drawers, empty and error states).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. `Activity.png` is clipped at the bottom (the events table continues). Boxes (CSS px, VIEWS.md): list 72,162,250,738; run rows 84,216,225,73 each; header 346,184,770,90; state pill 709,190,142,28; trace 346,292,770,397; events header 346,707,770,28; events table head 347,746,768,34; usage 1140,162,300,738; limits 1161,182,259,63; per-Agent 1161,406,259,106; reproducibility 1161,614,259,74.

## 3. Scope (in)

- Region crop specs with tolerance; deterministic fixtures (fixed clock 14:21:07, Run #14 running 18 min)
- State baselines: replay bar, tool drawer, export dialog, empty, error, narrow layouts.

## 4. Out of scope

- Kit visuals (DS106).

## 5. Detailed requirements

1. Each crop compares against `Activity.png` within the TEST005 tolerance (default 2%); fonts loaded (`document.fonts.ready`); animations disabled via the test flag and reduced motion.
2. The running bar glow and now marker are frozen via fixed `nowMin` fixtures.
3. Baseline-only captures (no design reference) are labelled `baseline-only` for: full events table scrolled to the end, replay bar, tool drawer, export dialog, empty/error pages, 1100 px layout.
4. CI job `visual-runs`; baseline updates need an explicit human `--update-snapshots` commit.
5. Fixtures share `run-14.executions.json` and the feed fixture with the unit tests.

## 6. Design notes

N/A, tests only.

## 7. Reuse

- TEST004/TEST005 harness.

## 8. Architecture and code placement

`@RU/__visual__/` specs and fixtures.

## 9. Security and safety

Fixtures contain no real paths or secrets.

## 10. Errors and edge cases

- Font loading differences.
- Timestamp rendering locale: fixed to `pl-PL` and timezone `Europe/Warsaw`.

## 11. Acceptance criteria

- [ ] All listed crops pass against `Activity.png`.
- [ ] Baseline-only captures exist and are labelled.
- [ ] CI fails on a diff with the review report attached.

## 12. Test plan

`pnpm --filter desktop test:visual -g runs`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: tolerance 2%.
