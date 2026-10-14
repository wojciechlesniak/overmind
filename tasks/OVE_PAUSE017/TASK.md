---
id: OVE_PAUSE017
title: "Provide the Workspace cascade participant for pause state"
area: PAUSE
kind: feature
size: XS
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA012, OVE_PAUSE002]
soft_depends_on: []
provides: ["lib:pause-cascade"]
needs: ["port:WorkspaceCascadeParticipant"]
owns: ["packages/adapters/sqlite/src/cascade/pause.participant.ts", "apps/engine/src/composition/modules/pause-cascade.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8, 28]
---

# OVE_PAUSE017: Provide the Workspace cascade participant for pause state

## 1. Summary

Registers a `WorkspaceCascadeParticipant` so deleting a Workspace removes its individual pause row (DATA012) and refreshes the pause gate.

## 2. Context

`pause_state` has one row per individually paused Workspace (`scope_key = 'ws:<id>'`). The table is marked workspace-scoped, so the DATA012 completeness test requires a participant. The global row is never touched.

## 3. Scope (in)

- Participant `id: "pause"`, `tables: ["pause_state"]`, `preview`, `deleteFor`.
- Gate refresh after commit.

## 4. Out of scope

- Other tables: their areas. Pausing logic: OVE_PAUSE004.

## 5. Detailed requirements

1. `preview(workspaceId)` returns `{ pause_state: 0|1 }`.
2. `deleteFor(tx, workspaceId)` deletes exactly `scope_key = 'ws:' || workspaceId` in the cascade transaction and never the `global` row; `order` 500.
3. `describeExternal` returns nothing (no files).
4. After the cascade commits, the module publishes `pause.changed` with a fresh snapshot (paused Workspace removed) through `GetPauseSnapshot` so the gate and UI drop the stale scope; if publishing fails the gate's staleness rule self-heals at next change.
5. Deleting a Workspace is refused by DATA012 while Runs are active; a paused Workspace has none, so deletion of a paused Workspace is the normal path.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `WorkspaceCascadeParticipant` and its contract test (DATA012), `PauseGateControl` (OVE_PAUSE005), `GetPauseSnapshot` (OVE_PAUSE003).

## 8. Architecture and code placement

Adapter-side participant in `packages/adapters/sqlite/src/cascade/`; the module file is the only wiring.

## 9. Security and safety

- Scoped by exact key; the global emergency state can never be deleted by a Workspace deletion (test).
- No pause state may survive for a deleted Workspace (a later reuse of the id is impossible, ULIDs).

## 10. Errors and edge cases

- Workspace never paused: no row, `deleted: 0`.
- Global paused while the Workspace is deleted: global row untouched.

## 11. Acceptance criteria

- [ ] Given two Workspaces both paused, Then deleting one removes only its row.
- [ ] The global row survives.
- [ ] The DATA012 completeness test passes for `pause_state`.
- [ ] The gate no longer lists the deleted Workspace.

## 12. Test plan

DATA012 participant contract test plus `pause-participant.test.ts`. Command: `pnpm vitest run packages/adapters/sqlite/src/cascade`.

## 13. Parallelization notes

Own file only.

## 14. Open questions and assumptions

- None.
