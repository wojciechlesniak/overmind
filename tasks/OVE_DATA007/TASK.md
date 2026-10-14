---
id: OVE_DATA007
title: Provide base repository utilities (row mapping, cursors, versioned update, canonical JSON)
area: DATA
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DATA001, OVE_DATA002]
soft_depends_on: []
provides: ["lib:repository-base", "lib:cursor-pagination", "lib:canonical-json"]
needs: ["port:Clock", "port:IdGenerator"]
owns: ["packages/adapters/sqlite/src/core/repository/**", "packages/adapters/sqlite/src/core/canonical-json.ts", "packages/application/src/data/**"]
reads: ["packages/testing/src/contracts/repository-contract.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14"]
adr_refs: [8, 19]
---

# OVE_DATA007: Provide base repository utilities (row mapping, cursors, versioned update, canonical JSON)

## 1. Summary

Shared, small building blocks so that dozens of repositories written by different areas behave identically: zod-validated row mapping, opaque cursor pagination, optimistic concurrency by `version`, soft-delete-free CRUD helpers and canonical JSON.

## 2. Context

TEST003's `repositoryContract` expects: `data.not_found`, `data.conflict` on version mismatch, stable id ordering, gap-free cursor pagination, `data.immutable` for append-only entities, and workspace isolation. Every area implementing `SqliteXxxRepository` must get these for free instead of re-implementing them (DRY).

## 3. Scope (in)

- `RowMapper<TRow, TEntity>` helper with zod validation on read (corrupt rows fail loudly).
- `Cursor` encode/decode (opaque, signed by structure not secret).
- `versionedUpdate()` helper implementing compare-and-swap.
- `Page<T>` type, `ListQuery` base, ordering rules.
- `canonicalJson()`.
- Application-level types in `packages/application/src/data/` (`Page`, `ListOptions`, `Versioned`).

## 4. Out of scope

- Entity-specific SQL: each owner. The contract-test harness itself: TEST003. In-memory fakes: `OVE_DATA008`.

## 5. Detailed requirements

1. `Page<T> = { items: readonly T[]; nextCursor?: string }`; `ListOptions = { limit?: number /* default 50, max 200 */; cursor?: string }`. Cursor = base64url of `{v:1, k:[sortKey...]}`; invalid or tampered -> `data.cursor_invalid`. Ordering is always `ORDER BY <sortKey> ASC, id ASC` (ULIDs make id order = creation order); keyset pagination (`WHERE (k,id) > (?,?)`), never OFFSET.
2. `RowMapper`: `defineRowMapper({ schema, toRow, fromRow })`; `fromRow` parses with the entity zod schema (dates as ISO strings, JSON columns parsed with `JSON.parse` in try/catch); an invalid row returns `data.corrupt_row` with entity name and id only (no content) and logs `error`.
3. `versionedUpdate(db, { table, id, expectedVersion, set })` emits `UPDATE t SET ..., version = version + 1 WHERE id=? AND version=?`; `changes === 0` then a follow-up `SELECT` distinguishes `data.not_found` from `data.conflict` (`details: { expected, actual }` numbers only). Entities with `version` use integers starting at 1.
4. Insert helper `insertRow` maps UNIQUE violations to `data.conflict` (with `details.field` when the constraint name is registered), FK violations to `data.integrity_violation`.
5. `scopedWhere({ workspaceId })` helper that every list query for a workspace-owned entity MUST use. A unit test lists the tables whose migration header carries `-- workspace-scoped: yes` and fails when a repository file under `packages/adapters/sqlite/src/` queries such a table without `scopedWhere` (static text check).
6. `canonicalJson(value)`: deterministic stringify (sorted keys, no whitespace, rejects `undefined`, functions, NaN, Infinity, cycles); used by hash chain, checksums and idempotency request hashes.
7. Timestamps: repositories store ISO-8601 UTC strings produced by `Clock.nowIso()` passed in by the use case; helpers never call `Date.now()`.
8. Boolean columns are INTEGER 0/1 with CHECK; JSON columns are TEXT with `CHECK(json_valid(col))`; enum columns have `CHECK(col IN (...))` generated from the zod enum by a helper `enumCheck()` so DB and contract cannot drift (a test compares them).
9. Table naming: snake_case plural; every owned table declares `-- owns-tables:` in its migration (ARCH009). Primary key `id TEXT` with the prefixed ULID (ARCH007); no autoincrement integers except `event_log.seq`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Used by every `Sqlite*Repository` in this backlog (DATA010, 013, 015, 016 and all other areas). Contract harness `repositoryContract` (TEST003) is the acceptance test for repositories built on these helpers.

## 8. Architecture and code placement

Adapter helpers: `packages/adapters/sqlite/src/core/repository/{row-mapper.ts,cursor.ts,versioned-update.ts,scoped-where.ts,enum-check.ts,errors.ts}`. Pure application types: `packages/application/src/data/{page.ts,list-options.ts}` so ports in application can return `Page<T>` without importing the adapter.

## 9. Security and safety

Cursor decoding never interpolates into SQL (values bound). Row validation on read makes tampered or corrupt rows fail loudly instead of flowing into policy decisions. `scopedWhere` keeps Workspace data separated (isolated Workspaces, SR-32/SR-33 spirit). Error details contain ids and numbers only.

## 10. Errors and edge cases

- Cursor from an older sort definition: `data.cursor_invalid`, client restarts from page 1.
- Limit above 200: clamped, not an error.
- Concurrent update between SELECT and UPDATE: CAS handles it; second writer gets `data.conflict`.
- JSON column containing invalid JSON (manual edit): `data.corrupt_row`.

## 11. Acceptance criteria

- [ ] Given 1000 rows and limit 37, then iterating all pages returns every row exactly once in order.
- [ ] Given a stale `expectedVersion`, then `data.conflict`; given a missing id, then `data.not_found`.
- [ ] Given a tampered cursor, then `data.cursor_invalid`.
- [ ] `canonicalJson` output is identical for key-permuted objects and rejects cycles.
- [ ] The enum-check test fails when a zod enum gains a member the SQL CHECK lacks.

## 12. Test plan

Unit tests for each helper; integration with a toy table via the SQLite contract run; property tests (fast-check) for cursor round trips and canonical JSON. Commands: `pnpm vitest run packages/adapters/sqlite/src/core/repository`.

## 13. Parallelization notes

Parallel with DATA004/005. Other areas' repository tasks depend on `lib:repository-base`.

## 14. Open questions and assumptions

- ASSUMPTION: keyset pagination only; no total counts (callers needing counts call a dedicated count method).
