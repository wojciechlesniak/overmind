---
id: OVE_BOARD004
title: "Create SQLite migrations and repositories for boards, lanes, tasks and timeline"
area: BOARD
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BACKUP003, OVE_BOARD003, OVE_DATA001, OVE_DATA002, OVE_DATA005]
soft_depends_on: ["OVE_TEST003"]
provides: ["table:boards", "table:lanes", "table:tasks", "table:task_timeline", "lib:sqlite-board-repos", "port:BoardPurgeGuard"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "port:EventStore", "port:BackupContributor"]
owns: ["packages/adapters/sqlite/migrations/V202610140410__OVE_BOARD004__board_tables.sql", "packages/adapters/sqlite/src/board/**"]
reads: ["packages/adapters/sqlite/src/core/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 18]
---

# OVE_BOARD004: Create SQLite migrations and repositories for boards, lanes, tasks and timeline

## 1. Summary

Implement the SQLite side of the Board: forward-only migration with tables, indexes and DB-level immutability triggers for the timeline, repositories implementing the BOARD003 ports, the transaction-scoped purge guard used by the cascade participant (OVE_BOARD015), and a backup/export contributor. The adapter must pass the same contract suites as the fakes.

## 2. Context

ADR 0018: SQLite is the store; SPEC 14: migrations, transactions, indexes by run/workspace/status, immutable audit-like events. ADR 0011: Board is the source of truth. SPEC 10 and ADR 0008: deleting a Workspace deletes its Board (Task Board) and the rest only after Local Approval with a warning. DATA (infrastructure `src/core/`) owns connection handling, `UnitOfWork`, WAL and migration runner; this task adds area tables using the naming convention `V<YYYYMMDDHHmm>__<TASKID>__<name>.sql` (OVE_ARCH009).

## 3. Scope (in)

- Migration `V202610140410__OVE_BOARD004__board_tables.sql`.
- Repositories `SqliteBoardRepository`, `SqliteTaskRepository`, `SqliteTaskTimelineRepository` with row mappers validated by the zod schemas on read (never trust stored JSON blindly).
- Purge guard table and trigger exceptions, used by `deleteAllForWorkspace(tx, workspaceId)`.
- `BoardBackupContributor` implementing `BackupContributor` (logical export of board data as JSON Lines, schemaVersion 1).
- Contract-suite runner file and migration tests.

## 4. Out of scope

- Read models, FTS: OVE_BOARD011. Use cases: BOARD005-BOARD010. Whole-DB daily backup mechanics and restore: BACKUP area (this task only contributes the logical export part).
- Event row writes: through `EventStore` (DATA) in use cases; no event tables here.

## 5. Detailed requirements

1. **Tables** (STRICT tables, `TEXT` ULID ids, ISO-8601 UTC text timestamps, JSON columns validated with `json_valid` CHECK):
   - `boards(id PK, workspace_id UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT, workflow_id, workflow_version_id, lane_source_label, created_at, updated_at)`.
   - `lanes(id PK, board_id NOT NULL REFERENCES boards(id), key NOT NULL, name NOT NULL, position INTEGER NOT NULL, category TEXT NOT NULL CHECK(category IN ('todo','doing','review','done')), assignee_kind TEXT CHECK(... IN ('agent','team') OR NULL), assignee_id TEXT, wip_limit INTEGER CHECK(wip_limit IS NULL OR wip_limit BETWEEN 1 AND 99), workflow_node_id TEXT, archived INTEGER NOT NULL DEFAULT 0, hint TEXT, UNIQUE(board_id, key))`.
   - `tasks(id PK, workspace_id NOT NULL, board_id NOT NULL, seq INTEGER NOT NULL, lane_id NOT NULL REFERENCES lanes(id), title NOT NULL CHECK(length(title) BETWEEN 1 AND 140), description NOT NULL DEFAULT '', doc_path NOT NULL CHECK(length(doc_path) BETWEEN 1 AND 300), doc_anchor, doc_commit, doc_quote, assignee_agent_id, status NOT NULL CHECK(status IN (...)), status_reason, criteria_json NOT NULL DEFAULT '[]', progress_done, progress_total, progress_label, origin_discussion_id, provenance_json NOT NULL, draft_source TEXT, draft_key TEXT, priority NOT NULL DEFAULT 'normal', run_id, version INTEGER NOT NULL DEFAULT 1, created_at, updated_at, closed_at, UNIQUE(workspace_id, seq), UNIQUE(draft_source, draft_key) WHERE draft_key IS NOT NULL)` with `doc_path NOT NULL` as the DB-level backstop of ADR 0016 (a Task without a docRef cannot even be inserted).
   - `task_timeline(id PK, task_id NOT NULL REFERENCES tasks(id), workspace_id NOT NULL, seq INTEGER NOT NULL, at NOT NULL, actor_json NOT NULL, kind NOT NULL, from_lane_id, to_lane_id, from_status, to_status, summary NOT NULL, payload_json NOT NULL, run_id, node_execution_id, event_id, UNIQUE(task_id, seq))`.
   - `board_purge_guard(workspace_id PK, created_at)` (see 4); the migration carries the marker comment `-- workspace-scoped: yes` for `boards`, `lanes`, `tasks`, `task_timeline` (DATA012 completeness test).
   - Indexes: `tasks(workspace_id, lane_id, status)`, `tasks(workspace_id, assignee_agent_id, status)`, `tasks(workspace_id, origin_discussion_id)`, `task_timeline(task_id, seq)`, `lanes(board_id, position)`.
2. **Immutability triggers** on `task_timeline`: `BEFORE UPDATE` always `RAISE(ABORT, 'board.history_immutable')`; `BEFORE DELETE` aborts unless a row exists in `board_purge_guard` for the entry's `workspace_id`. Same for `UPDATE` of immutable columns of `tasks` (`id`, `workspace_id`, `board_id`, `seq`, `created_at`, `doc_path` may change only through the explicit `doc_ref_changed` flow: see requirement 6) .
3. **Repositories** implement BOARD003 ports exactly: `seq` assignment `INSERT ... SELECT COALESCE(MAX(seq),0)+1` inside `BEGIN IMMEDIATE` (serialised writers), optimistic update `UPDATE ... WHERE id=? AND version=?` (0 rows -> `board.version_conflict`), parameterised statements only (no string-built SQL), page size caps.
4. **Purge.** `deleteAllForWorkspace(tx, workspaceId)` runs inside the transaction opened by the DATA012 deletion runner (which has already obtained the Local Approval grant): it inserts the `board_purge_guard` row, deletes timeline, tasks, lanes and board of that Workspace only, removes the guard row, and returns the counts (used by `preview`). The guard row exists only inside that transaction, so no committed state ever allows deletes. The participant that calls it is OVE_BOARD015. Task evidence files are Artifacts owned by DATA and are purged by that participant.
5. **Row mapping.** Read paths parse `*_json` columns with the zod schema; a failing row is logged (`error`, ids only) and returned as `data.corrupt_row` rather than crashing the whole list (one corrupt card must not hide the Board).
6. **doc_ref change** (rare): `TaskRepository.update` accepts a docRef change only when the draft contains a matching `doc_ref_changed` timeline entry in the same transaction (trigger checks `NEW.doc_path <> OLD.doc_path` requires the last timeline entry kind; implemented as an application-level assertion plus a trigger on `tasks` that aborts if doc_path changes and no timeline row with that kind was inserted in this transaction: use a `temp.board_tx_flags` row set by the repository).
7. **Backup contributor.** `exportSection(): AsyncIterable<JsonLine>` streams boards, lanes, tasks, timeline ordered by workspace, id; includes `schemaVersion`; `importSection` is out of MVP (restore replaces the whole DB, BACKUP). The export is redacted by the same `summary`/`payload` rules (no secrets exist in the data by construction; a test asserts the redactor changes nothing on a fixture).
8. **Migration safety.** Migration is idempotent under the runner (OVE_DATA), has no `DROP`, and a test applies it to a DB containing a Workspace row created by the previous migrations.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DATA `UnitOfWork`, migration runner, `EventStore`, JSON helpers; the `-- workspace-scoped: yes` migration marker convention (DATA012). TEST003 `repository-contract.ts` for the suite runner. Row mapping reuses contracts' zod schemas; no hand-written parsers.

## 8. Architecture and code placement

Adapter layer `packages/adapters/sqlite/src/board/{migrations-meta.ts,sqlite-board-repository.ts,sqlite-task-repository.ts,sqlite-task-timeline-repository.ts,row-mappers.ts,purge.ts,backup-contributor.ts}`. Depends on `application` ports and `contracts`; never imports other adapters or other areas' tables (task rows reference `agents` and `workspaces` ids as plain TEXT without foreign keys except `workspaces`, so Board does not depend on AGENT's schema: cross-area use goes through contracts and use cases).

## 9. Security and safety

DB-level defences complement the domain: timeline cannot be altered even by a buggy use case or a future migration written carelessly (trigger test). `doc_path NOT NULL` plus CHECK length is the persistence backstop of ADR 0016. All SQL parameterised; ids validated by schema before they reach SQL. Purge is reachable only through the DATA012 runner (Local Approval, desktop only, never Telegram); the guard exists only inside the deletion transaction, and the runner writes the `workspace.deleted` audit event. JSON columns are validated on read so a tampered database cannot inject unexpected shapes into the UI. The engine is the only process opening the DB file (0600, OVE_ARCH005); agents never touch it.

## 10. Errors and edge cases

- `BEGIN IMMEDIATE` busy: retry with backoff (DATA policy), then `data.busy` retryable.
- Purge interrupted by a crash: the transaction rolls back, including the guard row (it never commits).
- Duplicate `(draft_source, draft_key)` insert: mapped to `board.duplicate_draft` with the existing id.
- Lane referenced by tasks cannot be deleted (FK RESTRICT); archive instead.
- A Task row for a Workspace that no longer exists is impossible (FK), verified in test.
- Very long timelines: `list` paginates by `seq`.

## 11. Acceptance criteria

- [ ] Migration applies on an empty and on an upgraded DB; re-running the runner is a no-op.
- [ ] SQLite repositories pass the three contract suites from BOARD003.
- [ ] `UPDATE task_timeline ...` and `DELETE FROM task_timeline ...` fail with `board.history_immutable` outside purge (raw SQL test).
- [ ] Inserting a task with NULL or empty `doc_path` fails at the DB level.
- [ ] `deleteAllForWorkspace` deletes everything for exactly one Workspace, leaves other Workspaces untouched, and fails outside a transaction; no guard row survives commit.
- [ ] Export contributor streams all rows and is deterministic.
- [ ] Corrupt JSON in one row yields `data.corrupt_row` for that row only.

## 12. Test plan

- `packages/adapters/sqlite/src/board/*.contract.test.ts` (suite runner), `triggers.test.ts` (raw SQL abuse), `purge.test.ts` (two Workspaces), `migration.test.ts`, `backup-contributor.test.ts`.
- Use an in-memory or temp-dir SQLite per test (DATA helper).
- Commands: `pnpm vitest run packages/adapters/sqlite/src/board`.

## 13. Parallelization notes

Parallel with BOARD005-BOARD010 (they use fakes). Migration file name is unique to this task; BOARD011 adds its own migration for FTS. Hotspot: none besides the migrations folder (ordered by version string).

## 14. Open questions and assumptions

- ASSUMPTION: `agents`/`discussions` ids are stored as plain TEXT without foreign keys to keep areas decoupled.
- Open: should Task `description` be searchable by FTS (BOARD011 default: title, description and docRef path).
