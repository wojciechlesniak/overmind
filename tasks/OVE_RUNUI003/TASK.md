---
id: OVE_RUNUI003
title: "Wire the Runs list panel: selection, paging, filters and live status"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS025, OVE_DS044, OVE_DS075, OVE_RUNUI001, OVE_RUNUI002, OVE_SHELL027]
soft_depends_on: []
provides: ["feature:runs-list"]
needs: ["ui:RunList", "ui:RunListItem", "ui:SidePanel", "ui:SegmentedControl", "lib:runs-data-hooks", "lib:runs-list-model", "lib:app-navigation", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/list/RunsListContainer.tsx", "apps/desktop/src/features/runs/list/index.ts", "apps/desktop/src/locales/en/runs-list.json", "apps/desktop/src/locales/pl/runs-list.json"]
reads: []
design: design.png
design_source: "Activity#activity/runs-list (crop 72,162,250,738)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI003: Wire the Runs list panel: selection, paging, filters and live status

## 1. Summary

The 250 px left panel 'Runy': the list of Runs (running first), selection stored in the URL, a compact filter (Workflow, status, show dry-runs) and 'Pokaż starsze' paging, updating live when Runs start or end.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Mock region `activity/runs-list`: heading 'Runy', four rows (selected running #14 with violet border, done #13 mint, cancelled #12 grey, escalated #9 amber/red). DS075 provides `RunList`; here it is wired.

## 3. Scope (in)

- `RunsListContainer`.
- URL state `?run=<id>`; default selection logic.
- Filters and paging.
- Keyboard roving focus (provided by `RunList`).

## 4. Out of scope

- Run list component (DS075).
- Run detail (`OVE_RUNUI004`).

## 5. Detailed requirements

1. Default selection: `?run` if present and visible, else the newest running Run, else the newest Run, else none (empty state).
2. Selecting a Run sets the URL param (replace, not push, for arrow-key navigation; push on click) so back works.
3. Filter popover from a small funnel button next to the heading: Workflow select (all / each), status chips (działa, ukończony, anulowany, Eskalacja, błąd), toggle 'Pokaż dry-run'; filters persist in session state; active filters show a count badge on the funnel.
4. Paging: infinite scroll with 'Pokaż starsze' button as the keyboard-accessible alternative; total count in the heading when known ('Runy · 14').
5. Live: new Run appears at top with a brief highlight (no highlight under reduced motion); a Run that finishes updates its chip in place; the selected Run never jumps out of view.
6. Selecting a Run while replay is active asks nothing; replay stops (`OVE_RUNUI014` owns the state).
7. Empty states: no Runs 'Brak Runów. Uruchom Workflow z Canvas.' with a link button 'Przejdź do Canvas'; no match for filters 'Brak Runów dla tych filtrów' + 'Wyczyść filtry'.
8. Loading: 4 skeleton rows (73 px); error: inline retry.

## 6. Design notes

`design.png` shows the panel (bg `#0C0814`, rows with 4px gap, selected row with violet 1px border and tinted fill). Funnel button, filter popover, empty/loading/error states are not in the mock.

## 7. Reuse

- `ui:RunList`, `ui:SegmentedControl`, `ui:Popover`, hooks `OVE_RUNUI001`, mapper `OVE_RUNUI002`.

## 8. Architecture and code placement

`@RU/list/RunsListContainer.tsx`, `RunFilters.tsx`, `use-run-selection.ts` (URL state).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Run ids in the URL are validated as `run_` ids before use; a foreign or unknown id shows 'Nie znaleziono Runu' and never leaks existence across Workspaces.

## 10. Errors and edge cases

- Selected Run filtered out by a new filter: selection stays and a note 'Zaznaczony Run nie pasuje do filtrów' shows.
- 100+ Runs: virtualised after 100 rows.
- Run deleted by cascade: selection falls back to default.

## 11. Acceptance criteria

- [ ] Given the mock data, then the panel equals `design.png`.
- [ ] Given `?run=12`, then Run #12 is selected on load.
- [ ] Given a running Run that finishes, then its chip updates without losing selection.
- [ ] Given the filters toggled, then the request carries the filters and the funnel shows a count.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component tests with fake hooks, stories (`Default`, `Filtered`, `Empty`, `Loading`, `Error`), axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the panel lists Runs of all Workflows in the Workspace.
