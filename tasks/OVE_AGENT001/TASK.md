---
id: OVE_AGENT001
title: Define the Agent, AgentConfig and AgentState contracts with error codes
area: AGENT
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_PERM001, OVE_PROV002, OVE_VIS001]
soft_depends_on: [OVE_ARCH010]
provides: ["contract:Agent", "contract:AgentConfig", "contract:AgentState", "contract:AgentRef", "contract:AgentErrors"]
needs: ["contract:Visibility", "contract:PermissionProfileId", "contract:Connection"]
owns: ["packages/contracts/src/agent/**", "packages/contracts/src/errors/agent.errors.ts", "packages/contracts/src/events/agent.created.event.ts", "packages/contracts/src/events/agent.config_changed.event.ts", "packages/contracts/src/events/agent.archived.event.ts", "packages/contracts/src/events/agent.state.changed.event.ts"]
reads: ["packages/contracts/src/kernel/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 14", "SPECIFICATION 16.2", "SPECIFICATION 16.3"]
adr_refs: [7, 14, 28]
---

# OVE_AGENT001: Define the Agent, AgentConfig and AgentState contracts with error codes

## 1. Summary

Define once, in zod, everything the rest of the system says about an Agent: the stable identity, the versioned configuration (SPEC 4 definition fields), the evidence-based Agent State and the error and event catalogue. All later AGENT, SKILL, CHIEF, CHAT, WFRT and UI tasks import these types; nobody redefines them.

## 2. Context

SPEC 4 proposes the definition `id, name, role, instructions, providerId, modelId, skills[], tools[], permissionProfileId, budget, timeout, retryPolicy, lifecycle, visibility, ownerWorkspaceId?, createdBy, version`. ADR 0028 says changing visibility creates a new configuration version and that Runs use the pinned version (ADR 0002). ADR 0007: model per Agent. The Agents view mock (`Agenci.png`) shows: visibility selector, role and instructions, model, fallback model, "budget per Task: 45 min, 2 retries", assigned Skills, tools table, versions ("Save as v4"). Glossary: Persistent Agent, Dynamic Agent, Agent State.

## 3. Scope (in)

- zod schemas and inferred types for `Agent` (identity + current config + derived fields), `AgentConfig` (one immutable version body), `AgentVersionRecord`, `AgentSummary` (list row), `AgentState` and `AgentStateEvidence`.
- Input schemas: `CreateAgentInput`, `UpdateAgentConfigInput` (partial patch plus `expectedVersion`), `ArchiveAgentInput`.
- `agent.errors.ts` catalogue (ARCH003 format) and four event definitions (ARCH010).
- JSON Schema generation hooks per ARCH008 (no hand-written schema files).

## 4. Out of scope

- Validation rules that need other entities (Skill visibility, permission profile existence): `OVE_AGENT002`, `OVE_AGENT004`.
- Persistence: `OVE_AGENT003`. Gateway shapes: `OVE_AGENT005`. State derivation logic: `OVE_AGENT009`. AgentMessage contract: `OVE_AGENT011`.

## 5. Detailed requirements

1. `AgentId = EntityId<'agt'>` (ARCH007). Stable identity: `{ id, createdAt, createdBy: {kind:'owner'} | {kind:'chief', taskId?: EntityId<'tsk'>}, currentVersion: int>=1, archivedAt?: IsoDateTime }`.
2. `AgentConfig` (strict, immutable once stored; every field below is versioned):
   - `name` 1..60 chars, trimmed, no control characters; `role` 0..120; `instructions` 0..20000 (Owner-authored text; trusted for behaviour, never grants tools).
   - `providerId` and `modelId` (strings; `providerId` references a Connection, `modelId` a model that Connection offers); `fallbackModel?: { providerId, modelId }` (SPEC 9 fallback, mock "Model zapasowy").
   - `skills: Array<{ skillId: EntityId<'skl'>; pinnedVersion?: int }>` max 32, unique by `skillId`; no pin means "latest accepted version".
   - `tools: Array<{ toolId: string; enabled: boolean }>`: metadata about which Tools the Agent is meant to use; effective access is always the intersection computed by PERM (ADR 0003). `toolId` is lowercase `[a-z0-9_.-]{1,40}`.
   - `permissionProfileId: PermissionProfileId`.
   - `budget: { maxMinutesPerTask?: int 1..1440; maxCostUnits?: number>=0; maxIterations?: int 1..100 }`; `timeoutSeconds: int 10..86400` default 2700 (45 min as in the mock); `retryPolicy: { maxRetries: int 0..5; backoff: { initialMs, factor, maxMs }; retryNonIdempotent: false }` (`retryNonIdempotent` is the literal `false`, the schema rejects `true`, SPEC 12).
   - `lifecycle: 'persistent' | 'dynamic'`; `visibility: Visibility` (from VIS: `'public' | 'private'`); `ownerWorkspaceId?: EntityId<'ws'>` (required iff `visibility === 'private'`, forbidden otherwise; superRefine).
   - `dynamicStatus?: 'active' | 'proposed_for_keep' | 'declined'` (only for `lifecycle: 'dynamic'`, see `OVE_AGENT007`).
3. `AgentVersionRecord = { agentId, version, config: AgentConfig, createdAt, createdBy: Actor, changeNote?: string<=200, configHash: string }` where `configHash` is SHA-256 over canonical JSON (sorted keys) so equal configs can be detected.
4. `Agent = AgentIdentity & { config: AgentConfig }` (current version inlined) and `AgentSummary = { id, name, role, visibility, lifecycle, ownerWorkspaceId?, providerId, modelId, currentVersion, state?: AgentStateView }`.
5. `AgentState = 'working' | 'waiting_approval' | 'needs_login' | 'idle' | 'finished_unread'`. `AgentStateView = { agentId, workspaceId, state, reason?: 'approval' | 'access_request' | 'cli_choice_dialog' | 'login_expired' | 'unread_result' | 'no_session', evidence: AgentStateEvidence[] (1..5), since: IsoDateTime, taskId?, runId?, paused: boolean }` and `AgentStateEvidence = { source: 'herdr_hint' | 'screen_rule' | 'overmind_report' | 'run_event' | 'pending_request' | 'owner_action', ref?: string (id of event/request, never raw screen text), observedAt, summary: string<=160 }`. A state without evidence is not representable (`evidence.min(1)`).
6. Error codes (`agent.*`, retryable false unless stated): `not_found` (404), `name_taken` (409), `version_conflict` (409), `invalid_config` (422, details: issues with field paths only), `visibility_in_use` (409, details: workspaceIds count and first 5 ids), `private_requires_workspace` (422), `archived` (409), `skill_not_visible` (422), `profile_not_found` (422), `lifecycle_transition_invalid` (409), `not_dynamic` (409), `scope_violation` (403, audit true), `state_unknown` (500).
7. Events (ARCH010 `defineEvent`, all `persisted: true`, scope workspace except where noted): `agent.created`, `agent.config_changed` (payload `{ agentId, fromVersion, toVersion, changedFields: string[] }`, never the full instructions), `agent.archived`, and `agent.state.changed` (`persisted: false`, ephemeral hint; payload `AgentStateView`).
8. Every string field has a max length; `AgentConfig` rejects unknown keys (`.strict()`).

## 6. Design notes

N/A, functionality only. (Labels of the mock map to fields: "Widoczność" -> `visibility`, "Rola i instrukcje" -> `role` + `instructions`, "Model" -> `providerId/modelId`, "Model zapasowy" -> `fallbackModel`, "Budżet na zadanie" -> `timeoutSeconds` + `retryPolicy`.)

## 7. Reuse

`EntityId`, `Result`, `defineErrors`, `defineEvent`, `Actor` (ARCH003/007/010), `Visibility` (VIS). No local copies of any of them.

## 8. Architecture and code placement

`packages/contracts/src/agent/{agent.ts,agent-config.ts,agent-state.ts,inputs.ts,index.ts}` (barrel generated). Contracts depend only on zod and kernel. Pure data, no behaviour beyond refinements.

## 9. Security and safety

`retryNonIdempotent` cannot be true by schema (prevents duplicate side effects). `instructions` is Owner-authored but is still never interpolated into commands or policies. `tools` and `skills` are metadata and never widen permissions (ADR 0003, 0012). State evidence stores references, not screen text, so secrets on a terminal cannot leak through the state API. `details` of errors contain ids and counts only.

## 10. Errors and edge cases

- `visibility: 'private'` without `ownerWorkspaceId`: `agent.private_requires_workspace`. `public` with a workspace id: schema error.
- Duplicate skill ids in `skills`: schema error. More than 32 skills: schema error.
- `dynamicStatus` on a persistent Agent: schema error.
- Unknown `AgentState` received by a newer client: client falls back to `idle` styling (documented in the contract comment).
- `fallbackModel` equal to the primary model: allowed by the schema, warned by `OVE_AGENT002`.

## 11. Acceptance criteria

- [ ] `AgentConfig.parse` accepts the fixture "Developer" (mock values) and rejects every invalid case in section 10.
- [ ] `retryPolicy.retryNonIdempotent = true` fails parsing.
- [ ] An `AgentStateView` with empty `evidence` fails parsing.
- [ ] Error registry test passes with the `agent.*` codes and unique code names.
- [ ] Event files register with the ARCH010 registry and the naming test passes.
- [ ] Generated JSON Schema snapshot is committed and the additive-only check passes.

## 12. Test plan

`packages/contracts/src/agent/*.test.ts` (valid and invalid tables, canonical hash stability test: key order does not change `configHash`), `expectTypeOf` tests for inferred types, `errors/agent.errors.test.ts`. Command: `pnpm vitest run packages/contracts/src/agent`.

## 13. Parallelization notes

Merge this first in the AGENT area; AGENT002, 003, 009, 011 can then run in parallel. Conflict hotspot: none (one file per concern, generated barrels). Other areas read `AgentRef` only.

## 14. Open questions and assumptions

- ASSUMPTION: `fallbackModel` lives in `AgentConfig` (mock shows it per Agent) rather than only in global Settings; PROV decides when it is used (CHIEF018).
- ASSUMPTION: default `timeoutSeconds` 2700 and `maxRetries` 2 come from the mock ("45 min, 2 retries").
- ASSUMPTION: `skills[]` is stored inside the Agent version; `SkillAssignment` is a derived view (`OVE_SKILL007`), so there is one source of truth.
