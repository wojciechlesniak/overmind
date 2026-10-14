---
id: OVE_RUNUI008
title: "Wire the Activity table with filters by Run and Agent, only issues, paging"
area: RUNUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS017, OVE_DS028, OVE_DS030, OVE_DS069, OVE_RUNUI001, OVE_RUNUI007]
soft_depends_on: []
provides: ["feature:runs-events"]
needs: ["ui:DataTable", "ui:ResultCell", "ui:Chip", "ui:Select", "ui:Popover", "ui:Button", "lib:runs-data-hooks", "lib:runs-events-model", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/events/ActivityTableContainer.tsx", "apps/desktop/src/features/runs/events/ActivityFilters.tsx", "apps/desktop/src/features/runs/events/index.ts", "apps/desktop/src/locales/en/runs-events.json", "apps/desktop/src/locales/pl/runs-events.json"]
reads: []
design: design.png
design_source: "Activity#activity/events (crop 346,707,770,272)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI008: Wire the Activity table with filters by Run and Agent, only issues, paging

## 1. Summary

The 'Activity' section under the trace: heading, filter chips ('Agent: wszyscy', 'tylko błędy i blokady', plus Run scope and kind), and the table CZAS / KTO / CO / WYNIK with infinite loading, row details drawer and a live 'nowe zdarzenia' pill.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Mock region `activity/events` (346,707,770x272; the table runs past the viewport bottom and must scroll inside its container). Filter chips are `Agent: wszyscy` and `tylko błędy i blokady`; table head `#140F20`, 4 columns, result column coloured by state.

## 3. Scope (in)

- Container: header + filters + `DataTable`.
- Filter popovers (Agent select, Run scope, kinds) and toggles.
- Row details drawer (full redacted detail, copy as text, links to Node/Approval).
- Infinite scroll, sticky header, empty/loading/error.

## 4. Out of scope

- Table component (DS069).
- Live merging (`OVE_RUNUI009`), tool-call log drawer (`OVE_RUNUI016`).

## 5. Detailed requirements

1. Heading 'Activity' 15/700; chips on the right: `Agent: wszyscy` (opens a select listing Agents that acted in the Run/Workspace, with avatar), `tylko błędy i blokady` (toggle chip, `aria-pressed`), `Run: #14` (scope chip: 'Ten Run' / 'Wszystkie Runy'), `Rodzaj: wszystkie` (multi-select: terminal, sieć, pliki, wiadomości, Quality Gate, Zgody).
2. Active filters are reflected in the URL (`OVE_RUNUI007` serialisation) and a 'Wyczyść filtry' link appears when any is active.
3. Table: `DataTable` columns widths (mock): time 120, who 150, what flexible, result 240; `maxHeight` fills the remaining panel height; sticky header; rows 46 px; `onRowClick` opens the details drawer.
4. Row details (drawer from the right inside the main column, 360 px): time, actor, full text (wraps with `overflow-wrap:anywhere`), result detail, links: 'Pokaż Węzeł' (select the trace row), 'Otwórz Zgodę' (when approval-related), 'Pokaż w dzienniku narzędzi' (tool kinds); button 'Kopiuj jako tekst' copies the redacted text.
5. Paging: 50 rows per page, 'Pokaż starsze' dashed button after the last row (also the keyboard path) and IntersectionObserver auto-load.
6. New events: handled by `OVE_RUNUI009`; the table shows a sticky pill 'N nowych zdarzeń' when scrolled away from the top.
7. Empty: no entries 'Brak zdarzeń dla tych filtrów' (+ clear), no Run 'Wybierz Run z listy'; loading: 5 skeleton rows; error: inline retry keeping previous rows.
8. Keyboard: table rows focusable, Enter opens details, `Esc` closes, `/` focuses the first filter (documented).
9. Result cell: `ResultCell` glyph + word, mono 12; state never colour-only.

## 6. Design notes

`design.png` shows heading, chips and the first rows of the table (clipped by the mock viewport). The implementation scrolls inside the panel. Not in the mock: filter popovers, details drawer, live pill, empty/loading/error states (derive from DS069, DS032).

## 7. Reuse

- `ui:DataTable`, `ui:ResultCell`, `ui:Chip` (filter variant), `ui:Select`, `ui:Popover`, `ui:Skeleton`.

## 8. Architecture and code placement

`@RU/events/` containers; no model logic (uses `OVE_RUNUI007`).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. The drawer shows only redacted text; the copy button copies exactly what is displayed (no hidden raw fields).

## 10. Errors and edge cases

- Filters yield 0 rows while new live events arrive that match: the empty state is replaced by the new rows.
- Agent filter lists an Agent later archived: option kept with 'archiwalny'.
- Very long command text: ellipsis in the table, full text in the drawer.
- Cursor expired: reload from head with a toast.

## 11. Acceptance criteria

- [ ] Given the mock data, then the table head and first rows equal `design.png`.
- [ ] Given 'tylko błędy i blokady', then the request has the server filter and only blocked/waiting/failed rows show.
- [ ] Given scrolling to the end, then the next page loads and 'Pokaż starsze' works with keyboard.
- [ ] Given a row Enter, then the drawer shows the full redacted text with links.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component tests with fake feed, stories (`Default`, `Filtered`, `Empty`, `Loading`, `Error`, `Drawer`), axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: Run scope default is the selected Run; 'Wszystkie Runy' shows the Workspace-wide stream (spec: filters by Run and Agent).
