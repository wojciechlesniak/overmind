---
id: OVE_BOARD011
title: "Build Board read models: lane view, filters, counts, detail and full-text search"
area: BOARD
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_BOARD004, OVE_BOARD008, OVE_DATA001, OVE_DATA010, OVE_DATA018, OVE_PERM014]
soft_depends_on: ["OVE_BOARD009"]
provides: ["usecase:board.get-view", "usecase:board.get-task-detail", "usecase:board.search-tasks", "table:tasks_fts"]
needs: ["lib:result", "lib:sqlite-core", "port:AgentDirectory", "port:PendingApprovalsQuery", "port:ArtifactRepository", "port:WorkspaceRepository"]
owns: ["packages/adapters/sqlite/migrations/V202610140411__OVE_BOARD011__tasks_fts.sql", "packages/adapters/sqlite/src/board/read-models/**", "packages/application/src/board/queries/**", "packages/testing/src/fakes/FakeBoardQueryDeps.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 28]
---

# OVE_BOARD011: Build Board read models: lane view, filters, counts, detail and full-text search

## 1. Summary

Implement the query side the Task Board screen needs: the lane-by-lane `BoardView` with counts, WIP state and per-card chips, filters (All, My Approvals, Blocked, deferred counter, assignee), a Task detail projection with origin, docRef quote, timeline and evidence, and FTS5 search over Tasks.

## 2. Context

Mock `Tablica.png`: lanes with counts, cards with seq, state label, title, docRef chip, optional thin progress bar and assignee pill (or `nieprzypisane`); segmented filter `Wszystkie / Moje Zgody / Zablokowane`, chip `Odłożone · 1`, `Pokaż 5 starszych` in the Done lane; detail panel (`T-31 · tor QA`, `WYNIKA Z DOKUMENTACJI` with quote, `POCHODZENIE`, `PRZEBIEG`, `DOWODY · ARTEFAKTY`, `Czat z QA`, `Odłóż`). SPEC 3 'collect' and 'board' semantics only matter in that the same Board serves both. Read models must be cheap: the UI refreshes on events.

## 3. Scope (in)

- SQL read-model implementations behind `BoardReadModel` and `TaskSearch` ports (BOARD003).
- FTS5 virtual table + triggers (migration).
- Application query use cases wrapping them with visibility and shape mapping.
- Filter semantics, ordering, pagination, hidden-older logic for Done lane.

## 4. Out of scope

- Progress aggregation for Workspace cards: OVE_BOARD012. Routes: OVE_BOARD013. UI: BOARDUI.

## 5. Detailed requirements

1. **BoardView** per `contract:BoardView`: lanes ordered by `position`, archived lanes omitted; per lane `count` = tasks not deferred/cancelled; `cards` limited: lanes of category `done` show only the newest `doneVisible` cards (default 2, by `closedAt`; the mock shows 2 of 7 plus `Pokaż 5 starszych`), `hiddenOlderCount = count - shown`; other lanes show all up to 100 with `hiddenOlderCount`; `wipExceeded = wipLimit != null && count > wipLimit`. Card order: `priority desc`, lane-specific: `working` first, then `awaiting_approval`, then `queued` by `seq` (stable).
2. **Card projection** includes `statusLabelKey` (`board:status.<status>`), `progress`, `docRef {path, anchor}`, `assignee` (name and initials from `AgentDirectory` batch lookup; a private Agent visible in this Workspace only: lookup scoped to workspace; unknown agent -> `assignee.unknown: true`), `hasPendingApproval` (from `PendingApprovalsQuery.taskIdsWithPending(workspaceId)` one batch call), `deferred`.
3. **Filters**: `scope: 'all'` (default); `'my_approvals'` = tasks with a pending Approval or Access Request that needs the Owner (`PendingApprovalsQuery`); `'blocked'` = status `blocked` or `awaiting_approval`; `assigneeAgentId`; `q` (FTS, below). `deferredCount` always returned regardless of filter; a `scope: 'deferred'` list is available for the `Odłożone` chip (`listDeferred`).
4. **Counts** `countsByLane`, `countsByAssignee` in one SQL each, index backed (`tasks(workspace_id, lane_id, status)`); a perf test seeds 5 000 tasks and asserts BoardView builds under 100 ms on CI hardware class (ASSUMPTION budget, documented).
5. **Task detail** (`TaskDetail`): `{ card, description (sanitised Markdown source), docRef { path, anchor, gitCommit, quote, stale: boolean }, origin: { discussionId?, discussionTitle?, decisionId?, decisionSeq?, planId?, createdBy }, acceptanceCriteria, timeline: TaskTimelineEntry[] (latest 50, ascending; `moreBefore` flag), evidence: { artifactId, name, kind, checksum }[], allowedNextLanes: LaneKey[], chatTarget: { agentId } | null (for `Czat z QA`), canDefer: boolean }`. `allowedNextLanes` is computed by the domain move rules so the UI never re-implements them. Discussion and Decision titles come from read ports (`DiscussionOutcomeReader`, `DecisionExistenceReader` extended by `getTitle`, BOARD007 ports) and degrade to the ids if unavailable. `stale` = `docRef.gitCommit` differs from the current file blob (resolver call, cached 60 s).
6. **FTS5** table `tasks_fts(title, description, doc_path, content='tasks', content_rowid='rowid')` with `tokenize = 'unicode61 remove_diacritics 2'` (Polish diacritics fold), sync triggers on insert/update/delete of `tasks`, and a rebuild command used by restore (`INSERT INTO tasks_fts(tasks_fts) VALUES('rebuild')`). Query sanitiser: user input is converted to a quoted-term AND query (`"term"*`), special FTS operators (`NEAR`, `-`, `:`, `"`) removed, max 8 terms, max 200 chars: no FTS injection and no error on odd input. Results ranked by `bm25` then `seq`.
7. **Workspace scoping:** every query takes `workspaceId` and includes it in `WHERE`; the FTS join also filters by `workspace_id`. No query accepts a bare task id without workspace.
8. **Caching:** none in MVP besides the batched lookups; views are recomputed on request (UI refetches on `task.*` events).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Ports from BOARD003; domain `lanePolicy` for `allowedNextLanes`; `AgentDirectory`, `PendingApprovalsQuery` (PERM), `ArtifactRepository` (DATA). The FTS query sanitiser lives in this task's own folder (`fts-query.ts`); DEC007 and MEM004 keep behaviourally identical copies until DATA hoists a shared `lib:fts-query` (listed as a gap).

## 8. Architecture and code placement

Adapter `packages/adapters/sqlite/src/board/read-models/{board-view-query.ts,task-detail-query.ts,task-search.ts,fts-query.ts}`; application `packages/application/src/board/queries/{get-board-view.ts,get-task-detail.ts,search-tasks.ts}`. Read models never write. Dependencies: ports only.

## 9. Security and safety

Search input is untrusted: sanitised FTS query, bounded, parameterised. Output strings (titles, labels, quote) are data: the UI renders them as text/sanitised Markdown. Cross-Workspace isolation: every query is workspace scoped; `getTaskDetail(workspaceId, taskId)` returns not found for foreign ids. Private Agents of another Workspace are never resolved (ADR 0028). Nothing here reveals Decisions of other Workspaces (titles come only for the same Workspace's decision ids; a mismatch returns the bare id). Timeline `summary` is already redacted.

## 10. Errors and edge cases

- Task with deleted/unknown assignee Agent: `assignee.unknown = true`, label from i18n.
- Empty Board: lanes with zero cards; view still valid.
- Query `"`, `NEAR(`, `*`, only punctuation: returns empty result without error.
- Very long Done lane: `hiddenOlderCount` correct; `listLaneTasks(laneId, cursor)` supports `Pokaż 5 starszych`.
- `PendingApprovalsQuery` unavailable: `hasPendingApproval = false` with a `degraded: ['approvals']` marker in the view.
- FTS desync after crash: startup check compares row counts and rebuilds when different.

## 11. Acceptance criteria

- [ ] BoardView for the five-lane fixture matches the mock structure (counts 4/2/3/1/7; the done lane shows 2 cards and `hiddenOlderCount: 5`).
- [ ] Filters `my_approvals`, `blocked`, assignee and deferred behave as specified.
- [ ] Task detail contains origin, quote, timeline, evidence and `allowedNextLanes`.
- [ ] Search finds Polish text without diacritics, ignores FTS operators, never errors.
- [ ] Foreign-Workspace task ids return not found; FTS never returns other Workspaces' rows (test with two Workspaces).
- [ ] Performance test with 5 000 tasks within budget.
- [ ] Rebuild command restores the FTS index.

## 12. Test plan

- Contract-style tests on SQLite with seeded Workspaces: `board-view-query.test.ts`, `task-detail-query.test.ts`, `task-search.test.ts` (injection corpus: operators, unicode, long input), `fts-sync.test.ts` (insert/update/delete + rebuild), `perf.test.ts` (tagged `@perf`, non-gating locally).
- Fake-based use-case tests in `packages/application/src/board/queries/*.test.ts`.
- Commands: `pnpm vitest run packages/adapters/sqlite/src/board/read-models packages/application/src/board/queries`.

## 13. Parallelization notes

BOARD012 (progress) and BOARD013 (gateway) depend on this. Migration unique. No other task edits `fts-query.ts`.

## 14. Open questions and assumptions

- ASSUMPTION: Done lane shows the newest 2 cards by default (as in the mock); `doneVisible` is a query parameter (max 50) so the UI can expand.
- ASSUMPTION: Polish diacritics folded by `unicode61 remove_diacritics 2`.
- Open: `my_approvals` semantics when the Approval is not Task-bound (it then has no card); such approvals appear only in the Approvals view.
