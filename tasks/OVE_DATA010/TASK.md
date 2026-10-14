---
id: OVE_DATA010
title: Workspace repository port, SQLite schema and migration, in-memory fake, contract test
area: DATA
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA007, OVE_DATA008, OVE_DATA009, OVE_TEST003]
soft_depends_on: []
provides: ["port:WorkspaceRepository", "table:workspaces", "lib:workspace-fake", "lib:workspace-builder", "port:WorkspaceReader"]
needs: ["lib:repository-base", "port:UnitOfWork", "lib:contract-test-harness"]
owns: ["packages/application/src/ports/WorkspaceRepository.ts", "packages/domain/src/workspace/**", "packages/adapters/sqlite/src/workspace/**", "packages/adapters/sqlite/migrations/V202610130020__OVE_DATA010__create_workspaces.sql", "packages/testing/src/fakes/InMemoryWorkspaceRepository.ts", "packages/testing/src/builders/workspace.builder.ts", "packages/testing/src/contracts/WorkspaceRepository.contract.ts"]
reads: ["packages/contracts/src/workspace"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 14"]
adr_refs: [8, 10]
---

# OVE_DATA010: Workspace repository, schema, fake and contract test

## 1. Summary

Persist Workspaces: the repository port, the `workspaces` table, the SQLite implementation, an in-memory fake, a builder and a contract suite.

## 2. Context

Almost every table in the product carries `workspace_id` and references this table. Foreign keys from other areas' tables point to `workspaces(id)` with `ON DELETE RESTRICT`; deletion goes through the cascade routine (DATA012) which removes dependants explicitly so every area decides how its data is removed.

## 3. Scope (in)

- Domain helpers `normaliseWorkspaceName`, `slugify`, invariants.
- Port `WorkspaceRepository`.
- Migration, SQLite implementation, fake, builder `aWorkspace()`, contract runner.

## 4. Out of scope

- Use cases and routes: DATA011. Delete cascade: DATA012. Policy rows: PERM.

## 5. Detailed requirements

1. Table:
   ```sql
   CREATE TABLE workspaces (
     id TEXT PRIMARY KEY,                       -- ws_<ULID>
     name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,   -- NFC + case-folded, uniqueness
     slug TEXT NOT NULL UNIQUE,
     description TEXT, isolated INTEGER NOT NULL DEFAULT 0 CHECK (isolated IN (0,1)),
     policy_id TEXT, budget_json TEXT NOT NULL CHECK (json_valid(budget_json)),
     paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0,1)), paused_at TEXT,
     status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleting')),
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
   ) STRICT;
   CREATE INDEX idx_workspaces_status ON workspaces(status, updated_at);
   ```
   Header: `-- task: OVE_DATA010`, `-- tables: workspaces`, `-- owns-tables: workspaces`.
2. Port (all mutations take `tx: TxContext`; reads do not):
   ```ts
   interface WorkspaceRepository {
     insert(tx, ws: Workspace): Result<Workspace>;                          // data.conflict / data.workspace_name_taken
     get(id): Promise<Result<Workspace>>;                                    // data.not_found
     list(opts: ListOptions & { includeDeleting?: boolean }): Promise<Result<Page<WorkspaceSummary>>>;
     update(tx, id, expectedVersion, patch: WorkspacePatch): Result<Workspace>;   // versionedUpdate
     setPaused(tx, id, paused: boolean, at: string): Result<Workspace>;      // used by PAUSE
     setPolicyId(tx, id, policyId): Result<Workspace>;                       // used by PERM (once, null -> value)
     markDeleting(tx, id): Result<void>;                                     // cascade step 1
     hardDelete(tx, id): Result<void>;                                       // cascade last step only
     existsAll(ids): Promise<Result<boolean>>;
   }
   ```
3. Name uniqueness via `name_key`; violation mapped to `data.workspace_name_taken`. `slug` collision (different names, same slug) appends `-2`, `-3` deterministically inside the same transaction.
4. `status='deleting'` rows are excluded from `list` by default and every other area's queries must treat the Workspace as non-existent (enforced by `existsAll` used in use cases).
5. `policy_id` has no FK (the policy table belongs to PERM and is created later); integrity is checked by the use case.
6. Row mapping via DATA007 `RowMapper`; `budget_json` parsed through the contract schema.
7. Fake `InMemoryWorkspaceRepository` enrols in `InMemoryUnitOfWork`, reuses `normaliseWorkspaceName`/`slugify` from domain so behaviour matches.
8. Builder `aWorkspace(overrides)` uses `defineBuilder({ schema: Workspace })` with deterministic names (`Workspace 1`, ...).
9. Contract suite `WorkspaceRepository.contract.ts` calls `repositoryContract` (save/get, not found, ordering, pagination, optimistic concurrency, transaction rollback) plus specifics: name uniqueness case/diacritic-insensitive, slug collision suffix, `markDeleting` hides from list, `hardDelete` of a non-deleting Workspace is refused (`data.integrity_violation`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

DATA007 (RowMapper, versionedUpdate, cursors), DATA002 (TxContext), TEST003 `repositoryContract`, TEST002 `defineBuilder`.

## 8. Architecture and code placement

`packages/domain/src/workspace/{naming.ts,invariants.ts}` (pure), port in application, adapter `packages/adapters/sqlite/src/workspace/{sqlite-workspace-repository.ts,rows.ts}`. Domain has no I/O; adapter depends on port types and contracts.

## 9. Security and safety

`STRICT` tables and CHECK constraints keep types honest. Names never form file paths. The `deleting` state prevents use of a half-deleted Workspace (fail closed). `hardDelete` is only callable inside the cascade transaction (guard: requires `status='deleting'`).

## 10. Errors and edge cases

- Rename to the same name: no-op success with unchanged version.
- Concurrent rename and delete: version conflict or `not_found`.
- Slug generation yields empty (name made of emoji): fallback slug `workspace` + suffix.
- 10 000 Workspaces: list is keyset-paginated.

## 11. Acceptance criteria

- [ ] Contract suite passes on SQLite and fake.
- [ ] Given names `Projekt` and `projekt`, then the second insert fails with `data.workspace_name_taken`.
- [ ] Given `markDeleting`, then `list` omits it and `get` still returns it with status `deleting`.
- [ ] Given a stale version on `update`, then `data.version_conflict`.
- [ ] Migration file passes the ARCH009 naming/header checks.

## 12. Test plan

Contract runner files `sqlite-workspace-repository.contract.test.ts` and fake runner; unit tests for naming; migration test through DATA003 dry-run. Commands: `pnpm vitest run packages/adapters/sqlite/src/workspace packages/domain/src/workspace`.

## 13. Parallelization notes

Other areas may start with `EntityId<'ws'>` and fake `InMemoryWorkspaceRepository` before this merges (soft). Migration version `V202610130020` reserved.

## 14. Open questions and assumptions

- ASSUMPTION: no FK from `workspaces.policy_id` (cross-area, created later).
- ASSUMPTION: STRICT tables are available (SQLite >= 3.37; guaranteed by driver check).
