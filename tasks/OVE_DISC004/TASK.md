---
id: OVE_DISC004
title: "Create SQLite migrations and repositories for Discussions, messages and outcome revisions"
area: DISC
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BACKUP003, OVE_DATA001, OVE_DATA002, OVE_DATA005, OVE_DISC003]
soft_depends_on: ["OVE_TEST003"]
provides: ["table:discussions", "table:discussion_messages", "table:discussion_outcome_revisions", "lib:sqlite-discussion-repos"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "port:EventStore", "port:BackupContributor"]
owns: ["packages/adapters/sqlite/migrations/V202610140420__OVE_DISC004__discussion_tables.sql", "packages/adapters/sqlite/src/discussion/**"]
reads: ["packages/adapters/sqlite/src/core/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [8, 16]
---

# OVE_DISC004: Create SQLite migrations and repositories for Discussions, messages and outcome revisions

## 1. Summary

Persist Discussions with a tamper-resistant transcript: tables, indexes, DB-level append-only triggers for messages and outcome revisions, repositories passing the contract suites, a transaction-scoped purge guard for Workspace deletion, and a backup export.

## 2. Context

SPEC 15: Discussions are observable live and replayable. SPEC 10 and ADR 0008: Decisions record each side's arguments taken from the transcript, so the transcript must be immutable and complete; deleting a Workspace is the single exception (Local Approval, via DATA012). Run state is event-sourced (ADR 0019); these tables are domain state next to the event log.

## 3. Scope (in)

- Migration, repositories, row mappers validated by zod, purge guard, backup contributor, triggers, tests.

## 4. Out of scope

- Read-model queries and write-time redaction: OVE_DISC013. Cascade participant: OVE_DISC016. Engine behaviour: DISC006+.

## 5. Detailed requirements

1. **Tables** (STRICT; migration marked `-- workspace-scoped: yes` for all four): `discussions(id PK, workspace_id NOT NULL REFERENCES workspaces(id), seq INTEGER NOT NULL, run_id, branch_id, node_execution_id, title, agenda, question CHECK IN ('how','what'), options_json, started_by_kind CHECK IN ('node','chief'), started_by_json, participants_json, moderator_json, config_json, status CHECK IN (...), current_round INTEGER NOT NULL DEFAULT 0, owner_approval_required INTEGER NOT NULL, run_control_json, version INTEGER NOT NULL DEFAULT 1, created_at, started_at, ended_at, UNIQUE(workspace_id, seq), UNIQUE(node_execution_id) WHERE node_execution_id IS NOT NULL)`; `discussion_messages(id PK, discussion_id NOT NULL REFERENCES discussions(id), workspace_id NOT NULL, round, seq NOT NULL, kind, author_json, participant_id, text, stance_json, skills_json NOT NULL DEFAULT '[]', proposals_json, trust CHECK IN ('agent','owner','owner_remote','system'), channel, status, usage_json, redaction_json, content_hash NOT NULL, created_at NOT NULL, UNIQUE(discussion_id, seq))`; `discussion_outcome_revisions(id PK, discussion_id, workspace_id, revision NOT NULL, kind CHECK IN ('draft','owner_edit','approval','rejection'), outcome_json NOT NULL, content_hash NOT NULL, actor_json NOT NULL, created_at NOT NULL, UNIQUE(discussion_id, revision))`; `discussion_purge_guard(workspace_id PK, created_at)`.
2. **Indexes:** `discussions(workspace_id, status, created_at)`, `discussions(run_id, branch_id)`, `discussion_messages(discussion_id, round, seq)`.
3. **Triggers:** on messages and outcome revisions `BEFORE UPDATE` aborts with `disc.history_immutable`; `BEFORE DELETE` aborts unless `discussion_purge_guard` has a row for the row's `workspace_id`. On `discussions`: `BEFORE UPDATE` aborts when `id`, `workspace_id`, `seq`, `created_at`, `question`, `node_execution_id` change; a terminal status (`concluded`, `cancelled`, `failed`) cannot change, and `escalated` may only become `concluded`; `BEFORE DELETE` requires the guard.
4. **Message seq** under `BEGIN IMMEDIATE` (`COALESCE(MAX(seq),0)+1`); `content_hash = sha256(round|author|text|stance_json)` computed by the repository from the persisted values (test recomputes).
5. **Repositories** implement the DISC003 ports; zod validation on read; corrupt row -> `data.corrupt_row` for that row only; parameterised SQL; messages page max 200.
6. **Purge:** `deleteAllForWorkspace(tx, workspaceId)` (inside the DATA012 deletion transaction after Local Approval): insert guard row, delete messages, revisions, discussions of that Workspace, delete guard row, return counts. The guard never commits.
7. **Backup contributor:** JSON Lines export of discussions, messages, revisions with `schemaVersion`; messages are already redacted.
8. `listActive()` returns `running|paused|awaiting_outcome_approval` Discussions for engine recovery (DISC006).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Same pattern as OVE_BOARD004 (guard table, trigger style, row mappers); share helper SQL only through a DATA `lib:sqlite-append-only` if it exists, else keep equivalent triggers and tests.

## 8. Architecture and code placement

`packages/adapters/sqlite/src/discussion/{sqlite-discussion-repository.ts,sqlite-message-repository.ts,sqlite-outcome-repository.ts,row-mappers.ts,backup-contributor.ts,recovery-query.ts}`. Imports application ports and contracts only.

## 9. Security and safety

The transcript is evidence for Decisions and the Owner; triggers make tampering impossible for a buggy path, and deletes require the purge guard that only exists inside the Local-Approval deletion transaction. `trust` is CHECK constrained so an agent-authored row cannot claim `owner` trust. Content hashes make silent edits detectable. SQL parameterised; JSON validated on read.

## 10. Errors and edge cases

- Crash between message insert and event row: one `UnitOfWork`; recovery re-reads state.
- Duplicate `node_execution_id` start: unique violation -> existing Discussion (idempotent).
- Long transcripts: paginated by `seq`.

## 11. Acceptance criteria

- [ ] Migration applies; SQLite repositories pass DISC003 suites.
- [ ] Raw UPDATE/DELETE on messages and revisions fail outside purge.
- [ ] Terminal status cannot change.
- [ ] `deleteAllForWorkspace` removes only the target Workspace, only inside a transaction, no guard row survives commit.
- [ ] Message hash recomputes; export deterministic.

## 12. Test plan

- `*.contract.test.ts`, `triggers.test.ts`, `purge.test.ts`, `migration.test.ts`, `backup-contributor.test.ts`, `hash.test.ts`. Commands: `pnpm vitest run packages/adapters/sqlite/src/discussion`.

## 13. Parallelization notes

Parallel with DISC005/006 (fakes). Unique migration file.

## 14. Open questions and assumptions

- Proposal to DATA: shared `lib:sqlite-append-only` trigger generator for BOARD, DISC, DEC, MEM.
