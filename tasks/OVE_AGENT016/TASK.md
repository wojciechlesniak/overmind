---
id: OVE_AGENT016
title: Implement the GetAgentSummary read model for permission and audit consumers
area: AGENT
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT003, OVE_AGENT004, OVE_ARCH007]
soft_depends_on: []
provides: ["usecase:GetAgentSummary", "contract:AgentSummary"]
needs: ["port:AgentRepository", "port:Clock"]
owns: ["packages/application/src/agent/summary/**", "packages/contracts/src/agent/summary.ts"]
reads: ["packages/contracts/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 13"]
adr_refs: [7, 28, 3]
---

# OVE_AGENT016: Implement the GetAgentSummary read model for permission and audit consumers

## 1. Summary

A minimal, cheap, side-effect-free lookup that returns the facts other areas need about an Agent (identity, visibility, owner Workspace, lifecycle, archived flag, pinned model id) without exposing the whole configuration.

## 2. Context

PERM010 (path guard decisions) and PERM014 need `usecase:GetAgentSummary` for audit and violation records; reaching into the full config would couple them to AGENT internals and risk leaking the system prompt. Cross-area capability gap found while reading PERM010.

## 3. Scope (in)

- `AgentSummary` contract, use case, a version-aware variant `GetAgentSummary({ agentId, version? })`.

## 4. Out of scope

- Full config reads: AGENT004. Run summaries: AGENT018.

## 5. Detailed requirements

1. `AgentSummary = { id, name, kind: 'persistent'|'dynamic', visibility, ownerWorkspaceId?, version: int, archived: boolean, modelId, skillCount: int, role: string<=60 }`; strict zod, no prompt text, no tools list, no permission profile contents.
2. `GetAgentSummary({ agentId, version?, scope })` where `scope` is `{ workspaceId }`; private Agents of other Workspaces return `agent.not_found`.
3. System callers (engine, PERM) use a `system` scope that bypasses Workspace filtering but still returns only summary fields.
4. A batch variant `GetAgentSummaries(ids)` (<= 100) for audit views.
5. Pure read, no events, no audit write (reads are not audited), cached per request only.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AgentRepository`.

## 8. Architecture and code placement

`packages/application/src/agent/summary/get-agent-summary.ts`.

## 9. Security and safety

Summary excludes the system prompt and permission grants so audit and violation records cannot leak them. Scope filtering prevents probing private Agents.

## 10. Errors and edge cases

- Unknown version: `agent.version_not_found`.
- Archived Agent: returned with `archived: true`.

## 11. Acceptance criteria

- [ ] Summary contains no prompt or tool data (type and snapshot test).
- [ ] Cross-Workspace private Agent is not found.
- [ ] Batch limit enforced.

## 12. Test plan

Unit tests with in-memory repository. Command: `pnpm vitest run packages/application/src/agent/summary`.

## 13. Parallelization notes

Tiny and independent; unblocks PERM010/014.

## 14. Open questions and assumptions

- GAP closed by this task: `usecase:GetAgentSummary` was only needed, not provided.
