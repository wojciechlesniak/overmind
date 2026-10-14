---
id: OVE_WFED006
title: "Implement the connection rules engine (direction, ports, cycles, type compatibility)"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFED002, OVE_WFED004, OVE_WFED005, OVE_WFRT004]
soft_depends_on: []
provides: ["lib:editor-connection-rules"]
needs: ["lib:editor-document-model", "lib:editor-graph-queries", "lib:editor-node-catalog", "lib:port-schema-compat", "lib:result"]
owns: ["apps/desktop/src/features/workflow-editor/rules/engine.ts", "apps/desktop/src/features/workflow-editor/rules/types.ts", "apps/desktop/src/features/workflow-editor/rules/*.rule.ts", "apps/desktop/src/features/workflow-editor/rules/candidates.ts", "apps/desktop/src/features/workflow-editor/rules/*.test.ts", "apps/desktop/src/features/workflow-editor/rules/rules.generated.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED006: Implement the connection rules engine (direction, ports, cycles, type compatibility)

## 1. Summary

A pure engine that decides whether an edge between two ports may be created. It returns a typed verdict with a reason code, so the canvas can refuse an illegal connection immediately and explain why. Each rule is one small file (OCP). Raw back-edges are refused: cycles exist only through the Loop node.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. SPEC 7 and ADR 0002: typed ports; a raw edge back is a validation error; cycles only through an explicit Loop node. The server validator (WFRT011, WFRT012, WFRT013) is authoritative at save, publish and run start; this engine mirrors its rules that can be decided locally so that the Owner gets feedback while dragging (the DS096 contract: `canConnect` returns `{ok:true} | {ok:false, reason}`; incompatible ports show `not-allowed` and a tooltip with the reason; cycles outside the declared Loop are refused).

## 3. Scope (in)

- `ConnectionVerdict`, the rule interface and the engine.
- Rules: unknown nodes and ports, direction, start/end limits, self-connection, duplicate, occupied single input, edge limit, raw cycle, type compatibility.
- `candidateTargets(doc, from)` for pulsing compatible ports and for the keyboard connect mode.
- Reason codes with i18n key names (texts live in `wfc-conn`, WFED032).

## 4. Out of scope

- The drag gesture and tooltip rendering (WFED032).
- Creating the edge (WFED010).
- Mapping expression typing (WFRT017, server).
- Validation of Loop body membership of a return edge (server: `cycle.loop_return_not_in_loop`).

## 5. Detailed requirements

1. ```ts
export type RefusalCode = "unknown_node" | "unknown_port" | "wrong_direction" | "self_connection" | "start_has_incoming" | "end_has_outgoing" | "duplicate_edge" | "input_occupied" | "edge_limit" | "raw_cycle" | "type_mismatch" | "node_type_unknown" | "read_only";
export type ConnectionVerdict =
  | { ok: true; from: PortRef; to: PortRef; edgeKind: "flow" | "return"; warnings: readonly RuleWarning[] }
  | { ok: false; code: RefusalCode; messageKey: `wfc-conn:reason.${RefusalCode}`; params: Readonly<Record<string, string | number>> };
export interface ConnectionRule { readonly id: string; readonly order: number; check(c: RuleContext): RuleResult }   // pass | refuse | warn
export function checkConnection(doc: EditorDocument, a: PortRef, b: PortRef, q: CatalogQueries): ConnectionVerdict
export function candidateTargets(doc: EditorDocument, from: PortRef, q: CatalogQueries): readonly PortRef[]
```
2. `checkConnection` first calls `normalizeEnds(a, b)`: the user may drag from an input port to an output port; if `a` resolves to an `in` port and `b` to an `out` port the ends are swapped; if both are `in` or both `out`, refuse with `wrong_direction`. The verdict always carries the normalised `from` (out port) and `to` (in port).
3. Rule order and semantics (stop at the first refusal; warnings accumulate): (1) `unknown_node` / `unknown_port` (the port must be in `resolvePorts`, WFED005; node of unknown type -> `node_type_unknown`); (2) `wrong_direction`; (3) `self_connection` (same node on both ends); (4) `start_has_incoming` (target node type `start`), `end_has_outgoing` (source type `end`); (5) `duplicate_edge` (same from and to ports); (6) `input_occupied`: target input without `multi` already has an incoming edge (WFRT011 `graph.implicit_merge`); fan-out from one OUTPUT port is allowed (the mock fans `start` out to two Agents); (7) `edge_limit` (600, WFED002 limits); (8) `raw_cycle`: `wouldCloseRawCycle(doc, from, to, isReturnPort)` (WFED004) with params `path` (up to 6 node labels, then `...`); an edge into a return port (`continue`) is sanctioned and gets `edgeKind: "return"`; (9) `type_mismatch`: `isAssignable(sourceSchema, targetSchema)` from `lib:port-schema-compat`; `any_json` source into a typed target is NOT refused but returns the warning `any_json_into_typed` (server rule `port.any_json_into_typed`); `any_json` target accepts everything; an edge that will carry a `mapping` is not created here (mapping edits come from the Inspector, PART 2).
4. `params` carry only bounded strings and numbers: node labels truncated to 40 chars, port names, schema summary from `describeSchema` (<= 120 chars, never sample values). Params are escaped by the renderer, not by the rule.
5. `candidateTargets(doc, from, q)` returns every input port (on all nodes) for which `checkConnection` is ok, in canvas reading order; O(ports x (V+E)) but with the adjacency memoised it stays under 5 ms for 200 nodes (benchmark). It is memoised per (document identity, from).
6. Rule files: `rules/<id>.rule.ts` default-exporting a `ConnectionRule`; `rules.generated.ts` is produced by the extension generator (ARCH009); the engine sorts by `order`; duplicate ids fail a registry test. A new constraint = a new file, no edit of the engine.
7. Read-only mode is NOT a rule of the engine: the session refuses commands in view mode (WFED019). The `read_only` code exists so the canvas can reuse the same tooltip pipeline.
8. The engine is synchronous and allocation-light; it never mutates the document and never throws (a rule that throws is converted to a refusal `unknown_port` with `params.rule` and logged, fail closed).

## 6. Design notes

Copy of the refusal reasons shown in the tooltip (PL default in the mock tone, EN keys in `wfc-conn`): `wrong_direction` "Połącz wyjście (prawa strona) z wejściem (lewa strona)"; `self_connection` "Węzeł nie może łączyć się sam ze sobą"; `duplicate_edge` "To połączenie już istnieje"; `input_occupied` "To wejście ma już połączenie. Użyj Join, aby złączyć gałęzie"; `raw_cycle` "To połączenie utworzyłoby cykl. Cykle są dozwolone tylko przez Węzeł Loop"; `type_mismatch` "Typy nie pasują: {reason}"; `start_has_incoming` "Do Startu nic nie wchodzi"; `end_has_outgoing` "Z Końca nic nie wychodzi"; `edge_limit` "Osiągnięto limit 600 połączeń". Not in the mock: all of them.

## 7. Reuse

- `wouldCloseRawCycle`, `edgeIsReturn` (WFED004); `resolvePorts`, `isReturnPort`, `portOf` (WFED005); `isAssignable`, `describeSchema` from `lib:port-schema-compat` (WFRT004).
- The tooltip text for each code is an i18n message in `wfc-conn` (WFED032); example copy in section 6.

## 8. Architecture and code placement

Layer: pure `rules/`. Depends on `document/`, `catalog/`. Consumers: `edge.add` command (WFED010, authoritative inside the editor), the canvas `canConnect` (WFED032), keyboard connect mode (WFED032), paste (WFED012 re-checks inserted edges).

## 9. Security and safety

This engine is a UX safety net and a second line of defence inside the editor: `edge.add` calls it again so a forged command (paste payload, test hook) cannot create an illegal edge. It does not replace server validation; the engine validator re-runs on save, publish and run start (WFRT010). No raw back-edge can be created through the UI, which prevents accidentally authoring an infinite Run (SPEC 17).

## 10. Errors and edge cases

- Drag from an in port to an out port: swapped, then checked.
- Target port belongs to a node of unknown type: refused with `node_type_unknown`, the node stays untouched.
- A Join `in` (multi) receiving a second edge: ok.
- The edge would be valid but the document is at 600 edges: `edge_limit`.
- `resolvePorts` yields a schema pointer that is missing: `any_json`, ok with warning.
- Dynamic Parallel branch port removed while an edge exists: the edge stays in the document (the validator reports `graph.edge_unknown_port`); the rules engine does not delete edges.

## 11. Acceptance criteria

- [ ] Given Start->Agent exists and a second Start->Agent2 is requested from the same output port, Then ok (fan-out).
- [ ] Given a second edge into `Agent.in`, Then `input_occupied`.
- [ ] Given A->B->C and C->A, Then `raw_cycle` with path "A -> B -> C".
- [ ] Given the same C->A entering a Loop `continue`, Then ok with `edgeKind: "return"`.
- [ ] Given Agent `result` {text} into an `if.in` any schema, Then ok; into an Agent whose `inputSchema` requires `{stories: array}`, Then `type_mismatch`.
- [ ] `candidateTargets` for the Developer `result` output in the mock graph excludes the Start node, the Developer itself and every in-port that is already occupied and not multi (table-driven fixture).

## 12. Test plan

Table-driven unit tests per rule file (fixtures built with `aDocument()` and the catalogue fixture), engine order test, registry test (unique ids), benchmark (200 nodes), property test: for random DAG documents, any edge accepted never makes `findRawCycles` non-empty. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/rules`.

## 13. Parallelization notes

Parallel with WFED007/WFED008 after WFED004 and WFED005. Blocks WFED010 and WFED032. Conflict hotspot: none (one file per rule).

## 14. Open questions and assumptions

- GAP: `lib:port-schema-compat` (WFRT004, domain) must be importable from the desktop. Default: WFRT004 also exports `isAssignable` and `describeSchema` from a dependency-free module re-exported through `@overmind/contracts` (the task text calls the validator dependency-free). If not, the linker must ask WFRT004 for that re-export; until then this task uses a stub `isAssignable = () => true` behind the same import and the mismatch is reported by the server only.
- ASSUMPTION: refusing at connect time is stricter than the server for return edges outside the body (allowed locally, reported by the validator) so that a half-built loop can be wired in any order.
