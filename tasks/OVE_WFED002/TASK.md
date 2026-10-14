---
id: OVE_WFED002
title: "Define the EditorDocument model, selectors and test builders (the document contract)"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFED001, OVE_WFRT003, OVE_WFRT004]
soft_depends_on: []
provides: ["lib:editor-document-model", "lib:editor-test-builders"]
needs: ["contract:WorkflowDefinition", "contract:NodeDef", "contract:EdgeDef", "contract:PortSchema", "lib:result"]
owns: ["apps/desktop/src/features/workflow-editor/document/model.ts", "apps/desktop/src/features/workflow-editor/document/selectors.ts", "apps/desktop/src/features/workflow-editor/document/node-fields.ts", "apps/desktop/src/features/workflow-editor/document/limits.ts", "apps/desktop/src/features/workflow-editor/document/freeze.ts", "apps/desktop/src/features/workflow-editor/document/*.test.ts", "apps/desktop/src/features/workflow-editor/testing/document.builder.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED002: Define the EditorDocument model, selectors and test builders (the document contract)

## 1. Summary

Defines `EditorDocument`: an immutable, plain-JSON, React-free representation of a workflow draft that is separate from React Flow and from the persisted `WorkflowDefinition`. It states the invariants every command must keep, the selectors, and a fluent test builder. This is the document-model contract PART 2 and every later task build on.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The persisted shape is `WorkflowDefinition` (WFRT003): nodes with `key/type/label/config/position/ui`, edges with `id/from/to/label/kind/mapping`, `groups`, `lanes`, `inputSchema`, `outputSchema`, `limits`. The canvas kit has its own view model `CanvasModel` (DS087). The editor keeps three representations with pure mappers between them: Definition <-> Document (WFED013), Document -> CanvasModel (WFED015), kit intents -> Commands (WFED016). The Document is the single source of truth while editing; React Flow only displays a projection of it (SPEC 19.4: do not replace the engine by React Flow).

## 3. Scope (in)

- Types, invariants, constants and selectors of the document.
- Accessors for the few `config` fields the editor understands (`agentRef`, `lane`, `skills` overrides) in ONE file.
- `deepFreeze` for dev and test, and `assertDocumentInvariants(doc)` used by every test.
- Test builder `aDocument()`.

## 4. Out of scope

- Commands (WFED007, WFED009..WFED012).
- Mapping to and from the persisted definition (WFED013).
- Graph algorithms (WFED004).
- Any interpretation of node `config` beyond the accessors (the node types own their configs, the validator checks them).

## 5. Detailed requirements

1. Types (exported, exact):
```ts
export type NodeKey = string;   // ^[a-z][a-z0-9-]{0,47}$ (WFRT003)
export type EdgeId = string;    // ^e-[a-z0-9-]{1,60}$
export type GroupId = string; export type LaneKey = string; export type PortName = string;
export interface Point { readonly x: number; readonly y: number }
export interface PortRef { readonly node: NodeKey; readonly port: PortName }
export interface EditorNode { readonly key: NodeKey; readonly type: string; readonly label: string; readonly config: JsonObject; readonly position: Point; readonly ui?: { readonly collapsed?: boolean } }
export interface EditorEdge { readonly id: EdgeId; readonly from: PortRef; readonly to: PortRef; readonly label?: string; readonly kind?: "flow" | "return"; readonly mapping?: Readonly<Record<string, string>> }
export interface EditorGroup { readonly id: GroupId; readonly label: string; readonly kind: "loop" | "subworkflow" | "lane" | "free"; readonly nodeKeys: readonly NodeKey[]; readonly limitLabel?: string }
export interface EditorLane { readonly id: LaneKey; readonly name: string; readonly agentRef?: { agentId: string; pinVersion?: number }; readonly teamRef?: JsonObject }
export interface EditorMeta { readonly inputSchema: JsonObject; readonly outputSchema?: JsonObject; readonly limits?: JsonObject }
export interface EditorDocument {
  readonly schemaVersion: 1;
  readonly meta: EditorMeta;
  readonly nodes: Readonly<Record<NodeKey, EditorNode>>; readonly nodeOrder: readonly NodeKey[];
  readonly edges: Readonly<Record<EdgeId, EditorEdge>>; readonly edgeOrder: readonly EdgeId[];
  readonly groups: Readonly<Record<GroupId, EditorGroup>>; readonly groupOrder: readonly GroupId[];
  readonly lanes: Readonly<Record<LaneKey, EditorLane>>; readonly laneOrder: readonly LaneKey[];
}
```
`JsonObject` is a strict JSON type (no `undefined`, functions, `NaN`). Order arrays make serialisation and rendering deterministic and keep z-order stable.
2. INVARIANTS (the contract; `assertDocumentInvariants` checks all, commands MUST preserve all, mappers MUST establish all): I1 keys and ids are unique and match the regexes; I2 `nodeOrder` contains exactly the keys of `nodes` (same for edges, groups, lanes), no duplicates; I3 every edge `from.node` and `to.node` exists (a command that deletes a node deletes its edges in the same outcome); I4 every group `nodeKeys` entry exists and appears once per group (a node MAY be in several groups: ASSUMPTION, frames may nest); I5 positions are finite numbers with `abs <= 100000` (`clampPosition`); I6 counts are within `MAX_NODES = 200`, `MAX_EDGES = 600`, `MAX_GROUPS = 50`, `MAX_LANES = 16` (limits from WFRT003; they live in `limits.ts`); I7 `config` is a JSON object of depth <= 20 and without keys `__proto__`, `constructor`, `prototype` at any depth; I8 `label` is 1..60 chars after trim, edge `label` <= 60, group `label` <= 80, lane `name` <= 40; I9 a document never contains semantic validity: dangling ports, type mismatches, missing Start are allowed (the engine validator reports them, WFRT010); the editor only guarantees referential integrity.
3. Semantic validity is NOT an invariant because the author passes through invalid states (a new Agent node without an Agent). The validator result is a separate, asynchronous input (PART 2) and never blocks a command, except the connection rules of WFED006 which block creating an illegal edge.
4. `selectors.ts` (pure, memoised per document identity with a `WeakMap`, so repeated calls cost O(1)): `getNode`, `listNodes()` in `nodeOrder`, `getEdge`, `listEdges`, `edgesOfNode(doc, key)` (in and out), `incomingEdges(doc, key, port?)`, `outgoingEdges(doc, key, port?)`, `groupsOfNode`, `laneOf(doc, node)`, `nodeCount/edgeCount`, `isEmpty`, `findNodesByLabel(doc, q)` (used by WFED039). The per-node edge index is built once per document object.
5. `node-fields.ts` is the ONLY place that reads or writes known `config` fields: `getAgentRef(node): {agentId, pinVersion?} | undefined`, `withAgentRef(node, ref | undefined)`, `getLaneKey(node)`, `withLaneKey(node, key | undefined)`, `getSkillOverrides(node): {add, remove}`. Each accessor tolerates a missing or malformed field (returns `undefined`) and never throws. Other code MUST NOT read `node.config.agentRef` directly (DRY, one place to change when WFRT019 changes).
6. `freeze.ts`: `deepFreeze(doc)` used in tests and when `import.meta.env.DEV`, so accidental mutation throws. Production does not freeze (cost); the type system (`readonly`) is the guard there. Structural sharing is MANDATORY for every update helper: an unchanged subtree keeps its object identity (this is what makes 200-node rendering cheap, WFED045).
7. Update helpers (pure, exported, used by commands only): `setNode(doc, node)`, `removeNode`, `setEdge`, `removeEdge`, `setGroup`, `removeGroup`, `setLane`, `removeLane`, `reorderNodes`. They keep I2 (order arrays) automatically and never rebuild unrelated maps.
8. Builder `testing/document.builder.ts`: `aDocument().node("po","agent",{x:0,y:0}).node("join","join").edge("po","result","join","in").group("g1","loop",["po"]).lane("build","Build").build()`; defaults are deterministic; `build()` runs `assertDocumentInvariants` and `deepFreeze`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Persisted shapes come from `contract:WorkflowDefinition` (type-level reference only; the document does NOT import zod schemas at runtime so it stays small and fast).
- `JsonObject` and `Result` from `lib:result` / contracts utilities.

## 8. Architecture and code placement

Layer: pure UI-side model, folder `document/`. No React, no I/O, no ui-kit. Dependency direction: commands, mappers, session and canvas depend on `document/`; `document/` depends on nothing but contracts types.

## 9. Security and safety

The document is built from data that can be hostile (a Workflow drafted by Chief, an imported file, a pasted fragment): invariant I7 rejects prototype-pollution keys and unbounded depth before any code walks the structure; I5 and I6 bound numbers and counts so a malformed definition cannot freeze the UI. Immutability prevents a stale reference from silently changing a saved draft. The document holds no secrets and is never logged in full (log node counts and hashes only).

## 10. Errors and edge cases

- Edge pointing to a removed node: impossible by I3; a mapper input that violates it is rejected with `document.dangling_edge`.
- Two nodes with the same key in the input: rejected with `document.duplicate_key` (the engine validator would also flag it, but the editor cannot render duplicates).
- Position `NaN`, `Infinity` or 10^9: clamped by `clampPosition` and reported as a warning by the mapper.
- Node with a `config` that is not an object: replaced by `{}` and flagged `document.config_reset` in the mapper warnings.
- 201st node: `assertWithinLimits` returns `limit_exceeded`; commands refuse.

## 11. Acceptance criteria

- [ ] Given `aDocument()` with 3 nodes and 2 edges, When `assertDocumentInvariants` runs, Then it passes; Given each of I1..I8 violated in turn, Then it throws a typed error naming the invariant.
- [ ] Given `setNode` on one node, Then `nodes`, `edges`, `groups` object identities of untouched parts are unchanged (`===`).
- [ ] Given `config` with `__proto__` at depth 3, Then I7 fails.
- [ ] Given `getAgentRef` on malformed config, Then it returns `undefined` and does not throw.
- [ ] Selectors are O(1) after the first call on the same document object (verified by counting index builds).

## 12. Test plan

Unit tests per selector and invariant (`model.test.ts`, `selectors.test.ts`, `node-fields.test.ts`), identity tests for structural sharing, property test (fast-check if already approved in the dependency list, otherwise a seeded loop) generating random valid documents and applying update helpers, asserting invariants. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/document`.

## 13. Parallelization notes

Blocks almost everything in PART 1 and PART 2. Merge first after the skeleton. After merge nobody edits `model.ts`; additive proposals go to `tasks/_proposals/`.

## 14. Open questions and assumptions

- ASSUMPTION: groups may nest and overlap (a node can be listed in two groups); the canvas draws frames in `groupOrder`.
- ASSUMPTION: the persisted `GroupDef` has no rectangle, so frames are computed from member bounds (WFED015, WFED035). If the Owner wants manual frame sizes, WFRT003 needs an additive optional `rect`.
- OPEN: `ui.collapsed` has no visual in the kit; it is kept and round-tripped only.
