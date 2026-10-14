---
id: OVE_NOTIF003
title: "Persist notifications in SQLite with retention"
area: NOTIF
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA001, OVE_NOTIF001]
soft_depends_on: []
provides: ["table:notifications", "lib:notification-repository-sqlite", "lib:fake-notification-repository"]
needs: ["lib:sqlite-core"]
owns: ["packages/adapters/sqlite/src/notification/**", "packages/adapters/sqlite/migrations/V202610131010__OVE_NOTIF003__notifications.sql", "packages/testing/src/fakes/FakeNotificationRepository.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [5]
---

# OVE_NOTIF003: Persist notifications in SQLite with retention

## 1. Summary

SQLite implementation of `NotificationRepository`: the `notifications` table, indexes for the center queries, compare-and-swap updates and a retention policy that never deletes unresolved action requests.

## 2. Context

ADR 0005: an Access Request notification the Owner has not seen must still exist after a reboot. The table is small; queries are by recency and flags. Rows carry `workspace_id`, so the table is Workspace-scoped for deletion (DATA012; see OVE_NOTIF014).

## 3. Scope (in)

- Migration (marked `-- workspace-scoped: yes`) and adapter.
- `prune`, `deleteByWorkspace`.
- In-memory fake and contract suite.

## 4. Out of scope

- Service logic: NOTIF004. Cascade participant: NOTIF014.

## 5. Detailed requirements

1. **Table** (migration begins with the comment `-- workspace-scoped: yes`, required by the DATA012 completeness test):
   ```sql
   CREATE TABLE notifications (
     id TEXT PRIMARY KEY, kind TEXT NOT NULL,
     severity TEXT NOT NULL CHECK (severity IN ('info','attention','critical')),
     title_key TEXT NOT NULL, title_params TEXT NOT NULL, body_key TEXT, body_params TEXT,
     workspace_id TEXT, agent_id TEXT, run_id TEXT,
     subject_type TEXT NOT NULL, subject_id TEXT, dedupe_key TEXT NOT NULL,
     requires_action INTEGER NOT NULL CHECK (requires_action IN (0,1)),
     count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
     read_at TEXT, resolved_at TEXT, resolution TEXT,
     deliveries TEXT NOT NULL DEFAULT '[]'
   ) STRICT;
   CREATE INDEX notifications_recent ON notifications (created_at DESC);
   CREATE INDEX notifications_unread ON notifications (created_at DESC) WHERE read_at IS NULL;
   CREATE INDEX notifications_open_action ON notifications (requires_action, resolved_at) WHERE requires_action = 1 AND resolved_at IS NULL;
   CREATE INDEX notifications_dedupe ON notifications (dedupe_key, updated_at DESC);
   CREATE INDEX notifications_subject ON notifications (subject_type, subject_id);
   CREATE INDEX notifications_workspace ON notifications (workspace_id);
   ```
2. `update(id, patch, expectedUpdatedAt)` is compare-and-swap on `updated_at`; mismatch returns `data.conflict`.
3. `list` is keyset-paginated by `(created_at, id)` descending (limit 1..100, default 30).
4. `resolveBySubject` sets `resolved_at`, `resolution` and `read_at` (if null) for all unresolved rows of the subject in one statement and returns the changed ids.
5. **Retention** `prune({keepReadDays:30, keepMax:500})`: delete rows that are read or resolved and older than 30 days, then the oldest read rows beyond 500, in batches of 500. Unread rows and unresolved action rows are NEVER pruned.
6. `deleteByWorkspace(workspaceId)` deletes every row of that Workspace inside the caller's transaction (used by OVE_NOTIF014).
7. JSON columns are validated on read; an invalid row is skipped with a `warn` and counted, never fabricated. Only keys and primitive params are stored, never rendered text.
8. A redaction pass (`lib:redaction`) on params before insert is a second barrier behind the contract.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:sqlite-core` (connection, migrations, transactions); contract suite `NotificationRepository.contract.ts` run for SQLite and the fake.

## 8. Architecture and code placement

`packages/adapters/sqlite/src/notification/{sqlite-notification-repository.ts,rows.ts}`; fake in `packages/testing`. No business rules here.

## 9. Security and safety

- Parameterised SQL only.
- The SEC003 corpus secrets never reach the table (test).
- Deletion only through `prune` and `deleteByWorkspace`; no API deletes an unresolved actionable row otherwise.

## 10. Errors and edge cases

- Concurrent `markRead` and `update`: CAS conflict, service retries.
- 50k-row backlog: `list` stays O(limit); prune batches.
- Same `created_at`: ULID tiebreak.
- Backup restored: stale actionable rows are resolved at boot by NOTIF005.

## 11. Acceptance criteria

- [ ] Three inserts list newest first and paging has no duplicates.
- [ ] An unresolved Access Request older than 90 days survives `prune`.
- [ ] `resolveBySubject` returns the changed ids.
- [ ] A stale `expectedUpdatedAt` gives `data.conflict`.
- [ ] Contract suite passes for SQLite and the fake.
- [ ] `deleteByWorkspace` removes only that Workspace's rows.

## 12. Test plan

Contract suite plus `sqlite-notification-repository.test.ts` (temp DB): pagination, prune, CAS, corrupt rows, redaction, workspace delete. Command: `pnpm vitest run packages/adapters/sqlite/src/notification`.

## 13. Parallelization notes

Parallel with NOTIF002. Unique migration name.

## 14. Open questions and assumptions

- ASSUMPTION: 30 days / 500 rows retention for read items, not configurable in the MVP.
