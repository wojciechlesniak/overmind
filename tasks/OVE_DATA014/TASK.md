---
id: OVE_DATA014
title: OwnerRule repositories, SQLite schema and migration, in-memory fakes, contract tests
area: DATA
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA007, OVE_DATA008, OVE_DATA010, OVE_DATA013, OVE_TEST003]
soft_depends_on: []
provides: ["port:OwnerRuleRepository", "port:OwnerRuleProposalRepository", "table:owner_rules", "table:owner_rule_versions", "table:owner_rule_proposals", "lib:owner-rule-fake"]
needs: ["lib:repository-base", "port:UnitOfWork", "lib:contract-test-harness"]
owns: ["packages/application/src/ports/OwnerRuleRepository.ts", "packages/application/src/ports/OwnerRuleProposalRepository.ts", "packages/adapters/sqlite/src/owner-rule/**", "packages/adapters/sqlite/migrations/V202610130030__OVE_DATA014__create_owner_rules.sql", "packages/testing/src/fakes/InMemoryOwnerRuleRepository.ts", "packages/testing/src/fakes/InMemoryOwnerRuleProposalRepository.ts", "packages/testing/src/builders/owner-rule.builder.ts", "packages/testing/src/contracts/OwnerRuleRepository.contract.ts"]
reads: ["packages/contracts/src/owner-rule"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 14"]
adr_refs: [8, 16, 21]
---

# OVE_DATA014: OwnerRule persistence

## 1. Summary

Tables, repository ports, SQLite implementation, fakes and contract tests for Owner Rules, their version history and Chief's proposals.

## 2. Context

Rules are read on every Run start and injected into every prompt by CHIEF/SEC004 code, so reads must be fast and consistent; writes are rare and Owner-only. History is append-only so a weakened rule can be audited.

## 3. Scope (in)

- Migration with three tables, ports, SQLite repositories, fakes, builder, contract runners.
- Workspace cascade participant `owner-rules` (Workspace-scoped rules only; global rules survive).

## 4. Out of scope

- Use cases/routes: DATA015. Prompt assembly: CHIEF/SEC004.

## 5. Detailed requirements

1. `owner_rules(id PK, workspace_id TEXT NULL REFERENCES workspaces(id) ON DELETE RESTRICT, title, text, consent_overrides_json CHECK(json_valid), active INTEGER CHECK IN (0,1), version INTEGER, created_at, updated_at) STRICT`; index `(workspace_id, active)`. Header `-- workspace-scoped: yes` (global rows have NULL and are skipped by the cascade).
2. `owner_rule_versions(rule_id, version, title, text, consent_overrides_json, active, changed_at, PRIMARY KEY(rule_id, version))`, insert-only (BEFORE UPDATE/DELETE triggers abort; the cascade uses the same admin-flag pattern as `event_log`).
3. `owner_rule_proposals(id PK, workspace_id NULL REFERENCES workspaces(id), title, text, rationale, proposed_by_kind, proposed_by_id, target_rule_id NULL, status CHECK IN ('pending','accepted','rejected','withdrawn'), created_at, resolved_at, resolved_rule_id)`; index `(status, created_at)`. Pending proposals max 50 per Workspace (insert returns `data.integrity_violation` beyond; prevents proposal flooding by an Agent).
4. `OwnerRuleRepository`: `insert(tx, rule)` (writes version 1 row), `update(tx, id, expectedVersion, patch)` (writes the new version row, bumps `version`), `get(id)`, `listEffective(workspaceId)` (active global + active Workspace rules, ordered: global first, then by `created_at`, then id), `listAll(opts)`, `history(ruleId)`. `OwnerRuleProposalRepository`: `insert`, `get`, `listPending(workspaceId?)`, `resolve(tx, id, status, resolvedRuleId?)` (only from `pending`, else `data.conflict`).
5. `listEffective` is the hot path: single indexed query, result cached by the use case layer is NOT allowed (stale rules are a security risk); read each Run start.
6. Fakes enrol in `InMemoryUnitOfWork`; builder `anOwnerRule()`; contract suite instantiates `repositoryContract` (workspace isolation, optimistic concurrency, history append-only) plus effective ordering and proposal state machine tests.
7. Cascade participant `OwnerRulesCascadeParticipant` (id `owner-rules`, deletes Workspace-specific rules, versions and proposals) provided in `data-owner-rule.module.ts`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

DATA007 helpers, DATA002 `TxContext`, DATA012 participant port, TEST003 `repositoryContract`.

## 8. Architecture and code placement

Ports in application; adapter `packages/adapters/sqlite/src/owner-rule/`; module `apps/engine/src/composition/modules/data-owner-rule.module.ts` (owned by DATA015 together with the use cases to avoid two owners; this task only provides the participant file `cascade-participant.ts`).

## 9. Security and safety

History table is immutable; no repository method deletes rules (deactivate instead). Rule text never leaves via logs (logger rule: log ids and lengths only). Proposal flooding capped. Global rules apply to isolated Workspaces so isolation cannot be used to bypass a rule.

## 10. Errors and edge cases

- Edit with stale version: `data.version_conflict`.
- Deactivating the last rule: allowed.
- Resolve an already resolved proposal: `data.conflict`.
- Proposal targeting a deleted rule id: `data.not_found` on resolve.

## 11. Acceptance criteria

- [ ] Each edit adds a history row and bumps `version`; history cannot be modified.
- [ ] `listEffective` returns global then Workspace rules, inactive ones excluded.
- [ ] 51st pending proposal in a Workspace is rejected.
- [ ] Contract suite passes for SQLite and fake.
- [ ] Deleting a Workspace via the cascade removes its rules but not global rules.

## 12. Test plan

Contract runners, trigger tests, cascade test with two Workspaces. Commands: `pnpm vitest run packages/adapters/sqlite/src/owner-rule`.

## 13. Parallelization notes

Migration version `V202610130030` reserved. Parallel with ProjectDocRef and Artifact persistence.

## 14. Open questions and assumptions

- ASSUMPTION: pending proposal cap 50 per Workspace.
- ASSUMPTION: no caching of effective rules.
