---
id: OVE_SKILL005
title: Implement Skill visibility change with in-use checks
area: SKILL
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_AGENT003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_PERM020, OVE_SKILL003, OVE_SKILL004, OVE_VIS002]
soft_depends_on: ["OVE_AGENT003"]
provides: ["usecase:ChangeSkillVisibility"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "port:SkillRepository", "port:AgentUsageReader", "lib:visibility-rules"]
owns: ["packages/application/src/skill/visibility/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 13"]
adr_refs: [28, 12, 3]
---

# OVE_SKILL005: Implement Skill visibility change with in-use checks

## 1. Summary

The Owner makes a Skill public or private. Narrowing (public to private) is refused while Agents in other Workspaces use it; widening is allowed with Owner confirmation and a scan re-check.

## 2. Context

ADR 0028: visibility is public or private and changing it is Owner-only. A private Skill belongs to exactly one Workspace; a public Agent in another Workspace must not hold a reference to it.

## 3. Scope (in)

- Use case, in-use query through a read port, events, audit.
- Interaction with Chief proposals: a Chief-written Skill is private; making it public is a separate Owner action.

## 4. Out of scope

- Agent visibility change: AGENT006. Bulk operations.

## 5. Detailed requirements

1. `ChangeSkillVisibility { skillId, to, ownerWorkspaceId?, expectedVersionMeta }` Owner-only (never callable by Chief or Agent tokens; guarded by actor type in the use case and by route auth).
2. private to public: allowed; requires explicit `confirmPublic: true` in input so a UI misclick cannot publish; re-runs the scanner on the current accepted version.
3. public to private: requires `ownerWorkspaceId`; refused with `skill.visibility_in_use` and the list of blocking Agents (ids, names, workspaces) when any Agent outside that Workspace has the Skill assigned (via `AgentUsageReader` over AGENT003 `listBySkill`).
4. Atomic update through `SkillRepository.setVisibility` with optimistic metadata check; event `skill.visibility_changed` is added to SKILL001 (cross-task item) or reuses `skill.version_decided` payload (ASSUMPTION: new event).
5. No other field changes; the instruction text and versions are untouched.
6. Audit `{skillId, from, to, workspaceId}`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`lib:visibility-rules` and the AGENT006 pattern.

## 8. Architecture and code placement

`packages/application/src/skill/visibility/change-skill-visibility.ts`; port `AgentUsageReader` (file and adapter owned by AGENT003) answers "which Agents use this Skill".

## 9. Security and safety

Visibility is a permission-like decision and Owner-only (ADR 0015). The use case rejects any non-Owner actor even if the caller is internal. Narrowing never leaves a dangling cross-Workspace reference, preventing private text from reaching another Workspace's prompts.

## 10. Errors and edge cases

- Concurrent change: `skill.version_conflict`.
- Builtin Skill: always public, refuse with `skill.builtin_immutable`.
- Archived Skill: allowed but flagged.
- Missing target Workspace: `workspace.not_found`.

## 11. Acceptance criteria

- [ ] Non-Owner actors refused.
- [ ] Narrowing with outside users returns the blocking list.
- [ ] Widening requires `confirmPublic`.
- [ ] Event and audit written once.

## 12. Test plan

Unit tests with fakes. Command: `pnpm vitest run packages/application/src/skill/visibility`.

## 13. Parallelization notes

Parallel with SKILL006/007. No hotspots.

## 14. Open questions and assumptions

- ASSUMPTION: new event `skill.visibility_changed` (add to SKILL001).
- OPEN: should widening also be Owner-confirmed in the UI by typing? Left to SKUI.
