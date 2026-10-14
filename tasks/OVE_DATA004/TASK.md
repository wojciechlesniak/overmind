---
id: OVE_DATA004
title: Provide the FTS5 setup helper for searchable tables
area: DATA
kind: infra
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA001, OVE_DATA003]
soft_depends_on: []
provides: ["lib:fts5-helper"]
needs: []
owns: ["packages/adapters/sqlite/src/core/fts/**"]
reads: ["packages/adapters/sqlite/migrations"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8, 14]
---

# OVE_DATA004: Provide the FTS5 setup helper for searchable tables

## 1. Summary

A small library that creates external-content FTS5 indexes with their sync triggers and runs safe ranked queries, so Decisions, Agent Memory and chat search (other areas) never hand-write FTS SQL or build `MATCH` strings from user input.

## 2. Context

SPEC 10 proposes SQLite + FTS for memory and the Decision Register (Chief searches Decisions across Workspaces, except isolated ones). The owning areas (DEC, MEM, CHAT) own their tables and migrations; this helper owns the shared mechanics. FTS5 availability is gated in DATA001.

## 3. Scope (in)

- `ftsDdl({ table, contentTable, contentRowId, columns, tokenizer })` returning migration SQL text (virtual table + three triggers) for use inside a migration file.
- `FtsQuery` builder: sanitises user text into a safe MATCH expression.
- `searchFts(db, spec, query, filters, page)` ranked by bm25 with snippet and pagination.
- `rebuildFts(db, table)` and `integrityCheckFts`.

## 4. Out of scope

- Which columns of which entity are indexed: DEC, MEM, CHAT. Vector or hybrid search (later). Workspace isolation filtering rules: callers pass `workspaceIds` (VIS/DEC decide the set).

## 5. Detailed requirements

1. Index style: external content (`content='<table>', content_rowid='rowid'`), tokenizer default `unicode61 remove_diacritics 2` (Polish diacritics fold), `prefix='2 3'`. The helper emits `AFTER INSERT/UPDATE/DELETE` triggers using the documented `'delete'` command pattern.
2. `FtsQuery.fromUserText(text, { mode: 'all'|'any'|'prefix' })`: tokenises on Unicode word boundaries, quotes each token (`"tok"`), escapes `"`, drops FTS operators (`AND OR NOT NEAR * : ^ ( ) -`), caps at 12 tokens and 200 chars, empty after sanitising -> `err(data.query_empty)`-like validation error `validation.invalid_input`. User text is NEVER concatenated unquoted into MATCH.
3. `searchFts` signature: `(db, { ftsTable, contentTable, select: string[], filterColumns: Record<string,'eq'|'in'> }, q, { filters, limit<=100, cursor }) => Result<{ rows: (Row & { rank: number; snippet: string })[]; nextCursor? }>`. Filter column names come from the spec (whitelist), values are bound parameters. Order by `rank` then rowid; cursor encodes `(rank, rowid)`.
4. Snippet via `snippet()` with markers `[[`/`]]` (not HTML) so the UI escapes content itself (agent text is untrusted, SR-35).
5. `rebuildFts` runs `INSERT INTO t(t) VALUES('rebuild')`; `integrityCheckFts` runs the `integrity-check` command and returns a report used by diagnostics.
6. Identifiers (table, column names) pass through `ident()` (regex `^[a-z][a-z0-9_]{0,62}$`, throws a programmer `InvariantError` otherwise).
7. Performance target: 100k rows, query under 50 ms (informational benchmark).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`SqliteDatabase` (DATA001), migration files via DATA003 (consumers embed `ftsDdl()` output in their `.sql`; a generator script `pnpm db:fts-ddl <spec>` prints it so SQL files are static and reviewable).

## 8. Architecture and code placement

`packages/adapters/sqlite/src/core/fts/{ddl.ts,query.ts,search.ts,maintenance.ts}`. Pure string builders are unit-testable without a database; `search.ts` depends on `SqliteDatabase`.

## 9. Security and safety

FTS `MATCH` is a mini query language: unsanitised input could raise syntax errors or run expensive `NEAR` queries (denial of service); the quoting and caps prevent that. Results from private/isolated Workspaces are excluded by the caller-supplied `workspaceIds` filter: the helper makes the filter mandatory when the spec declares a `workspaceColumn` (cannot be omitted, test), so a search cannot leak across Workspaces (SR-32 style isolation).

## 10. Errors and edge cases

- Query of only operators (`AND OR`): empty -> validation error, no query run.
- Very long Polish words, emoji, RTL text: tokenised, no crash.
- Triggers and content out of sync after a crash: `integrityCheckFts` detects, `rebuildFts` repairs.
- Update of a non-indexed column: trigger still fires (documented cost); helper supports `UPDATE OF <cols>` triggers.

## 11. Acceptance criteria

- [ ] Given hostile input (`"foo" OR (bar`, `NEAR(a b)`, `*`), then the generated MATCH is valid and no SQL error occurs.
- [ ] Given inserts, updates and deletes on the content table, then search results reflect them.
- [ ] Given a spec with `workspaceColumn`, then calling without `workspaceIds` fails at type level and at runtime.
- [ ] Given diacritics (`zażółć` vs `zazolc`), then both match.
- [ ] `rebuildFts` repairs a deliberately desynchronised index.

## 12. Test plan

Unit tests for sanitiser (property test with fast-check: any string yields a valid MATCH), integration with a toy `notes` table, desync repair test, benchmark file marked `slow`. Commands: `pnpm vitest run packages/adapters/sqlite/src/core/fts`.

## 13. Parallelization notes

Independent of DATA005+; DEC/MEM tasks depend on it through `lib:fts5-helper`.

## 14. Open questions and assumptions

- ASSUMPTION: `unicode61` is enough for Polish and English; trigram tokenizer revisited post-MVP.
