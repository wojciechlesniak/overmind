---
id: OVE_SKILL010
title: Implement Skill usage recording and the Skill inspector queries
area: SKILL
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_AGENT003, OVE_AGENT008, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_PERM020, OVE_SKILL003, OVE_SKILL004]
soft_depends_on: ["OVE_AGENT003"]
provides: ["usecase:RecordSkillUsage", "usecase:GetSkillInspector", "usecase:ListSkillAssignments", "usecase:ListSkillsForAgent"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "port:SkillUsageRepository", "port:SkillReader", "port:AgentUsageReader", "usecase:ResolveAgentForRun"]
owns: ["packages/application/src/skill/usage/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 14"]
adr_refs: [12, 28, 23]
---

# OVE_SKILL010: Implement Skill usage recording and the Skill inspector queries

## 1. Summary

Records when a Skill was included in a Run's prompt or reported as used, and serves the Skills view inspector: instruction text, versions, assigned Agents and recent uses.

## 2. Context

The mock card says "3 agents - 41 uses" and the inspector lists recent uses. Usage is evidence for display only and never feeds permissions. Prompt-inclusion usage is recorded by Overmind when `ResolveAgentForRun` pins Skills; report-based usage is a declaration from an Agent report (AGENT014).

## 3. Scope (in)

- `RecordSkillUsage` (idempotent), queries for inspector and assignments, event `skill.used` (ephemeral).

## 4. Out of scope

- UI. Assignment mutations (AGENT004 owns config versions).

## 5. Detailed requirements

1. `RecordSkillUsage { skillId, version, agentId, workspaceId, runId?, discussionId?, conversationId?, source }`: validates that the Skill is visible in the Workspace and the Agent exists in it; for `prompt_inclusion` the caller is the engine (system actor); for `report` the caller is the report ingest with an Agent call context. Unknown Skill ids in a report are ignored (counted in a metric), never an error visible to the Agent.
2. Idempotent per SKILL003 rule; emits ephemeral `skill.used`.
3. `GetSkillInspector(skillId, workspaceId)` returns the accepted current text, version list, scan summary, assigned Agents (`SkillAssignmentView[]` through `AgentUsageReader`), 20 most recent uses and counts. Private Skills of other Workspaces are not found.
4. `ListSkillAssignments(skillId)` and `ListSkillsForAgent(agentId, version?)` expose the derived assignment view in both directions.
5. Instruction text in inspector responses is flagged `untrusted: false` for Owner/accepted text and `true` for pending imports; clients render as plain text only.
6. Counts use indexed aggregates; list limits <= 50.
7. Report-based usage never increases an Agent's permissions or changes any state.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Repositories from SKILL003, pagination helper.

## 8. Architecture and code placement

`packages/application/src/skill/usage/{record-skill-usage.ts,inspector.ts,assignments.ts}`.

## 9. Security and safety

Usage data contains ids and names. Report-sourced usage is a declaration; the Quality Gate and permissions ignore it. Scope checks prevent an Agent from recording usage in another Workspace.

## 10. Errors and edge cases

- Duplicate reports: idempotent.
- Skill archived after use: usage kept, inspector shows archived badge.
- Agent from a deleted Workspace: rejected.

## 11. Acceptance criteria

- [ ] Idempotent recording.
- [ ] Cross-Workspace usage rejected.
- [ ] Inspector aggregates match fixtures.
- [ ] Pending text flagged untrusted.

## 12. Test plan

Unit tests with fakes and the contract fixtures. Command: `pnpm vitest run packages/application/src/skill/usage`.

## 13. Parallelization notes

Parallel with SKILL008/009. AGENT008 and AGENT014 call `RecordSkillUsage`.

## 14. Open questions and assumptions

- ASSUMPTION: AGENT008 records `prompt_inclusion` once per Run start.
- OPEN: whether Discussion turns record usage per turn (assumed yes).
