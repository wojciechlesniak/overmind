---
id: OVE_VIS004
title: Create the visibility conformance suites that AGENT, SKILL and WFRT repositories must run
area: VIS
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST002, OVE_TEST003, OVE_VIS002, OVE_VIS003]
soft_depends_on: [OVE_TEST003]
provides: ["lib:visibility-conformance-suite", "lib:visibility-fixtures"]
needs: ["lib:contract-test-harness", "lib:builders"]
owns: ["packages/testing/src/visibility/conformance.ts", "packages/testing/src/visibility/fixtures.ts", "docs/testing/visibility-conformance.md"]
reads: ["packages/domain/src/visibility/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16.3"]
adr_refs: [28, 14, 3]
---

# OVE_VIS004: Create the visibility conformance suites

## 1. Summary

A parameterised test suite `visibilityConformance(adapter)` that every repository listing Agents, Skills or Workflows MUST instantiate. It proves that a Private item never appears outside its Workspace through any read path.

## 2. Context

Acceptance criterion 3: a Private Agent or Skill does not appear in another Workspace. The risk is a single forgotten filter (search, count, get-by-id). One shared suite, instantiated per area, makes the guarantee uniform. Each area task must list "runs visibility conformance" in its acceptance criteria.

## 3. Scope (in)

The suite, shared fixtures (three Workspaces including one isolated), adapter interface, documentation.

## 4. Out of scope

The repositories (AGENT003, SKILL, WFRT), UI filtering, usage checks (VIS005).

## 5. Detailed requirements

1. Adapter interface (implemented by each area in its test file):
   ```ts
   interface VisibilityTarget<T> {
     kind: 'agent'|'skill'|'workflow';
     create(fields: { name: string, visibility: 'public'|'private', ownerWorkspaceId?: string }): Promise<T & {id: string}>;
     list(scope: VisibilityScope, opts?): Promise<{id:string}[]>;
     get(scope: VisibilityScope, id: string): Promise<{id:string}|null>;
     search(scope: VisibilityScope, query: string): Promise<{id:string}[]>;
     count(scope: VisibilityScope): Promise<number>;
     setVisibility?(...)
     extraReadPaths?: Record<string, (scope, ctx) => Promise<{id:string}[]>>;   // e.g. suggestions, byAssignment
   }
   ```
2. Fixtures: Workspaces W1, W2, W3 (W3 isolated); items: `pub1` public, `priv1` private(W1), `priv2` private(W2), `privIso` private(W3, isolated).
3. Mandatory cases (each a named test): list in W1 shows pub1+priv1 only; in W2 pub1+priv2; in W3 pub1+privIso (isolated Workspace may use public items); get by id of priv1 from W2 returns null, indistinguishable from a random id (same result object and timing class); search for priv1's exact name from W2 returns nothing and the same count as a non-existing name; count totals exclude foreign private items; pagination totals identical; owner_management scope shows all four; missing scope throws; items with inconsistent data (private, no owner) invisible everywhere; after `setVisibility` public->private the item disappears from other Workspaces immediately and private->public appears; each `extraReadPaths` entry repeats the foreign-private checks.
4. Property test: random items and scopes; for any read path, the result set equals the in-memory `isVisible` filter of the full set.
5. Timing/size oracle guard: responses for foreign-private ids and missing ids are compared structurally (equal), not by timing.
6. The suite exports `describeVisibilityConformance(name, makeTarget)` and fails the area's CI when `extraReadPaths` is omitted for a repository that has FTS or suggestions (a check on a declared `readPaths` manifest in the adapter).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`describeContract` harness (TEST003), builders (TEST002), `isVisible` (VIS003) as the oracle.

## 8. Architecture and code placement

`packages/testing/src/visibility/`. Areas import and call it from their own `*.visibility.test.ts`.

## 9. Security and safety

The oracle is the pure predicate, so a repository bug cannot hide behind a shared implementation of the same bug. Negative controls: a deliberately leaky fake target is part of the suite's self-test and must fail it.

## 10. Errors and edge cases

Repositories without search: `search` omitted and the suite marks it skipped visibly (not silently passed). Case-insensitive names: query uses exact name variants.

## 11. Acceptance criteria

- [ ] Self-test: a leaky fake (no filter in `search`) fails the suite; a correct fake passes.
- [ ] Documentation explains how an area wires its repositories.
- [ ] The suite covers list, get, search, count, pagination and extra read paths.
- [ ] Property test replays 500 random scenarios.

## 12. Test plan

Self-tests inside `packages/testing`. `pnpm vitest run packages/testing/src/visibility`.

## 13. Parallelization notes

Areas wire it after their repositories exist; no edits here by them.

## 14. Open questions and assumptions

- ASSUMPTION: structural equality of "foreign-private" and "missing" results is sufficient; timing side channels are out of scope for a local single-owner app.
