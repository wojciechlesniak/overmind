---
id: OVE_PERM024
title: Add SQLite policy, profile and override repositories with fakes and contract tests
area: PERM
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA001, OVE_DATA002, OVE_DATA003, OVE_PERM011, OVE_PERM012]
soft_depends_on: []
provides: ["lib:sqlite-policy-repo", "lib:memory-policy-repo", "table:perm_policies", "table:perm_policy_directories", "table:perm_profiles", "table:perm_approval_overrides"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "lib:migration-runner"]
owns: ["packages/adapters/sqlite/src/perm/policies/**", "packages/adapters/sqlite/migrations/V202610141000__OVE_PERM024__create_perm_policies.sql", "packages/testing/src/fakes/MemoryPolicyRepository.ts", "packages/testing/src/contracts/PolicyRepository.contract.ts", "packages/testing/src/contracts/ApprovalOverrideRepository.contract.ts"]
reads: ["packages/application/src/ports/PolicyRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [3, 18]
---

# OVE_PERM024: Add SQLite policy, profile and override repositories

## 1. Summary

Persistence for Permission Policies, their Allowed Directories, Permission Profiles and Approval overrides, with optimistic versioning, plus in-memory fakes and the shared contract suites both implementations must pass.

## 2. Context

Ports are defined in PERM011 (`PolicyRepository`, `PermissionProfileReader`) and PERM012 (`ApprovalOverrideRepository/Reader`). Cross-area access to this data goes through those ports, never through the tables (PLAN section 6).

## 3. Scope (in)

Migration, SQLite repositories, memory fakes, contract suites, seeding of built-in profiles (idempotent, at migration/start).

## 4. Out of scope

Approvals and Access Requests tables (PERM025), audit tables (PERM020), use cases (PERM011/012).

## 5. Detailed requirements

1. Tables (STRICT): `perm_policies(id PK, scope CHECK IN (...), subject_id, profile_id, directories_mode CHECK IN ('unrestricted','list'), max_rights_json, capabilities_json, version INTEGER NOT NULL, updated_at, UNIQUE(scope, subject_id))` with `CHECK (scope <> 'workspace' OR directories_mode = 'list')` and `CHECK ((scope='owner') = (subject_id IS NULL))`; `perm_policy_directories(id PK, policy_id FK ON DELETE CASCADE, path_canonical, rights_json, is_primary, label, source, added_at, root_dev, root_ino, UNIQUE(policy_id, path_canonical))` plus a partial unique index allowing one primary per policy; `perm_profiles(id PK, name_ci UNIQUE COLLATE NOCASE, name, description, built_in, max_rights_json, capabilities_json, version, updated_at)`; `perm_approval_overrides(id PK, action_class, workspace_id NULL, created_at, local_confirmation_prefix, owner_rule_id, UNIQUE(action_class, COALESCE(workspace_id,'*')))`.
2. Repositories implement optimistic concurrency: `update(policy, expectedVersion)` fails with `perm.policy_conflict` when the stored version differs; all writes accept the ambient `UnitOfWork`.
3. `readLayers({workspaceId, agentId, workflowId?, toolId?})` returns all layers in one consistent read transaction (snapshot) so `CheckAccess` never mixes versions.
4. Validation on read: rows are parsed with the PERM001 zod schemas; a row that fails parsing makes the repository return `Err(perm.policy_unreadable)` (never a partial policy); a test inserts corrupted JSON.
5. Built-in profiles seeded idempotently by id; `built_in=1` rows cannot be updated or deleted by the repository (also guarded by a trigger).
6. Deleting a Workspace's policy is only via the cascade participant (PERM032).
7. Contract suites (Memory and SQLite): CRUD, version conflicts, unique name case-insensitivity, one primary, workspace policy cannot be `unrestricted`, snapshot consistency under concurrent writes, corrupted row handling, built-in immutability.
8. Index/perf: lookup by `(scope, subject_id)` indexed; `readLayers` under 3 ms for 64 directories.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PERM001 schemas for parsing, DATA SQLite core and migration runner, TEST003 repository contract helper.

## 8. Architecture and code placement

`packages/adapters/sqlite/src/perm/policies/*.ts` implements ports from `packages/application/src/ports/`; no domain logic in SQL beyond constraints. Migration naming per ARCH009.

## 9. Security and safety

DB constraints duplicate key invariants (no unrestricted Workspace policy, one primary) as defence in depth. Corrupt or unparseable rows fail closed. Paths are stored canonical only (writes go through PERM002). No secrets stored. Built-in profile immutability enforced twice.

## 10. Errors and edge cases

Concurrent edits: second gets conflict. Deleting a profile in use: guarded by the use case; FK not used across areas. Unicode paths stored NFC. Restoring a backup with older schema: migration runner handles.

## 11. Acceptance criteria

- [ ] Contract suites pass on both implementations.
- [ ] Corrupt JSON row yields `perm.policy_unreadable`.
- [ ] `readLayers` returns a consistent snapshot under concurrent writes.
- [ ] Built-in profile update/delete fails at repository and trigger level.
- [ ] Constraint tests: workspace+unrestricted and two primaries are rejected by SQLite itself.

## 12. Test plan

Contract suites, real-SQLite integration tests in temp dirs, corruption tests. `pnpm vitest run packages/adapters/sqlite/src/perm/policies`.

## 13. Parallelization notes

Parallel with PERM025. Migration timestamps must be unique per task id.

## 14. Open questions and assumptions

- ASSUMPTION: the Workspace policy lives only here (see PERM001 open question 1).
