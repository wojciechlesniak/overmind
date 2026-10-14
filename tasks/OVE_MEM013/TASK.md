---
id: OVE_MEM013
title: "Test memory scope isolation, poisoning and edit abuse cases"
area: MEM
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_MEM003, OVE_MEM005, OVE_MEM008, OVE_MEM012, OVE_SEC004]
soft_depends_on: []
provides: ["test:memory-abuse-suite"]
needs: ["lib:memory-fakes", "lib:injection-corpus", "lib:memory-contract-suites"]
owns: ["tests/abuse/memory/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [8, 14, 16]
---

# OVE_MEM013: Test memory scope isolation, poisoning and edit abuse cases

## 1. Summary

End-to-end abuse test suite for the memory area: cross-Workspace reads, public Agent boundaries, poisoned summaries, edit attempts, FTS hostile queries, and replayed events.

## 2. Context

Memory is the long-lived channel for injection and the privacy boundary of ADR 0014 and ADR 0028.

## 3. Scope (in)

- Test-only task.

## 4. Out of scope

- Fixes: owning tasks.

## 5. Detailed requirements

1. Public Agent in two Workspaces: pack, list and search never mix entries.
2. Isolated Workspace: Chief and other Agents see nothing; Owner outside context sees `withheld`.
3. Corpus: hostile task output becomes quarantined; quarantined text never appears in any prompt snapshot.
4. Edit attempts through gateway, repository and raw SQL fail.
5. FTS queries with operators, quotes, NEAR, long strings return no foreign rows and no errors.
6. Visibility toggled: no change.
7. Replays of done events create one entry.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Suites and corpus.

## 8. Architecture and code placement

Tests only.

## 9. Security and safety

This task is the regression net for the area; failures block release.

## 10. Errors and edge cases

- Unicode lookalike instruction phrases.

## 11. Acceptance criteria

- [ ] All listed cases automated and green.
- [ ] Mutation of the scope check makes at least one test fail (documented manual check).

## 12. Test plan

- Command: `pnpm vitest run tests/abuse/memory`.

## 13. Parallelization notes

Last in area.

## 14. Open questions and assumptions

- None.
