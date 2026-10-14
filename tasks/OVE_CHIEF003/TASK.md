---
id: OVE_CHIEF003
title: Implement the Chief autonomy policy (decide alone or escalate)
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF001, OVE_CHIEF002, OVE_DATA009, OVE_PERM005]
soft_depends_on: []
provides: ["lib:autonomy-policy"]
needs: ["contract:Budget", "lib:effective-permissions"]
owns: ["packages/domain/src/chief/autonomy/**"]
reads: ["packages/domain/src/chief/precedence/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 6", "SPECIFICATION 16.6"]
adr_refs: [15, 16, 3, 21]
---

# OVE_CHIEF003: Implement the Chief autonomy policy (decide alone or escalate)

## 1. Summary

A pure function that answers one question for every choice Chief wants to make on its own: may Chief decide this alone, or must it escalate? Chief decides when the choice stays within the Budget, agrees with Project Documentation and breaks no Owner Rule; everything else is an Escalation to the Owner. It also makes sure that Chief never decides anything that is a permission, a Rule, or an action on the ADR 0021 list.

## 2. Context

ADR 0015: "Chief rozstrzyga sam, o ile decyzja mieści się w Budżecie, zgadza się z Dokumentacją projektu i nie narusza Reguł Właściciela. W przeciwnym razie następuje Eskalacja." ADR 0016: "how" gaps Chief decides and records as a Decision, "what" gaps always go to the Owner. ADR 0003 and 0021: Chief cannot extend permissions and cannot waive Approvals. Spec criterion 6: deadlock settled by Chief with a Decision containing arguments of all sides.

## 3. Scope (in)

- `evaluateAutonomy(request, ctx): AutonomyVerdict` with verdicts `decide_alone`, `escalate(reason, evidence)`, `owner_only(reason)`.
- Decision categories and the table of what each may do.
- Budget arithmetic helper `withinBudget(estimate, budgetState)`.

## 4. Out of scope

- Recording the Decision and raising the Escalation: `OVE_CHIEF012`, `OVE_CHIEF015`. Estimating cost: callers provide estimates (WFRT/PROV). Doc-gap classification: `OVE_CHIEF004`.

## 5. Detailed requirements

1. `AutonomyRequest = { category, workspaceId, estimate?: { costUnits?, minutes?, iterations?, parallelAgents? }, conflicts: ConflictReport (CHIEF002), docs: { gap?: 'how'|'what'|'none', linked: boolean }, touches: { permissions: boolean, ownerRules: boolean, documentation: boolean, approvalsList: boolean, visibility: boolean, skillLibrary: boolean }, isolated: boolean }`.
2. `category` values: `how_gap_choice`, `deadlock_resolution`, `agent_selection`, `task_split`, `workflow_start`, `retry_after_failure`, `model_fallback_switch`, `scheduling_priority`, `discussion_initiation`.
3. Owner-only (never Chief, regardless of budget): anything with `touches.permissions`, `touches.ownerRules`, `touches.documentation`, `touches.approvalsList` (removing a required Approval), `touches.visibility`, publishing a Skill, accepting a Dynamic Agent, raising a Budget, adding an Allowed Directory. Verdict `owner_only` leads to a Proposal (CHIEF014) or an Access Request, not an Escalation.
4. `decide_alone` requires ALL of: no blocking conflict (CHIEF002), `docs.gap !== 'what'`, `docs.linked === true` for planning categories, estimate within the Budget remaining at each applicable level (Run, Agent, Workspace; the strictest level decides), parallelism within the installation limit (default 3, SPEC 9), `isolated` Workspace rules respected (decisions in an isolated Workspace are recorded as private).
5. `escalate` reasons mirror `EscalationReason` (CHIEF001): `over_budget` (any estimate exceeds remaining Budget or Budget unknown), `doc_conflict`, `rule_conflict`, `missing_what`, `missing_doc_link`, `deadlock_out_of_bounds`, `no_fallback_model`, `other`. When several apply, the verdict lists all reasons in a stable order (rule_conflict, missing_what, doc_conflict, missing_doc_link, over_budget, others) and the first is primary.
6. Unknown inputs fail toward escalation: missing estimate for a category that needs one, missing Budget, unclassified gap, unknown Workspace state -> `escalate(other or over_budget)`.
7. Model fallback switch (`model_fallback_switch`): Chief may decide alone when a configured fallback exists and its cost class is not higher than the primary's; otherwise `escalate(no_fallback_model or over_budget)` (SPEC 9).
8. `AutonomyVerdict` includes `evidence: Array<{ key: string; value: string|number|boolean }>` (small, structured) for the Decision record and the Escalation card.
9. A `limitsSnapshot` is returned so the audit shows which limits applied.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Conflict report from CHIEF002; Budget state shape from PROV/WFRT contracts (read-only); effective permission arithmetic stays in PERM (this task only reads flags).

## 8. Architecture and code placement

`packages/domain/src/chief/autonomy/{evaluate.ts,categories.ts,budget.ts,reasons.ts}`; pure and total.

## 9. Security and safety

This is the code form of "Chief cannot expand its own power". Owner-only list is closed (adding items is additive; removing is a breaking security change requiring an ADR). All unknowns escalate. The function takes structured facts only; model prose cannot influence the verdict except through typed fields that the caller derived and validated.

## 10. Errors and edge cases

- Estimate exactly equal to remaining Budget: allowed (not exceeding).
- Budget remaining negative (already exceeded): escalate `over_budget`.
- Category not in table: `escalate(other)`.
- Both a "how" and "what" gap in one request: split by caller; if not split, verdict escalates with `missing_what`.
- Isolated Workspace: no cross-Workspace facts allowed in the request (`ctx.crossWorkspaceFacts` must be empty or the verdict escalates).

## 11. Acceptance criteria

- [ ] Table tests: every category with every combination of budget/doc/rule flags matches the matrix in the test.
- [ ] `touches.ownerRules = true` is `owner_only` for every category.
- [ ] Unknown estimate yields `escalate`.
- [ ] Deadlock resolution inside budget, docs and rules yields `decide_alone`.
- [ ] Reasons list order is stable and primary reason is correct.
- [ ] Verdict carries evidence and limits snapshot.

## 12. Test plan

Exhaustive table test generated from the matrix; property test "adding a constraint never turns escalate into decide_alone". Command: `pnpm vitest run packages/domain/src/chief/autonomy`.

## 13. Parallelization notes

Parallel with CHIEF002 and CHIEF004 (stub the conflict type). Used by CHIEF008 to CHIEF013 and CHIEF018. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: cost units are the same unit as WFRT Budget; Chief default `maxDecisionCostUnits = 0` (no spending increase without escalation).
- Question for Owner: may Chief pick a more expensive fallback model within Budget? Default: yes only if within Budget; otherwise escalate.
