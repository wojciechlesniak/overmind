---
id: OVE_DEC013
title: "Register the Decision WorkspaceCascadeParticipant for Workspace deletion"
area: DEC
kind: feature
size: XS
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA012, OVE_DEC004]
soft_depends_on: ["OVE_DEC007"]
provides: ["port:DecisionCascadeParticipant"]
needs: ["port:WorkspaceCascadeParticipant", "port:UnitOfWork"]
owns: ["packages/application/src/decision/cascade/**", "apps/engine/src/composition/modules/decision-cascade.module.ts"]
reads: ["packages/application/src/ports/WorkspaceCascadeParticipant.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 28]
---

# OVE_DEC013: Register the Decision WorkspaceCascadeParticipant for Workspace deletion

## 1. Summary

Plug the Decision Register into the single legal exception to append-only: when the Owner deletes a whole Workspace (after Local Approval), its Decisions, their events and FTS rows are removed inside the deletion transaction.

## 2. Context

ADR 0008 and SPEC 10: deleting a Workspace deletes its Decisions, Board and Agent Memory from that Workspace after a Local Approval with a warning; the rule protects history from Agents and accidents, not from the Owner. DATA012 provides the runner and the `WorkspaceCascadeParticipant` port; DATA012 req 9: cross-Workspace links keep ids only and the UI shows "deleted Workspace".

## 3. Scope (in)

- `DecisionCascadeParticipant` and composition module; declaration of the tables for the completeness test.

## 4. Out of scope

- Runner, approval, event purge: OVE_DATA012. SQL: `deleteAllForWorkspace` (OVE_DEC004). The warning UI: WSPACE.

## 5. Detailed requirements

1. `id: 'decision'`, `order: 320`, `tables: ['decisions','decision_events']` (plus the FTS tables `decisions_fts`, `decisions_fts_map`, covered by the delete trigger of OVE_DEC007; declared in `tables` as well so the completeness test passes).
2. `preview(workspaceId)` -> `{ decisions, events }`.
3. `deleteFor(tx, workspaceId)` calls `DecisionRepository.deleteAllForWorkspace(tx, workspaceId)` (guard row inside the transaction); returns total rows deleted. Decisions of OTHER Workspaces that reference these (`supersedesId`) are untouched; their `DecisionRef` now resolves with `workspaceName: null` and no title (handled in read models).
4. Registered by `multiToken` in the composition module only.
5. After deletion, the `workspace.deleted` audit event in DATA012 is the only trace.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DATA012 port and runner; DEC004 repository method.

## 8. Architecture and code placement

`packages/application/src/decision/cascade/decision-cascade-participant.ts`, composition module.

## 9. Security and safety

Owner-only destruction behind Local Approval by construction; strictly Workspace-scoped (two-Workspace test); not exposed by routes or to Agents; failure -> rollback; the guard row never commits so no later code path can delete Decisions.

## 10. Errors and edge cases

- Workspace with no Decisions: no-op.
- Another Workspace's Decision superseded one here: it stays `superseded` with a dangling ref shown as deleted Workspace.
- FTS rows missing: delete still succeeds.

## 11. Acceptance criteria

- [ ] Two-Workspace test: only the target's decisions, events and FTS rows vanish.
- [ ] `preview` equals deleted counts.
- [ ] Declared tables match migration markers and the completeness test passes.
- [ ] After commit, no guard row exists and raw DELETE fails again.

## 12. Test plan

- `decision-cascade-participant.test.ts` on SQLite with the runner double. Commands: `pnpm vitest run packages/application/src/decision/cascade`.

## 13. Parallelization notes

Independent; own module file only.

## 14. Open questions and assumptions

- ASSUMPTION: order band 320; confirm with DATA012.
