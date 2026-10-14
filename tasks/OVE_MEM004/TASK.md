---
id: OVE_MEM004
title: "Create SQLite tables, FTS and immutability triggers for Agent Memory"
area: MEM
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA001, OVE_DATA002, OVE_MEM003]
soft_depends_on: ["OVE_DATA003"]
provides: ["adapter:SqliteAgentMemoryRepository", "adapter:SqliteMemoryIndex", "port:MemoryDeleteGuard"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "port:AgentMemoryRepository", "port:MemoryIndex", "lib:memory-contract-suites"]
owns: ["packages/adapters/sqlite/src/memory/**", "packages/adapters/sqlite/migrations/V202610140440__agent_memory.sql"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [8, 14]
---

# OVE_MEM004: Create SQLite tables, FTS and immutability triggers for Agent Memory

## 1. Summary

Implement the SQLite repository and FTS5 index for Agent Memory entries: `agent_memory_entries`, `memory_fts`, triggers that make content immutable, and a transaction-scoped delete guard so only typed purge paths can remove rows.

## 2. Context

SPEC 14 `AgentMemory`; SPEC 10 SQLite plus FTS. ADR 0014: memory is local and separate per Workspace. Same trigger plus guard pattern as ADR 0008 (Decision Register), applied here to content immutability (Owner views but never edits). Port contracts from MEM003; migration timestamp V202610140440 is reserved for this task.

## 3. Scope (in)

- Migration, repository, index adapter, FTS sanitiser copy, delete guard, JSON export function used by MEM011.

## 4. Out of scope

- Compaction rules: MEM006. Backup hooks: MEM011. Cascade participant: MEM014.

## 5. Detailed requirements

1. Table `agent_memory_entries(id PK, agent_id, workspace_id, kind, title, content, tags_json, source_task_id, source_run_id, source_task_ids_json, provenance_json NOT NULL, status, flags_json, compacted_into_id, promoted_from, content_hash, created_at, status_changed_at)` with CHECKs on kind/status and `length(content) <= 2000`; indexes `(workspace_id, agent_id, status, created_at)` and `(source_task_id)` UNIQUE where kind = 'task_summary' (one summary per Task: idempotency).
2. Trigger `memory_content_immutable` BEFORE UPDATE: aborts when any column other than `status`, `flags_json`, `compacted_into_id`, `status_changed_at` changes.
3. Trigger `memory_delete_guard` BEFORE DELETE: aborts unless the transaction set a row in temp table `memory_delete_guard_token(reason, workspace_id, agent_id)` that matches the row; reasons `workspace_purge`, `agent_deleted`, `retention`. Retention reason additionally requires status `compacted` and age over 180 days.
4. FTS5 `memory_fts(title, content, tags)` external-content, `tokenize='unicode61 remove_diacritics 2'`; insert/update/delete triggers keep it in sync; quarantined and retired entries are removed from the index on status change.
5. Queries accept only `AuthorisedScope`; every SQL carries `workspace_id IN (...)` from the set; the FTS query goes through a sanitiser (quoted terms, max 12 terms, operators stripped) identical to the corpus in DEC007 (parity test in DEC012).
6. `rebuild()` recreates the FTS content from the table inside one transaction.
7. Export function streams entries as JSON lines with `contentHash` for MEM011.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`lib:sqlite-core`, `UnitOfWork`, contract suites from MEM003.

## 8. Architecture and code placement

Adapters in `packages/adapters/sqlite/src/memory/`; no domain imports beyond ports.

## 9. Security and safety

Database-level immutability backs the application rule; deletes only via typed token; scope filter in every statement; FTS input sanitised so a hostile query cannot widen results or raise syntax errors; entries from a quarantined state never reach the index; content length bound at DB level.

## 10. Errors and edge cases

- Two completions for the same Task: unique index makes the second insert a no-op returning the existing id.
- Update attempt on content via raw SQL: trigger aborts.
- FTS out of sync after crash: `rebuild()` repairs.
- Diacritics in Polish titles ('rezerwacje', 'Koszyk z rabatami') match unaccented queries.

## 11. Acceptance criteria

- [ ] Contract suites of MEM003 pass on the SQLite adapters.
- [ ] Raw UPDATE of content and raw DELETE without token both fail (tests via a raw connection).
- [ ] Unique summary per Task enforced.
- [ ] FTS finds Polish diacritics and never returns rows outside the scope.
- [ ] Migration applies on an empty and on a populated database.

## 12. Test plan

- Adapter tests with in-memory SQLite, trigger tests with raw SQL. Commands: `pnpm vitest run packages/adapters/sqlite/src/memory`.

## 13. Parallelization notes

Independent of BOARD/DISC/DEC adapters except the shared sqlite-core. Hotspot: migrations folder (unique timestamp).

## 14. Open questions and assumptions

- ASSUMPTION: DATA hoists a shared FTS sanitiser later; until then this copy is covered by the parity test.
