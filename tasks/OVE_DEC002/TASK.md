---
id: OVE_DEC002
title: "Implement Decision rules in the domain: transitions, supersede, projection and uncertainty"
area: DEC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_DEC001]
soft_depends_on: []
provides: ["lib:decision-domain", "lib:decision-projection"]
needs: ["contract:Decision", "contract:DecisionEvent", "contract:DecisionView", "lib:result", "lib:error-catalogue"]
owns: ["packages/domain/src/decision/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 15, 16]
---

# OVE_DEC002: Implement Decision rules in the domain: transitions, supersede, projection and uncertainty

## 1. Summary

Implement the pure rules of the Decision Register: who may do what in which status, the status transition table, supersede validation, the fold from immutable record plus events to the current `DecisionView`, evidence rules for outcomes, and deterministic uncertainty computation for similar-Decision answers.

## 2. Context

ADR 0008: append-only, supersede instead of overwrite, Chief proposes the Outcome with evidence and the Owner issues the verdict (changeable, history kept), never grade without evidence. ADR 0015/0016: Chief decides "how" within autonomy and records it; "what" goes to the Owner. All state changes after creation are events, so current state is a fold, which makes tampering visible and tests simple.

## 3. Scope (in)

- `foldView(decision, events)`, `canTransition`, `applyStatusChange`, `validateSupersede`, `validateOutcomeProposal`, `applyVerdict`, `confidenceLabel`, `computeUncertainty`, `effectiveReviewDate`, authorisation matrix data.

## 4. Out of scope

- Persistence: DEC004. Orchestration: DEC005/006. Search ranking: DEC007-009.

## 5. Detailed requirements

1. **Status table:** `proposed -> accepted | rejected`; `accepted -> needs_review | superseded`; `needs_review -> accepted | superseded`; `rejected` and `superseded` terminal. `superseded` is reachable only through `validateSupersede` + a `superseded` event written together with the new Decision (never by a bare status change request). Invalid pair: `dec.invalid_transition`.
2. **Authorisation matrix (data):** record as `proposed`: owner, chief, agent (typed proposal from the overmind Skill), system; record as `accepted`: owner, chief (only when `origin.kind` is `chief` or `discussion` with a `how` question within autonomy, ADR 0015; the use case passes `withinAutonomy: boolean` from DISC/CHIEF), system on behalf of Chief; `accept/reject` a proposed Decision: owner, chief for `how` within autonomy; `needs_review`: system, chief, owner; re-accept from `needs_review`: owner, chief; supersede: owner (any), chief (only within the same Workspace and only Decisions that are `needs_review` or `accepted` with a recorded negative outcome proposal evidence; cross-Workspace supersede is owner-only, `dec.supersede_forbidden`); outcome proposal: chief, system; verdict: owner only (desktop; Telegram not allowed, ASSUMPTION); evidence added: chief, owner, system. Agents can never change status or outcome.
3. **Supersede validation** (`validateSupersede(old, oldView, new, ctx)`): old exists, old status in (`accepted`, `needs_review`) (`proposed` Decisions are rejected or re-proposed, not superseded); old not already superseded (`dec.already_superseded`); same Workspace unless owner-initiated and both Workspaces non-isolated and visible (`ctx.crossWorkspaceAllowed`), else `dec.supersede_target_invalid`; new Decision must differ in `selectedOption` or rationale (ASSUMPTION: no-op supersedes rejected); a chain cannot loop (new's `supersedesId` chain never reaches itself).
4. **Fold:** `foldView(decision, events[])` processes events by `seq`: `status_changed` sets status (validated against the table, invalid sequences logged and skipped, never applied); `superseded` sets `supersededBy` and status `superseded`; `outcome_proposed` sets `outcomeProposal` (cleared when a later verdict is issued); `outcome_verdict` sets `outcome`; `evidence_added` appends; `review_date_set` overrides `reviewDate`. The fold is a pure function (same input -> same output) and tolerant of unknown kinds.
5. **Outcome evidence rule:** `validateOutcomeProposal`: outcome `unknown` needs none; `positive|mixed|negative` need >= 1 evidence ref of kind `artifact`, `run`, `task` or `doc` (not `url` alone, ASSUMPTION: a bare URL is not evidence Overmind can verify); the proposer must be chief or system. `applyVerdict`: owner only; allowed any time and any number of times (history retained); a verdict on a `rejected` Decision is allowed (outcome of not doing it is rarely meaningful but not forbidden); verdict without evidence is accepted but the view marks `verdictWithoutEvidence: true` (the Owner's prerogative, ADR 0008) .
6. **Uncertainty** `computeUncertainty(view, ctx: { similarity: number, now, currentContextHints })`: reasons added deterministically: outcome `unknown` -> `outcome_unknown`; outcome known but `outcomeEvidence` empty -> `no_outcome_evidence`; `similarity < 0.5` -> `low_similarity`; older than 18 months -> `old_decision` (ASSUMPTION); status `superseded` -> `superseded`; outcome `mixed` -> `mixed_outcome`; `confidence < 0.4` -> `low_confidence`; level = `high` if >= 3 reasons or any of (`outcome_unknown` with `no_outcome_evidence`), `medium` if 1-2, `low` if none. `assessment = 'evidence_backed'` only when outcome is known AND evidence non-empty; otherwise `not_assessed` (the finder must say "no verdict" and never present a grade).
7. **Review date:** `effectiveReviewDate(view)`; default when accepting without a date: acceptance date + 30 days (ASSUMPTION), applied by DEC005 through a `review_date_set` event.
8. All functions pure; time injected.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Contracts (DEC001), `Result`/errors. This module is the only place with the status table and uncertainty rules (UI reads results, never recomputes).

## 8. Architecture and code placement

`packages/domain/src/decision/{status.ts,authz.ts,supersede.ts,fold.ts,outcome.ts,uncertainty.ts,review.ts}`. Imports contracts only.

## 9. Security and safety

The rules encode the ADR 0008 guarantees in code: no function edits a record, outcomes need evidence, only the Owner issues verdicts, agents cannot accept or supersede, cross-Workspace supersede is owner-only and never for isolated Workspaces. The fold ignores invalid event sequences so a corrupted history cannot yield a forbidden state. Uncertainty is deterministic so a model cannot talk its way into a confident answer.

## 10. Errors and edge cases

- Concurrent events with equal timestamps: ordered by `seq`.
- Verdict then new Chief proposal: proposal shown as pending until Owner re-affirms; the verdict stays current.
- Supersede target in a deleted Workspace: invalid target.
- Fold of 10 000 events: linear time.

## 11. Acceptance criteria

- [ ] Exhaustive transition matrix test; supersede cases (same Workspace, cross-Workspace by owner, by chief refused, already superseded, loop).
- [ ] Outcome proposals without evidence rejected; verdict by non-owner rejected.
- [ ] Fold reproduces the mock D-14 view (accepted, proposal `positive` with 2 evidence, review date 2026-11-10, supersedes D-03).
- [ ] Uncertainty levels and reasons match the table; `assessment` is `not_assessed` without evidence.
- [ ] Fold ignores an invalid event sequence (test).

## 12. Test plan

- `packages/domain/src/decision/*.test.ts`, property test: folding any event prefix keeps status table validity. Commands: `pnpm vitest run packages/domain/src/decision`.

## 13. Parallelization notes

Parallel with DEC003 after DEC001. Hotspot: `authz.ts`, `status.ts` owned here.

## 14. Open questions and assumptions

- ASSUMPTION: verdicts are desktop-owner only; Telegram can read.
- ASSUMPTION: no-op supersedes rejected; 30-day default review; 18-month age threshold.
