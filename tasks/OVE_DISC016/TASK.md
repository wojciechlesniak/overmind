---
id: OVE_DISC016
title: "Register the Discussion WorkspaceCascadeParticipant for Workspace deletion"
area: DISC
kind: feature
size: XS
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA012, OVE_DISC004]
soft_depends_on: []
provides: ["port:DiscussionCascadeParticipant"]
needs: ["port:WorkspaceCascadeParticipant", "port:UnitOfWork"]
owns: ["packages/application/src/discussion/cascade/**", "apps/engine/src/composition/modules/discussion-cascade.module.ts"]
reads: ["packages/application/src/ports/WorkspaceCascadeParticipant.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [8, 28]
---

# OVE_DISC016: Register the Discussion WorkspaceCascadeParticipant for Workspace deletion

## 1. Summary

Plug Discussions into Workspace deletion (OVE_DATA012): preview counts of Discussions, messages and outcome revisions and delete them inside the deletion transaction after the Owner's Local Approval.

## 2. Context

SPEC 10 and ADR 0008: deleting a Workspace is the one exception to never deleting history. DATA012 owns the runner and port `WorkspaceCascadeParticipant` (`id`, `order`, `tables`, `preview`, `deleteFor(tx, workspaceId)`); each area ships a participant.

## 3. Scope (in)

- `DiscussionCascadeParticipant` and its composition module; table declaration for the completeness test.

## 4. Out of scope

- Runner, approval, event purge: OVE_DATA012. SQL deletion: `deleteAllForWorkspace` in OVE_DISC004. Running Discussions block deletion because DATA012 refuses with active Runs; open Discussions of idle Runs are cancelled by this participant first.

## 5. Detailed requirements

1. `id: 'discussion'`, `order: 310`, `tables: ['discussions','discussion_messages','discussion_outcome_revisions']` (must equal the migration markers).
2. `preview` returns `{ discussions, messages, outcomeRevisions }`.
3. `deleteFor(tx, workspaceId)`: calls `DiscussionRepository.deleteAllForWorkspace(tx, workspaceId)`; before that, any Discussion still `running/paused/awaiting_outcome_approval` is not cancelled through use cases (no events during deletion); it is simply deleted with its data, and pending turns were already stopped because DATA012 refused deletion with active Runs (Discussions of idle Runs have no pending turn; assert in the participant and return `err` if a `pending_turn` exists).
4. Registered via `multiToken` in the composition module only.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DATA012 port and runner, DISC004 repository method.

## 8. Architecture and code placement

`packages/application/src/discussion/cascade/discussion-cascade-participant.ts` plus the composition module.

## 9. Security and safety

Owner-only destruction behind Local Approval by construction; strictly Workspace-scoped; not callable from routes or Agents; failure -> rollback.

## 10. Errors and edge cases

- Workspace with no Discussions: no-op.
- A pending turn exists: returns `err` so the Workspace is not deleted mid-turn.
- Duplicate participant id: startup aborts (DATA012).

## 11. Acceptance criteria

- [ ] Two-Workspace test: only the target's Discussion data disappears.
- [ ] Preview equals deleted counts.
- [ ] Declared tables equal migration markers.
- [ ] A pending turn blocks deletion with an error and no change.

## 12. Test plan

- `discussion-cascade-participant.test.ts` on SQLite with the runner double. Commands: `pnpm vitest run packages/application/src/discussion/cascade`.

## 13. Parallelization notes

Independent; own module file only.

## 14. Open questions and assumptions

- ASSUMPTION: order band 310 (Board 300, Decisions 320, Memory 330); confirm with DATA012.
