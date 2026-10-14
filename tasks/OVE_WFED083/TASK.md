---
id: OVE_WFED083
title: "Show finished, failed and cancelled Runs on the canvas and list Node executions"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS017, OVE_DS033, OVE_DS040, OVE_WFED063, OVE_WFED080, OVE_WFED082, OVE_WFRT006, OVE_WFRT051]
soft_depends_on: []
provides: ["feature:wfed-run-end-states"]
needs: ["lib:wfed-run-projection", "feature:wfed-run-overlay", "feature:wfed-inspector", "contract:NodeExecution", "api:runs.get", "ui:InfoNote", "ui:Pill", "ui:RunLink", "ui:ListRow"]
owns: ["apps/desktop/src/features/workflow-editor/run-overlay/end/**", "apps/desktop/src/features/workflow-editor/inspector/sections/executions.section.tsx", "apps/desktop/src/locales/en/wfed-runend.json", "apps/desktop/src/locales/pl/wfed-runend.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED083: Show finished, failed and cancelled Runs on the canvas and list Node executions

## 1. Summary

Presentation of Runs that are no longer live: a banner with the outcome ('Run #12 anulowany · Ty · zmiana zakresu', 'Eskalacja: limit 5 iteracji'), the final state on the canvas, the pinned Version shown read-only, and an 'Wykonania' section in the Inspector listing each execution of the selected Node (iteration, attempt, times, result, error code).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The mock shows only a running Run. The Activity list contains finished (mint), cancelled (grey) and escalated (red/amber) Runs (`Run #13 ukończony`, `#12 anulowany`, `#9 Eskalacja`). Opening a Run from Activity or the header pill must show its pinned Version on the canvas with final states; for a failed Run the failing Node and its error code must be obvious.

## 3. Scope (in)

- `RunEndBanner` (outcome, duration, link to Activity, 'Wróć do wersji roboczej').
- Pinned-Version canvas mode: loads the Run's Version read-only through `OVE_WFED059` viewer and applies the final overlay.
- Inspector section `executions` (list per selected Node, newest first).
- Failure focus: failing Node is selected and centred on open for `failed` Runs.

## 4. Out of scope

- Run replay (RUNUI).
- Run controls (`OVE_WFED053`).

## 5. Detailed requirements

1. Banner copy by outcome: succeeded 'Run #13 ukończony · 6 min' (mint), failed 'Run #11 zakończony błędem w Węźle QA: <code>' (error tone), cancelled 'Run #12 anulowany · Ty · zmiana zakresu' (grey, who cancelled from the cancel event actor word: 'Ty', 'Chief', 'limit'), escalated 'Eskalacja: limit 5 iteracji. Czeka na decyzję Właściciela' with a link 'Otwórz w Zgodach' (`lib:app-navigation`). Outcome and reason words come from `WorkflowRun.outcome`, `failure.code` (i18n lookup by code, unknown -> the code) and `pauseReasons`.
2. Canvas: Nodes show their final state (`done`, `error`, `skipped`, `cancelled`); in-flight glows never remain after a terminal Run (the reducer guarantees; test asserts no `working` state in terminal Runs, defensive reset to `cancelled` with the word 'przerwany').
3. The displayed Version is the Run's pinned Version (read-only); if it differs from the published one a chip 'v6 (wersja Runu)' shows; the button 'Wróć do v7' returns.
4. Executions section: rows `it. 2 · próba 1 · 14:20:12 → 14:21:07 · ✓ ok` or `✗ wfrt.agent_output_invalid`; click selects the execution and shows its safe details (timing, `pinned` model and Skill versions from `NodeExecution.pinned`, Artifact chips); the redacted tool-call log is in Activity (link 'Dziennik narzędzi w Activity').
5. Dry-run Runs carry the grey 'dry-run' word in the banner.
6. Escalated Run: banner amber; the Loop frame shows the 'Eskalacja' pill (from the overlay).
7. Keyboard: banner actions focusable; Executions list is a listbox.
8. Failure focus uses the part 1 controller (`focusNode`) once after load, announced 'Błąd w Węźle QA'.

## 6. Design notes

Not in the mock. Banner: `ui:InfoNote` style row with a state glyph and link; positioned above the stage under the header region as a slot (page composition `OVE_WFED085`). Executions section uses `InspectorSection` + `ListRow` compact.

## 7. Reuse

- `ui:InfoNote`, `ui:Pill`, `ui:ListRow`, `ui:RunLink`; overlay selectors; `OVE_WFED059` viewer.

## 8. Architecture and code placement

`@WF/run-overlay/end/` (`RunEndBanner.tsx`, `end-state.ts` pure: Run -> banner model), `executions.section.tsx`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Failure codes map to i18n texts; raw error messages and CLI output are never shown here (redaction happens engine-side; the full redacted log is in Activity).

## 10. Errors and edge cases

- Run of a deleted Version (cascade): 'Wersja niedostępna' and overlay disabled.
- Run with 0 executions (cancelled before start): banner only.
- Escalation already resolved: banner reads 'Eskalacja rozwiązana'.
- Failure at several Nodes: first failing Node by time is focused, others listed in the banner as '+2'.

## 11. Acceptance criteria

- [ ] Given a cancelled Run, then the banner names who cancelled and no live glow remains.
- [ ] Given a failed Run, then the failing Node is selected and centred.
- [ ] Given an escalated Run, then the amber banner links to Zgody.
- [ ] Given a Node with 2 iterations, then the Executions section lists both.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`end-state.test.ts` (outcome table), component tests, stories per outcome, axe.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the cancel actor word is part of `run.cancelled` payload (`by: 'owner'|'chief'|'limit'`).
