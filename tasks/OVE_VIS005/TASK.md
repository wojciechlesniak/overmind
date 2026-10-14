---
id: OVE_VIS005
title: Define the VisibilityUsageChecker port, the assignment rule and the usage report
area: VIS
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_DATA010, OVE_VIS002, OVE_VIS003]
soft_depends_on: []
provides: ["port:VisibilityUsageChecker", "port:VisibilityUsageProvider", "contract:UsageReport", "lib:skill-assignment-rule", "usecase:ComputeVisibilityImpact"]
needs: ["lib:multi-token", "port:WorkspaceReader"]
owns: ["packages/contracts/src/visibility/usage-report.ts", "packages/domain/src/visibility/assignment/**", "packages/application/src/visibility/impact/**", "packages/application/src/ports/VisibilityUsageChecker.ts", "packages/application/src/ports/VisibilityUsageProvider.ts", "packages/testing/src/fakes/FakeVisibilityUsageProvider.ts"]
reads: ["packages/domain/src/visibility/rules/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 16.3"]
adr_refs: [28, 12]
---

# OVE_VIS005: Define the usage checker port, the assignment rule and the usage report

## 1. Summary

Two things: (1) the rule for assigning a Skill to an Agent (works only where both are visible), and (2) the "used elsewhere" machinery: a provider port implemented by each area, an aggregating checker, and the `UsageReport` that blocks making an item Private while another Workspace depends on it.

## 2. Context

ADR 0028: dragging a Skill onto an Agent works wherever both are visible; a Private Skill on a Public Agent works only in its own Workspace; making an item Private is blocked while it is used in another Workspace until it is removed there. AGENT006 consumes `port:VisibilityUsageChecker`.

## 3. Scope (in)

- `assignmentScope(skill, agent)` and `canAssignSkill`.
- `UsageReport` contract, `VisibilityUsageProvider` (per area, registered with a multi-token), `VisibilityUsageChecker.usage(ref, { excludeWorkspaceId })`, `ComputeVisibilityImpact` use case.
- Fake provider.

## 4. Out of scope

Providers' implementations (AGENT for lane/agent references, SKILL for assignments, WFRT for node references, BOARD for lane assignments), the change use cases (areas), the route (VIS008).

## 5. Detailed requirements

1. `assignmentScope(skill, agent): { scope: 'all' } | { scope: 'workspace', workspaceId } | { scope: 'none' }`: both public: all; one public one private(W): W; both private same W: W; both private different Workspaces: none. `canAssignSkill` is false when `none` (`vis.no_common_workspace`). At runtime an Agent's effective Skills in Workspace X = assignments whose Skill is visible in X (VIS003), so a Private Skill silently drops out of other Workspaces.
2. `UsageReport = { ref: {kind,id}, usages: Usage[], truncated: boolean, byWorkspace: {workspaceId, workspaceName, count}[] , activeRuns: number }`, `Usage = { workspaceId, referrerKind: 'workflow_node'|'subworkflow_call'|'lane_assignment'|'task_assignment'|'skill_assignment_effective'|'chat_pin', referrerId, referrerName, active: boolean }`. Max 200 usages in a response (`truncated`). Workspace names are included only in the Owner-facing report (VIS008), never in error details.
3. `VisibilityUsageProvider`: `{ kind: VisibleEntityKind (or kinds supported), usages(ref, opts: { excludeWorkspaceId }): Promise<Result<Usage[]>> }` registered through the multi-token; the aggregator calls all providers for the kind, merges and de-duplicates; any provider `Err` makes the aggregate `Err(internal.dependency_unavailable)` (fail closed).
4. What counts as use (default, documented): a Workflow Version node referencing the Agent/Skill/Workflow in a Workspace other than the one that remains owner; a Lane assigned to the Agent; a not-finished Task assigned to the Agent; a Subworkflow call; a Skill assigned to a Public Agent that is itself placed in a workflow or lane in another Workspace (`skill_assignment_effective`). A mere existence of a Public Agent's assignment without placement is not usage. Finished Tasks and historical Runs are not usage (Runs keep pinned versions).
5. `excludeWorkspaceId` is the Workspace that would own the Private item; usage there is fine.
6. `ComputeVisibilityImpact({ ref, to })` returns `{ allowed: boolean, blockers: UsageReport, reasons: VisError[] }` by combining VIS002's verdict and the usage report; read-only, no side effects, used by the dry-run route and by area change use cases.
7. Active Runs in other Workspaces that use the item are counted (`activeRuns`) and reported as an information (not a blocker, because Runs keep the pinned version).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Multi-token registration (ARCH006), `WorkspaceReader` (DATA), rules (VIS002), spec (VIS003).

## 8. Architecture and code placement

Contracts in `packages/contracts/src/visibility/`, domain assignment rule in `packages/domain/src/visibility/assignment/`, application aggregator in `packages/application/src/visibility/impact/`, ports one file each. OCP: a new area that references items adds a provider; nothing here changes.

## 9. Security and safety

Fail closed on any provider error or timeout (2 s); reports expose only ids and names to the Owner; error bodies expose counts only; providers must apply no visibility filter themselves for this query (they need the real usage, including other Workspaces' private items that reference a Public item), which is why only this application service may call them and its output is Owner-only.

## 10. Errors and edge cases

Provider timeout: change refused. Item referenced by a Private workflow of its own Workspace only: no blocker. Skill used by a Public Agent in a lane of Workspace B: blocker `lane_assignment` (via effective assignment). 250 usages: first 200 and `truncated: true`.

## 11. Acceptance criteria

- [ ] Assignment scope table (public/private x same/different Workspace) tested; `none` refuses with `vis.no_common_workspace`.
- [ ] Aggregator merges providers, dedupes, and fails closed on a provider error or timeout.
- [ ] Usage in the target owner Workspace is excluded.
- [ ] Report truncation works and flags itself.
- [ ] Active Runs are counted but not blocking.

## 12. Test plan

Unit tests with fake providers (including slow and failing providers). `pnpm vitest run packages/domain/src/visibility/assignment packages/application/src/visibility/impact`.

## 13. Parallelization notes

Providers are small follow-ups in AGENT, SKILL, WFRT, BOARD; they depend on this port. AGENT006 can start with the fake.

## 14. Open questions and assumptions

- ASSUMPTION: usage = configuration references (nodes, lanes, unfinished tasks), not memory or historical Runs.
- Open: whether a Skill assigned to a Public Agent that is not placed anywhere should block making the Skill Private; default no (assignment becomes dormant outside its Workspace).
