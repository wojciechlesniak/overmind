---
id: OVE_NOTIF014
title: "Provide the Workspace cascade participant for notifications"
area: NOTIF
kind: feature
size: XS
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA012, OVE_NOTIF003]
soft_depends_on: []
provides: ["lib:notification-cascade"]
needs: ["port:WorkspaceCascadeParticipant"]
owns: ["packages/adapters/sqlite/src/cascade/notification.participant.ts", "apps/engine/src/composition/modules/notification-cascade.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8, 28]
---

# OVE_NOTIF014: Provide the Workspace cascade participant for notifications

## 1. Summary

Registers a `WorkspaceCascadeParticipant` so deleting a Workspace removes its notifications (DATA012).

## 2. Context

`notifications` carries `workspace_id` and is marked workspace-scoped; the DATA012 completeness test fails CI if no participant covers it.

## 3. Scope (in)

- Participant with `id: "notification"`, `tables: ["notifications"]`, `preview`, `deleteFor`.
- Module registration.

## 4. Out of scope

- Other tables: their areas.

## 5. Detailed requirements

1. `preview(workspaceId)` returns `{ notifications: <count> }`.
2. `deleteFor(tx, workspaceId)` calls `deleteByWorkspace` on the transaction and returns the count; it never touches rows of other Workspaces (rows with `workspace_id` null, such as backup or system notifications, are kept).
3. `order` 500 (before the Workspace row); no external cleanups.
4. The module provides the participant through the collect token.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `WorkspaceCascadeParticipant` and its contract test (DATA012), `deleteByWorkspace` (OVE_NOTIF003).

## 8. Architecture and code placement

Adapter-side participant in `packages/adapters/sqlite/src/cascade/`; module file is the only wiring.

## 9. Security and safety

- Scoped strictly by `workspace_id`; a two-Workspace test is required.
- Deletion happens in the cascade transaction only.

## 10. Errors and edge cases

- Notifications with subject in the deleted Workspace but null `workspace_id`: not deleted (system-wide).
- Unresolved actionable notifications of that Workspace are deleted too (the Workspace is gone).

## 11. Acceptance criteria

- [ ] Given two Workspaces, Then only the deleted one's notifications disappear.
- [ ] The DATA012 completeness test passes for `notifications`.
- [ ] Preview counts are correct.

## 12. Test plan

Participant contract test from DATA012 plus `notification-participant.test.ts`. Command: `pnpm vitest run packages/adapters/sqlite/src/cascade`.

## 13. Parallelization notes

Own file only.

## 14. Open questions and assumptions

- None.
