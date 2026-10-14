---
id: OVE_MEM014
title: "Purge Agent Memory when a Workspace is deleted"
area: MEM
kind: infra
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA012, OVE_MEM004]
soft_depends_on: ["OVE_DATA012"]
provides: ["adapter:MemoryCascadeParticipant"]
needs: ["port:WorkspaceCascadeParticipant", "port:MemoryDeleteGuard"]
owns: ["packages/adapters/sqlite/src/memory/cascade/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [14]
---

# OVE_MEM014: Purge Agent Memory when a Workspace is deleted

## 1. Summary

Register a WorkspaceCascadeParticipant (order 330) that deletes all memory entries and FTS rows of a deleted Workspace through the typed guard.

## 2. Context

DATA012 defines the cascade with order bands; Memory is 330, after Board 300, Discussions 310 and Decisions 320.

## 3. Scope (in)

- Participant with dry-run count and purge.

## 4. Out of scope

- Cascade engine: DATA.

## 5. Detailed requirements

1. `describe()` returns counts per Agent for the confirmation dialog.
2. `purge(workspaceId, tx)` sets the `workspace_purge` token, deletes entries, FTS rows follow by triggers, emits `memory.entries.purged`.
3. Idempotent.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Delete guard.

## 8. Architecture and code placement

Adapter.

## 9. Security and safety

Only the given Workspace; token required; audit entry.

## 10. Errors and edge cases

- Re-run after crash: zero rows, success.

## 11. Acceptance criteria

- [ ] Other Workspaces untouched.
- [ ] No FTS leftovers.
- [ ] Idempotent.

## 12. Test plan

- Adapter test. Commands: `pnpm vitest run packages/adapters/sqlite/src/memory/cascade`.

## 13. Parallelization notes

Independent.

## 14. Open questions and assumptions

- None.
