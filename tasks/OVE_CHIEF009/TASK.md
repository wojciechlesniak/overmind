---
id: OVE_CHIEF009
title: Implement DelegateTask with permission narrowing
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT008, OVE_AGENT018, OVE_BOARD008, OVE_CHIEF003, OVE_CHIEF006, OVE_PERM005, OVE_PERM020]
soft_depends_on: [OVE_CHIEF010]
provides: ["usecase:DelegateTask", "handler:chief.delegate"]
needs: ["usecase:AssignTask", "lib:effective-permissions", "usecase:ResolveAgentForRun", "usecase:AppendAudit", "port:RunReader"]
owns: ["packages/application/src/chief/delegate/**"]
reads: ["packages/domain/src/agent/narrowing.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 4", "SPECIFICATION 16.10"]
adr_refs: [3, 7, 28, 15]
---

# OVE_CHIEF009: Implement DelegateTask with permission narrowing

## 1. Summary

Assign a Task to an Agent on Chief's behalf. Delegation can only narrow: the Agent never receives more tools, time or access than Chief's own effective limits and the Agent's own profile allow, and requests for more become Access Requests for the Owner.

## 2. Context

ADR 0003: effective permissions are the intersection of policies; delegating (Chief to Team Lead to Agent, a Node overriding the model) may only narrow; an Agent can only file an Access Request. ADR 0007: a Node may override model, prompt and Skills but not permissions. ADR 0028: the Agent must be visible in the Task's Workspace.

## 3. Scope (in)

- `DelegateTask({ taskId, agentId, narrowing? })` and the `delegate` handler.
- Narrowing checks (tools, timeout, budget) using domain `assertNarrowing`.
- Visibility and availability checks, assignment through BOARD, event `chief.delegated` (ephemeral trace).

## 4. Out of scope

- Choosing which Agent: `OVE_CHIEF010`. Starting the actual Run: `OVE_CHIEF011`. Access Request creation and decision: PERM. Effective permission computation: PERM.

## 5. Detailed requirements

1. Preconditions: the Task exists in a non-terminal state and belongs to a Workspace Chief may act in; the Agent is active and visible in that Workspace (VIS); the Task has a valid documentation link (re-checked); no blocking Owner Rule conflict for the assignment.
2. Narrowing input may only restrict: `tools` subset of the Agent's enabled tools, `timeoutSeconds` and `maxMinutesPerTask` not above the Agent's configured values, never adding permissions. The handler computes `effective = intersect(owner, workspace, agentProfile, narrowing)` through PERM and records its hash in the assignment; it never stores a permission set of its own.
3. The schema of the action has no permission fields (CHIEF001); if the model sends extra keys the parser rejects them. If the Task would need access outside the effective permissions, the handler does NOT widen; it creates an `Escalation` or an Access Request through the Agent's own report path and leaves the Task `blocked: needs_access` (ADR 0003: Chief may only file an Access Request on behalf of an Agent when it names the path, and the Owner decides).
4. Parallelism: the assignment does not start work; the 3-Agent concurrency limit is enforced by WFRT/engine (SPEC 16.14). The handler reports `queued` if the limit is reached.
5. Reassignment: an Agent with an active Run on that Task cannot be replaced without cancelling (`chief.outside_autonomy` if Run is active); Chief may reassign only unstarted Tasks.
6. Memory: delegating never copies memory between Workspaces; the Agent starts with its own Memory for the Workspace (ADR 0014).
7. Direct Owner assignment (via direct chat command) overrides Chief's choice (binding) and goes through the same checks.
8. Each delegation is audited (`chief.task.delegated` with Task id, Agent id, narrowing summary, effective-permission hash).
9. Idempotent by `(taskId, agentId, planId)`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`assertNarrowing` (AGENT002), `ResolveAgentForRun` for validation (AGENT008), `lib:effective-permissions` (PERM), BOARD `AssignTask`, audit.

## 8. Architecture and code placement

`packages/application/src/chief/delegate/{delegate-task.usecase.ts,narrowing.ts}`; registered through `chief-delegate.module.ts`.

## 9. Security and safety

The classic escalation path is "delegate to a stronger Agent". Controls: effective permissions are always the intersection and are recomputed by PERM, not by Chief; narrowing only; private Agents of other Workspaces are not assignable; every delegation audited; no tool or Skill grants anything. A failing PERM call blocks the assignment (fail closed).

## 10. Errors and edge cases

- Agent archived between selection and delegation: `agent.archived`.
- Narrowing larger than Agent limits: `chief.outside_autonomy` with the field.
- Task already assigned to the same Agent: idempotent success.
- PERM unavailable: refused.
- Agent has no Skill needed by the Task: allowed (Skills are advisory), a warning is returned.

## 11. Acceptance criteria

- [ ] A narrowing that removes a tool succeeds and the effective hash differs from the unnarrowed one.
- [ ] A narrowing that adds a tool or increases the timeout is rejected.
- [ ] A permission-like key in the action is rejected at parse time.
- [ ] A Task needing an out-of-policy directory becomes `blocked: needs_access` with an Access Request, and nothing is widened.
- [ ] A private Agent from another Workspace cannot be assigned.
- [ ] Delegation produces an audit record with the effective-permission hash.

## 12. Test plan

Unit tests with fake PERM and BOARD; negative security tests; idempotency test. Command: `pnpm vitest run packages/application/src/chief/delegate`.

## 13. Parallelization notes

Parallel with CHIEF010 and 011. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: BOARD provides `usecase:AssignTask`; PERM provides an intersection helper usable without a Run (`dry` mode).
