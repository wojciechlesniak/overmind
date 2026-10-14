---
id: OVE_DEC006
title: "Manage Decision Outcome: Chief proposals with evidence, Owner verdicts, history"
area: DEC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DATA018, OVE_DEC005, OVE_NOTIF004, OVE_PERM008, OVE_PERM020]
soft_depends_on: []
provides: ["usecase:decision.propose-outcome", "usecase:decision.set-verdict", "usecase:decision.collect-evidence-candidates"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:ArtifactRepository", "port:NotificationPublisher"]
owns: ["packages/application/src/decision/outcome/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 15]
---

# OVE_DEC006: Manage Decision Outcome: Chief proposals with evidence, Owner verdicts, history

## 1. Summary

Implement the Decision Outcome lifecycle: Chief (or the system) proposes an Outcome only with evidence, the Owner issues the verdict and can change it at any time, every step is an event, and the current Outcome is derived. Never grade without evidence.

## 2. Context

SPEC 10 and ADR 0008: Chief continuously collects evidence and proposes the Outcome; the Owner issues the verdict and may change it later, history stays; Chief must not assess a Decision without evidence (SPEC 3 'Wiedza'). Mock: box `WYNIK DECYZJI · Chief proponuje: pozytywny · przegląd 2026-11-10`, `Dowody: bundle 41 KB zamiast 271 KB, 0 błędów stref w 112 testach jednostkowych.` with chips `bundle-report.json`, `unit-report.xml`, and `Twój werdykt: pozytywny / mieszany / nieznany / negatywny`.

## 3. Scope (in)

- `proposeOutcome`, `setVerdict`, evidence candidate collection helper for Chief, notifications.

## 4. Out of scope

- Chief's reasoning on what evidence means: CHIEF. Review scheduling: DEC010. UI: DECUI.

## 5. Detailed requirements

1. **proposeOutcome({ decisionId, outcome, evidence: EvidenceRef[], rationale, confidence? }, actor)**: actor chief or system; Decision status must be `accepted` or `needs_review` (a `proposed`/`rejected` Decision has no outcome); evidence verified by `ArtifactEvidenceVerifier` (DEC005) and DEC002 `validateOutcomeProposal` (>= 1 evidence of artifact/run/task/doc kind for non-`unknown`); `rationale` is data (<= 1500). Appends `outcome_proposed` (event + outbox); the current Outcome does not change; the view shows `Chief proposes: <outcome>`. Repeated identical proposal (same outcome + evidence set) is idempotent via `dedupeKey = sha256(outcome|sorted evidence)`. A new proposal replaces the displayed one.
2. **setVerdict({ decisionId, outcome, note?, evidence? }, actor)**: owner on desktop only; any outcome including `unknown` (resetting is allowed); appends `outcome_verdict`; the view's current `outcome` is the latest verdict; the previous value is in the event (`previous`) and history; a verdict without evidence is accepted and flagged `verdictWithoutEvidence` in the view. Verdict is allowed for `accepted`, `needs_review` and `superseded` Decisions (the outcome of the old choice, e.g. D-03 `negative`, is what justified the replacement).
3. **Chief evidence collection helper** `collectEvidenceCandidates(decisionId)` (read only; invoked by Chief jobs): returns candidate Artifacts of the Decision's Workspace created after the Decision (test reports, bundle reports) and linked Tasks' evidence refs (BOARD `evidence_added` payloads via a read port), with checksums, so Chief proposes with real references. It never reads file contents and never calls models.
4. **Notifications:** Owner is notified when Chief proposes (`decision_outcome_proposed`, once per distinct proposal) so the verdict is not forgotten; the notification text is a template with the Decision title (truncated) only.
5. **Review loop:** an Outcome proposal on a `needs_review` Decision does not change status; the Owner (or Chief with a proposal) re-accepts (DEC005) after reviewing.
6. **History:** `outcomeHistory(decisionId)` returns proposals and verdicts in order with actors, for the detail UI timeline (`DecisionReadModel.history`).
7. **Constraints:** at most 20 outcome proposals per Decision (flood guard, `dec.rate_limited`).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DEC002 rules, DEC005 verifier, outbox, NOTIF.

## 8. Architecture and code placement

`packages/application/src/decision/outcome/{propose-outcome.ts,set-verdict.ts,evidence-candidates.ts,history.ts}`.

## 9. Security and safety

Abuse: an Agent or injected Chief flips an Outcome to `positive` to promote its favourite choice, or fabricates evidence. Defences: only Chief/system may propose and the proposal needs verified same-Workspace evidence; proposals never change the current Outcome; only the authenticated desktop Owner issues verdicts (Telegram cannot); evidence refs are verified Artifacts with checksums; proposal rationale is untrusted display text; all changes are append-only and audited; flooding is capped.

## 10. Errors and edge cases

- Proposal with artifact from another Workspace: `dec.evidence_forbidden`.
- Verdict on a `proposed` or `rejected` Decision: refused (`dec.invalid_transition`); status must be accepted, needs_review or superseded.
- Owner sets `unknown` after `negative`: allowed; history keeps both.
- Evidence artifact removed later: reference remains with `unavailable` marker in the view.

## 11. Acceptance criteria

- [ ] Proposal without evidence for non-`unknown` is rejected (`dec.outcome_without_evidence`); proposal does not change the current Outcome.
- [ ] Only owner (desktop) can set a verdict; chief, agent, system and Telegram are refused and audited.
- [ ] Verdict can be changed repeatedly; the history lists all proposals and verdicts.
- [ ] The Owner is notified once per distinct proposal.
- [ ] Evidence candidates are same-Workspace only.
- [ ] 21st proposal is refused.

## 12. Test plan

- `propose-outcome.test.ts`, `set-verdict.test.ts`, `evidence-candidates.test.ts`, `history.test.ts`. Commands: `pnpm vitest run packages/application/src/decision/outcome`.

## 13. Parallelization notes

Parallel with DEC007-010 after DEC005.

## 14. Open questions and assumptions

- ASSUMPTION: verdict desktop-only; max 20 proposals per Decision.
