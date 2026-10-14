---
id: OVE_DEC001
title: "Define Decision contracts: record, events, projection, outcome, search and errors"
area: DEC
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH008, OVE_ARCH010, OVE_PERM008]
soft_depends_on: []
provides: ["contract:Decision", "contract:DecisionProposal", "contract:DecisionEvent", "contract:DecisionView", "contract:DecisionSummary", "contract:SimilarDecisionResult", "event:decision.recorded", "event:decision.status.changed", "event:decision.outcome.proposed", "event:decision.outcome.verdict_set", "event:decision.review_due", "contract:DecisionErrors"]
needs: ["lib:define-event", "contract:EventEnvelope", "contract:Actor"]
owns: ["packages/contracts/src/decision/**", "packages/contracts/src/events/decision.*.event.ts", "packages/contracts/src/errors/dec.errors.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 14, 15, 16, 28]
---

# OVE_DEC001: Define Decision contracts: record, events, projection, outcome, search and errors

## 1. Summary

Define, as zod schemas, the Decision entity with every field of SPEC section 10, the append-only event that carries all later changes (status, evidence, outcome proposals, verdicts), the derived `DecisionView` projection, list/search shapes, events and `dec.*` error codes. Everything in DEC and the Decisions UI builds on these.

## 2. Context

SPEC 10 and ADR 0008: the Decision Register is append-only; a Decision is never deleted or overwritten, a new Decision supersedes an old one (`supersedesId`); Chief gathers evidence and proposes the Decision Outcome, the Owner issues the verdict and may change it, history stays. Fields: `title, problem, context, alternatives[], selectedOption, rationale, participants[], evidenceRefs[], assumptions[], risks[], skillsUsed[] (with versions), workspaceId, runId, createdAt, reviewDate, outcome, outcomeEvidence[], confidence, status, supersedesId`; statuses `proposed, accepted, rejected, superseded, needs_review`; outcome `unknown, positive, mixed, negative`. Chief never grades without evidence; Chief searches Decisions across all non-isolated Workspaces (isolated shares nothing). Mock `Decyzje.png`: list rows `D-14 przyjęta · wynik: pozytywny`, filters (`Wszystkie Workspace'y`, `Status: każdy`, `Wynik: każdy`), detail with problem, three alternative cards (chosen one marked `wybrana`), rationale, participants, skills, `Pewność · średnia · 0,7`, assumptions, risks, the box `WYNIK DECYZJI Chief proponuje: pozytywny · przegląd 2026-11-10` with evidence chips (`bundle-report.json`, `unit-report.xml`) and `Twój werdykt` buttons, `Zastępuje: D-03 · ... (Strona fundacji)`, `Zastąp nową Decyzją`.

## 3. Scope (in)

- zod schemas (one file per entity) in `packages/contracts/src/decision/`: `decision.ts`, `proposal.ts`, `alternative.ts`, `evidence-ref.ts`, `decision-event.ts`, `decision-view.ts`, `decision-summary.ts`, `search.ts`, `similar.ts`, `ids.ts`.
- Event definitions and error codes.

## 4. Out of scope

- Rules/state machine: OVE_DEC002. Persistence: OVE_DEC004. Use cases: DEC005+. UI: DECUI.

## 5. Detailed requirements

1. **Ids:** `DecisionId = EntityId<'dec'>`, `DecisionEventId = EntityId<'dev'>`; `seq: int` per Workspace (label `D-14`), assigned by the repository, never reused.
2. **Decision** (immutable record, strict): `{ id, seq, workspaceId, runId?: RunId, title 1..160, problem 1..4000, context: string <= 4000, alternatives: Alternative[1..8], selectedOption: string (an `alternatives[].key`), rationale 1..4000, participants: Array<{ kind: 'chief'|'agent'|'owner', id?: AgentId, displayName }> (1..12), evidenceRefs: EvidenceRef[0..30], assumptions: string[0..10] (each <= 500), risks: string[0..10] (each <= 500), skillsUsed: Array<{ skillId, name, version }> (0..20), createdAt, reviewDate?: IsoDate, confidence: number 0..1, initialStatus: 'proposed'|'accepted'|'rejected', supersedesId?: DecisionId, origin: { kind: 'chief'|'discussion'|'owner'|'agent', discussionId?: DiscussionId, byActor: Actor }, sourceKey?: string <= 120 (idempotency key, unique per Workspace: `discussion:<id>:<draftKey>`), tags?: string[0..8] (each /^[a-z0-9-]{1,32}$/, for search) }`.
3. **Alternative:** `{ key: /^[a-z0-9_]{1,32}$/, title 1..120, summary <= 800, pros?: string[<=5], cons?: string[<=5], arguments?: Array<{ participantId: 'chief'|AgentId|'owner', stance: 'for'|'against'|'neutral'|'conditional', text <= 1000 }> (each side's arguments, kept for deadlock rulings, ADR 0015) }`.
4. **EvidenceRef:** `{ kind: 'artifact'|'discussion'|'task'|'run'|'doc'|'decision'|'url', ref: string <= 300, label?: string <= 80, checksum?: string }`. `artifact` refs point to Artifacts (verified in DEC005), `doc` refs are Project Documentation paths (relative, no `..`), `url` is an opaque string without credentials that Overmind never fetches automatically; `decision` refs link to other Decisions (similar/related).
5. **DecisionStatus** and **Outcome** enums as in the SPEC (`proposed|accepted|rejected|superseded|needs_review`, `unknown|positive|mixed|negative`).
6. **DecisionEvent** (append-only): `{ id, decisionId, workspaceId, seq: int (per decision), at, actor: Actor, kind: 'status_changed' | 'superseded' | 'evidence_added' | 'outcome_proposed' | 'outcome_verdict' | 'review_date_set' | 'review_due' | 'note', payload (strict per kind), dedupeKey?: string, eventId?: EntityId<'evt'> }`. Payloads: `status_changed { from, to, reason <= 300 }`; `superseded { bySupersedingId }`; `evidence_added { evidence: EvidenceRef }`; `outcome_proposed { outcome: Outcome, evidence: EvidenceRef[] (>=1 unless outcome is 'unknown'), rationale <= 1500, confidence?: number }`; `outcome_verdict { outcome: Outcome, note?: <= 500, evidence?: EvidenceRef[] }`; `review_date_set { reviewDate: IsoDate, reason? }`; `review_due { reviewDate }`.
7. **DecisionView** (projection, never stored as truth): `Decision` fields plus `status` (current), `outcome` (current = latest `outcome_verdict`, else `unknown`), `outcomeProposal?: { outcome, evidence, rationale, proposedAt }` (latest proposal after the latest verdict, shown as `Chief proponuje: pozytywny`), `outcomeEvidence: EvidenceRef[]` (union of evidence in proposals/verdicts/evidence_added), `reviewDate` (latest `review_date_set` else original), `supersededBy?: DecisionRef`, `supersedes?: DecisionRef`, `lastEventAt`, `confidenceLabel: 'low'|'medium'|'high'` (derived: < 0.4 low, < 0.75 medium, else high; mock `średnia · 0,7`). `DecisionRef = { id, seq, title, workspaceId, workspaceName?: string | null (null when that Workspace was deleted or is isolated and not visible to the caller) }`.
8. **DecisionSummary** (list row): `{ id, seq, title, status, outcome, workspaceId, workspaceName, originLabelKey, createdAt }`.
9. **Search shapes:** `DecisionQuery { q?: string <= 200, workspaceId?, statuses?, outcomes?, tags?, cursor?, limit <= 100 }`; `SimilarDecisionResult { decision: DecisionSummary, matchedOn: string[], score: number 0..1, alternatives: {key,title}[], selectedOption, rationale, outcome, outcomeEvidenceCount: int, assessment: 'evidence_backed' | 'not_assessed', uncertainty: { level: 'low'|'medium'|'high', reasons: UncertaintyReason[] }, caveats: string[] }` with `UncertaintyReason = 'outcome_unknown' | 'no_outcome_evidence' | 'low_similarity' | 'old_decision' | 'superseded' | 'mixed_outcome' | 'context_differs' | 'low_confidence'`.
10. **Events** (persisted, `scope: 'workspace'`, `visibleTo: ['owner','channel']`; Chief and agents receive only through use cases): `decision.recorded {decisionId, seq, title, origin}`, `decision.status.changed {decisionId, from, to}`, `decision.outcome.proposed {decisionId, outcome}`, `decision.outcome.verdict_set {decisionId, outcome, previous}`, `decision.review_due {decisionId, reviewDate}`.
11. **Errors** (`dec.*`): `not_found` [404], `invalid_transition` [409], `selected_option_missing` [422], `evidence_required` [422], `evidence_not_found` [422], `evidence_forbidden` [403, audit], `supersede_forbidden` [403, audit], `supersede_target_invalid` [422], `already_superseded` [409], `outcome_without_evidence` [422], `verdict_forbidden` [403, audit], `history_immutable` [409, audit], `duplicate_source_key` [409], `search_scope_denied` [403, audit], `workspace_isolated` [403, audit], `version_conflict` [409, retryable], `rate_limited` [429].
12. All schemas strict, bounded, NFC normalised, control characters removed except `\n\t`. `DecisionProposal` = the input subset (`title, problem, context, alternatives, selectedOption, rationale, participants, evidenceRefs, assumptions, risks, skillsUsed, runId?, reviewDate?, confidence, supersedesId?, tags?, sourceKey?, origin`).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`defineEvent`, `defineErrors`, `EntityId`, `Actor`. `DecisionProposal` is imported by DISC001 (do not redeclare there).

## 8. Architecture and code placement

L0 `packages/contracts/src/decision/*.ts`, events and errors in the shared folders. No I/O.

## 9. Security and safety

Strict schemas stop smuggled fields; `url` evidence is opaque and never fetched; `doc` refs are relative; events carry ids and titles only (no rationale or arguments) so Telegram-visible events leak little; the model has no field to mark a Decision accepted except through use cases that check the actor; the confidence number is bounded; outcome proposals require evidence in the schema (refine) so "never grade without evidence" is structural.

## 10. Errors and edge cases

- `selectedOption` not among alternatives: refine fails (`dec.selected_option_missing`).
- `outcome_proposed` with outcome != unknown and empty evidence: refine fails.
- `reviewDate` earlier than `createdAt`: allowed in the schema; DEC005 rejects for new records.
- Alternative keys duplicated: refine fails.
- Older client receiving an unknown event kind: renders a generic row.

## 11. Acceptance criteria

- [ ] All schemas strict with JSON Schema snapshots; every field of SPEC 10 is present.
- [ ] Invalid fixtures rejected: missing selected option, duplicate keys, 9 alternatives, outcome proposal without evidence, `supersedesId` equal to own id format, bad tag.
- [ ] Events and errors registered per ARCH003/010 rules; `expectEventSafe` passes.
- [ ] `confidenceLabel` thresholds tested.

## 12. Test plan

- `packages/contracts/src/decision/*.test.ts` (table-driven), event tests, registry scan. Commands: `pnpm vitest run packages/contracts/src/decision packages/contracts/src/events`.

## 13. Parallelization notes

Merge first within DEC; DISC001 imports `DecisionProposal`. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: `alternatives` min 1 (a Decision with one option is allowed but flagged `thin` by read models); at most 8.
- ASSUMPTION: `confidence` is a number 0..1 (mock: `0,7`); label derived.
