---
id: OVE_AGENT008
title: Resolve the pinned Agent configuration for a Run
area: AGENT
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_PERM011, OVE_PROV025, OVE_SKILL003]
soft_depends_on: []
provides: ["usecase:ResolveAgentForRun", "contract:ResolvedAgent"]
needs: ["port:SkillVersionReader", "port:PermissionProfileReader", "usecase:ResolveModelForAgent"]
owns: ["packages/application/src/agent/resolve-agent-for-run.usecase.ts", "packages/contracts/src/agent/resolved-agent.ts"]
reads: ["packages/application/src/ports/AgentRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 15"]
adr_refs: [2, 7, 28, 12]
---

# OVE_AGENT008: Resolve the pinned Agent configuration for a Run

## 1. Summary

At Run start the workflow runtime asks for a `ResolvedAgent`: the exact Agent version, the exact Skill versions, the model and the permission profile reference, frozen and hashed so the Run can be replayed and audited. Later edits never change a running Run.

## 2. Context

SPEC 15: "Odtwarzalność Runu: wersja grafu, Agenta, Skilla i modelu." ADR 0002 pins workflow versions; ADR 0028 extends pinning to Agent configuration. ADR 0007: a Node may override model, prompt and Skills but not permissions. Skill usage with versions must appear in history (SPEC 8, criterion 3).

## 3. Scope (in)

- `ResolveAgentForRun(input: { agentId; workspaceId; version?: number; nodeOverrides?: { modelId?; providerId?; extraInstructions?; skillIds? } })` returning `ResolvedAgent`.
- `ResolvedAgent` contract: `{ agentId, agentVersion, configHash, name, role, instructions, model: { providerId, modelId, fallback? }, skills: Array<{ skillId, skillVersion, name, contentHash }>, toolIds, permissionProfileId, budget, timeoutSeconds, retryPolicy, resolvedAt, visibleInWorkspaceId }`.

## 4. Out of scope

- Assembling the actual prompt: `OVE_SEC004` assembler is used by the caller. Choosing the fallback at runtime: `OVE_CHIEF018`. Effective permission computation: PERM.

## 5. Detailed requirements

1. Without `version`, the current version is read once and recorded in the result; with `version` (resume of an old Run) that exact version is loaded even if archived.
2. Visibility check: the Agent MUST be visible in `workspaceId` (public, or private with that owner Workspace); otherwise `agent.scope_violation` (audit). Every Skill MUST be visible in the same scope; Skills that are not visible are dropped from the result and listed in `skippedSkills[]` with a reason (not an error, so a Run does not die because a private Skill of another Workspace was attached to a public Agent, ADR 0028).
3. Each Skill is resolved to its accepted version: the pinned version if given, else the highest `accepted` SkillVersion at resolution time; `contentHash` is stored so replay can detect a tampered Skill body.
4. `nodeOverrides` may change `modelId/providerId`, add `extraInstructions` (Owner-authored workflow text) and select a subset of the Agent's Skills; they MUST NOT introduce Skills the Agent does not have and MUST NOT carry any permission field (strict schema; a permission-like key is rejected, ADR 0007).
5. Model: `ResolveModelForAgent` (PROV) validates that the Connection exists and offers the model; if the provider is currently unhealthy the result still returns the configured model and sets `model.degraded = true` so the runtime may apply the fallback.
6. The result is immutable and serialisable; the runtime stores it in the Run record (`checkpointRef` or run snapshot, WFRT).
7. `configHash` of the resolved bundle = SHA-256 over canonical JSON of the whole `ResolvedAgent` minus `resolvedAt`.
8. Resolution is pure with respect to storage (read-only) and deterministic for a given storage state.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AgentRepository.getById/getVersion`, `SkillVersionReader` (SKILL003), `ResolveModelForAgent` (PROV), canonical hashing helper from `OVE_AGENT001`.

## 8. Architecture and code placement

`packages/application/src/agent/resolve-agent-for-run.usecase.ts`; contract in `packages/contracts/src/agent/resolved-agent.ts`. Read-only ports; no events emitted (the runtime records the event `run.agent.pinned`, WFRT).

## 9. Security and safety

Pinning prevents a later edit (or a malicious Skill update) from changing behaviour inside a running Run. Skill bodies are not embedded in the Run record, only ids, versions and hashes (bodies are fetched again by id and version and verified against the hash; mismatch fails closed with `skill.hash_mismatch`). Cross-Workspace visibility is enforced here as the last gate before any prompt is built.

## 10. Errors and edge cases

- Agent archived and no explicit version: `agent.archived`.
- All Skills invisible: result with empty skills and a populated `skippedSkills`.
- Version not found: `agent.not_found`.
- Override model not offered by the provider: `agent.invalid_config`.
- Provider connection deleted: `prov.connection_not_found` surfaced as is.

## 11. Acceptance criteria

- [ ] Editing the Agent after resolution does not alter an already resolved bundle (test with two versions).
- [ ] Resolving with an explicit older version returns that version's config.
- [ ] A private Skill from another Workspace is skipped and reported, not fatal.
- [ ] A permission-like key in `nodeOverrides` is rejected.
- [ ] A Skill body changed after hashing makes verification fail with `skill.hash_mismatch`.
- [ ] Two identical resolutions produce the same `configHash`.

## 12. Test plan

Unit tests with in-memory ports; hash stability test; negative tests for overrides. Command: `pnpm vitest run packages/application/src/agent/resolve-agent`.

## 13. Parallelization notes

Needed by WFRT's Agent node and CHIEF delegation; publish the contract file early. Independent of AGENT005-007.

## 14. Open questions and assumptions

- ASSUMPTION: highest accepted Skill version is used when not pinned ("latest" semantics of the mock "aktualna").
