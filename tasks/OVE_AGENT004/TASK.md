---
id: OVE_AGENT004
title: Implement the create, update, archive and read Agent use cases
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_AGENT002, OVE_AGENT003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DATA005, OVE_DATA010, OVE_PERM011, OVE_PERM020, OVE_SKILL003]
soft_depends_on: []
provides: ["usecase:CreateAgent", "usecase:UpdateAgentConfig", "usecase:ArchiveAgent", "usecase:GetAgent", "usecase:ListAgents", "usecase:ListAgentVersions", "event:agent.deleted"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:EventStore", "port:UnitOfWork", "port:SkillReader", "port:PermissionProfileReader", "port:WorkspaceRepository", "usecase:AppendAudit"]
owns: ["packages/application/src/agent/create-agent.usecase.ts", "packages/application/src/agent/update-agent-config.usecase.ts", "packages/application/src/agent/archive-agent.usecase.ts", "packages/application/src/agent/read-agents.usecase.ts", "packages/application/src/agent/refs-loader.ts"]
reads: ["packages/domain/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 16.2"]
adr_refs: [2, 7, 28]
---

# OVE_AGENT004: Implement the create, update, archive and read Agent use cases

## 1. Summary

The application layer for Agent CRUD. Every configuration change appends a new immutable version; the use cases load the facts the pure rules need (Skills, profiles, Workspace), call the domain, persist atomically and emit events and audit entries.

## 2. Context

The Owner creates Agents (and at least three with different models, SPEC 16.2). Chief only creates Dynamic Agents through `OVE_AGENT007`, never through `CreateAgent`. UI: Agents view "Nowy" and "Zapisz jako v4". Caller context (`Actor`) tells whether the call comes from the Owner (desktop or Telegram) or from Chief; this task only accepts the Owner for persistent Agents.

## 3. Scope (in)

- `CreateAgent`, `UpdateAgentConfig`, `ArchiveAgent`, `GetAgent`, `ListAgents`, `ListAgentVersions`.
- `refs-loader.ts`: collects `refs` for `validateAgentConfig` from ports.
- Events `agent.created`, `agent.config_changed`, `agent.archived`; audit entries for create, config change and archive.

## 4. Out of scope

- Visibility change specifics: `OVE_AGENT006`. Dynamic Agents: `OVE_AGENT007`. Routes: `OVE_AGENT005`. Skill assignment semantics: `OVE_SKILL007` (it calls `UpdateAgentConfig`).

## 5. Detailed requirements

1. Signature style: `execute(input, caller: Caller): Promise<Result<Agent>>` where `Caller = { actor: Actor; channel: 'desktop' | 'telegram' | 'engine' }`.
2. `CreateAgent`: caller MUST be `owner` on channel `desktop` or `telegram`... with one restriction: creating a PUBLIC or any persistent Agent from Telegram is rejected with `perm.local_only` (permission-like configuration is desktop-only, ADR 0006 spirit). Telegram may not create Agents at all in MVP (ASSUMPTION). Defaults: Owner-created Agent is `persistent` and `public` (ADR 0028) unless the Workspace is isolated (forced private to that Workspace). Steps: load refs, `validateAgentConfig`, uniqueness check via `findByNormalisedName`, `repository.insert` + `EventStore.append(agent.created)` in one `UnitOfWork`, publish after commit, audit.
3. `UpdateAgentConfig(input: { agentId; expectedVersion; patch; changeNote? })`: loads current, `nextVersion`; if `noop` returns the current Agent unchanged (no event). Otherwise `appendVersion` with `expectedVersion`; maps conflicts to `agent.version_conflict` with the current version in `details`. Changing `visibility` through this use case is rejected (`agent.invalid_config`, hint key `use ChangeAgentVisibility`) so that the in-use check lives in one place (`OVE_AGENT006`). Changing `lifecycle` is rejected likewise (`OVE_AGENT007`).
4. Editing an Agent that is currently running affects only future Runs (Runs pin versions, ADR 0002); the response includes `affectsRunningRuns: number` (count from `RunReader` if available, otherwise omitted) so the UI can say "applies to new Runs".
5. `ArchiveAgent`: Owner only; refuses (`agent.archived` already, or `agent.in_use`-like `agent.visibility_in_use` reused is wrong) when a Workflow Version still references the Agent: returns `agent.in_use` (add to the catalogue by proposal to AGENT001 if missing: `agent.in_use`, 409). Archive is soft: configuration versions stay for replay (SPEC 15).
6. `ListAgents(workspaceId, filter)` returns `AgentSummary[]` including the cached `AgentStateView` from `OVE_AGENT010` when available; `GetAgent` accepts optional `version`; `ListAgentVersions` paginates with changed fields per version (computed with `diffConfig`).
7. Every write uses `Clock` and `IdGenerator` from ports; no ambient time.
8. All writes emit an audit entry `agent.config.changed` with `{ agentId, fromVersion, toVersion, changedFields }` (field names only, never instruction text).
9. Skills in the patch MUST pass `SkillReader.isVisibleIn(skillId, scope)`; otherwise `agent.skill_not_visible`. The Skill `requiredTools` metadata is shown to the caller as `warnings[]` (a Skill needing a tool that is not enabled) and never enables the tool.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Domain rules (`OVE_AGENT002`), repository (`OVE_AGENT003`), `Result`, event publisher and store, `AppendAudit` (PERM). `PageRequest` from DATA.

## 8. Architecture and code placement

`packages/application/src/agent/*.usecase.ts`, one class per file with `deps` object. Depends only on ports and domain. Wired in `apps/engine/src/composition/modules/agent.module.ts` (this task adds that module file, owned by AGENT; the file is a per-area module per ARCH006).

## 9. Security and safety

Only the Owner can create or change persistent Agents; Chief and agent-originated calls are rejected with `perm.owner_required` (audit true). The patch cannot contain `permissionProfileId` values the Owner has not defined. Instructions text never leaves the engine except to the Agent's own CLI session. Audit entries hold field names only.

## 10. Errors and edge cases

- Stale `expectedVersion`: conflict error with `currentVersion`.
- Workspace deleted between load and write: transaction fails, `data.not_found`.
- Name collision race: unique-index error mapped to `agent.name_taken`.
- Patch with unknown field: `agent.invalid_config` listing the field path.
- Archive of an already archived Agent: idempotent success.

## 11. Acceptance criteria

- [ ] Create three Agents with three different `providerId/modelId` pairs in one Workspace (SPEC 16.2 setup).
- [ ] Update with an unchanged patch creates no version and no event.
- [ ] Update creates version n+1; the old version stays readable unchanged.
- [ ] Update with stale `expectedVersion` returns `agent.version_conflict`.
- [ ] Visibility and lifecycle changes through `UpdateAgentConfig` are rejected.
- [ ] Non-Owner callers are rejected and audited.
- [ ] Events and audit entries are produced in the same transaction as the write.

## 12. Test plan

Unit tests with fakes (in-memory repository, fake clock/ids, spy publisher). Integration test with SQLite adapter for transactional atomicity (event row and version row commit together, kill between = neither). Commands: `pnpm vitest run packages/application/src/agent`.

## 13. Parallelization notes

After AGENT003. AGENT005 (routes) and AGENT006/007/008 build on it. Hotspot: `agent.module.ts` is owned here; later AGENT tasks add their use cases to it via a proposal-free append pattern: each later task adds its own `agent-<topic>.module.ts` file instead.

## 14. Open questions and assumptions

- ASSUMPTION: Agents cannot be created from Telegram in MVP.
- ASSUMPTION: a new error code `agent.in_use` is added to the catalogue by the AGENT001 owner during review (listed in the report).
