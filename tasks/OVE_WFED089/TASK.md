---
id: OVE_WFED089
title: "Add end-to-end tests of the Workflow page against the mock gateway"
area: WFED
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST004, OVE_WFED053, OVE_WFED054, OVE_WFED057, OVE_WFED059, OVE_WFED065, OVE_WFED081, OVE_WFED085]
soft_depends_on: []
provides: ["lib:wfed-e2e-suite"]
needs: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:e2e-fixtures"]
owns: ["apps/desktop/src/features/workflow-editor/__e2e__/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED089: Add end-to-end tests of the Workflow page against the mock gateway

## 1. Summary

Playwright scenarios for part 2 of the editor: edit-as-new-version and publish with conflict, running Run keeps its Version, live overlay from scripted events, Run controls, dry-run, visibility blocked report, validation click-to-focus and expression editing.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The harness (TEST004) runs the desktop UI against a mock gateway controllable by scripts (emit events, fail requests, simulate engine restart). Scenarios map to SPEC 16 criteria 5, 7 and 14 as far as the UI can show them (Run continues after reconnect, pause/cancel).

## 3. Scope (in)

- Scenario specs listed below with fixtures.
- Mock gateway scripts for scripted event streams and error injection.

## 4. Out of scope

- Backend vertical slices (WFRT/PAUSE suites).
- Visual (`OVE_WFED088`) and a11y (`OVE_WFED087`).

## 5. Detailed requirements

1. S1 publish: open published v7, 'Edytuj jako v8', change an IF condition, 'Zapisz jako v8', dialog shows the diff (behaviour group), validation 0 errors, publish; header reads 'v8 · opublikowana'; the active Run #14 still shows v7 in its pill tooltip.
2. S2 conflict: gateway returns `wfrt.draft_revision_conflict` on publish; conflict screen shown; the local draft is not overwritten.
3. S3 validation: introduce an unconnected `else` port; badge says '1 błąd'; click 'Pokaż' focuses the IF Node; Publish disabled.
4. S4 overlay: scripted events move Developer to working, QA to waiting for Approval, Loop iteration 2 of 5; assert glow classes via test ids and the frame label; assert no re-fetch for node events.
5. S5 reconnect: drop the event stream, emit a gap, assert resync and a consistent final state.
6. S6 run controls: Pause, Resume; Cancel dialog default focus is 'Wróć'; confirm cancels; Global Pause blocks Resume with the reason.
7. S7 dry-run: validation errors block; valid flow starts a dry-run; banner shows; no live glows (neutral look).
8. S8 visibility: change PUBLICZNY->PRYWATNY for a used Agent; blocked report lists the Workspace; radio snaps back.
9. S9 expression editor: type an invalid condition (error underline), fix it, preview with sample data shows 'prawda'.
10. S10 inspector sections: model scope chooser (node override) writes only the Draft; skill removal confirm; permissions section shows 'git push: wymaga Zgody'.
11. S11 lanes: bind a Node to lane 'Build' and see 'TOR · BUILD' on the tile.
12. Each scenario asserts on accessible roles/names (not CSS) where possible; scripted events come from `fixtures/run-14.events.json` shared with the unit tests.
13. Run time budget: whole suite under 4 minutes in CI; retries disabled (flakes are bugs).

## 6. Design notes

N/A, tests only.

## 7. Reuse

- Harness and fixtures from TEST004/TEST002; shared event fixture with `OVE_WFED080`.

## 8. Architecture and code placement

`@WF/__e2e__/*.spec.ts`, helper `gateway-script.ts`.

## 9. Security and safety

Tests run with a test token on loopback; no real CLIs or filesystem.

## 10. Errors and edge cases

- Gateway script timing: use event-driven waits, no sleeps.
- Order of SSE events across scenarios isolated per test via fresh gateway state.

## 11. Acceptance criteria

- [ ] All scenarios S1-S11 pass in CI with no retries.
- [ ] Scenarios fail when the corresponding feature is broken (mutation check on one scenario in review).
- [ ] Suite runtime under 4 minutes.

## 12. Test plan

`pnpm --filter desktop test:e2e -g wfed-part2`.

## 13. Parallelization notes

After the features exist; individual scenarios can be written as each feature lands. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the mock gateway supports scripted SSE and request failure injection (TEST004).
