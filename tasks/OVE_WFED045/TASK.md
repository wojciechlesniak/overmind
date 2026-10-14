---
id: OVE_WFED045
title: "Set and verify the 200-node performance budgets with fixtures and render counting"
area: WFED
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS095, OVE_TEST002, OVE_TEST004, OVE_WFED002, OVE_WFED007, OVE_WFED008, OVE_WFED015, OVE_WFED019, OVE_WFED022, OVE_WFED024, OVE_WFED025, OVE_WFED026, OVE_WFED038, OVE_WFED039]
soft_depends_on: []
provides: ["suite:editor-perf", "lib:editor-perf-fixtures"]
needs: ["lib:editor-document-model", "lib:editor-commands", "lib:canvas-model-mapper", "lib:editor-session", "ui:WorkflowCanvasPane", "lib:editor-autosave", "lib:editor-node-search", "lib:editor-test-builders", "lib:test-utils", "lib:fake-clock", "lib:playwright-harness", "lib:mock-gateway-control", "ui:FlowCanvas"]
owns: ["apps/desktop/src/features/workflow-editor/testing/perf/**", "apps/desktop/src/features/workflow-editor/testing/perf/budgets.ts", "apps/desktop/e2e/workflow-editor/perf.spec.ts", "docs/frontend/workflow-editor-performance.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED045: Set and verify the 200-node performance budgets with fixtures and render counting

## 1. Summary

Turns "performance for 200 nodes" into numbers that CI checks: a table of budgets (projection time, update time, re-render counts, drag frame time, autosave payload, memory), generators of large graphs, micro-benchmarks of the pure core, render-count tests for the React layer and one Playwright trace test of dragging and zooming a 200-node Workflow.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The engine limit is 200 nodes, 600 edges and 512 KiB per definition (WFRT002), so 200 nodes is the design size, not an extreme. Earlier tasks promised: structural sharing in every document update (WFED002), identity-stable projection (WFED015), selection that does not re-render all tiles (WFED019, WFED024), one history entry per drag (WFED008, WFED026), a search that finishes in 3 ms (WFED039). The kit FlowCanvas (DS095) owns viewport culling and drag rendering; this task measures it through the editor and reports kit-level problems to DS instead of patching them. The test machine class is the CI runner (budgets are relative to the `lib:fake-clock`-free wall clock only in the Playwright test; all other budgets are counts, which are deterministic).

## 3. Scope (in)

- `budgets.ts`: the single table of budgets, imported by every perf test and printed in the doc.
- Fixture generators: `makeLayeredGraph(nodes, edges)`, `makeWideFanOut`, `makeLoopHeavy`, `makeMaxDefinition` (exactly 200 nodes, 600 edges, near 512 KiB).
- Vitest benchmarks (`vitest bench`) for the pure core.
- RTL render-count tests with `React.Profiler` and counting wrappers.
- Playwright performance trace test and the frame-time probe.
- `docs/frontend/workflow-editor-performance.md`.

## 4. Out of scope

- Optimising the kit (DS095 owns culling, memoised tiles); findings go to section 14.
- Run-time (engine) performance.
- Network latency of save (WFED022 tests).

## 5. Detailed requirements

1. Budgets (`budgets.ts`, each with `id`, `metric`, `limit`, `kind: "count" | "time"`, and an `enforce: "ci" | "report"` flag; counts are enforced, times are enforced only on the CI class machine and reported elsewhere): `B1` `projectDocument` of 200 nodes and 600 edges cold < 25 ms, warm (one node changed) < 3 ms and exactly 1 changed node model identity; `B2` `toDefinition` + JSON size of the max definition < 15 ms; `B3` any single command dispatch (move of 200 nodes, delete of a node with 20 edges, paste of a 50-node fragment) < 8 ms in the pure core including invariant checks in development mode; `B4` undo and redo of the biggest command < 8 ms; `B5` `checkConnect` over all candidate in-ports during a connection drag (200 nodes) < 1 ms per hover; `B6` node search `searchNodes` < 3 ms; `B7` autosave serialisation + size check < 20 ms and at most ONE `saveDraft` per 2 s window under a continuous drag (count); `B8` selection of one node re-renders at most 3 tile components (the node, its previous selection, the Inspector subscriber) and 0 edges outside its neighbourhood (count); `B9` a viewport pan or zoom re-renders 0 tile components (count; the kit moves a transform); `B10` dragging 50 selected nodes for 2 s keeps the 95th percentile frame time under 24 ms and no frame over 50 ms on the CI class (Playwright trace); `B11` memory: after 300 commands the history holds at most 100 entries and a heap snapshot growth under 15 MB over the baseline (Playwright `performance.memory` where available, otherwise reported); `B12` first render of the max definition to first interactive canvas < 800 ms (Playwright, report).
2. Fixtures (`@/testing/perf/`): deterministic (seeded PRNG, no `Date.now`), produce valid `EditorDocument`s through the builders of WFED002 (so invariants hold) in a layered layout (columns of 10, 22 px grid, 280 px column gap) with realistic fields (labels of 12..40 chars, Agent refs among 12 Agents, 3 frames of 20 nodes each, 1 Loop with a return edge). `makeMaxDefinition` is exactly at the limits and is asserted to be valid (`validateLimits`, WFED002) and to round-trip (`fromDefinition` then `toDefinition`, WFED013).
3. Pure-core benchmarks: `vitest bench` files next to the code under `@/testing/perf/*.bench.ts`; a plain Vitest test wraps each benchmark with a generous 3x margin so CI fails on regressions without a flaky threshold; results print as a table.
4. Render counting: a test helper `renderCounts()` uses a `React.Profiler` per tile inside a test-only `FlowCanvas` stand-in that renders every projected node in a plain list and counts renders by id (the real FlowCanvas needs layout); the stand-in is in `testing/perf/FakeKitCanvas.tsx` and mirrors the kit controlled-props contract (DS095), so identity stability of the projection (which is what we own) is verified without React Flow.
5. Real canvas test (`perf.spec.ts`, Playwright, Chromium): load the max definition through the mock gateway (`lib:mock-gateway-control`), then (a) select all and drag 50 nodes with 120 pointer events over 2 s while `performance.mark` and a `requestAnimationFrame` probe record frame times; (b) zoom 10 %..200 % with the wheel for 2 s; (c) type in the search box. It writes a JSON report next to the Playwright report; thresholds `B9..B12`. The test is tagged `@perf` and runs in the nightly job and on demand, plus on PRs that touch `features/workflow-editor` or `ui-kit/src/canvas` (path filter).
6. Regression guard for accidental full re-render: a test mutates ONE node label in the 200-node document through the session and asserts that the projected arrays differ only at that node (reference equality for the other 199 nodes and all 600 edges) and that the list identity of untouched groups is preserved.
7. Doc `docs/frontend/workflow-editor-performance.md`: the budget table, how to run the suites, how to read the report, the rule "a change that breaks a count budget needs a recorded reason in the PR", and the list of known kit-level limits.
8. CI wiring: only a documented script in the package `test:perf`; changes to the CI workflow file are a request to the CI owner (SETUP area), not edited here.

## 6. Design notes

N/A, functionality only (no visual output).

## 7. Reuse

- `lib:editor-test-builders` (WFED002) and `lib:workflow-mapper-fixtures` (WFED017) for valid documents; `lib:test-utils`; `lib:playwright-harness` and `lib:mock-gateway-control` (TEST004); the session and projector APIs.

## 8. Architecture and code placement

Layer: test support under `testing/perf/` (never imported by production code, enforced by the layering test of WFED001) plus an e2e spec. Budgets are data, so another task can tighten a number in one place (OCP).

## 9. Security and safety

No user data. Fixtures are synthetic. The max-definition fixture also serves as a denial-of-service check: a definition at the limits must load, edit and save without freezing the UI, and a definition ONE over the limit must be refused with a message instead of being rendered (asserted here with 201 nodes).

## 10. Errors and edge cases

- CI machine slower than the reference: time budgets are `report` outside the CI class, count budgets always enforced.
- `performance.memory` unavailable (non-Chromium): `B11` reported as skipped, never silently passed.
- Flaky frame probe: three runs, the median is judged.
- A budget changed in a PR: the doc table is generated from `budgets.ts`, so code and doc cannot diverge.
- Kit upgrade makes tiles re-render on pan: `B9` fails and points to DS.

## 11. Acceptance criteria

- [ ] Given the max-definition fixture, Then it is valid, round-trips and sits exactly at 200 nodes and 600 edges.
- [ ] Given one changed node label, Then 199 node models and 600 edge models keep reference equality.
- [ ] Given a selection change on the stand-in canvas, Then at most 3 tile renders are counted.
- [ ] Given 300 commands, Then the history length is at most 100.
- [ ] Given a continuous 2 s drag, Then the mock gateway received at most one `saveDraft` per 2 s window.
- [ ] Given the `@perf` Playwright run, Then a JSON report with `B9..B12` values is produced and the 95th percentile frame time is under 24 ms on the CI class.
- [ ] Given a 201-node definition, Then the editor shows the limit message and does not render it.

## 12. Test plan

Vitest (`pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/testing/perf`) for counts and pure benchmarks; Playwright (`pnpm --filter @overmind/desktop e2e --grep @perf`) for frame times. A budget file self-test checks that every id is referenced by at least one test (no dead budgets).

## 13. Parallelization notes

Parallel with WFED046..WFED049; needs the production tasks merged. Conflict hotspot: none (own folders).

## 14. Open questions and assumptions

- ASSUMPTION: frame-time thresholds are for the CI runner class and macOS desktop; the Owner may want a second profile for a low-end laptop (a later task).
- GAP: `lib:fake-clock` is used by the autosave tests; the perf spec uses the real clock and must stay out of the default PR path (tag `@perf`).
- OPEN (DS): confirm that FlowCanvas uses viewport culling (`onlyRenderVisibleElements`) for nodes and edges; if not, B10/B12 may need it.
