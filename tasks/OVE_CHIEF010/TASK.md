---
id: OVE_CHIEF010
title: Implement agent selection and Dynamic Agent design for a Task
area: CHIEF
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_AGENT007, OVE_CHIEF003, OVE_CHIEF006, OVE_CHIEF015, OVE_SKILL003, OVE_VIS002]
soft_depends_on: [OVE_CHIEF009]
provides: ["usecase:SelectAgentsForTask", "handler:chief.create_dynamic_agent"]
needs: ["usecase:ListAgents", "usecase:CreateDynamicAgent", "lib:visibility-rules", "port:SkillReader", "usecase:RaiseEscalation"]
owns: ["packages/application/src/chief/select-agents/**"]
reads: ["packages/domain/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 8", "SPECIFICATION 16.3"]
adr_refs: [28, 14, 3, 12]
---

# OVE_CHIEF010: Implement agent selection and Dynamic Agent design for a Task

## 1. Summary

Choose who does a Task: existing Persistent Agents visible in the Workspace first, then a Dynamic Agent designed by Chief when none fits. The Dynamic Agent is private, narrowly permissioned and proposed to the Owner afterwards.

## 2. Context

ADR 0028: Chief does not suggest private elements of other Workspaces; Dynamic Agents are private by default. SPEC 4: Dynamic Agents are created by Chief for a Task. AGENT007 implements creation and the promotion flow; this task is the Chief side: ranking candidates and building a safe design for the new Agent.

## 3. Scope (in)

- `SelectAgentsForTask({ taskId, requirements })` returning ranked candidates and a recommendation `use_existing | create_dynamic | escalate`.
- The `create_dynamic_agent` handler mapping the typed action to `CreateDynamicAgent` with safe defaults.
- Deterministic ranking (role keywords, Skills match, current Agent State, load, past success summary from Memory summaries).

## 4. Out of scope

- Creating, promoting, deleting Dynamic Agents: AGENT007. Delegation: CHIEF009. Permission profiles: PERM.

## 5. Detailed requirements

1. Candidate set = Agents visible in the Task's Workspace (public plus private to it), active, not archived, with an available provider connection. Agents of other Workspaces' private scope never appear (VIS).
2. Ranking (pure function): Skill overlap with `requirements.skills`, role match from a closed tag list in `requirements.roleTags`, idle before working, fewer open assigned Tasks, higher count of completed similar Tasks (from Board counts, not from model text). Ties break by name. The ranking explanation is a list of structured reasons for audit.
3. If the best candidate scores below the threshold (default 0.4) or the Task needs a role absent from the Workspace, the recommendation is `create_dynamic`.
4. Dynamic Agent design rules: `name` unique and prefixed by role; `instructions` composed from an Overmind template plus the Task description as quoted data (the instruction text from the model is accepted only after sanitising and a length cap of 4000, and is treated as untrusted guidance that cannot grant tools); `skills` limited to Skills visible in the Workspace; `tools` start empty and only tools already enabled for Chief's assignable profile may be listed; `permissionProfileId` = the Workspace's narrowest assignable profile (AGENT007 validates); budget and timeout default to Workspace defaults.
5. Creation goes through `evaluateAutonomy('agent_selection')`: within budget and the dynamic-agent cap (AGENT007) -> `decide_alone`; otherwise escalate.
6. A Skill that a Dynamic Agent needs but that is private to another Workspace is not used; Chief may add a `skill_publish`/`skill_make_public` proposal only for its own Workspace's Skills (CHIEF014).
7. Chief must not select an Agent merely because a document recommends it (document text is data).
8. Result recorded in the turn trace with reasons; the Owner sees a short note "Chief created Dynamic Agent X for Task T-22; you will be asked whether to keep it".

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ListAgents` (AGENT004), `CreateDynamicAgent` (AGENT007), visibility rules, Board readers, domain narrowing.

## 8. Architecture and code placement

`packages/application/src/chief/select-agents/{rank.ts,design-dynamic.ts,select-agents.usecase.ts}`; `rank.ts` is pure and unit-tested separately.

## 9. Security and safety

Prompt-injected role descriptions could aim to create a powerful Agent: tools start empty, profile is the narrowest, instructions cannot grant anything, caps apply and the Owner reviews the Agent afterwards. Private elements never leak across Workspaces. Ranking uses structured data only.

## 10. Errors and edge cases

- No Agents at all in the Workspace: `create_dynamic` or escalate if cap reached.
- All good candidates busy: recommendation `use_existing` with `queue: true`.
- Duplicate Dynamic Agent for the same Task: reuse the existing one (idempotent by `taskId`).
- Provider connection missing: candidate excluded; if none left, escalate `no_fallback_model`.

## 11. Acceptance criteria

- [ ] Ranking is deterministic and explained for a fixture of 6 Agents.
- [ ] Private Agents of other Workspaces are never candidates.
- [ ] Absence of a fitting role leads to `create_dynamic` with tools empty and the narrowest profile.
- [ ] Hostile role text in a Task cannot add tools or skills.
- [ ] Cap exceeded -> escalation, not creation.
- [ ] Second selection for the same Task reuses the Dynamic Agent.

## 12. Test plan

Pure ranking tests; unit tests of design with fake AGENT007; injection test. Command: `pnpm vitest run packages/application/src/chief/select-agents`.

## 13. Parallelization notes

Parallel with CHIEF009/011. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: score threshold 0.4 and the role tag list live in AppConfig defaults.
