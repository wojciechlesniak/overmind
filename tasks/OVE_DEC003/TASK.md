---
id: OVE_DEC003
title: "Define Decision ports, in-memory fakes, builders and repository contract suites"
area: DEC
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DEC001, OVE_DEC002, OVE_TEST002, OVE_TEST003]
soft_depends_on: ["OVE_TEST003"]
provides: ["port:DecisionRepository", "port:DecisionEventRepository", "port:DecisionSearchIndex", "port:DecisionReadModel", "lib:decision-fakes", "lib:decision-builders", "lib:decision-contract-suites", "port:DecisionReader"]
needs: ["port:UnitOfWork", "lib:test-utils", "lib:builders", "lib:contract-test-harness", "lib:fake-clock"]
owns: ["packages/application/src/ports/DecisionRepository.ts", "packages/application/src/ports/DecisionEventRepository.ts", "packages/application/src/ports/DecisionSearchIndex.ts", "packages/application/src/ports/DecisionReadModel.ts", "packages/testing/src/fakes/InMemoryDecisionRepository.ts", "packages/testing/src/fakes/InMemoryDecisionEventRepository.ts", "packages/testing/src/fakes/InMemoryDecisionSearchIndex.ts", "packages/testing/src/builders/decision.builder.ts", "packages/testing/src/contracts/DecisionRepository.contract.ts", "packages/testing/src/contracts/DecisionEventRepository.contract.ts", "packages/testing/src/contracts/DecisionSearchIndex.contract.ts", "packages/testing/src/helpers/authorised-set.stub.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 15]
---

# OVE_DEC003: Define Decision ports, in-memory fakes, builders and repository contract suites

## 1. Summary

Define the Decision Register ports, in-memory fakes (including a simple scored text index that mimics FTS ranking order), builders and contract suites that the SQLite adapter must also pass.

## 2. Context

Same ports-and-fakes approach as BOARD003/DISC003. The Register has no update or delete on the record port, which makes ADR 0008 a type-level property. The search index port hides FTS5 so a vector or hybrid index can be added later (SPEC 10 PROPOSED: SQLite FTS now, hybrid later).

## 3. Scope (in)

- Ports, fakes, builders, suites.

## 4. Out of scope

- SQLite and FTS5: OVE_DEC004 and OVE_DEC007. Search services: DEC008/009.

## 5. Detailed requirements

1. **DecisionRepository:** `insert(decision, tx?)` (assigns `seq`; rejects duplicate `(workspaceId, sourceKey)` with `dec.duplicate_source_key` carrying the existing id), `get(id)`, `getForWorkspace(wid, id)` (foreign -> not found), `getMany(ids)`, `findBySourceKey(wid, key)`, `listByWorkspace(wid, { cursor, limit })`, `deleteAllForWorkspace(tx, workspaceId)` (cascade participant only, OVE_DEC013). NO `update`/`delete` for single records (type test).
2. **DecisionEventRepository:** `append(event, tx?)` (gapless per-decision `seq`; unique `(decisionId, kind, dedupeKey)` when `dedupeKey` present -> returns the existing event as idempotent success), `list(decisionId)`, `listForDecisions(ids)` (batch for projections), `latestOfKind(decisionId, kind)`. No update/delete.
3. **DecisionSearchIndex:** `index(decision)` (called inside the insert transaction by the adapter; the port exists for the fake and for later vector backends), `search(q: IndexQuery, allowed: AuthorisedWorkspaceSet): Array<{ decisionId, score, matchedFields }>` where `AuthorisedWorkspaceSet` is the branded type produced only by the scope policy (`lib:memory-scope-policy`, OVE_MEM002): the index cannot be queried without it (type-level enforcement of the isolation rule).
4. **DecisionReadModel:** `list(query: DecisionQuery, allowed: AuthorisedWorkspaceSet) -> DecisionSummary[]`, `get(id, allowed) -> DecisionView | null`, `history(id, allowed) -> DecisionEvent[]`, `getRefs(ids, allowed) -> DecisionRef[]` (workspace name null when not visible).
5. **Fakes** keep Maps, replicate uniqueness/seq/dedupe, expose `failNext`, never offer edits; the fake index scores by term frequency over title/problem/context/rationale/alternatives with a deterministic tie-break `(score desc, createdAt desc, id)`.
6. **Builders:** `aDecision({ seq: 14, workspace: 'rezerwacje', selected: 'date-fns' })` with the three mock alternatives (`date-fns`, `moment`, `Temporal API`), `aDecisionEvent.verdict('positive')`, `aSupersedingDecision(old)`; schema validated.
7. **Contract suites:** gapless seq; sourceKey idempotency; event dedupe; no mutation API; foreign Workspace not found; deterministic list order; search never returns Workspaces outside the authorised set (two-Workspace fixture incl. an isolated one); purge removes only the target Workspace.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

TEST002 builders/clock; TEST003 harness; `AuthorisedWorkspaceSet` from OVE_MEM002 (capability `lib:memory-scope-policy`): do not define a second isolation type.

## 8. Architecture and code placement

Ports in `packages/application/src/ports/`, fakes/builders/suites in `packages/testing`.

## 9. Security and safety

The search and read ports REQUIRE an `AuthorisedWorkspaceSet`; there is no overload without it, so the cross-Workspace privacy rule is structural: forgetting to filter is a compile error. No mutation methods exist for records and events. Fakes behave the same so tests do not pass for the wrong reason.

## 10. Errors and edge cases

- Event append for a missing Decision: `dec.not_found`.
- `search` with an empty authorised set: empty result.
- Cursor pagination stable under inserts (cursor is `(createdAt, id)`).

## 11. Acceptance criteria

- [ ] Ports compile; fakes pass the suites.
- [ ] No mutating method for records/events (type tests); search ports require the authorised set (type test using `// @ts-expect-error`).
- [ ] Isolation suite: an isolated Workspace's Decisions never appear for a caller whose set excludes it.
- [ ] Builders reproduce the mock D-14 and D-03.

## 12. Test plan

- Contract suites on fakes, builder tests, type tests. Commands: `pnpm vitest run packages/testing`.

## 13. Parallelization notes

Needs OVE_MEM002 for the branded set type; if not merged, use the stub type exported from `packages/testing/src/helpers/authorised-set.stub.ts` (owned here, removed after MEM002).

## 14. Open questions and assumptions

- ASSUMPTION: read-model and index ports live with repositories to keep DEC small.
