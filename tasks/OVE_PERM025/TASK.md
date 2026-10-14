---
id: OVE_PERM025
title: Add SQLite repositories for approvals, access requests and run grants with fakes
area: PERM
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA001, OVE_DATA002, OVE_DATA003, OVE_PERM014, OVE_PERM016]
soft_depends_on: []
provides: ["lib:sqlite-approval-repo", "lib:memory-approval-repo", "table:perm_approvals", "table:perm_access_requests", "table:perm_run_grants"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "lib:migration-runner"]
owns: ["packages/adapters/sqlite/src/perm/approvals/**", "packages/adapters/sqlite/migrations/V202610141010__OVE_PERM025__create_perm_approvals.sql", "packages/testing/src/fakes/MemoryApprovalRepository.ts", "packages/testing/src/fakes/MemoryAccessRequestRepository.ts", "packages/testing/src/fakes/MemoryRunGrantRepository.ts", "packages/testing/src/contracts/ApprovalRepository.contract.ts", "packages/testing/src/contracts/AccessRequestRepository.contract.ts", "packages/testing/src/contracts/RunGrantRepository.contract.ts"]
reads: ["packages/application/src/ports/ApprovalRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14", "SPECIFICATION 12"]
adr_refs: [3, 6, 19]
---

# OVE_PERM025: Add SQLite approval, access request and run grant repositories

## 1. Summary

Persistence for ApprovalRequests, AccessRequests and Run grants with compare-and-set status changes, sweep queries and fakes, so pending requests and Run grants survive an engine restart.

## 2. Context

Ports: `ApprovalRepository` (PERM014), `AccessRequestRepository` and `RunGrantRepository` (PERM016). State machines are domain code; the repositories only guarantee atomic transitions.

## 3. Scope (in)

Migration, three SQLite repositories, three fakes, three contract suites.

## 4. Out of scope

Use cases, routes, audit (separate tasks).

## 5. Detailed requirements

1. `perm_approvals(id PK, workspace_id, run_id, agent_id, node_execution_id, action_class, summary, structured_json, action_hash, preview_json, status CHECK IN (...), requested_at, expires_at, decided_at, decided_by, decision_note, consumed_at, correlation_id)`; indexes `(status, expires_at)`, `(run_id, status)`, unique partial index `(action_hash) WHERE status='pending'` (dedupe).
2. `perm_access_requests(id PK, workspace_id, run_id, agent_id, raw_path_display, canonical_path, rights_json, justification, status CHECK IN (...), requested_at, expires_at, decided_at, decided_by, granted_rights_json, run_grant_id, added_directory_id, note)`; indexes `(status, expires_at)`, `(run_id, status)`, `(run_id, canonical_path)`.
3. `perm_run_grants(id PK, run_id, workspace_id, path_canonical, rights_json, request_id, created_at, revoked_at)`; index `(run_id) WHERE revoked_at IS NULL`.
4. `compareAndSetStatus(id, from, to, patch)` is a single `UPDATE ... WHERE id=? AND status=?` returning affected rows; zero rows means the caller maps to `*_not_pending`. No read-modify-write races.
5. Sweep queries `listExpiring(now, limit)` and `listPendingByRun(runId)` are indexed.
6. Terminal rows are retained (history for the Approvals view) for 365 days; deletion of old terminal rows is a maintenance function (audit events remain); Run grants kept 30 days after revocation.
7. Parse-on-read with the contract schemas; failure returns an error and the row is treated as non-existing for decisions (fail closed: never approved by a broken row).
8. Contract suites: CAS race (50 concurrent deciders, exactly one wins), dedupe unique index, sweeps, grants revocation, corrupt row handling, ordering and pagination.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PERM013/015 schemas, DATA SQLite core, TEST003 helper.

## 8. Architecture and code placement

`packages/adapters/sqlite/src/perm/approvals/*.ts`; fakes/contracts in `packages/testing`.

## 9. Security and safety

CAS at the database level is the real single-use guarantee for approvals and decisions. Dedupe index prevents approval flooding. Previews and justification are stored as bounded text only. A corrupted row never counts as approved.

## 10. Errors and edge cases

Concurrent decide and expire: one wins. Engine restart: pending rows persist. Disk full: error propagated, nothing half-written (single statement or transaction). Hash collision across Runs impossible (hash includes Run and Agent).

## 11. Acceptance criteria

- [ ] 50 concurrent `compareAndSetStatus` calls: exactly one succeeds.
- [ ] Duplicate pending hash is rejected by the DB.
- [ ] Sweep queries use indexes (plan test).
- [ ] Corrupt row is not approvable.
- [ ] Contract suites pass on Memory and SQLite.

## 12. Test plan

Contract suites, temp-file SQLite tests, plan tests. `pnpm vitest run packages/adapters/sqlite/src/perm/approvals`.

## 13. Parallelization notes

Parallel with PERM024.

## 14. Open questions and assumptions

- ASSUMPTION: 365-day history for finished approvals/requests; audit holds the permanent record.
