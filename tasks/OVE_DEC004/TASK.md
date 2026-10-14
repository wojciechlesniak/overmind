---
id: OVE_DEC004
title: "Create the append-only SQLite Decision Register with DB-level enforcement"
area: DEC
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BACKUP003, OVE_DATA001, OVE_DATA002, OVE_DATA005, OVE_DEC003]
soft_depends_on: ["OVE_TEST003"]
provides: ["table:decisions", "table:decision_events", "lib:sqlite-decision-repos", "lib:decision-append-only-triggers"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "port:EventStore", "port:BackupContributor"]
owns: ["packages/adapters/sqlite/migrations/V202610140430__OVE_DEC004__decision_tables.sql", "packages/adapters/sqlite/src/decision/**"]
reads: ["packages/adapters/sqlite/src/core/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 16, 18, 28]
---

# OVE_DEC004: Create the append-only SQLite Decision Register with DB-level enforcement

## 1. Summary

Implement the Decision Register storage so that "never deleted, only superseded" is enforced by the database itself: immutable `decisions` rows, append-only `decision_events`, triggers that abort UPDATE and DELETE, a transaction-scoped purge guard for the single legal exception (Workspace deletion), repositories passing the contract suites, and a backup export.

## 2. Context

ADR 0008: Decisions are not deleted or overwritten; a new Decision supersedes the old; the Owner may delete a whole Workspace together with its Decisions after Local Approval (SPEC 10, DATA012). SPEC 16 does not test this directly but the guarantee is the product's memory. Application-level rules can have bugs; DB-level triggers plus tests make the rule robust against them, against future migrations and against SQL mistakes. Agents never touch the DB, but defence in depth protects against engine bugs.

## 3. Scope (in)

- Migration with tables, indexes, triggers, repositories, row mappers, purge guard, export, tests including raw SQL abuse.

## 4. Out of scope

- FTS5 table and search: OVE_DEC007. Use cases: DEC005+. Cascade participant: OVE_DEC013.

## 5. Detailed requirements

1. **Tables** (STRICT; migration marks both `-- workspace-scoped: yes`): `decisions(id PK, workspace_id NOT NULL REFERENCES workspaces(id), seq INTEGER NOT NULL, run_id, title NOT NULL, problem NOT NULL, context NOT NULL DEFAULT '', alternatives_json NOT NULL CHECK(json_valid(...)), selected_option NOT NULL, rationale NOT NULL, participants_json NOT NULL, evidence_refs_json NOT NULL DEFAULT '[]', assumptions_json, risks_json, skills_used_json NOT NULL DEFAULT '[]', created_at NOT NULL, review_date, confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1), initial_status NOT NULL CHECK(initial_status IN ('proposed','accepted','rejected')), supersedes_id, origin_json NOT NULL, source_key, tags_json, content_hash NOT NULL, UNIQUE(workspace_id, seq), UNIQUE(workspace_id, source_key) WHERE source_key IS NOT NULL)`; `decision_events(id PK, decision_id NOT NULL REFERENCES decisions(id), workspace_id NOT NULL, seq INTEGER NOT NULL, at NOT NULL, actor_json NOT NULL, kind NOT NULL CHECK(kind IN (...)), payload_json NOT NULL, dedupe_key, event_id, UNIQUE(decision_id, seq), UNIQUE(decision_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL)`; `decision_purge_guard(workspace_id PK, created_at)`. `supersedes_id` has NO foreign key (cross-Workspace links must survive deletion of the other Workspace; DATA012 req 9) .
2. **Triggers:** `decisions` and `decision_events`: `BEFORE UPDATE` always `RAISE(ABORT, 'dec.history_immutable')`; `BEFORE DELETE` aborts unless `decision_purge_guard` has a row for the row's `workspace_id`. There is NO column-level exception: even `content_hash` or `confidence` cannot change. Additional `BEFORE INSERT` check on `decision_events`: the referenced Decision's workspace must equal `workspace_id`; for `kind = 'superseded'` the payload's `bySupersedingId` must exist and its `supersedes_id` must equal this decision id (a Decision cannot be marked superseded by an unrelated one).
3. **Table-level protections:** `DROP`/`ALTER` are not possible from the application (engine uses a connection with `PRAGMA trusted_schema = OFF`, and migrations are the only schema writers, DATA). A test asserts that the repository layer exposes no code path emitting `UPDATE decisions`/`DELETE FROM decisions` (grep-based static test over `packages/adapters/sqlite/src/decision` excluding the purge file).
4. **content_hash** = sha256 over canonical JSON of the immutable fields, computed by the repository; recomputed in tests and by an integrity check `verifyDecisions(workspaceId)` that reports mismatches (used by diagnostics, never auto-repairs).
5. **Repositories** implement DEC003 ports; `seq` under `BEGIN IMMEDIATE`; insert of a Decision and its first events (initial status event is NOT written: `initial_status` is in the row; follow-up `review_date_set` etc. are events) happen in one transaction; zod validation on read; corrupt row -> `data.corrupt_row` for that row only.
6. **Purge:** `deleteAllForWorkspace(tx, workspaceId)` inserts the guard row, deletes events then decisions (and FTS rows via trigger from DEC007) of that Workspace, deletes the guard row; the guard never commits; returns counts.
7. **Supersede link integrity:** a `decisions` row with `supersedes_id` is inserted together with a `superseded` event on the old Decision in the same transaction by DEC005 (the repository offers `insertSuperseding(newDecision, oldId, actor, tx)` doing both atomically).
8. **Backup contributor:** JSON Lines export of decisions then events, deterministic order, `schemaVersion`, includes `content_hash` so integrity can be verified after restore.
9. **Indexes:** `decisions(workspace_id, created_at)`, `decisions(supersedes_id)`, `decision_events(decision_id, seq)`, `decision_events(kind, at)` (for review scans), `decisions(workspace_id, source_key)`.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Same conventions as BOARD004/DISC004 (guard table, trigger style); shared trigger generator if DATA provides `lib:sqlite-append-only`. DEC003 contract suites.

## 8. Architecture and code placement

`packages/adapters/sqlite/src/decision/{sqlite-decision-repository.ts,sqlite-decision-event-repository.ts,row-mappers.ts,hash.ts,integrity.ts,backup-contributor.ts}`. Imports ports and contracts only.

## 9. Security and safety

This is the integrity core of organisational memory (ADR 0008). Defences: triggers on both tables with no column exceptions; guard row exists only inside the Local-Approval deletion transaction (DATA012); content hashes allow integrity verification; cross-check trigger prevents a bogus `superseded` link; static test forbids UPDATE/DELETE statements in the adapter; engine-only DB access (0600 file); migrations reviewed (a future migration that drops triggers must be rejected by a test that asserts the triggers exist after all migrations: `triggers-present.test.ts`). Backup contains the hashes, so tampering in a restored file is detectable.

## 10. Errors and edge cases

- `supersedes_id` pointing to a Decision in a deleted Workspace later: link stays, UI shows "deleted Workspace" (DATA012).
- Insert race on `seq`: serialised by `BEGIN IMMEDIATE`.
- Corrupt JSON in one row: that row errors, others load.
- Event append dedupe conflict: returns existing event (idempotent).
- Purge crash: rollback including guard row.

## 11. Acceptance criteria

- [ ] Migration applies; repositories pass DEC003 suites.
- [ ] Raw `UPDATE` (any column) and `DELETE` on both tables fail outside the purge guard; with a guard row for Workspace A, deleting Workspace B rows still fails.
- [ ] Bogus `superseded` event (unrelated superseding id) is rejected.
- [ ] `triggers-present.test.ts` asserts all triggers exist after running all migrations.
- [ ] Static test finds no UPDATE/DELETE of these tables outside `purge.ts`.
- [ ] `verifyDecisions` detects a hash mismatch introduced by direct file tampering in a test copy of the DB.
- [ ] Atomic supersede insert: both rows or none.

## 12. Test plan

- `*.contract.test.ts`, `triggers.test.ts` (raw SQL abuse matrix incl. `INSERT OR REPLACE`, `REPLACE INTO`, `UPDATE ... WHERE 0`, `DELETE` with guard for another Workspace, `PRAGMA recursive_triggers` toggles, `DROP TRIGGER` attempt through the app connection), `integrity.test.ts`, `purge.test.ts`, `backup-contributor.test.ts`. Commands: `pnpm vitest run packages/adapters/sqlite/src/decision`.

## 13. Parallelization notes

Parallel with DEC005/006 (fakes). Unique migration file; DEC007 adds FTS in a separate migration.

## 14. Open questions and assumptions

- Note: `INSERT OR REPLACE`/`REPLACE INTO` delete-then-insert; SQLite fires DELETE triggers only with `recursive_triggers` ON, so the repository forbids the keywords and the triggers add a `BEFORE INSERT` check that aborts when a row with the same primary key exists (explicit test).
- Proposal to DATA: shared trigger generator `lib:sqlite-append-only`.
