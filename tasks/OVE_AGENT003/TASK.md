---
id: OVE_AGENT003
title: Add SQLite tables and repository for Agents and their configuration versions
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_AGENT002, OVE_DATA001, OVE_DATA002, OVE_DATA005]
soft_depends_on: []
provides: ["port:AgentRepository", "table:agents", "table:agent_versions", "lib:sqlite-agent-repo", "port:AgentUsageReader"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "port:EventStore"]
owns: ["packages/application/src/ports/AgentRepository.ts", "packages/adapters/sqlite/src/agent/**", "packages/adapters/sqlite/migrations/V202610140900__OVE_AGENT003__agents.sql", "packages/application/src/ports/AgentUsageReader.ts"]
reads: ["packages/contracts/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14", "SPECIFICATION 12"]
adr_refs: [2, 8, 28]
---

# OVE_AGENT003: Add SQLite tables and repository for Agents and their configuration versions

## 1. Summary

Persist Agents as a stable identity row plus an append-only list of immutable configuration versions, behind the `AgentRepository` port. Versions are never updated or deleted, so a Run can always load exactly the configuration it pinned.

## 2. Context

ADR 0002 and 0028: runs use the pinned version; visibility change creates a new version. SPEC 14 lists Agent with `configVersion`. The DATA area owns SQLite infrastructure (`lib:sqlite-core`, migrations runner, unit of work); this task adds only the Agent tables and repository (PLAN section 6 ownership).

## 3. Scope (in)

- Port `AgentRepository` (interface only in application) and the SQLite adapter.
- Migration with two tables, indexes and CHECK constraints.
- Contract tests (TEST003 pattern) and an in-memory fake in `packages/testing` is NOT written here (TEST002 owns fakes; this task adds a minimal `InMemoryAgentRepository` under `packages/testing/src/agent/` only if TEST002 has not; see section 13).

## 4. Out of scope

- Use cases: `OVE_AGENT004`. Skill-usage queries: `OVE_SKILL003`. Agent State storage: `OVE_AGENT010`. AgentMessage tables: `OVE_AGENT011`.

## 5. Detailed requirements

1. Port (all methods return `Promise<Result<T, AppError>>`):
   ```ts
   interface AgentRepository {
     insert(identity: AgentIdentity, v1: AgentVersionRecord): Promise<Result<void>>;         // one transaction
     appendVersion(agentId, expectedVersion: number, record: AgentVersionRecord): Promise<Result<void>>; // optimistic lock
     getById(id, opts?: { version?: number }): Promise<Result<Agent>>;                       // default current version
     getVersion(id, version): Promise<Result<AgentVersionRecord>>;
     listVersions(id, page: PageRequest): Promise<Result<Page<AgentVersionRecord>>>;
     listVisible(workspaceId, filter: { lifecycle?; includeArchived?; query? }): Promise<Result<AgentSummary[]>>;
     findByNormalisedName(scope: {visibility; workspaceId?}, key: string): Promise<Result<AgentId | null>>;
     listBySkill(skillId, workspaceId?): Promise<Result<AgentRef[]>>;    // for assignments and visibility-in-use checks
     markArchived(id, at, expectedVersion): Promise<Result<void>>;
   }
   ```
2. Tables:
   - `agents(id TEXT PK, created_at TEXT NOT NULL, created_by_json TEXT NOT NULL, current_version INTEGER NOT NULL, archived_at TEXT NULL, visibility TEXT NOT NULL CHECK(visibility IN ('public','private')), owner_workspace_id TEXT NULL, lifecycle TEXT NOT NULL, name_key TEXT NOT NULL)` (visibility, owner workspace, lifecycle and `name_key` are denormalised copies of the current version, updated in the same transaction as `appendVersion`, for indexed filtering).
   - `agent_versions(agent_id TEXT NOT NULL REFERENCES agents(id), version INTEGER NOT NULL, config_json TEXT NOT NULL, config_hash TEXT NOT NULL, created_at TEXT NOT NULL, created_by_json TEXT NOT NULL, change_note TEXT NULL, PRIMARY KEY(agent_id, version))`.
   - `agent_skill_refs(agent_id, version, skill_id, pinned_version NULL, PRIMARY KEY(agent_id, version, skill_id))` written with each version so `listBySkill` is an indexed query; only the current version counts.
   - Unique partial indexes: `UNIQUE(name_key) WHERE visibility='public' AND archived_at IS NULL` and `UNIQUE(owner_workspace_id, name_key) WHERE visibility='private' AND archived_at IS NULL`.
   - CHECK: `(visibility='private') = (owner_workspace_id IS NOT NULL)`.
3. Triggers: `BEFORE UPDATE` and `BEFORE DELETE` on `agent_versions` raise an error (append-only). `agents` rows are never deleted by this port; a deleted Workspace cascades through the WSPACE/DATA delete use case which calls `deletePrivateForWorkspace(workspaceId)` (add to the port; it archives, then removes versions in one transaction after the Owner's local approval, SPEC 10).
4. `appendVersion` uses `UPDATE agents SET current_version = ?+1 WHERE id = ? AND current_version = ?` and fails with `agent.version_conflict` when zero rows change; insertion of the version row and skill refs happen in the same transaction (`UnitOfWork`).
5. JSON columns are validated with the contract schema on read; a row failing validation returns `data.corrupt_row` (DATA code) and is logged without the JSON content.
6. `listVisible(workspaceId)` returns public Agents plus private Agents whose `owner_workspace_id = workspaceId`; it never returns another Workspace's private Agents (VIS defence in depth, tested).
7. Prepared statements only; no string-built SQL; `query` filter uses `LIKE` with escaped wildcards on `name_key` and role.
8. Event rows (`agent.created`, `agent.config_changed`) are written by the use case through `EventStore` in the same transaction; the repository does not publish.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`UnitOfWork`, migration runner and `PageRequest/Page` from DATA; `Result`; contract schemas from `OVE_AGENT001`.

## 8. Architecture and code placement

Port in `packages/application/src/ports/AgentRepository.ts` (with token). Adapter in `packages/adapters/sqlite/src/agent/sqlite-agent-repository.ts`, mappers in `mappers.ts`. Adapter imports only `application` ports and `contracts`; no other adapter. Migration file follows `V<ts>__<TASKID>__<name>.sql`; never edit once merged.

## 9. Security and safety

Append-only triggers protect pinned configuration from tampering after the fact (a Run must be reproducible, SPEC 15). Cross-Workspace leakage is a core risk: `listVisible` is the only list query and it takes a mandatory `workspaceId`. Instructions are stored as plain text in the local DB (Owner-authored, not secrets); logs never print `config_json`.

## 10. Errors and edge cases

- Two concurrent edits: second gets `agent.version_conflict` and re-reads.
- Insert with a name that exists in the same scope: `agent.name_taken` (mapped from the unique index violation).
- Archived Agent: excluded by default, readable by id with `includeArchived`.
- Database locked (WAL busy): bounded retry by DATA core, otherwise `data.busy`.
- Corrupt JSON row: `data.corrupt_row`, listing skips that row and reports a diagnostics counter.

## 11. Acceptance criteria

- [ ] Migration applies on an empty DB and on a DB with data from the previous migration (up-only).
- [ ] UPDATE or DELETE on `agent_versions` fails (trigger test).
- [ ] Concurrent `appendVersion` calls: exactly one succeeds.
- [ ] Unique name indexes behave as specified for public and private scopes.
- [ ] `listVisible('ws_A')` never includes private Agents of `ws_B`.
- [ ] `listBySkill` returns only Agents whose current version references the Skill.
- [ ] Repository contract suite passes for the SQLite adapter.

## 12. Test plan

Contract suite `AgentRepository.contract.ts` run against SQLite (in-memory DB with real migrations); trigger tests with raw SQL; concurrency test with two connections. Command: `pnpm vitest run packages/adapters/sqlite/src/agent`.

## 13. Parallelization notes

Can run concurrently with AGENT002, AGENT009 and AGENT011. Conflict hotspot: the migrations folder (unique file name per task, no edits to others). If TEST002 already provides `InMemoryAgentRepository`, do not add one.

## 14. Open questions and assumptions

- ASSUMPTION: denormalising visibility, lifecycle and name key into `agents` is acceptable (written in one transaction, covered by a consistency test) to keep list queries index-only.
- ASSUMPTION: ULIDs are used for ids so `ORDER BY id` is chronological.
