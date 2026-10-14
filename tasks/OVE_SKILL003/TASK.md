---
id: OVE_SKILL003
title: Add SQLite tables and repositories for Skills, versions and usage with cascade
area: SKILL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA001, OVE_DATA002, OVE_DATA005, OVE_DATA012, OVE_SKILL001, OVE_SKILL002]
soft_depends_on: []
provides: ["port:SkillRepository", "port:SkillReader", "port:SkillVersionReader", "port:SkillUsageRepository", "table:skills", "table:skill_versions", "table:skill_usage", "participant:skills-cascade", "port:SkillCatalog"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "port:EventStore", "port:WorkspaceCascadeParticipant"]
owns: ["packages/application/src/ports/SkillRepository.ts", "packages/application/src/ports/SkillReader.ts", "packages/application/src/ports/SkillUsageRepository.ts", "packages/adapters/sqlite/src/skill/**", "packages/adapters/sqlite/migrations/V202610141500__OVE_SKILL003__skills.sql"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 10", "SPECIFICATION 14"]
adr_refs: [12, 28, 8]
---

# OVE_SKILL003: Add SQLite tables and repositories for Skills, versions and usage with cascade

## 1. Summary

Persistence for the Skill library: identity rows, append-only versions, usage records, scoped queries, and a Workspace cascade participant that deletes private Skills with their Workspace.

## 2. Context

Versions are immutable so a Run can verify the exact instruction text by hash (AGENT008). Usage appears in Discussion and Run history and in the inspector "recent uses" and card "3 agents - 41 uses". SPEC 10: deleting a Workspace deletes its private Agents, Skills and Workflows after local approval (`WorkspaceCascadeParticipant`, DATA012).

## 3. Scope (in)

- Ports (small, split by consumer): `SkillRepository` (writes, library queries), `SkillReader` (visibility and version lookups used by other areas), `SkillUsageRepository`.
- Tables, indexes, triggers, adapter, contract tests, cascade participant `skills-cascade`.

## 4. Out of scope

- Use cases: SKILL004-009. Scanner: SKILL006. Assignment storage (derived from Agents): AGENT003 `listBySkill`.

## 5. Detailed requirements

1. Tables: `skills(id PK, name, name_key, display_name, description, source_kind, visibility, owner_workspace_id NULL, builtin INTEGER, current_version INTEGER NOT NULL, latest_version INTEGER NOT NULL, created_at, created_by_json, archived_at NULL)`; `skill_versions(skill_id REFERENCES skills, version INTEGER, instructions TEXT, required_tools_json, status, source_json, change_note, content_hash, scan_json NULL, created_at, created_by_json, decided_at NULL, decided_by NULL, PRIMARY KEY(skill_id, version))`; `skill_usage(id PK, skill_id, skill_name, skill_version, agent_id, run_id NULL, discussion_id NULL, conversation_id NULL, workspace_id, used_at, source)`.
2. Indexes/constraints: unique partial index on `name_key` for public non-archived, unique `(owner_workspace_id, name_key)` for private non-archived; CHECK `(visibility='private') = (owner_workspace_id IS NOT NULL)`; indexes on `skill_usage(skill_id, used_at DESC)`, `(agent_id, used_at)`, `(run_id)`, `(workspace_id)`.
3. Triggers: `skill_versions` rows are immutable except `status`, `decided_at`, `decided_by`, `scan_json` and only in the `pending_review -> accepted|rejected` direction; instructions and hash can never change; `skill_usage` append-only.
4. Repository methods (Result-returning): `insertSkill(skill, v1)`, `appendVersion(skillId, expectedLatest, version)`, `decideVersion(skillId, version, decision, at)`, `getSkill(id)`, `getVersion(id, version)`, `getAcceptedVersion(id, pinned?)`, `listLibrary(workspaceId, filter: { visibility?, source?, query?, includeArchived? })` returning summaries with `agentCount` and `useCount` aggregates, `findByNameKey(scope)`, `setVisibility(skillId, expectedVersionMeta, ...)`, `archive`, `listVersions`, `listPending(workspaceId?)`.
5. `SkillReader` exposes only: `isVisibleIn(skillId, workspaceId)`, `getAcceptedVersion`, `getSummaries(ids)`; this is what AGENT004/008 consume (no write access).
6. `SkillUsageRepository`: `record(usage)`, `recentUses(skillId, limit, workspaceId?)`, `countsBySkill(workspaceId)`, `usageForRun(runId)`, `usageForDiscussion(id)`; recording is idempotent by `(skill_id, skill_version, run_id, agent_id, source)` within a Run to avoid duplicate chips.
7. Library queries are scoped: public Skills plus private ones of the given Workspace; a query without `workspaceId` is impossible (type-level).
8. Cascade participant `skills-cascade` (id `skills`): in the delete transaction removes private Skills of the Workspace (versions included) and all `skill_usage` rows with that `workspace_id`; reports counts for the delete preview. A private Skill only works in its own Workspace, so it never blocks the delete; stale references in Agent configs are skipped lazily at resolution (AGENT008). The participant also publishes `skill.removed_for_workspace` so AGENT can drop stale references in a later version (ASSUMPTION).
9. FTS is not required; `query` uses escaped `LIKE` on name, display name and description.
10. JSON columns validated on read; corrupt rows return `data.corrupt_row` and are skipped.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

DATA core, `UnitOfWork`, pagination; `WorkspaceCascadeParticipant` (DATA012); contract schemas.

## 8. Architecture and code placement

Ports in `packages/application/src/ports/`; adapter `packages/adapters/sqlite/src/skill/{sqlite-skill-repository.ts,sqlite-skill-usage-repository.ts,cascade.ts,mappers.ts}`; one migration.

## 9. Security and safety

Immutability triggers protect the text a Run verified by hash. Scoped queries prevent private Skill leakage. Usage rows contain ids and names only. Deleting a Workspace removes private Skills with local approval flow owned by DATA012.

## 10. Errors and edge cases

- Concurrent version appends: optimistic `expectedLatest`, loser gets `skill.version_conflict`.
- Archive of a Skill assigned to Agents: allowed; resolution skips archived Skills.
- Duplicate usage report: idempotent.
- Huge usage table: indexes and retention not needed in MVP (documented), aggregates bounded by index.

## 11. Acceptance criteria

- [ ] Migration applies; constraints reject invalid visibility/workspace combinations.
- [ ] Triggers block editing instructions or hash of an existing version.
- [ ] Library query for Workspace A never returns private Skills of B.
- [ ] Counts (agents, uses) match fixtures.
- [ ] Idempotent usage recording within a Run.
- [ ] Cascade removes private Skills and usage of the deleted Workspace and reports counts.
- [ ] Repository contract suite passes.

## 12. Test plan

Contract suite on SQLite with real migrations; trigger tests via raw SQL; cascade test with the DATA012 harness. Command: `pnpm vitest run packages/adapters/sqlite/src/skill`.

## 13. Parallelization notes

Parallel with SKILL002. Blocks SKILL004-009. Hotspot: migrations folder only.

## 14. Open questions and assumptions

- ASSUMPTION: usage retention is unlimited in MVP; a later task may add pruning.
- ASSUMPTION: stale Skill references in Agent configs are tolerated and skipped at resolution.
