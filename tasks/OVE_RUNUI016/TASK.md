---
id: OVE_RUNUI016
title: "Build the tool call log drawer: per Run and per Node, redacted results, decisions"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS017, OVE_DS036, OVE_DS040, OVE_DS069, OVE_RUNUI001, OVE_RUNUI008, OVE_RUNUI015, OVE_SHELL027]
soft_depends_on: []
provides: ["feature:runs-toolcalls"]
needs: ["ui:Dialog", "ui:DataTable", "ui:ResultCell", "ui:Chip", "ui:InfoNote", "lib:runs-data-hooks", "lib:runs-toolcalls-model", "lib:app-navigation", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/toolcalls/ToolCallLogDrawer.tsx", "apps/desktop/src/features/runs/toolcalls/ToolCallDetail.tsx", "apps/desktop/src/features/runs/toolcalls/index.ts", "apps/desktop/src/locales/en/runs-toolcalls.json", "apps/desktop/src/locales/pl/runs-toolcalls.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI016: Build the tool call log drawer: per Run and per Node, redacted results, decisions

## 1. Summary

A right-side drawer 'Dziennik narzędzi' opened from the events table, a trace row or the header: a filterable list of tool calls for the Run or for one Node execution, with decisions (ok, blocked, waiting, approved), redacted result summaries and links to the related Approval.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Not in the mock; derived from the Activity table style. It answers 'what exactly did this Agent run and what happened' without exposing raw output.

## 3. Scope (in)

- `ToolCallLogDrawer` (list + detail), filters, links.
- Entry points registered via an `openToolCalls({runId, executionKey?, callId?})` function exported for the table and the trace.

## 4. Out of scope

- Model (`OVE_RUNUI015`).
- Approvals UI (APPRUI).

## 5. Detailed requirements

1. Drawer 440 px from the right inside the main area (`ui:Dialog` drawer variant or the kit's SidePanel overlay), title 'Dziennik narzędzi · Run #14' or '... · QA · it. 2' when scoped; close with Esc and return focus to the invoker.
2. List: `DataTable` compact (time, Agent, what, result) using the model rows; filters: Agent select, chips 'tylko zablokowane', tool kind chips; paging 50.
3. Detail pane (replaces the list on selection, 'Wróć' button): tool, redacted args list, result summary, 'ukryto 3 wartości' note with a lock glyph, duration, decision with reason, link 'Otwórz Zgodę' for approval-related calls (navigates to Zgody with the approval selected), 'Pokaż w Activity'.
4. Banner at the top: 'Wyniki są ukryte zgodnie z polityką redakcji. Pełne dane wyjściowe nie są przechowywane w tym widoku.' (`InfoNote`).
5. Result summaries are plain text; no 'Pokaż pełny wynik' control exists.
6. Copy button copies the displayed redacted text only.
7. Loading skeleton rows; empty 'Brak wywołań narzędzi w tym zakresie'; error with retry.
8. Live: new calls for the scoped Run prepend (via `OVE_RUNUI009` feed events of kind tool).
9. Deep link: `?tool=<callId>` opens the drawer on that call.

## 6. Design notes

Not in the mock: use DS069 table styling, `ResultCell` glyphs and DS036 dialog/drawer patterns; mono 12 for commands.

## 7. Reuse

- `ui:DataTable`, `ui:ResultCell`, `ui:InfoNote`, `ui:Dialog`.

## 8. Architecture and code placement

`@RU/toolcalls/` UI components + `open-toolcalls.ts` (tiny event/URL helper).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. No raw outputs are requested from the server for this view (route returns redacted records only).

## 10. Errors and edge cases

- Call belongs to an execution no longer in the pinned Version listing: still shown with the raw execution key.
- Very long command: wraps in the detail pane.
- Approval deleted: link disabled.

## 11. Acceptance criteria

- [ ] Given a Node-scoped open, then only that execution's calls show and the title says so.
- [ ] Given a blocked call, then the decision reads 'zablokowane · izolacja' and no result is shown.
- [ ] Given a result with redactions, then 'ukryto N wartości' shows and no unmask control exists.
- [ ] Given Esc, then focus returns to the invoking control.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component tests with fixtures, stories (`Run`, `Node`, `Blocked`, `Detail`, `Empty`, `Error`), axe.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: drawer variant exists in the kit (`ui:Dialog` drawer) — if not, a DS gap is recorded and a centered dialog is used.
