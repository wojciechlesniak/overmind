---
id: OVE_WFRT011
title: Add structural validation rules (start/end, reachability, edge integrity, size)
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFRT010]
soft_depends_on: []
provides: ["lib:validation-rules-structure"]
needs: ["lib:result"]
owns: ["packages/domain/src/wfrt/validation/rules/graph.*.rule.ts", "packages/domain/src/wfrt/validation/rules/config.invalid.rule.ts", "packages/domain/src/wfrt/validation/rules/structure.fixtures.ts"]
reads: ["packages/domain/src/wfrt/validation/context.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 19]
---

# OVE_WFRT011: Add structural validation rules (start/end, reachability, edge integrity, size)

## 1. Summary

Rules that make sure a definition is a well-formed graph: exactly one Start, at least one End, unique keys and ids, edges that connect existing ports in the right direction, no unreachable nodes, no nodes that cannot reach an End, no implicit merges, limits respected.

## 2. Context

SPEC 7 lists "missing start/end" and "unreachable nodes" as validation errors. A node with several incoming edges on one port would run once per arrival (accidental OR-merge) which hides bugs; only ports declared `multi` (Join `in`, Loop `continue`) accept several edges.

## 3. Scope (in)

One rule file per rule id below, each with its tests and fixtures.

## 4. Out of scope

Port typing (WFRT012), cycles (WFRT013), permissions and references (WFRT014), expression checks (WFRT017), node-specific config rules.

## 5. Detailed requirements

Each rule is `error` unless noted. Messages use keys `workflow:validation.<ruleId>`; params named below.

1. `graph.missing_start`: no node of type `start`. `graph.multiple_start` (params `count`).
2. `graph.missing_end`: no `end` node. Multiple `end` nodes are allowed (success, failure, escalated outcomes).
3. `graph.duplicate_node_key` (params `key`), `graph.duplicate_edge_id`, `graph.duplicate_edge` (same from/to ports twice).
4. `graph.unknown_node_type` (params `type`); the rest of the rules skip nodes of unknown type (no cascades).
5. `graph.edge_unknown_node`, `graph.edge_unknown_port` (port not declared by `ports(config)` of the node), `graph.edge_wrong_direction` (from an `in` port or to an `out` port).
6. `graph.start_has_incoming`: edge into Start. `graph.end_has_outgoing`: edge out of End.
7. `graph.unreachable_node`: node not reachable from Start following edges (treat Loop `continue` and all edges as normal for reachability). Params `nodeKey`. One issue per node (not per downstream node: report only the unreachable "roots" of each unreachable component, others as part of params `alsoUnreachable` count).
8. `graph.dead_end`: node from which no End is reachable. Exception: the `exhausted` port of a Loop must reach an End (covered). Warning-level `graph.output_unconnected` for optional output ports left unconnected (for example Review `info`).
9. `graph.implicit_merge`: an input port without `multi: true` has more than one incoming edge. Params `nodeKey`, `port`, `count`.
10. `graph.size_limit`: more than 200 nodes or 600 edges or Parallel fan-out above 16 (the last is reported by `graph.fan_out_limit`).
11. `graph.group_unknown_node`: a group lists a non-existent node (warning, groups are visual).
12. `graph.label_missing`: empty/whitespace-only label (warning).
13. `config.invalid`: per-node `parseNodeConfig` failure, one issue per zod issue, `target.path` = JSON pointer inside the node (for example `/nodes/3/config/limits/maxIterations`), param `zodCode`; never echoes the offending value.
14. Edge-case policy: a graph with a single Start and an End directly connected is valid.

## 6. Design notes

N/A, functionality only. Highlighting of offending nodes on the canvas uses `target` (WFED).

## 7. Reuse

`DefinitionGraph` and `ValidationContext` (WFRT010); `PortDecl` via the registry (WFRT005). Shared graph algorithms (reachability, reverse reachability) are written once in `packages/domain/src/wfrt/validation/graph-algos.ts` (owned by this task; WFRT013 reuses them).

## 8. Architecture and code placement

`packages/domain/src/wfrt/validation/rules/<ruleId>.rule.ts`, one export each; pure functions.

## 9. Security and safety

Rules are resource-bounded (linear in nodes + edges; iterative, no recursion that a 200-node chain could overflow). They never trust declared `kind: 'return'` on edges. Issue params never contain configuration values.

## 10. Errors and edge cases

Two Starts plus an unreachable cluster: report `multiple_start` and the cluster once. Empty edges list with Start and End unconnected: `graph.unreachable_node` for End and `graph.dead_end` for Start. A node of unknown type with edges: no secondary errors. Self-referencing edge: reported by WFRT013 only.

## 11. Acceptance criteria

- [ ] Each rule id has a passing and a failing fixture.
- [ ] Reachability handles 200-node chains iteratively (no stack overflow).
- [ ] `graph.implicit_merge` does not fire for Join `in` or Loop `continue`.
- [ ] No cascading duplicate issues for unknown node types.
- [ ] Message keys exist in the EN locale.

## 12. Test plan

`rules/graph.*.rule.test.ts` using a `DefinitionBuilder` fixture (`structure.fixtures.ts`) and snapshot of issues. Command `pnpm vitest run packages/domain/src/wfrt/validation/rules/graph`.

## 13. Parallelization notes

Parallel with WFRT012, 013, 014 (separate rule files). Shared `graph-algos.ts` is created here first; WFRT013 depends on it (soft).

## 14. Open questions and assumptions

- ASSUMPTION: multiple End nodes are valid; the first End reached ends the Run (other branches are cancelled), documented in WFRT018.

