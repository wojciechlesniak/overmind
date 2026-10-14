---
id: OVE_AGENT006
title: Implement Agent visibility change with the in-use check
area: AGENT
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_DATA010, OVE_VIS002, OVE_VIS005]
soft_depends_on: [OVE_AGENT005]
provides: ["usecase:ChangeAgentVisibility", "api:agents.visibility"]
needs: ["lib:visibility-rules", "port:VisibilityUsageChecker", "port:WorkspaceRepository"]
owns: ["packages/application/src/agent/change-agent-visibility.usecase.ts", "packages/gateway/src/routes/agent/agent-visibility.route.ts", "packages/application/src/agent/agent-visibility.module-parts.ts"]
reads: ["packages/domain/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 8"]
adr_refs: [28, 2]
---

# OVE_AGENT006: Implement Agent visibility change with the in-use check

## 1. Summary

Only the Owner may switch a persistent Agent between Public and Private. The change creates a new configuration version, and making an Agent Private is blocked while other Workspaces still use it.

## 2. Context

ADR 0028: "Uprywatnienie elementu używanego w innym Workspace jest blokowane, dopóki go stamtąd nie usuniesz"; visibility change creates a new version; Chief may only propose (via `OVE_CHIEF014`). Visibility never changes permissions or memory boundaries (ADR 0003, 0014). The Agents view shows two radio cards (PUBLICZNY / PRYWATNY).

## 3. Scope (in)

- `ChangeAgentVisibility(input: { agentId; expectedVersion; to: 'public' | 'private'; ownerWorkspaceId? })`.
- `PATCH /v1/agents/{id}/visibility` route.
- Use of `VisibilityUsageChecker` to list Workspaces (other than the owner Workspace) where the Agent is referenced by a Workflow Version, a Task assignment or an open Run.

## 4. Out of scope

- Skill and Workflow visibility (SKILL, WFRT). The check implementation per entity kind is VIS (`port:VisibilityUsageChecker`). UI: AGUI.

## 5. Detailed requirements

1. Caller MUST be the Owner on the desktop channel. Telegram and Chief are rejected (`perm.owner_required` / `perm.local_only`, audit true).
2. `to: 'private'` requires `ownerWorkspaceId`; the default in the UI is the current Workspace, but the API demands it explicitly. The use case asks `VisibilityUsageChecker.usage(agentId, excludeWorkspaceId = ownerWorkspaceId)`; non-empty usage returns `agent.visibility_in_use` with `details: { workspaceCount, workspaceIds (max 5) }`.
3. `to: 'public'` is allowed only for persistent Agents; Dynamic Agents must first be accepted (`OVE_AGENT007`). In an isolated Workspace it is rejected (`agent.private_requires_workspace` with reason `isolated`).
4. On success the use case calls the domain `nextVersion` with the new `visibility`/`ownerWorkspaceId` and `appendVersion`; the changed field list is `['visibility','ownerWorkspaceId']`; event `agent.config_changed` plus audit `agent.visibility.changed`.
5. Running Runs keep their pinned version; the response carries `runsKeepPinnedVersion: true` and the number of active Runs (when known) for the UI hint.
6. Memory: no memory moves. The use case MUST NOT call any memory port (a test asserts the dependency list).
7. Idempotent: requesting the current visibility returns the unchanged Agent without a new version.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`nextVersion` and visibility rules from `OVE_AGENT002`, usage checker (VIS), repository (`OVE_AGENT003`), `AppendAudit`.

## 8. Architecture and code placement

Use case in `packages/application/src/agent/`, route in `packages/gateway/src/routes/agent/`. Depends on ports only. The use case is registered by adding `agent-visibility.module.ts` under `apps/engine/src/composition/modules/` (owned here).

## 9. Security and safety

Visibility is a data-exposure control, so the check fails closed: if the usage checker errors, the change is refused. Private data of another Workspace is never listed in the error details beyond ids. Audit entry required for every success and every refusal.

## 10. Errors and edge cases

- Usage checker unavailable: `agent.visibility_in_use` is NOT returned, instead `internal.dependency_unavailable`, change refused.
- Agent archived: `agent.archived`.
- Stale expected version: `agent.version_conflict`.
- Agent referenced only in its own Workspace: allowed.

## 11. Acceptance criteria

- [ ] Public to Private succeeds when only the owner Workspace uses the Agent.
- [ ] Public to Private is refused with ids when another Workspace's Workflow uses it.
- [ ] Private to Public works for the Owner, not for Chief or Telegram.
- [ ] Isolated Workspace cannot publish an Agent.
- [ ] New version number is current+1 and the old version is unchanged.
- [ ] A test proves no memory port is injected.

## 12. Test plan

Unit tests with fake usage checker; route test; audit assertion. Command: `pnpm vitest run packages/application/src/agent/change-agent-visibility`.

## 13. Parallelization notes

Independent of AGENT007, 008. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Task assignments in another Workspace count as "use" only when the Task is not finished.
