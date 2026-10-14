---
id: OVE_PERM032
title: Implement the WorkspaceCascadeParticipant for permission data on Workspace deletion
area: PERM
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA012, OVE_PERM012, OVE_PERM020, OVE_PERM024, OVE_PERM025]
soft_depends_on: [OVE_PERM031]
provides: ["usecase:WorkspaceCascadeParticipant"]
needs: ["port:WorkspaceCascadeRegistry", "usecase:AppendAudit", "port:UnitOfWork"]
owns: ["packages/application/src/perm/workspace-cascade.ts", "apps/engine/src/composition/modules/perm-cascade.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 11"]
adr_refs: [3, 8]
---

# OVE_PERM032: Implement the WorkspaceCascadeParticipant

## 1. Summary

When the Owner deletes a Workspace (after Local Approval, DATA), PERM removes its policy, Allowed Directories, overrides, pending approvals/access requests and Run grants, and detaches mounts, while keeping audit history.

## 2. Context

SPEC 10: deleting a Workspace removes its data after Local Approval with a warning. DATA coordinates the saga; each area participates through a registry (capability name assumed, flagged to the linker).

## 3. Scope (in)

A participant with `plan(workspaceId)` (counts for the warning dialog) and `execute(workspaceId)`.

## 4. Out of scope

The saga, Local Approval for the deletion (DATA with `LocalApprovalGate`), deletion of files on disk (never done: Allowed Directories are not touched).

## 5. Detailed requirements

1. `plan` returns counts: directories, overrides, pending approvals, pending access requests, active Run grants.
2. `execute` in one transaction: cancel pending approvals and access requests (state machines, audited), revoke Run grants, delete overrides scoped to the Workspace, delete the Workspace policy and directories, emit `policy.changed {widened:false}` and `override.changed` so mounts are removed (PERM017).
3. Global overrides and the Owner policy are untouched. Agent-layer policies for private Agents of that Workspace are deleted by AGENT's own participant; profiles remain.
4. Audit events are never deleted; one event `perm.policy.workspace_removed` records counts.
5. Idempotent: running twice is a no-op. Never touches host files.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Repositories (PERM024/025), `AppendAudit`, state machines.

## 8. Architecture and code placement

Application layer participant registered by a module file owned here.

## 9. Security and safety

Mounts must be detached before the policy disappears; failing to detach aborts the saga step (fail closed, the Workspace stays). No host data deleted.

## 10. Errors and edge cases

Unknown Workspace: no-op success; active Runs: DATA cancels Runs first (precondition checked, else `perm.policy_conflict`).

## 11. Acceptance criteria

- [ ] After execute, no PERM rows reference the Workspace except audit.
- [ ] Mounts removed from fake sandbox before policy deletion.
- [ ] Second execution is a no-op.
- [ ] Audit event with counts exists.

## 12. Test plan

Use case tests with fakes. `pnpm vitest run packages/application/src/perm/workspace-cascade`.

## 13. Parallelization notes

Small; after repositories.

## 14. Open questions and assumptions

- ASSUMPTION: `port:WorkspaceCascadeRegistry` is provided by DATA (name to be confirmed).
