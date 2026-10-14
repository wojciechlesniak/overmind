---
id: OVE_MEM010
title: "Expose Shared Memory (Board plus Decisions) through authorised scopes"
area: MEM
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_BOARD003, OVE_BOARD011, OVE_DEC003, OVE_DEC007, OVE_MEM002]
soft_depends_on: []
provides: ["usecase:memory.shared-lookup"]
needs: ["lib:authorised-scope", "port:BoardReadModel", "port:DecisionReadModel"]
owns: ["packages/application/src/memory/shared/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [14, 28]
---

# OVE_MEM010: Expose Shared Memory (Board plus Decisions) through authorised scopes

## 1. Summary

A thin facade that gives callers one entry point to Shared Memory of a Workspace (Task Board and Decision Register) while delegating isolation to the scope library; it holds no data of its own.

## 2. Context

ADR 0014: Shared Memory is the Task Board plus Decision Register, readable per Workspace; cross-Workspace reading belongs to Chief via DEC008. No duplication of data (DRY).

## 3. Scope (in)

- Facade, no storage.

## 4. Out of scope

- Cross-Workspace Decision search: DEC008.

## 5. Detailed requirements

1. `lookup(scope: AuthorisedScope, { q, kinds: ('task'|'decision')[], limit })` fan-out to Board and Decision read models, merged by score.
2. Results carry source kind and id only plus titles; no bodies.
3. Rejects scopes other than `workspace`.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

BOARD and DEC read models.

## 8. Architecture and code placement

Application facade.

## 9. Security and safety

No bypass: each underlying port demands the scope; result titles pass through the redactor; facade stateless.

## 10. Errors and edge cases

- One source down: partial result with a marker.

## 11. Acceptance criteria

- [ ] Two-Workspace fixture never leaks.
- [ ] Partial failure marked.
- [ ] No tables owned.

## 12. Test plan

- Facade tests with fakes. Commands: `pnpm vitest run packages/application/src/memory/shared`.

## 13. Parallelization notes

After BOARD011 and DEC007.

## 14. Open questions and assumptions

- ASSUMPTION: Agents use this only in their current Workspace.
