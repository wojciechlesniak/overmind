---
id: OVE_SKILL001
title: Define the Skill, SkillVersion, usage and assignment contracts with errors and events
area: SKILL
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_VIS001]
soft_depends_on: [OVE_ARCH010]
provides: ["contract:Skill", "contract:SkillVersion", "contract:SkillUsage", "contract:SkillAssignment", "contract:SkillErrors", "contract:SkillScanFinding"]
needs: ["contract:Visibility", "contract:AgentRef"]
owns: ["packages/contracts/src/skill/**", "packages/contracts/src/errors/skill.errors.ts", "packages/contracts/src/events/skill.created.event.ts", "packages/contracts/src/events/skill.version_added.event.ts", "packages/contracts/src/events/skill.version_decided.event.ts", "packages/contracts/src/events/skill.used.event.ts", "packages/contracts/src/events/skill.assigned.event.ts"]
reads: ["packages/contracts/src/kernel/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [12, 3, 27, 28]
---

# OVE_SKILL001: Define the Skill, SkillVersion, usage and assignment contracts with errors and events

## 1. Summary

The shared description of a Skill: a versioned instruction with a source (Owner, Chief, import), a Visibility and `requiredTools` metadata that never grants access, plus usage records and the assignment view. All SKILL tasks, AGENT, CHIEF and SKUI import these types.

## 2. Context

SPEC 8: a Skill is a versioned instruction and grants no access to any Tool (ADR 0003, 0012); each Skill has a source (Owner, Chief, import), a version and a Visibility; Owner Skills are public by default, Chief proposals private; every use records name and version in the Discussion or Run history. SPEC 14: `Skill { id, version, source, instructions, requiredTools, visibility, ownerWorkspaceId? }`. Mock `Skille.png`: cards with name, version, visibility tab, source tag (Owner, Chief, import), agent stack and use count; inspector with preview, version list ("v4 - 2026-10-02 - added API contracts") and recent uses; "Edit as v5", "Detach from agents"; the system Skill "overmind v1" (public, source Owner).

## 3. Scope (in)

- Schemas: `Skill`, `SkillSummary`, `SkillVersion`, `SkillSource`, `SkillScanFinding`, `SkillUsage`, `SkillAssignmentView`, and inputs for create, new version, import, decide, assign.
- Error catalogue `skill.*`, five events.

## 4. Out of scope

- Persistence: SKILL003. Rules: SKILL002. Use cases and routes: later tasks. The "overmind" Skill content: SKILL011.

## 5. Detailed requirements

1. `Skill` identity: `{ id: EntityId<'skl'>, name: slug [a-z0-9][a-z0-9-]{0,39}, displayName?: string<=60, description: string<=200, source: 'owner'|'chief'|'import', visibility: Visibility, ownerWorkspaceId?: EntityId<'ws'> (required iff private), builtin: boolean, currentVersion: int>=1 (highest accepted version), latestVersion: int (including pending), createdAt, createdBy: {kind:'owner'}|{kind:'chief', turnId?}, archivedAt? }`. `builtin` marks "overmind"; builtin Skills cannot be edited, archived or made private through the API.
2. `SkillVersion`: `{ skillId, version: int>=1, instructions: string (Markdown, 1..20000 chars), requiredTools: string[] (max 20, ids `[a-z0-9_.-]{1,40}`; METADATA ONLY), status: 'accepted'|'pending_review'|'rejected', source: SkillSource, createdAt, createdBy, changeNote?: <=200, contentHash: sha256 hex, scan?: { scannedAt, scannerVersion, findings: SkillScanFinding[], severity: 'none'|'low'|'medium'|'high' } , decidedAt?, decidedBy?: 'owner' }`.
3. `SkillSource = { kind: 'owner' } | { kind: 'chief', proposalId?: string } | { kind: 'import', via: 'file'|'url'|'paste', origin?: string (host name only, never full URL with query/credentials), fetchedAt, sha256 }`.
4. `SkillScanFinding = { rule: string, severity: 'info'|'low'|'medium'|'high', line?: int, excerpt?: string<=120 (sanitised), message: string<=200 }` with the rule id enumeration defined in SKILL006.
5. `SkillUsage = { id: EntityId<'sku'>, skillId, skillName, skillVersion, agentId, runId?, discussionId?, conversationId?, workspaceId, usedAt, source: 'report' | 'prompt_inclusion' }`: `prompt_inclusion` means the Skill was included in the Agent prompt for that Run; `report` means the Agent reported using it (declaration).
6. `SkillAssignmentView = { skillId, agentId, agentVersion, assignedAt, pinnedVersion?: int, scopedToWorkspaceId?: ws (set when a private Skill is on a public Agent) }`; assignments are derived from Agent versions (OVE_AGENT001) and this contract is a read view.
7. Errors (`skill.*`): `not_found` 404, `name_taken` 409, `invalid_instructions` 422, `too_large` 413, `version_conflict` 409, `builtin_immutable` 403, `visibility_in_use` 409, `import_owner_only` 403 (audit), `import_fetch_failed` 502, `import_blocked_host` 403, `scan_blocking` 422, `not_pending_review` 409, `hash_mismatch` 500 (audit), `assignment_not_visible` 422, `private_requires_workspace` 422, `chief_cannot_fetch` 403 (audit).
8. Events (persisted): `skill.created`, `skill.version_added`, `skill.version_decided` (accepted/rejected), `skill.assigned` (assigned/unassigned, with agent id and version), `skill.used` (ephemeral, `persisted: false`; payload ids). Payloads carry ids, version, enums, never instruction text.
9. Input schemas: `CreateSkillInput { name, displayName?, description, instructions, requiredTools?, visibility?, ownerWorkspaceId? }`, `AddSkillVersionInput { skillId, expectedVersion, instructions, requiredTools?, changeNote? }`, `ImportSkillInput { via, file? | url? | paste?, suggestedName? }`, `DecideSkillVersionInput { skillId, version, decision: 'accept'|'reject', visibility?, note? }`, `AssignSkillInput { skillId, agentId, expectedAgentVersion, pinnedVersion? }`.

## 6. Design notes

N/A, functionality only. (Mock tags map to `source`: "Właściciel", "Chief", "import"; the PUBLICZNY/PRYWATNY words are `visibility`.)

## 7. Reuse

`EntityId`, `Result`, `defineErrors`, `defineEvent`; `Visibility` (VIS); `AgentRef` (AGENT001).

## 8. Architecture and code placement

`packages/contracts/src/skill/{skill.ts,skill-version.ts,usage.ts,assignment.ts,scan.ts,inputs.ts,index.ts}`, errors and events as listed. Pure schemas.

## 9. Security and safety

`requiredTools` is documented in the schema description as non-authoritative and a contract test asserts no field in any Skill schema can carry a permission. `import` provenance stores a host name only, so credentials in URLs are never persisted. Instructions are bounded and are untrusted text until accepted. Events carry no instruction text. `chief_cannot_fetch` exists to make the ADR 0012 rule testable.

## 10. Errors and edge cases

- Name with uppercase or spaces: rejected; display name carries presentation.
- `requiredTools` listing an unknown tool: allowed (metadata), flagged as a warning by SKILL004.
- `latestVersion > currentVersion` while a version is pending review: both shown by the inspector.
- Private Skill without `ownerWorkspaceId`: `private_requires_workspace`.

## 11. Acceptance criteria

- [ ] Fixtures for the nine mock Skills (including `overmind` builtin) parse.
- [ ] Permission-like field scan finds nothing in all Skill schemas.
- [ ] Instruction length 20001 fails; 20000 passes.
- [ ] Source `import` with a URL containing credentials stores only the host (builder test).
- [ ] Error and event registry tests pass; JSON Schema snapshots committed.

## 12. Test plan

Contract tests with valid/invalid tables; schema key scan; fixtures `packages/contracts/src/skill/__fixtures__/mock-skills.json`. Command: `pnpm vitest run packages/contracts/src/skill`.

## 13. Parallelization notes

First in SKILL; SKILL002/003 can follow in parallel; CHIEF014 and AGENT006/007 reference `SkillRef` through this contract. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Skill names are unique per visibility scope (public globally; private within a Workspace) and a private name may not shadow a public one.
- ASSUMPTION: instruction limit 20 000 characters (matches Agent instructions).
