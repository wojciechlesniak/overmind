---
id: OVE_DEC007
title: "Add FTS5 search, filters and list read models for the Decision Register"
area: DEC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_DATA001, OVE_DATA010, OVE_DEC004, OVE_DEC005, OVE_MEM002]
soft_depends_on: ["OVE_DEC006"]
provides: ["table:decisions_fts", "usecase:decision.list", "usecase:decision.get", "usecase:decision.history", "lib:decision-fts-query"]
needs: ["lib:sqlite-core", "lib:memory-scope-policy", "port:WorkspaceRepository", "lib:result"]
owns: ["packages/adapters/sqlite/migrations/V202610140431__OVE_DEC007__decisions_fts.sql", "packages/adapters/sqlite/src/decision/read-models/**", "packages/application/src/decision/queries/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 10, 28]
---

# OVE_DEC007: Add FTS5 search, filters and list read models for the Decision Register

## 1. Summary

Implement the Register's read side: FTS5 full-text search over Decisions, the filtered list (Workspace, Status, Outcome), the projected detail view with history, and the FTS maintenance, all behind the scope-policy type so only authorised Workspaces are searchable.

## 2. Context

SPEC 10: SQLite plus FTS now, hybrid later. Mock `Decyzje.png`: search `Szukaj: biblioteka dat, płatności…`, filter chips `Wszystkie Workspace'y`, `Status: każdy`, `Wynik: każdy`, list rows with `D-14`, status, `wynik: pozytywny`, title and `Aplikacja rezerwacji · Chief`, detail panel with all fields. The Owner's view covers all Workspaces; Chief's searches are bounded by isolation (DEC008).

## 3. Scope (in)

- Migration for `decisions_fts` and triggers, list/detail/history queries, query sanitiser, projection assembly (fold), pagination.

## 4. Out of scope

- Cross-Workspace Chief search and similar finder: DEC008/009. Routes: DEC011. UI: DECUI.

## 5. Detailed requirements

1. **FTS5 table** `decisions_fts(title, problem, context, rationale, alternatives_text, assumptions_text, risks_text, tags, content='', tokenize='unicode61 remove_diacritics 2')` populated by an `AFTER INSERT` trigger on `decisions` (flattening JSON arrays by `json_each` to text); decisions are immutable so no UPDATE trigger is needed; `AFTER DELETE` trigger removes the FTS row (needed for purge). `decision_id` is stored in an auxiliary content table `decisions_fts_map(rowid, decision_id, workspace_id)`; a rebuild command exists for restore.
2. **Scope:** every query takes `AuthorisedWorkspaceSet` (OVE_MEM002); SQL adds `workspace_id IN (...)` AND the FTS match; no query without it (type). The Owner's set contains all Workspaces including isolated ones; callers decide (DEC011 uses owner context).
3. **Query sanitiser** (`fts-query.ts` in this task's folder): user text -> terms (split on whitespace/punctuation, max 8 terms of 1..40 chars), each as `"term"*`, ANDed; FTS operators and quotes stripped; empty result -> no match; BOARD011 and MEM004 have equivalent helpers in their own folders; a proposal to DATA to hoist one shared `lib:fts-query` is listed as a gap (until then keep the three implementations behaviourally identical, verified by the shared corpus test in OVE_DEC012).
4. **List:** `list(query: DecisionQuery, allowed)`: filters by `workspaceId`, status (current, from the fold: implemented with a SQL view `decision_current` computing current status/outcome from the latest status/verdict events), outcome, tags; ordering `created_at desc, id`; with `q` ordered by `bm25` then recency; cursor `(sortKey, id)`; limit <= 100. Row = `DecisionSummary` with `workspaceName` from `WorkspaceRepository`.
5. **View `decision_current`** (SQL view): `status` = last `status_changed.to` (or `superseded` if a `superseded` event exists) else `initial_status`; `outcome` = last `outcome_verdict.outcome` else `unknown`. The same result as the domain fold (DEC002); a consistency test compares view vs fold on random histories (the fold is authoritative for the detail endpoint; the view serves lists).
6. **Detail:** `get(id, allowed)` loads the Decision and all its events and returns `foldView(...)` with `supersedes`/`supersededBy` refs resolved by `getRefs` (workspace name null when not visible: Workspace deleted, or isolated and not in the caller's set). `history(id, allowed)` returns events with actor labels.
7. **Thin Decision flag:** `alternatives.length < 2` -> `thin: true` in the view.
8. **Counts:** `facets(query)` returns counts by status and outcome for the filter chips (single grouped query).
9. **Performance:** 10 000 Decisions: list under 100 ms (`@perf`).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DEC002 `foldView`; MEM002 scope policy types; FTS query sanitiser (shared); `WorkspaceRepository`.

## 8. Architecture and code placement

Adapter `packages/adapters/sqlite/src/decision/read-models/{decision-list-query.ts,decision-detail-query.ts,fts.ts,fts-query.ts,facets.ts}`; application `packages/application/src/decision/queries/{list-decisions.ts,get-decision.ts,decision-history.ts}`.

## 9. Security and safety

Search input is untrusted: sanitised, bounded, parameterised. The read ports require an `AuthorisedWorkspaceSet`, so isolation is structural; refs to Decisions of hidden Workspaces return the id and seq only with `workspaceName: null` and no title (no leak of titles across isolation); FTS rows are removed on purge so deleted Workspaces are not searchable; the Owner's own view is the only one including isolated Workspaces.

## 10. Errors and edge cases

- Query of only punctuation: empty list.
- A Decision whose Workspace was deleted but is referenced by `supersedesId`: ref with `workspaceName: null`, title omitted.
- FTS out of sync after restore: rebuild command and startup count check.
- Diacritics: `platnosci` finds `płatności`.

## 11. Acceptance criteria

- [ ] FTS finds Decisions by title, problem, context, rationale, alternatives, tags; Polish diacritics folded.
- [ ] Filters by Workspace, status, outcome work; facets counts correct.
- [ ] `decision_current` view equals `foldView` on randomised histories.
- [ ] Detail reproduces the mock D-14 including `Zastępuje: D-03` ref.
- [ ] Hidden-Workspace refs expose no title; deleted Workspace rows vanish from FTS after purge.
- [ ] Sanitiser never throws on hostile input.

## 12. Test plan

- `fts.test.ts`, `decision-list-query.test.ts`, `view-vs-fold.property.test.ts`, `decision-detail-query.test.ts`, `fts-query.test.ts` (corpus), purge-removes-fts test, `@perf` test. Commands: `pnpm vitest run packages/adapters/sqlite/src/decision/read-models packages/application/src/decision/queries`.

## 13. Parallelization notes

DEC008/009/011 depend on this.

## 14. Open questions and assumptions

- ASSUMPTION: list statuses come from the SQL view; detail from the fold.
