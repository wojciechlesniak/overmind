---
id: OVE_CHIEF012
title: Record Chief Decisions for how-gaps and autonomous rulings
area: CHIEF
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF003, OVE_CHIEF006, OVE_DEC003, OVE_DEC005, OVE_PERM020]
soft_depends_on: []
provides: ["usecase:RecordChiefDecision", "handler:chief.record_decision"]
needs: ["usecase:RecordDecision", "port:DecisionReader", "usecase:AppendAudit"]
owns: ["packages/application/src/chief/decision/**"]
reads: ["packages/contracts/src/chief/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 16.6"]
adr_refs: [15, 16, 8]
---

# OVE_CHIEF012: Record Chief Decisions for how-gaps and autonomous rulings

## 1. Summary

Every time Chief decides something alone, the choice goes into the Decision Register with problem, alternatives, rationale, evidence and the autonomy verdict that allowed it. Chief only decides within Budget, Documentation and Rules; nothing is decided without a record.

## 2. Context

ADR 0015: each Chief ruling lands in the Register with the arguments of all sides. ADR 0016: "how" gaps are decided by Chief and recorded. ADR 0008: the Register is append-only; changes are supersessions. Spec criterion 6: deadlock settled by Chief with a Decision containing the parties' arguments. DEC owns the entity and storage; Chief supplies a validated proposal and sets the status.

## 3. Scope (in)

- `RecordChiefDecision(input)` and the `record_decision` handler.
- Mapping to DEC `RecordDecision` fields (`participants`, `evidenceRefs`, `skillsUsed`, `assumptions`, `risks`, `confidence`, `reviewDate`).
- Re-check of the autonomy verdict at record time; supersession when a prior Chief Decision on the same subject exists.

## 4. Out of scope

- Decision storage, outcomes and Owner verdicts: DEC. Deadlock flow: `OVE_CHIEF013`. Agent-proposed Decisions (`proposed`): DEC/AGENT014.

## 5. Detailed requirements

1. Input: `{ kind: 'how_gap'|'deadlock'|'selection', workspaceId, runId?, taskId?, title, problem, context?, alternatives: 2..6 items with { title, pros, cons, argumentBy?: participant }, selectedOption, rationale, evidenceRefs, autonomyCategory }`.
2. Before writing, call `evaluateAutonomy` with the structured facts (CHIEF003); a verdict other than `decide_alone` returns `chief.outside_autonomy` and creates an Escalation instead of a Decision with status `accepted`. Only `decide_alone` yields status `accepted`; a Decision for something Chief proposed but may not decide (for example touching documentation) is recorded as `proposed` and goes to the Owner.
3. All parties' arguments are required for deadlocks: `alternatives[].argumentBy` must cover every Discussion participant who stated a position (the DISC summary supplies them); missing arguments fail validation with `chief.action_invalid`.
4. The Decision records `participants` (Agents plus `chief`), `skillsUsed` with versions (from usage records), `evidenceRefs` as artifact ids or doc refs (never raw text), `assumptions` and `risks` as short strings (<= 200 chars, plain text, sanitised), `confidence` low/medium/high from a rule table (documentation-backed = high, preference only = low) rather than the model's claim.
5. Supersession: when a non-superseded Decision with the same `subject` key exists, the new one sets `supersedesId`; Chief never edits or deletes a Decision (ADR 0008).
6. Isolated Workspace: the Decision is created private in that Workspace and flagged `isolated`; it never enters cross-Workspace search.
7. `DecisionOutcome` starts `unknown`; Chief may later propose an outcome through DEC; the Owner decides (not here).
8. Idempotent by `(turnId, actionId)`.
9. Audit `chief.decision.recorded`; an Owner notification is not sent for routine how-gap decisions (visible in the Register); deadlock rulings produce a notification line in Chief chat.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

DEC `RecordDecision` and readers, autonomy policy, Skill usage records (SKILL008), audit.

## 8. Architecture and code placement

`packages/application/src/chief/decision/{record-chief-decision.usecase.ts,map-to-decision.ts,confidence.ts}`; `confidence.ts` pure.

## 9. Security and safety

A Decision is durable memory that later Chiefs search and trust more than Agent Memory (ADR 0016 order). Poisoned decisions would persist, so: structured fields, length caps, sanitised plain text, no instructions copied from documents, evidence by reference, autonomy re-check at write, Owner can mark outcomes. Unknown or failing checks escalate.

## 10. Errors and edge cases

- DEC unavailable: no Decision, no silent proceeding; the dependent action waits and retries (Chief reports).
- Same how-gap decided twice: second returns the existing Decision.
- Selected option not among alternatives: validation error.
- Discussion participants missing arguments: validation error.

## 11. Acceptance criteria

- [ ] A how-gap within budget becomes an `accepted` Decision with alternatives and rationale.
- [ ] A choice touching documentation is recorded `proposed`, not accepted.
- [ ] A deadlock Decision without all parties' arguments is rejected.
- [ ] Supersession sets `supersedesId` and leaves the old record intact.
- [ ] Isolated Workspace Decisions are flagged private.
- [ ] Duplicate action id does not create a second Decision.

## 12. Test plan

Unit tests with fake DEC; confidence table tests; idempotency test. Command: `pnpm vitest run packages/application/src/chief/decision`.

## 13. Parallelization notes

Parallel with CHIEF008 and 013 (stub DEC). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: DEC exposes `usecase:RecordDecision` accepting `status`, `supersedesId` and a `subject` key.
