---
id: OVE_CHIEF002
title: Implement the precedence resolver (Owner Rules, Documentation, Decisions, Memory)
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF001, OVE_DATA013, OVE_DATA016, OVE_DEC001, OVE_MEM001]
soft_depends_on: []
provides: ["lib:precedence-resolver"]
needs: ["contract:OwnerRule", "contract:Decision", "contract:AgentMemoryEntry", "contract:ProjectDocRef"]
owns: ["packages/domain/src/chief/precedence/**"]
reads: ["packages/contracts/src/chief/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 2", "SPECIFICATION 6", "SPECIFICATION 10"]
adr_refs: [16, 14, 15]
---

# OVE_CHIEF002: Implement the precedence resolver (Owner Rules, Documentation, Decisions, Memory)

## 1. Summary

Pure logic that orders the four sources of guidance and answers "does X conflict with a higher source?": Owner Rules beat Project Documentation, which beats Chief Decisions, which beat Agent Memory. Nothing in a lower source can weaken a higher one. It produces a typed conflict report that Chief use cases and the command gate consume.

## 2. Context

ADR 0016: "Kolejność pierwszeństwa: Reguły Właściciela, potem Dokumentacja projektu, potem Decyzje Chiefa, a na końcu Pamięć agenta. Nic, co Agent zapamiętał, nie może osłabić Reguły Właściciela." ADR 0014: Agent Memory never outranks Rules or Documentation. The resolver cannot understand natural language by itself; it works on structured "guidance items" that carry source, scope and a normalised statement produced elsewhere (a classification the Chief model returned as typed data, or explicit fields). The domain stays deterministic.

## 3. Scope (in)

- `GuidanceItem` and `GuidanceSource = 'owner_rule' | 'project_doc' | 'chief_decision' | 'agent_memory'`; rank table.
- `mergeGuidance(items)`: stable ordering and shadowing (a lower item that contradicts a higher one is marked `overridden`).
- `detectConflicts(candidate, items)`: given a typed `CandidateEffect` (what a planned action or a command would do), returns `ConflictReport`.
- `effectiveGuidanceFor(workspace, agent)`: filters items to scope (Workspace and Agent) and returns ordered list for prompt assembly.

## 4. Out of scope

- Obtaining `CandidateEffect` from natural language: `OVE_CHIEF016` (model classification returning typed output). Loading items: ports in CHIEF005. Rule storage and editing: DATA/Owner.

## 5. Detailed requirements

1. Rank: `owner_rule` 4, `project_doc` 3, `chief_decision` 2, `agent_memory` 1. Equal rank within a source: newest version wins only for `chief_decision` (supersession chain, DEC); Owner Rules and Documentation conflicts inside the same rank are reported as `ambiguity` and escalated (never auto-resolved).
2. `GuidanceItem = { id, source, scope: { workspaceId?: string; agentId?: string }, kind: 'requires'|'forbids'|'prefers'|'defines', subject: string (normalised key, e.g. 'task.pentest_after', 'scope.feature.google_login'), value?: string|number|boolean, text: string<=500, version: number, ref: string (rule id, doc path#anchor, decision id, memory id) }`. `subject` keys are produced by classifiers or by explicit rule templates; the domain compares keys exactly.
3. `CandidateEffect = { subject: string, operation: 'add'|'remove'|'skip'|'change'|'require'|'forbid', value?: ..., origin: 'owner_command'|'agent_proposal'|'chief_plan'|'discussion_outcome' }`.
4. Conflict rules: a candidate with `operation in ('skip','remove','forbid')` against an item of kind `requires` with the same subject is a conflict; `add`/`require` of a subject that an item `forbids` is a conflict; `change` of a `defines` value conflicts when the new value differs. Conflicts report `{ itemId, source, ref, severity: 'blocking' }` for Owner Rule or Documentation items and `'warning'` for Chief Decisions and Memory.
5. Special rule (ADR 0016): conflicts with an Owner Rule are always `blocking` and can only be resolved by the Owner changing the Rule; conflicts with Documentation about "what" are `blocking` for any origin except an Owner command that explicitly changes the Documentation (then the result is `doc_change_required`, never silently accepted). A Chief Decision never overrides Documentation; Memory never overrides a Decision.
6. `mergeGuidance` marks lower-rank items that contradict higher ones as `overridden: true` with `overriddenBy`; overridden items are excluded from prompts (so Memory text that tries to weaken a Rule never reaches a model as guidance).
7. Scope: an item with `workspaceId` applies only in that Workspace; Memory items (agent scope) apply only to that Agent in that Workspace; Owner Rules may be global (no `workspaceId`) and apply everywhere.
8. All functions are pure, deterministic and independent of locale; ordering ties break by `ref` string for reproducibility.
9. The resolver never reads or interprets free text (`text` is carried along for display only).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Result helpers; contract types from DATA/DEC/MEM (read-only). Prompt assembly later receives `effectiveGuidanceFor` output.

## 8. Architecture and code placement

`packages/domain/src/chief/precedence/{rank.ts,merge.ts,conflicts.ts,scope.ts,types.ts}`. No I/O.

## 9. Security and safety

Core invariant of ADR 0016 as code: lower sources can never weaken higher ones; Memory text that contradicts a Rule is dropped before prompt assembly, which also reduces prompt-injection leverage through memory poisoning. Conflicts with Rules are blocking by construction. Unclassifiable or ambiguous cases fail toward more restriction (return a conflict/ambiguity, never silent pass).

## 10. Errors and edge cases

- Two Owner Rules contradicting each other: `ambiguity` report; Chief escalates (`rule_conflict`).
- Rule removed or edited after planning: callers recompute with the current version set; items carry `version`.
- Candidate subject unknown to all items: no conflict.
- Documentation item that `forbids` what a Chief Decision `requires`: Chief Decision is `overridden`.
- Empty item list: no conflicts.

## 11. Acceptance criteria

- [ ] Table tests for every pair of sources show the higher source winning.
- [ ] A Memory item contradicting an Owner Rule is marked overridden and absent from `effectiveGuidanceFor`.
- [ ] `skip pentest` against Rule "requires pentest after each Task" yields a blocking conflict naming the Rule.
- [ ] Two contradictory Owner Rules yield `ambiguity`.
- [ ] Owner command changing "what" yields `doc_change_required`.
- [ ] Output is identical for shuffled inputs.

## 12. Test plan

Table-driven and property tests (order independence; adding a lower-rank item never changes the result for higher-rank subjects). Command: `pnpm vitest run packages/domain/src/chief/precedence`.

## 13. Parallelization notes

Parallel with CHIEF003 and CHIEF004. Consumed by CHIEF005, 006, 008, 012, 016. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: subjects are normalised keys produced by classifiers, with a starter vocabulary (`task.test_required`, `task.pentest_after`, `scope.feature.<name>`, `budget.max`); the vocabulary list lives in `types.ts` and grows by additive PRs.
- ASSUMPTION: Owner Rules may carry an optional `subject` template field (DATA contract); without it, the model classifier assigns one and the Owner can review it.
