---
id: OVE_PERM020
title: Implement the append-only audit store (AppendAudit, AuditLog port, SQLite adapter)
area: PERM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH007, OVE_DATA001, OVE_DATA002, OVE_DATA003, OVE_PERM019]
soft_depends_on: [OVE_PERM021]
provides: ["usecase:AppendAudit", "port:AuditLog", "table:audit_events", "table:audit_head", "lib:sqlite-audit-log", "lib:memory-audit-log"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "lib:migration-runner", "port:Clock", "port:IdGenerator", "port:Logger"]
owns: ["packages/application/src/audit/append-audit.ts", "packages/application/src/ports/AuditLog.ts", "packages/adapters/sqlite/src/audit/**", "packages/adapters/sqlite/migrations/V202610140900__OVE_PERM020__create_audit_events.sql", "packages/testing/src/fakes/MemoryAuditLog.ts", "packages/testing/src/contracts/AuditLog.contract.ts"]
reads: ["packages/domain/src/audit/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [3, 8, 19]
---

# OVE_PERM020: Implement the append-only audit store

## 1. Summary

`AppendAudit` is the single door through which every area writes an audit event. It validates the action and details against the registry, redacts, assigns `seq`, `prevHash` and `hash` inside one SQLite transaction and appends. The table has no update or delete path: enforced by the port shape, SQLite triggers and a contract test.

## 2. Context

Audit events are written in the same transaction as the change they describe (PERM011, PERM014, PERM016 pass the shared `UnitOfWork`). SQLite runs in WAL mode (SPEC 12). Chain and registry come from PERM019, redaction from PERM021. SR-17: security decisions go to the append-only store, not only to logs.

## 3. Scope (in)

- Port `AuditLog`: `append(draft)`, `appendMany(drafts)`, `readRange`, `head()`, `count(filter)`, `iterate(filter)`; deliberately no update/delete method.
- `AppendAudit` use case, SQLite adapter, migration with triggers and indexes, in-memory fake, contract suite.

## 4. Out of scope

Chain and registry (PERM019), redaction rules (PERM021), export/verify/retention (PERM022), query routes (PERM023), the domain event store (DATA).

## 5. Detailed requirements

1. `AuditDraft` = event without `id, seq, prevHash, hash, occurredAt, schemaVersion`. `AppendAudit` adds id/time from ports, checks the action is registered and `details` pass the strict action schema. Invalid draft: returns `Err(audit.invalid_event)` AND writes a minimal `audit.invalid_event_dropped` event (action id only) and logs an error, so a bug never silently loses evidence.
2. Transaction: join the caller's `UnitOfWork` if active. Read `audit_head`, compute `seq+1`, `prevHash`, `hash` via `AuditSigner`, insert the row, advance the head. A rolled-back outer change rolls the audit row back too. Denials with no change use their own small transaction.
3. Migration `V202610140900__OVE_PERM020__create_audit_events.sql`: table `audit_events` (`seq INTEGER PRIMARY KEY`, `id UNIQUE`, `occurred_at`, actor columns, `action`, `category`, `severity`, target columns, `result`, `reason_code`, `workspace_id`, `run_id`, `agent_id`, `correlation_id`, `causation_id`, `details_json CHECK(length<=2048)`, `schema_version`, `key_id`, `prev_hash`, `hash`) STRICT; indexes on `occurred_at`, `(run_id, seq)`, `(workspace_id, seq)`, `(action, seq)`, `(category, result, seq)`; single-row `audit_head(id=1, seq, hash, key_id)`; triggers `audit_no_update` and `audit_no_delete` (RAISE ABORT 'audit_events is append-only') and `audit_head_monotonic` (head may only advance by one).
4. Triggers are a speed bump, not the boundary (a process with file access can drop them); tamper-evidence is the chain. A start-up self-check verifies the triggers exist; if missing it recreates them via a new migration, logs a warning and appends `audit.integrity_warning`, never silently.
5. The `AuditLog` type has no mutating method except append; a type-level test asserts it, and importing the SQLite audit repository outside `packages/application/src/audit` and the composition root is forbidden (lint proposal to ARCH002).
6. Performance: append under 2 ms typical; `appendMany` appends sequentially inside one transaction preserving the chain.
7. Any storage or signing failure returns `Err(perm.audit_unavailable)`; every caller MUST abort the audited action (a test over PERM use cases checks each `AppendAudit` result is handled).
8. Contract suite `AuditLog.contract.ts` for Memory and SQLite: gap-free seq; 200 concurrent appends give a valid chain; no mutation through the port; raw UPDATE/DELETE blocked by triggers; stable paging; `verify` fails on a row tampered through a connection with triggers dropped.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PERM019 chain/registry, PERM021 redactor inside `AppendAudit`, DATA `UnitOfWork`, migration runner, `Clock`, `IdGenerator`, harness of TEST003.

## 8. Architecture and code placement

Use case in `packages/application/src/audit/`, port in `packages/application/src/ports/AuditLog.ts`, adapter `packages/adapters/sqlite/src/audit/sqlite-audit-log.ts`, fake and contract in `packages/testing`. No SQL in application.

## 9. Security and safety

Append-only by interface, trigger and chain; audit failure aborts the audited change; details allowlisted and redacted before the adapter; typed filters with bound parameters (no injection surface); events never logged with details. Integrity warnings reach the Owner.

## 10. Errors and edge cases

- Disk full: `perm.audit_unavailable`, change refused, degraded status.
- Clock goes backwards: order is `seq`, not time.
- Backup restore: head restored with table; verify afterwards (PERM022).
- Second process: prevented by the engine lock; primary key `seq` would reject duplicates.

## 11. Acceptance criteria

- [ ] No update/delete through the port; triggers block raw UPDATE/DELETE.
- [ ] 200 concurrent appends give seq 1..200 and a valid chain.
- [ ] Rolled-back change leaves no audit row; a denial is auditable alone.
- [ ] Unregistered action produces `audit.invalid_event_dropped`.
- [ ] Missing triggers detected at start and reported.
- [ ] Contract suite green for both implementations.

## 12. Test plan

Contract suite, real SQLite temp-file adapter tests, trigger tamper tests, benchmark with generous threshold, transaction-join tests. `pnpm vitest run packages/adapters/sqlite/src/audit packages/application/src/audit`.

## 13. Parallelization notes

After PERM019. Others code against `AppendAudit` with `MemoryAuditLog`. Migration timestamp must be later than DATA core migrations (choose at implementation).

## 14. Open questions and assumptions

- ASSUMPTION: DATA `UnitOfWork` supports joining an outer transaction (flag to DATA).
- ASSUMPTION: one head row (single writer) is fine for under 50 events/s.
