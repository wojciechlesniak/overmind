---
id: OVE_WFED059
title: "Build the version list and version switching (read-only view of older Versions)"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS017, OVE_DS019, OVE_DS028, OVE_DS032, OVE_DS033, OVE_DS040, OVE_WFED013, OVE_WFED050, OVE_WFED052, OVE_WFED055, OVE_WFRT048]
soft_depends_on: []
provides: ["feature:wfed-versions"]
needs: ["api:workflows.versions.list", "api:workflows.versions.get", "lib:wfed-data-hooks", "lib:wfed-definition-diff", "ui:Popover", "ui:ListRow", "ui:VersionBadge", "ui:Pill", "ui:EmptyState", "lib:workflow-mappers", "ui:RunLink"]
owns: ["apps/desktop/src/features/workflow-editor/versions/**", "apps/desktop/src/locales/en/wfed-versions.json", "apps/desktop/src/locales/pl/wfed-versions.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED059: Build the version list and version switching (read-only view of older Versions)

## 1. Summary

A popover opened from the version badge that lists all Versions (v7 opublikowana, v6, ...), with publish time, change note, Runs pinned to each, and 'Wyświetl' to open an older Version read-only on the canvas. Starting an edit from an old Version is offered.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). Versions are immutable and gapless (WFRT002). The Owner needs to see what an older Version looked like (for example the Version pinned by failed Run #12) and to base a new Draft on it. Visibility changes are Versions too ('visibility changed').

## 3. Scope (in)

- `VersionListPopover` (list, load more, current marker).
- Viewing an old Version: mode `viewing_old`, canvas read-only, banner 'Oglądasz v5 (starsza wersja). Tylko do odczytu.' with buttons 'Wróć do v7' and 'Edytuj jako v8 na bazie v5'.
- 'Porównaj z v7' using `diffDefinitions` shown in a side list (reuses `DiffList` from `OVE_WFED056`).
- Runs pinned to each Version (count with `ui:RunLink` to Activity).

## 4. Out of scope

- Publishing (`OVE_WFED057`).
- Run replay at a Version (RUNUI replay).

## 5. Detailed requirements

1. Row: `vN`, status word ('opublikowana' for the current published, 'poprzednia', 'wersja robocza' for the Draft at the top when it exists), `publishedAt` relative + absolute `title`, `changeNote` (2-line clamp), counters 'Runy: 3' (from the runs index), `contentHash` short (8 hex, mono) with copy button.
2. Paging: 20 per page, 'Pokaż starsze'; the list is virtualised after 100 rows.
3. Selecting a row loads `api:workflows.versions.get` and maps it with `lib:workflow-mappers` to the editor document (read-only); URL state `?version=5` so reload keeps the view.
4. While `viewing_old`: all edit actions hidden, header badge 'v5 · starsza wersja', validation badge shows the stored report summary (`validationReport`) not a live run.
5. 'Porównaj z aktualną' opens the diff list in the right panel region replacing the Inspector until closed.
6. A Version that fails schema upgrade (`wfrt.definition_from_future`) is listed as 'nieobsługiwana wersja formatu' with the view disabled (fail closed).
7. Keyboard: listbox semantics, arrows move, Enter views, `Esc` closes the popover and returns focus to the badge.

## 6. Design notes

Not in the mock. Popover 360 px wide under the badge (use `ui:Popover` + `ui:ListRow` variant `run`-like with two lines); the current Version row has a violet 1px border and a check glyph; empty state 'Brak opublikowanych wersji. Opublikuj pierwszą wersję.'; loading skeleton 4 rows; error inline retry.

## 7. Reuse

- `ui:Popover`, `ui:ListRow`, `ui:VersionBadge`, `ui:Pill`, `ui:RunLink` (OVE_DS040), `DiffList` from `OVE_WFED056`.

## 8. Architecture and code placement

`@WF/versions/VersionListPopover.tsx`, `use-version-view.ts`, `ViewingOldBanner.tsx`. Depends on data hooks, part 1 mappers and ui-kit.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Old Versions are rendered read-only; no editing API accepts a Version id. A Version from a different Workspace is not reachable (query keys and server scope).

## 10. Errors and edge cases

- Version deleted by Workspace cascade: row hidden after refetch.
- 100+ Versions: pagination keeps memory bounded.
- Viewing an old Version while a new one is published: banner updates 'Jest nowsza wersja v9'.
- Version with 200 nodes: loads lazily; show skeleton on canvas.

## 11. Acceptance criteria

- [ ] Given three Versions, then the list shows them newest first with the current one marked.
- [ ] Given a click on v5, then the canvas shows v5 read-only and the header badge says it is older.
- [ ] Given a Version of an unsupported format, then viewing is disabled with an explanation.
- [ ] Given reload with `?version=5`, then the same view is restored.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component and hook tests, stories (`Default`, `WithDraft`, `Empty`, `Loading`, `Error`, `FutureFormat`), axe, e2e step in `OVE_WFED089`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the runs-per-version counts come from `api:runs.list?groupBy=version` (WFRT048); if missing, counts are hidden.
