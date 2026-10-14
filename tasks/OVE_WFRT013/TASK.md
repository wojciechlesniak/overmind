---
id: OVE_WFRT013
title: Add cycle and Loop validation rules (raw back-edges are errors)
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_WFRT010]
soft_depends_on: [OVE_WFRT011]
provides: ["lib:validation-rules-cycles"]
needs: []
owns: ["packages/domain/src/wfrt/validation/rules/cycle.*.rule.ts"]
reads: ["packages/domain/src/wfrt/validation/graph-algos.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 19]
---

# OVE_WFRT013: Add cycle and Loop validation rules (raw back-edges are errors)

## 1. Summary

Enforce ADR 0002: cycles exist only through the explicit Loop node. Any edge that closes a cycle without entering a Loop's `continue` port is an error; every Loop must declare iteration, time and cost limits and have a wired `exhausted` exit.

## 2. Context

Spec: "Cycles only as an explicit Loop node with iteration, time and cost limits and `onExhausted` exit. A raw back-edge is a validation error." The mock draws a dashed amber return edge "nie spełnia → wróć do Developera z raportem" inside the frame "Pętla jakości · limit 90 min · 5 iteracji". In the data model that return edge enters `quality-loop.continue`; the Loop then routes back to its `body` port. Loop port model: inputs `enter`, `continue` (multi); outputs `body`, `exhausted` (WFRT023).

## 3. Scope (in)

Algorithm and rules listed below.

## 4. Out of scope

Loop runtime (WFRT023), Loop config schema (WFRT023), structural rules (WFRT011).

## 5. Detailed requirements

1. **Algorithm.** Let `E` = all edges. Remove every edge whose target port is `continue` of a Loop node (the sanctioned return edges). Run an iterative strongly-connected-components pass (Tarjan, no recursion) on the rest. Any SCC with more than one node, or a node with a self-edge, is a violation; for each report one shortest cycle path as `cycle.raw_back_edge` with params `path` (up to 8 node keys, `...` if longer), and `target.edgeId` of an edge in the cycle that, by position (closest to End by DFS finishing order), is the back edge. Deterministic: ties resolved by sorted node keys.
2. `cycle.loop_return_not_in_loop` (error): a `continue` edge whose source is not reachable from the same Loop's `body` port (the return would not close a loop of that Loop, it would be a stray jump). Uses reachability from `body`.
3. `cycle.loop_no_return` (warning): a Loop with `continue` unconnected (iterates only once; likely a mistake).
4. `cycle.loop_body_empty` (error): `body` unconnected.
5. `cycle.loop_exhausted_unwired` (error): `exhausted` unconnected (there must be an `onExhausted` path, SPEC 7). Also `cycle.loop_exhausted_not_terminating` (warning) when no End node of outcome `escalated` or `failure` is reachable from `exhausted` (a loop that exhausts and silently succeeds is suspicious).
6. `cycle.loop_limits_missing` (error): config lacks any of `maxIterations`, `maxDurationMs`, `maxCost` (all three required, SPEC 7); `cycle.loop_limit_out_of_range` (error): values above hard caps from WFRT001 §9 (iterations 50, duration 24 h) or below 1.
7. `cycle.loop_nesting_too_deep` (error): more than 3 nested Loops (a Loop whose body reaches another Loop's `body` before returning, computed by body membership); `cycle.loop_shared_return` (error): two Loops sharing one return edge (an edge can target one port only; guaranteed by structure, rule defends against crafted data).
8. **Body membership** is computed by `loopBody(loopKey)`: nodes reachable from `body` without passing through the same Loop's `continue` target port; exit edges to nodes outside the body (success path) are legal and reported in params for the editor frame (`GroupDef` suggestion). Provide `computeLoopBodies(ctx)` as a reusable helper for WFRT033 (scheduler) and WFED.
9. Other nodes may not have a port named `continue`; only the registry-declared Loop kind is special-cased by a `node definition flag` `allowsReturnEdges: true` (not by the literal type string), so future loop-like nodes reuse the rule.

## 6. Design notes

N/A, functionality only. The editor draws dashed return edges from `kind: 'return'` hints or from this analysis (WFED).

## 7. Reuse

`graph-algos.ts` (WFRT011), `DefinitionGraph` (WFRT010). The SCC implementation lives in `graph-algos.ts` extension file `scc.ts` owned by this task.

## 8. Architecture and code placement

`packages/domain/src/wfrt/validation/rules/cycle.<name>.rule.ts` plus `loop-bodies.ts` helper in `packages/domain/src/wfrt/validation/`. Pure and iterative.

## 9. Security and safety

An undetected cycle is a denial-of-service (infinite Run, runaway cost). This rule is a safety control, run on publish and Run start. Defence in depth: the runtime also enforces limits (WFRT038) and caps total token emissions per Run (WFRT001 §9 `maxEvents`).

## 10. Errors and edge cases

Self-loop on an Agent node: `raw_back_edge`. Two raw cycles sharing nodes: both reported, capped at 5 issues. A back edge into a Loop `enter` port: raw back-edge (only `continue` is sanctioned). Parallel branches both returning to `continue`: legal (multi), runtime de-duplicates (WFRT023).

## 11. Acceptance criteria

- [ ] The golden workflow (WFRT050) passes with zero cycle errors; deleting the Loop and keeping the return edge yields `cycle.raw_back_edge`.
- [ ] Each rule has failing and passing fixtures including nested loops (depth 3 ok, 4 error).
- [ ] Algorithm is iterative and handles 200 nodes under budget.
- [ ] Cycle path reporting is deterministic.

## 12. Test plan

Table-driven tests with generated graphs; a property test: any DAG plus random sanctioned return edges is accepted, any extra random back edge is rejected. Command `pnpm vitest run packages/domain/src/wfrt/validation/rules/cycle`.

## 13. Parallelization notes

Parallel with WFRT011/012/014. Helper `computeLoopBodies` unblocks WFRT023 and WFRT033.

## 14. Open questions and assumptions

- ASSUMPTION: Subworkflow call cycles (A calls B calls A) are validated by a separate P2 rule (WFRT055).

