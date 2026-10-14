---
id: OVE_DISC011
title: "Resolve deadlocks: Chief rules within Budget, Docs and Rules, otherwise Escalation"
area: DISC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_CHIEF015, OVE_DATA002, OVE_DATA015, OVE_DATA017, OVE_DEC005, OVE_DISC006, OVE_DISC010, OVE_NOTIF004, OVE_PERM008, OVE_PERM020, OVE_PROV035]
soft_depends_on: ["OVE_DISC005"]
provides: ["usecase:discussion.resolve-deadlock"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:BudgetService", "port:OwnerRuleChecker", "port:ProjectDocResolver", "usecase:escalation.raise", "usecase:decision.record", "port:NotificationPublisher"]
owns: ["packages/application/src/discussion/deadlock/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 16, 8]
---

# OVE_DISC011: Resolve deadlocks: Chief rules within Budget, Docs and Rules, otherwise Escalation

## 1. Summary

When the round limit is reached without consensus, decide what happens: Chief rules only if the ruling fits the Budget, Project Documentation and Owner Rules and the question is a "how"; otherwise Escalate to the Owner. The ruling is recorded as a Decision containing each side's arguments.

## 2. Context

SPEC 6 and ADR 0015: no agreement after the round limit -> Chief decides if within Budget, Documentation and Rules, else Escalation; the ruling goes to the Decision Register with the arguments of all sides. ADR 0016: a gap about "how" Chief decides itself; about "what" it always goes to the Owner. Mock text: `Brak porozumienia po 4 rundach: Chief rozstrzyga w granicach Budżetu i Dokumentacji albo przekazuje Tobie.` SPEC 16 criterion 6: deadlock is settled by Chief and recorded as a Decision with the sides' arguments.

## 3. Scope (in)

- Deadlock handler: gather arguments, call `ChiefArbiter`, VERIFY claims with code, then rule (record Decision, create outcome) or escalate.

## 4. Out of scope

- The arbiter implementation (CHIEF). Decision storage: DEC. Outcome finalisation and Tasks: DISC012. The Owner's resolution of an Escalation: PERM/WFRT UI.

## 5. Detailed requirements

1. **Trigger:** the engine reaches `deadlock` (DISC006) or Owner `concludeNow` without consensus (DISC009); status `deadlocked`.
2. **Eligibility gates (all code, none from model claims), any failure -> Escalation:**
   a. `discussion.question === 'how'` (a `what` question always goes to the Owner, ADR 0016);
   b. Budget: `BudgetService.check` shows remaining Budget for the Run/Workspace and for the work the outcome implies (Task count x configured estimate, ASSUMPTION) otherwise `budget`;
   c. Documentation: the ruling must cite >= 1 `docRef` that `DocRefVerifier`/`ProjectDocResolver` resolves in this Workspace (cites must exist; semantic consistency cannot be machine-proven, so it is recorded as "Chief's claim" in the Decision `assumptions`), and Task drafts need docRefs anyway;
   d. Owner Rules: `OwnerRuleChecker.evaluate({ proposal summary, selected option, task drafts })` must return `compliant` (not `violates` or `unknown`; `unknown` escalates);
   e. the Owner did not already vote (an Owner vote bypasses this whole path);
   f. Chief ruling count for this Discussion is 1 (no re-ruling loops).
3. **Arguments pack:** for every participant its LAST stance and a bounded summary of its arguments built from stored messages (stance, label, up to 800 chars of its latest message text, `skillsUsed`) plus dissent conditions; passed to the arbiter as data (DISC005 `ruling` template).
4. **Ruling path:** the arbiter's `ChiefRuling` is parsed strictly; `selectedOptionKey` must exist in options or `alternativeProposal` (text) is stored as a new option `chief_alternative`; the use case records a `chief_ruling` message and a Decision draft `DecisionProposal` via `usecase:decision.record` with: `alternatives` = all options with each side's arguments (participant, stance, argument summary), `selectedOption`, `rationale` (Chief's, plus the list of dissenters), `participants` (all, Chief as decider), `skillsUsed` (union with versions from the transcript), `assumptions` including "ruled by Chief after N rounds without consensus", `evidenceRefs: discussion:<id>` + cited docs, `confidence` capped at 0.6 (ASSUMPTION) for rulings, `status: 'accepted'` only for `how` rulings within autonomy else `proposed`.
5. **Escalation path:** `usecase:escalation.raise({ kind: 'discussion_deadlock', discussionId, reasons: [...], argumentsDigest })`; status `escalated`; the branch stays paused. When the Owner resolves the Escalation by deciding, `usecase:discussion.apply-escalation-decision` (exported here, Owner caller only) records `resolution: 'owner_decided'` on a new outcome revision and moves `escalated -> concluded` through DISC002's single Owner-guarded transition, then runs DISC012 finalisation.
6. **Owner notification** in both paths (`ruling_made` with a link, or `escalation`). The Owner can still change the outcome afterwards by superseding the Decision (DEC).
7. **Audit** `discussion.deadlock_resolved` with path, gates results (booleans) and ids.
8. **Idempotent:** re-running after crash detects an existing ruling message or Decision (by `draftKey = 'ruling'`) and does nothing.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`ChiefArbiter` port (DISC003), `DocRefVerifier` (BOARD006), `usecase:decision.record` (DEC), `BudgetService`, escalation use case, prompts (DISC005).

## 8. Architecture and code placement

`packages/application/src/discussion/deadlock/{resolve-deadlock.ts,eligibility.ts,arguments-pack.ts,ruling-to-decision.ts,apply-escalation-decision.ts}`. Pure gates with ports; no model text affects gates.

## 9. Security and safety

Chief's authority is bounded by code: a model that claims `assertsWithinBudget: true` or "consistent with Documentation" is checked against Budget and docRef resolution; Owner Rules compliance comes from `OwnerRuleChecker`, never from model words; "what" questions and unknown rule status always escalate (fail closed). A single ruling per Discussion prevents loops. The recorded Decision preserves every side's arguments so the Owner can audit and supersede it (ADR 0008). Argument texts are untrusted data inside fenced blocks when shown to Chief.

## 10. Errors and edge cases

- Arbiter unavailable or invalid JSON: Escalation `arbiter_unavailable`.
- Ruling cites a docRef that does not exist: Escalation (gate c).
- Budget check exactly at limit: treated as not enough (strict).
- Options empty (open question): Chief may propose an `alternativeProposal`; gate d still applies.
- Owner votes while the arbiter is running: the vote wins; the ruling result is discarded (version conflict).

## 11. Acceptance criteria

- [ ] A `how` deadlock within Budget with a valid cited docRef and compliant Rules is ruled by Chief and stored as a Decision containing all sides' arguments, skills with versions and the discussion reference.
- [ ] `what` questions always escalate.
- [ ] False `assertsWithinBudget` with exhausted Budget escalates.
- [ ] Missing/invalid docRef, `violates` or `unknown` rule status escalate.
- [ ] Re-run after a crash creates no second ruling or Decision.
- [ ] Owner vote during the ruling overrides it.

## 12. Test plan

- `eligibility.test.ts` (gate table), `resolve-deadlock.test.ts` with `FakeChiefArbiter` scripted lies, `ruling-to-decision.test.ts` (Decision content), idempotency test. Commands: `pnpm vitest run packages/application/src/discussion/deadlock`.

## 13. Parallelization notes

Depends on DEC `usecase:decision.record` (capability); use a fake in tests.

## 14. Open questions and assumptions

- ASSUMPTION: Task-count Budget estimate and ruling confidence cap 0.6.
- ASSUMPTION: the escalation is resolved by the Owner through the Escalation flow (PERM/WFRT UI), which calls `apply-escalation-decision`.
