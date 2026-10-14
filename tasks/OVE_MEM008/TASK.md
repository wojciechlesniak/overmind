---
id: OVE_MEM008
title: "Build the fenced memory context pack for Agent prompts"
area: MEM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_MEM001, OVE_MEM002, OVE_MEM003, OVE_MEM004, OVE_MEM007, OVE_SEC004]
soft_depends_on: ["OVE_SEC004"]
provides: ["usecase:memory.build-context-pack"]
needs: ["port:AgentMemoryRepository", "port:MemoryIndex", "lib:authorised-scope", "lib:prompt-assembly", "contract:MemoryContextPack"]
owns: ["packages/application/src/memory/context/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [8, 14, 16]
---

# OVE_MEM008: Build the fenced memory context pack for Agent prompts

## 1. Summary

Select relevant Agent Memory entries for a Task (FTS search plus recency within a character budget) and return a context pack where each entry is a fenced data block, preceded by a fixed trusted fragment stating that notes never override Owner Rules or documentation.

## 2. Context

ADR 0014: only what a Task needs goes to the model. ADR 0016 precedence: Owner Rules, Project Documentation, Chief Decisions, Agent Memory. SEC004: memory is untrusted at read time too, even after the write guard.

## 3. Scope (in)

- Query building, selection, budget, fencing, manifest.

## 4. Out of scope

- Prompt assembly itself: SEC004. Shared Memory: MEM010.

## 5. Detailed requirements

1. Input: system scope `(agentId, workspaceId)` and the Task title and description; query terms derived by the sanitiser; limit 8 entries, budget 4000 chars (default).
2. Only `active` entries; order by search score then recency; always include the 2 newest.
3. Each entry rendered as a SEC004 untrusted block with id and date; instruction fragment is the fixed text from MEM001, never built from entry content.
4. Manifest lists selected ids and exclusion counts; recorded in the run's timeline for traceability.
5. No entries: empty pack, no fragment.
6. Precedence array included for the prompt template to print.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Assembler, index port, scope library.

## 8. Architecture and code placement

Application use case.

## 9. Security and safety

Quarantined and compacted entries cannot be selected; scope is the current Workspace only; fences prevent entries from closing the data block; the fragment is constant; the budget limits injection surface.

## 10. Errors and edge cases

- Entry containing a fence delimiter: assembler escapes it.
- Over-budget: lowest-score entries dropped, counted in manifest.

## 11. Acceptance criteria

- [ ] Pack never contains entries from another Workspace (two-Workspace fixture, public Agent).
- [ ] Quarantined entries excluded even if matching.
- [ ] Prompt snapshot shows fences and constant fragment.
- [ ] Budget respected.

## 12. Test plan

- Use case tests with fakes; snapshot. Commands: `pnpm vitest run packages/application/src/memory/context`.

## 13. Parallelization notes

Independent of MEM009/010.

## 14. Open questions and assumptions

- ASSUMPTION: callers (AGENT/CHIEF) insert the pack into the Task prompt.
