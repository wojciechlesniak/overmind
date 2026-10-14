---
id: OVE_RUNUI006
title: "Wire the Run trace card: Gantt rows, tooltips, selection and toggles"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS023, OVE_DS028, OVE_DS076, OVE_RUNUI001, OVE_RUNUI005]
soft_depends_on: []
provides: ["feature:runs-trace"]
needs: ["ui:RunTrace", "ui:TraceRow", "ui:TimeAxis", "ui:Tooltip", "ui:Switch", "lib:runs-data-hooks", "lib:runs-trace-model", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/trace/RunTraceContainer.tsx", "apps/desktop/src/features/runs/trace/index.ts", "apps/desktop/src/locales/en/runs-trace.json", "apps/desktop/src/locales/pl/runs-trace.json"]
reads: []
design: design.png
design_source: "Activity#activity/trace (crop 346,292,770,397)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI006: Wire the Run trace card: Gantt rows, tooltips, selection and toggles

## 1. Summary

The 'Ślad Runu' card: the Gantt of Node executions with legend, a ticking 'now' for running Runs, hover tooltips with exact times and the pinned model, row selection that filters the events table, and toggles for operators and pending Nodes.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Mock region `activity/trace` (346,292,770x397): axis 0-20 min, rows per Node with bars: mint done with ✓, red failed '✗ 2 testy', magenta running with glow 'działa', amber hatched waiting 'Zgoda'. DS076 `RunTrace` renders; the feature supplies data, ticker and interaction.

## 3. Scope (in)

- `RunTraceContainer` with the model and ticker.
- Tooltip content, row selection, 'Pokaż operatory' and 'Pokaż oczekujące' toggles, jump to Canvas for a row.
- Replay playhead overlay hook (position from `OVE_RUNUI014`).

## 4. Out of scope

- Gantt component (DS076).
- Replay engine (`OVE_RUNUI013`).

## 5. Detailed requirements

1. Ticker: a 1 s interval updates `nowMin` only while the Run is non-terminal and the document is visible; the component re-renders only the running bar and the now marker (memoised rows).
2. Tooltip (on hover and focus): '<node> · it. 2 · próba 1', start/end `14:20:12 → 14:21:07 (55 s)`, state word, Agent + model `Developer · Opus 5.5` (from `NodeExecution.pinned`), and the result summary; no output text.
3. Row selection (click/Enter): sets `selectedExecutionKey` in the page state, which filters the events table to that Node (chip 'Węzeł: QA · it. 2' with remove button) and highlights the row; second click clears.
4. Row action menu (kebab on focus/hover): 'Pokaż na Canvas' (opens Workflow page with node selected via `?run=&node=`), 'Dziennik narzędzi' (opens `OVE_RUNUI016` filtered to this execution).
5. Legend: Done, Błąd, Działa, Czeka na Zgodę, Oczekuje (DS076 legend prop).
6. Replay: when replay is active the Gantt shows only executions up to the playhead and a vertical playhead marker (prop `playheadMin`); rows after it are hidden.
7. Loading: skeleton rows; empty: 'Brak wykonanych Węzłów. Run jeszcze się nie zaczął.'; error: inline retry; the card scrolls vertically inside its max-height.
8. Large Runs: virtualised rows; keyboard: arrow keys move between rows, Home/End.

## 6. Design notes

`design.png` shows the card as in the mock (title row omitted in the mock, legend added by DS076). States not in the mock: tooltip, selected row (violet outline), paused spans, replay playhead, toggles row, empty/loading/error.

## 7. Reuse

- `ui:RunTrace`, `ui:Tooltip`, `ui:Switch`, trace model `OVE_RUNUI005`.

## 8. Architecture and code placement

`@RU/trace/RunTraceContainer.tsx`, `use-now-ticker.ts` (injectable timer), `trace-tooltip.tsx`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Tooltips show timings, ids and model names only; no Agent output or paths.

## 10. Errors and edge cases

- Tab hidden: ticker paused; on return it jumps to the real time.
- Run finishes while hovering: tooltip closes.
- Selection of a row that disappears after refetch: cleared.

## 11. Acceptance criteria

- [ ] Given the mock Run, then the card equals `design.png`.
- [ ] Given a running Run, then only the running bar and now marker update each second (render-count test).
- [ ] Given a row click, then the events table filter chip appears.
- [ ] Given replay at minute 9, then later rows are hidden and the playhead is drawn.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component tests with fake timers, tooltip tests, stories (`Running`, `Finished`, `Paused`, `Replay`, `Empty`, `Loading`, `Error`), axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- None.
