---
id: OVE_BOARD012
title: "Aggregate Task progress per Workspace for the dashboard cards and segmented bar"
area: BOARD
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH010, OVE_BOARD011, OVE_DATA001, OVE_DATA010]
soft_depends_on: []
provides: ["usecase:board.get-progress", "usecase:board.get-progress-batch", "event:board.progress_changed"]
needs: ["lib:result", "port:EventBus", "lib:sqlite-core", "port:WorkspaceRepository"]
owns: ["packages/application/src/board/progress/**", "packages/adapters/sqlite/src/board/read-models/progress-query.ts", "packages/contracts/src/events/board.progress_changed.event.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11]
---

# OVE_BOARD012: Aggregate Task progress per Workspace for the dashboard cards and segmented bar

## 1. Summary

Provide the aggregate that the Workspaces dashboard cards need: counts of Tasks to do, in progress, in review and done, a total, and the data of the 8 px segmented progress bar, for one or many Workspaces in a single cheap call, plus a coalesced change event so cards refresh live.

## 2. Context

Mock `Pulpit` (Workspaces dashboard): each Workspace card shows `4 do zrobienia · 5 w toku · 1 review · 7 gotowe z 17` and a segmented bar (component `dash/workspace-progress-bar`: todo/doing/review/done). Another card shows `0 do zrobienia · 1 w toku · 1 review · 7 gotowe z 9`; an isolated Workspace shows `2 do zrobienia · 0 w toku · 0 review · 4 gotowe z 6`. The aggregation is driven by `Lane.category` (BOARD001), because lanes are named by the Workflow (Build, QA...) while the dashboard speaks in four buckets. The `total` excludes deferred and cancelled Tasks, which are reported separately.

## 3. Scope (in)

- SQL aggregate query and application use cases for a single Workspace and for a batch of Workspaces.
- Domain-free pure mapping function `bucketOf(task, lane)` shared with counts.
- Coalescing publisher: `board.progress_changed` (ephemeral) emitted at most once per Workspace per second after any `task.*` event.

## 4. Out of scope

- The dashboard UI and segmented bar component: WSPACE / DS. Run-level progress (`Run #14 · pętla jakości 2 z 5`): WFRT/RUNUI. Cross-Workspace Owner visibility policy: the dashboard is the Owner's own view (all Workspaces including isolated); Chief-facing aggregates for other Workspaces are NOT provided here (isolated Workspaces must not leak to Chief, ADR 0008/0014).

## 5. Detailed requirements

1. **Bucket rules**: Task status `deferred` and `cancelled` are excluded from the four buckets. For the rest: lane `category` `todo` -> `todo`; `doing` -> `doing`; `review` -> `review`; `done` -> `done`. A `blocked` or `awaiting_approval` Task counts in its lane's bucket (the card says so elsewhere). `total = todo + doing + review + done`.
2. **WorkspaceProgress** per `contract:WorkspaceProgress` plus `segments: { key: 'todo'|'doing'|'review'|'done'; count: int; ratio: number (0..1, 4 decimals, sums to 1 or all 0 when total = 0) }[]` so the UI draws widths without recomputation; ratio rounding uses largest-remainder so the sum is exactly 1.
3. **Single query:** `SELECT l.category, COUNT(*) ... FROM tasks t JOIN lanes l ... WHERE t.workspace_id IN (...) AND t.status NOT IN ('deferred','cancelled') GROUP BY t.workspace_id, l.category` plus a second count for deferred; one round trip for up to 50 Workspaces; archived lanes still count their remaining tasks (tasks left in an archived lane keep their lane's category).
4. **Batch use case** `getProgressBatch(workspaceIds[])` returns an entry for every id (zeros for Workspaces without Board); ids the caller may not see do not exist as a concept for the Owner (all visible), so no filtering is applied except for non-existing ids, which return `data.not_found` in a per-item error list.
5. **Change event** `board.progress_changed { workspaceId, todo, doing, review, done, total }` (ephemeral, `persisted: false`, `visibleTo: ['owner']`): a subscriber on `task.created|moved|status_changed|deferred` recomputes progress for that Workspace and publishes at most once per second per Workspace (trailing edge). Clients also refetch on reconnect (`afterEventId` protocol, ARCH010).
6. **Agent- and Telegram-safety:** the event is Owner-only; the Telegram summary text uses a separate formatter in TG using the same use case, so numbers always match the desktop (SPEC 16.13).
7. **Consistency:** the numbers must equal what the Board view shows (sum of lane counts per category) except for deferred: a consistency test compares `BoardView` counts and `WorkspaceProgress` on random Boards.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`Lane.category` from BOARD001, BOARD011 SQL helpers, `EventBus`. The ratio helper is a pure function exported from `packages/domain/src/board`? NO: from this task's application folder (`largest-remainder.ts`), to be reused by DS if a UI utility is needed (DS owns its own display rounding; do not import application code into the UI).

## 8. Architecture and code placement

Application `packages/application/src/board/progress/{get-progress.ts,bucket.ts,largest-remainder.ts,progress-publisher.subscriber.ts}`; adapter query `packages/adapters/sqlite/src/board/read-models/progress-query.ts`; event contract file. No new tables.

## 9. Security and safety

Cross-Workspace aggregation is Owner-only data; the gateway route (BOARD013) requires an owner caller; Chief and Agents cannot call the batch route, so an isolated Workspace's existence and counts do not leak to them. The ephemeral event is `visibleTo: ['owner']`. Queries are parameterised and bounded (max 50 ids).

## 10. Errors and edge cases

- Workspace with Board but zero tasks: all zeros, `segments` all ratio 0.
- Tasks in a lane whose category was changed: next aggregation reflects the new category.
- 51 ids: `validation.invalid_input`.
- Burst of 200 task events: one publication per second (coalesced).
- Deleted Workspace: not found item.

## 11. Acceptance criteria

- [ ] The three mock cards' numbers are reproduced from seeded fixtures (4/5/1/7 of 17, 0/1/1/7 of 9, 2/0/0/4 of 6).
- [ ] Deferred and cancelled Tasks are excluded from `total` and reported as `deferred`.
- [ ] Ratios always sum to exactly 1 (property test) or all zero.
- [ ] Batch call performs a constant number of SQL queries (query-count assertion).
- [ ] Consistency test with BoardView passes on random Boards.
- [ ] Event is emitted at most once per second per Workspace and is Owner-only.

## 12. Test plan

- `bucket.test.ts`, `largest-remainder.test.ts` (property), `get-progress.test.ts` (fakes), `progress-query.test.ts` (SQLite), `progress-publisher.subscriber.test.ts` with `FakeClock`/fake timers.
- Commands: `pnpm vitest run packages/application/src/board/progress packages/adapters/sqlite/src/board/read-models`.

## 13. Parallelization notes

WSPACE dashboard tasks consume `usecase:board.get-progress-batch` and `event:board.progress_changed`. Parallel with BOARD013.

## 14. Open questions and assumptions

- ASSUMPTION: blocked tasks keep their lane bucket (no separate `blocked` segment in the 8 px bar, as in the mock).
- Open: whether `review` bucket should include tasks with status `in_review` regardless of lane. Default: lane category only.
