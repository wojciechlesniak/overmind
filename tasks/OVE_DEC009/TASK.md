---
id: OVE_DEC009
title: "Find similar past Decisions with evidence, Outcome and uncertainty, never graded blindly"
area: DEC
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DEC003, OVE_DEC006, OVE_DEC008, OVE_MEM002, OVE_PERM008, OVE_PERM020]
soft_depends_on: []
provides: ["usecase:decision.find-similar"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "lib:memory-scope-policy", "port:DecisionSearchIndex"]
owns: ["packages/application/src/decision/similar/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 14]
---

# OVE_DEC009: Find similar past Decisions with evidence, Outcome and uncertainty, never graded blindly

## 1. Summary

Implement the "knowledge" scenario: given a new problem, find similar past Decisions across allowed Workspaces and present for each the alternatives, rationale, evidence, Outcome and an explicit uncertainty, never presenting a judgement when there is no evidence.

## 2. Context

SPEC 3 'Wiedza': in a new project Chief finds a similar Decision in another (non-isolated) Workspace and shows alternatives, rationale, evidence, Decision Outcome and uncertainty, and does not grade a Decision without evidence. ADR 0008: Chief cites sources and uncertainty. Mock D-14 rationale: `Podobna Decyzja D-03 w „Stronie fundacji” wybrała moment i dostała wynik negatywny: bundle +230 KB i błędy stref czasowych.`

## 3. Scope (in)

- `findSimilar(problemText, options, ctx)`: candidate retrieval via FTS, ranking, filtering, result assembly with deterministic uncertainty, caveats.

## 4. Out of scope

- How Chief words the answer: CHIEF. Vector/hybrid index: later (port `DecisionSearchIndex` allows it).

## 5. Detailed requirements

1. **Input:** `{ problem: 1..2000, alternatives?: string[], tags?: string[], currentWorkspaceId, limit?: <= 10 (default 5), includeSuperseded?: boolean (default true) }`; context from DEC008 (authorised set).
2. **Retrieval:** sanitised query from `problem` + alternative titles + tags (top 12 distinctive terms by IDF-like weighting over the query itself, no model); FTS over the authorised set; candidates limited to 50.
3. **Scoring** (deterministic): `similarity = 0.6 * normalisedBm25 + 0.25 * alternativesOverlap (Jaccard over lower-cased alternative titles) + 0.15 * tagOverlap`; threshold 0.25 (below -> dropped); ties by recency. `matchedOn` lists fields that matched.
4. **Result per candidate** (`SimilarDecisionResult`): summary, alternatives (key/title), `selectedOption`, `rationale` (<= 600 chars), `outcome` (current verdict), `outcomeEvidenceCount`, `assessment` and `uncertainty` from DEC002 `computeUncertainty` with the similarity, `caveats` (strings generated from reasons by template, e.g. "Outcome not yet judged", "Decision was later superseded by D-14", "Different Workspace: context may differ"). `assessment = 'not_assessed'` whenever outcome is `unknown` or there is no outcome evidence: the result then carries NO statement about whether the choice was good (the field `outcome` is shown as `unknown`, and no score about quality exists).
5. **Superseded handling:** superseded Decisions are included (they carry the lesson) but marked and linked to their successor.
6. **Ranking safety:** a Decision with `positive` verdict does NOT outrank a more similar one merely for being positive (similarity only); outcome is information, not a ranking boost (prevents survivorship bias; ASSUMPTION).
7. **No model call:** the finder is deterministic code; Chief receives structured results and phrases the answer with the assembler. Uncertainty and caveats are included in the data so the phrasing cannot drop them (Chief's prompt template requires quoting them: SEC004/CHIEF).
8. **Scope:** only authorised set; cross-Workspace use audited by DEC008's wrapper; results from the current Workspace are labelled `sameWorkspace: true`.
9. **Audit** via DEC008 `purpose: 'similar_problem'`.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DEC007 FTS + sanitiser, DEC008 context/audit, DEC002 uncertainty. No duplicate scoring code in CHIEF.

## 8. Architecture and code placement

`packages/application/src/decision/similar/{find-similar.ts,query-terms.ts,scoring.ts,result.ts}`. Pure with ports.

## 9. Security and safety

Retrieved Decisions are historical data from other projects and may contain adversarial text (a past Agent proposal); returned fields are data for prompts (callers fence them). Isolation is inherited from the authorised set. The "never grade without evidence" rule is structural (`assessment` and null quality fields) to prevent the model from asserting an unearned conclusion. No secrets are stored in Decisions by construction (redaction at record, SEC003), but the finder runs the redactor on outputs as a second line.

## 10. Errors and edge cases

- No candidates: empty list with `reason: 'no_similar_found'`.
- Candidate in a deleted Workspace: not present.
- Very short problem text: requires >= 3 distinctive terms else `validation.invalid_input`.
- All candidates `unknown` outcome: all `not_assessed`, `high` uncertainty.

## 11. Acceptance criteria

- [ ] The mock scenario (new project date library problem) finds D-03 (negative, with evidence) and D-14 and presents outcomes, evidence counts and uncertainty.
- [ ] Decisions without outcome evidence are `not_assessed` and carry no quality statement.
- [ ] Isolated Workspace Decisions never appear for Chief outside that Workspace.
- [ ] Superseded Decisions appear with successor link and caveat.
- [ ] Ranking ignores Outcome (a positive dissimilar Decision does not outrank a similar neutral one).
- [ ] Deterministic: same inputs give the same order.

## 12. Test plan

- `scoring.test.ts`, `find-similar.test.ts` with fake index and fixtures from the mock, privacy cases, determinism test. Commands: `pnpm vitest run packages/application/src/decision/similar`.

## 13. Parallelization notes

Parallel with DEC010/011.

## 14. Open questions and assumptions

- ASSUMPTION: weights 0.6/0.25/0.15 and threshold 0.25; tune with real data.
