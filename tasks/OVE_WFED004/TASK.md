---
id: OVE_WFED004
title: "Implement pure graph queries: adjacency, reachability, back-edges, loop bodies"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: ["OVE_WFED002"]
soft_depends_on: []
provides: ["lib:editor-graph-queries"]
needs: ["lib:editor-document-model"]
owns: ["apps/desktop/src/features/workflow-editor/document/graph.ts", "apps/desktop/src/features/workflow-editor/document/graph-cycles.ts", "apps/desktop/src/features/workflow-editor/document/loop-bodies.ts", "apps/desktop/src/features/workflow-editor/document/graph*.test.ts", "apps/desktop/src/features/workflow-editor/document/loop-bodies.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED004: Implement pure graph queries: adjacency, reachability, back-edges, loop bodies

## 1. Summary

Iterative (non recursive) graph algorithms over `EditorDocument` used by the connection rules, the tile descriptors, the Loop frames and the keyboard navigation: adjacency by node and port, reachability, detection of a raw back-edge (a cycle that does not pass through a sanctioned Loop return port) and the body of a Loop.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. ADR 0002 and SPEC 7: cycles exist only through an explicit Loop node, a raw edge back is a validation error. WFRT013 defines the algorithm on the server: remove every edge whose target port is a return port (`continue` of a node whose definition has `allowsReturnEdges`), then find strongly connected components; any component with more than one node or a self-edge is a violation. The editor must reproduce the same decision locally so that an illegal connection is refused at once, not at publish. The mock (Main view) draws the dashed amber edge "nie spełnia → wróć do Developera z raportem" which in the data enters `continue` of a Loop (WFRT013 section 2).

## 3. Scope (in)

- Adjacency and reachability helpers.
- `wouldCloseRawCycle(doc, from, to, isReturnTarget)` for a candidate edge.
- `findRawCycles(doc, isReturnPort)` (Tarjan, iterative) for tests, hints and warnings after paste.
- `computeLoopBodies(doc, loopKey)` mirroring WFRT013 section 8.

## 4. Out of scope

- The decision whether a port may be connected at all (WFED006).
- Server validation (WFRT013) and its messages.
- Auto layout.

## 5. Detailed requirements

1. The helpers take a predicate instead of the catalogue to stay decoupled: `type ReturnPortPredicate = (ref: PortRef, doc: EditorDocument) => boolean` supplied by the catalogue (WFED005 `isReturnPort`).
2. `buildAdjacency(doc, isReturnPort)`: returns `{ out: Map<NodeKey, readonly EdgeId[]>, in: ..., sanctioned: ReadonlySet<EdgeId> }` where `sanctioned` are edges entering a return port. Memoised per document identity (`WeakMap`).
3. `reachableFrom(doc, starts, { skipSanctioned: true })`: iterative DFS returning a `Set<NodeKey>`; O(V+E); never recursion (200 nodes chain must not overflow).
4. `wouldCloseRawCycle(doc, from: PortRef, to: PortRef, isReturnPort)`: true when the candidate edge is NOT sanctioned (target is not a return port) and `from.node` is reachable from `to.node` through non sanctioned edges, or `from.node === to.node` (self-edge). Sanctioned candidate edges never close a raw cycle. O(V+E).
5. `findRawCycles(doc, isReturnPort, cap = 5)`: Tarjan SCC iterative on non sanctioned edges; returns up to `cap` cycles as `{ nodes: NodeKey[]; edgeIds: EdgeId[] }` deterministic (sorted by node key). Used after paste or load to mark `kind: "return"` hints and to show warnings; it never blocks loading a draft (the validator reports).
6. `computeLoopBodies(doc, loopKey, isReturnPort)`: the nodes reachable from the Loop `body` port without passing the Loop own `continue` target port; returns `{ nodeKeys, exitEdges: EdgeId[] }` where exit edges lead outside the body. Needs the port names `body` and `continue`; they come from the catalogue entry (`loopPorts`), not from literals (WFED005).
7. `edgeIsReturn(doc, edge, isReturnPort)`: true when the target port is a return port; the canvas mapper uses it to draw the edge with `state: "return"` (dashed amber) regardless of the stored `kind` hint, because the validator derives back-edges itself (WFRT003 section 3).
8. Deterministic output ordering everywhere (sorted keys) so tests and render order are stable.
9. Complexity budget: 200 nodes and 600 edges, every function under 2 ms on CI hardware (benchmark test with 5x slack).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Types from `lib:editor-document-model`; predicate from `lib:editor-node-catalog` (WFED005) injected by the caller.
- Do not re-implement the SCC for the validator (that one lives in the domain, WFRT013); this is a UI-side mirror with a parity test (requirement 9 of WFED017 fixtures).

## 8. Architecture and code placement

Layer: pure `document/`. No React. Mirrors server logic, so a shared test vector file `testing/cycle-vectors.json` (owned here) is used by both the editor tests and, by proposal, the WFRT013 tests to prevent drift.

## 9. Security and safety

A denial-of-service guard: an undetected raw cycle in a draft would be published and run forever (SPEC 17). The local check is UX only; the server validator at save/publish/run start is authoritative (fail closed). Iterative algorithms avoid stack exhaustion on hostile deep graphs.

## 10. Errors and edge cases

- Self-edge on an Agent: raw cycle, reported.
- Edge into `continue` from a node outside the Loop body: not a raw cycle (sanctioned) but WFRT013 reports `cycle.loop_return_not_in_loop`; the editor shows it only via the validator.
- Two parallel return edges into the same `continue`: both sanctioned.
- Loop nested in a Loop body: `computeLoopBodies` of the outer includes the inner node and its body.
- Graph with 200 nodes in one chain: no stack overflow.

## 11. Acceptance criteria

- [ ] Given A->B->C and a candidate C->A (non return target), `wouldCloseRawCycle` is true; Given the same candidate entering `continue` of Loop L where L.body reaches C, Then false.
- [ ] Given the mock graph (Developer, QA, Security, Gate, Senior Reviewer inside Loop "quality-loop"), `computeLoopBodies` returns those five nodes and the exit edge to "save decisions".
- [ ] Given 200-node chain, `findRawCycles` returns `[]` in under 2 ms (with slack).
- [ ] Parity vectors in `testing/cycle-vectors.json` give the same verdicts as the documented server algorithm (table of 20 cases).

## 12. Test plan

Unit tests with the vectors; benchmark test; property test: adding a random forward edge to a DAG never creates a raw cycle. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/document/graph`.

## 13. Parallelization notes

Parallel with WFED003 and WFED005. WFED006 depends on this.

## 14. Open questions and assumptions

- ASSUMPTION: the server flag is `allowsReturnEdges` on the node definition and the catalogue exposes it as `returnPorts` (see WFED005).
