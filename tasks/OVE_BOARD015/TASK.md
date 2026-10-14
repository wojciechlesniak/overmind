---
id: OVE_BOARD015
title: "Register the Board WorkspaceCascadeParticipant for Workspace deletion"
area: BOARD
kind: feature
size: XS
priority: P1
mvp: true
status: todo
depends_on: [OVE_BOARD004, OVE_DATA002, OVE_DATA012]
soft_depends_on: []
provides: ["port:BoardCascadeParticipant"]
needs: ["port:WorkspaceCascadeParticipant", "port:UnitOfWork"]
owns: ["packages/application/src/board/cascade/**", "apps/engine/src/composition/modules/board-cascade.module.ts"]
reads: ["packages/application/src/ports/WorkspaceCascadeParticipant.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14"]
adr_refs: [8, 28]
---

# OVE_BOARD015: Register the Board WorkspaceCascadeParticipant for Workspace deletion

## 1. Summary

Plug the Board into the Workspace deletion flow: a `WorkspaceCascadeParticipant` that previews the number of boards, lanes, Tasks and timeline entries of a Workspace and deletes them inside the deletion transaction, so deleting a Workspace removes its Task Board after the Owner's Local Approval.

## 2. Context

SPEC 10 and ADR 0008: deleting a Workspace deletes its Decisions, Board and Agent Memory of that Workspace, after a Local Approval with a warning. OVE_DATA012 owns the runner and the multi-provider port `WorkspaceCascadeParticipant` (`id`, `order`, `tables`, `preview`, `deleteFor(tx, workspaceId)`); every area ships its own participant. The runner has already checked the typed name and the `LocalApprovalGate` grant; participants only delete their own data in the given transaction and must never touch other Workspaces.

## 3. Scope (in)

- `BoardCascadeParticipant` implementing the port from DATA012 and its composition module.
- Declaration of the covered tables for the completeness test.

## 4. Out of scope

- The runner, preview endpoint, approval, event purge: OVE_DATA012. Task evidence Artifacts: the DATA Artifact participant. The SQL: `deleteAllForWorkspace` in OVE_BOARD004.

## 5. Detailed requirements

1. `id: 'board'`, `order: 300` (before Workspace row 1000 and event purge 900; before Agents so Task rows referencing Agent ids go first; ASSUMPTION: Agents use order 400+), `tables: ['boards','lanes','tasks','task_timeline']` (must equal the tables marked `-- workspace-scoped: yes` in OVE_BOARD004; the DATA012 completeness test fails otherwise).
2. `preview(workspaceId)` returns `{ boards: n, lanes: n, tasks: n, timelineEntries: n }` using count queries via `TaskRepository.countsByLane` plus a repository `countForWorkspace` (add to the BOARD003 port by proposal if missing; otherwise a read through `BoardReadModel`).
3. `deleteFor(tx, workspaceId)` calls `TaskTimelineRepository`/`BoardRepository.deleteAllForWorkspace(tx, workspaceId)` and returns `{ deleted }` = total rows; any error returns `err` so the runner rolls everything back.
4. Registered through the multi-token extension point (`multiToken` of ARCH006) in `apps/engine/src/composition/modules/board-cascade.module.ts`; nothing else is edited.
5. No external cleanups (`describeExternal` absent): Board stores no files.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`WorkspaceCascadeParticipant` and `multiToken` (DATA012, ARCH006); repositories from BOARD003/004. Do not implement approval, naming confirmation or event purging here.

## 8. Architecture and code placement

Application `packages/application/src/board/cascade/board-cascade-participant.ts`; composition module in `apps/engine`. Depends on ports only.

## 9. Security and safety

Destruction is Owner-only and runs after Local Approval by construction (the runner). The participant must delete strictly by `workspaceId` (two-Workspace test) and must not be callable from routes or Agents (it has no route and is not exported in the public barrel). Failure fails closed: error -> rollback.

## 10. Errors and edge cases

- Workspace without Board: counts zero, delete is a no-op ok.
- Participant invoked outside a transaction: returns `data.invalid_operation` (repository refuses).
- Duplicate participant id at startup: DATA012 aborts startup.

## 11. Acceptance criteria

- [ ] With two Workspaces seeded, `deleteFor` removes only the target's boards, lanes, tasks and timeline; the other is intact.
- [ ] `preview` counts equal what `deleteFor` deletes.
- [ ] The declared `tables` match the migration markers (completeness test passes).
- [ ] A forced repository failure returns `err` and leaves data untouched when run inside a rolled-back transaction.

## 12. Test plan

- `board-cascade-participant.test.ts` on SQLite with two Workspaces and the DATA012 runner test double; completeness test registration.
- Commands: `pnpm vitest run packages/application/src/board/cascade`.

## 13. Parallelization notes

Independent of BOARD005-014. Only touches its own module file.

## 14. Open questions and assumptions

- ASSUMPTION: `order: 300` for Board; confirm the order bands with DATA012 (Discussions 310, Decisions 320, Agent Memory 330, Agents later).
