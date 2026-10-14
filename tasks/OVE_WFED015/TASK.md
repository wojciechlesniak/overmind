---
id: OVE_WFED015
title: "Map EditorDocument to the kit CanvasModel with identity-stable caching"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS087, OVE_WFED002, OVE_WFED004, OVE_WFED005, OVE_WFED014]
soft_depends_on: []
provides: ["lib:canvas-model-mapper"]
needs: ["lib:editor-document-model", "lib:editor-node-catalog", "lib:editor-graph-queries", "lib:editor-node-descriptor", "ui:CanvasModel", "lib:canvasGeometry", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/mappers/canvas.ts", "apps/desktop/src/features/workflow-editor/mappers/canvas-cache.ts", "apps/desktop/src/features/workflow-editor/mappers/frames.ts", "apps/desktop/src/features/workflow-editor/mappers/ports.ts", "apps/desktop/src/features/workflow-editor/mappers/canvas*.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED015: Map EditorDocument to the kit CanvasModel with identity-stable caching

## 1. Summary

The projection from the document to the view model the kit draws (`CanvasNodeModel[]`, `CanvasEdgeModel[]`, `CanvasGroupModel[]`). It resolves ports and their sides, marks return edges, computes frame rectangles from members, injects Run state and validation issues from outside, and keeps object identity for unchanged items so React Flow re-renders only what changed.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The kit canvas is purely presentational (DS087 model: `CanvasNodeModel { id, kind, position, size?, title, statusText?, state, skillsCount?, model?, stack?, ports, data? }`, `CanvasEdgeModel { id, from, to, state: idle | active | done | return | error, label?, waypoints? }`, `CanvasGroupModel { id, kind: loop | parallel | generic, rect, label, limitLabel?, nodeIds }`). Coordinates are WORLD px; the mock world is 1120x760 at zoom 0.7. The mock draws a dashed amber return edge, frames with a label and a limit label, and node states (working glow, waiting glow, done). The editor never computes Run state: PART 2 supplies it.

## 3. Scope (in)

- `createCanvasProjector(deps)` returning `project(doc, view): CanvasProjection` with cached sub-results.
- Port construction and side rules.
- Frame rectangles and nesting padding.
- Edge states (return derivation, issues, runtime).
- Formatting of labels through an injected `Translator`.

## 4. Out of scope

- Rendering (WFED024 passes the result to `FlowCanvas`).
- Fetching Agents (WFED023), runtime state (PART 2), validation (PART 2).
- Edge routing and waypoints (kit `routeEdge`, DS093).

## 5. Detailed requirements

1. ```ts
interface ViewContext {
  catalog: CatalogQueries; agents: (id: string) => AgentLookup | "loading" | undefined; t: Translator;
  mode: "view" | "edit";
  runtime?: { nodes?: Readonly<Record<NodeKey, { state: NodeVisualState; statusText?: string }>>; activeEdges?: ReadonlySet<EdgeId>; doneEdges?: ReadonlySet<EdgeId> };   // PART 2 / run overlay
  issues?: { nodes: Readonly<Record<NodeKey, readonly IssueRef[]>>; edges: Readonly<Record<EdgeId, readonly IssueRef[]>> };        // PART 2 validation
  dropFeedback?: { nodeId: string; accepting: "valid" | "invalid"; label: string }; skillDragActive?: boolean;                    // WFED042
}
interface CanvasProjection { nodes: CanvasNodeModel[]; edges: CanvasEdgeModel[]; groups: CanvasGroupModel[]; warnings: ProjectionWarning[] }
function createCanvasProjector(deps: { catalog: CatalogQueries }): { project(doc: EditorDocument, view: ViewContext): CanvasProjection }
```
2. Node model: `id = node.key`; `position = node.position` (WORLD); `kind`, `title`, `skillsCount`, `model`, `stack` from `describeNode` (WFED014); `title = node.label` clamped to 60 chars (the kit clamps lines further); `state` = `runtime.nodes[key]?.state ?? "idle"` and NEVER `selected` (selection is a separate prop of `FlowCanvas`, DS095); `statusText` = runtime text, else the descriptor attention text, else none; `data` carries `{ type, tabLabel, tabAccessible, issueCount, acceptsSkills }` for the kit tile wrappers (the kit reads `tabLabel` and `skills.label` from the node data, strings formatted here with `t`).
3. Skills label via ICU plural in `wfc-canvas` (owner WFED024): `skills.count` = `{count, plural, one {# skill} few {# skille} many {# skilli} other {# skilli}}` (mock: `2 skille`, `1 skill`); the drop label `skills.dropLabel` = `upuść → {count, plural, ...}` where `count = current + 1` (mock `upuść → 1 skill` on a tile with 0 Skills): the projector sets `dropLabel` only on the tile named by `view.dropFeedback`.
4. Ports (`ports.ts`): from `resolvePorts` (WFED005): `PortModel { id: port.name, role: in|out, side, label }`. Default sides: inputs left, outputs right; overrides table `PORT_SIDE: Record<type, Record<port, side>>`: `quality_gate.fail` bottom, `review.changes_requested` bottom, `loop.continue` top; outputs of the same side keep template order (the kit places them evenly). Labels are `t(port.labelKey)` for ports with a label (then/else, pass/fail, approved/changes_requested); others none. Port ids are the engine port names so edges map 1:1.
5. Edges: `id = edge.id`, `from: { nodeId, portId }`, `to`; `state`: `error` if the edge has an error issue; `return` if `edgeIsReturn(doc, edge)` (WFED004) OR `edge.kind === "return"`; `active`/`done` from `runtime` sets; else `idle`. `label = edge.label` (clamped 60). Edges whose ports do not resolve (unknown type, removed dynamic port) are STILL emitted when both nodes exist, with the missing port synthesised (`side` by direction) and `state: "error"`, so the author sees and can delete the broken edge; a warning `edge_port_unresolved` is added.
6. Frames (`frames.ts`): for each non-empty group compute `rect` from the bounding boxes of its member nodes (size from kit `kinds` defaults: tile 224x112, discussion 240x112, start 64x30, save-decisions 118x36, join 26x26, gate 44x44, operators 112x48) expanded by padding `left 24, right 24, top 56 (label strip), bottom 36 + 12 for the model pill`, plus 16 per nesting depth level (a frame fully containing another is drawn larger; nesting derived from member-set inclusion). Kind mapping: `loop -> loop`, `subworkflow -> parallel`, `lane -> generic`, `free -> generic` (ASSUMPTION). Groups with no existing member are skipped with warning `empty_group`. `limitLabel` passes through. Frames are ordered by `groupOrder` (larger frames first for z-order). `nodeIds = nodeKeys`.
7. Caching (`canvas-cache.ts`): per-node cache keyed by node identity plus the identities of its inputs (descriptor, runtime entry, issue list, drop feedback); per-edge cache likewise; per-group cache by (group identity, member node identities). When nothing changed for an item the SAME object is returned, so `React.memo` in the kit (DS095 requirement 9) skips it; when no item changed the arrays are also returned by identity (the projector returns the previous `CanvasProjection` object). Cache entries for removed ids are dropped. Complexity: O(changed items) plus O(n) for the identity comparison.
8. Determinism: output order follows `nodeOrder`, `edgeOrder`, frames sorted as above; no randomness; no clock.
9. Warnings are returned, never thrown: `empty_group`, `edge_port_unresolved`, `unknown_type`, `position_out_of_world` (a node far outside the 1120x760 world is still rendered; informational for fit-view).
10. Intent-facing inverse helpers (`nodeKeyOf(id)`, `portRefOf(...)`) are identity functions today and live here so the later change of id schemes touches one file.

## 6. Design notes

Reference geometry from the mock (screen px at zoom 0.7, world = screen / 0.7): tile 224x112 world, frame `(12, 402, 1096, 348)` world for the loop, return edge amber dashed with label "nie spełnia → wróć do Developera z raportem", edge caption "3 decyzje → 5 Zadań na Tablicy". The kit draws all of it; this task only feeds data. Reference crops of the Main view are in the kit tasks (DS087..DS094).

## 7. Reuse

- `describeNode` (WFED014), catalogue (WFED005), `edgeIsReturn` (WFED004), kit model types and `kinds` sizes (type-only imports: `ui:CanvasModel`, `lib:canvasGeometry` for node bounds).
- Do not duplicate kit geometry: use `nodeBounds` from `lib:canvasGeometry` (DS087) for frame computation.

## 8. Architecture and code placement

Layer: pure `mappers/` with type-only ui-kit imports (the single allowed exception of WFED001). The projector is stateful only through its WeakMap/Map caches (no side effects). Dependency: canvas wiring (WFED024) -> projector -> document.

## 9. Security and safety

All display strings come from untrusted data: clamped, never HTML, never used as keys or ids. The projector passes no secrets (documents hold none). Issue and runtime inputs are read-only. A malformed document cannot crash it: every access is guarded and problems become warnings.

## 10. Errors and edge cases

- Edge between nodes where one port was removed: rendered in error state, deletable.
- Group whose members are all deleted: skipped with a warning.
- Nested frames (Loop inside a Subworkflow frame): outer larger, drawn first.
- Two outputs on the same side: template order; the kit spreads them.
- Node outside the world rect: still rendered.
- 1000 projections of an unchanged document: identity-equal result, zero allocations of node models (test).

## 11. Acceptance criteria

- [ ] Given the mock-like fixture, Then the projection has 12 nodes, the expected edges and one `loop` frame whose rect contains all member rects with the specified padding.
- [ ] Given an edge entering Loop `continue`, Then `state: "return"` and the label passes through.
- [ ] Given a changed label on one node, Then only that node model has a new identity (others `===` previous).
- [ ] Given `dropFeedback` for node X with 0 Skills, Then X gets `dropLabel` "upuść → 1 skill" and others none.
- [ ] Given a node with a missing Agent, Then the node model has the attention tab text and no model pill.
- [ ] Given `mode: "view"`, Then tiles are not draggable and `data.acceptsSkills` stays true for Agent-backed tiles only.

## 12. Test plan

Unit tests with `aDocument()` and the catalogue fixture, identity tests (`===`), snapshot of the projection of the golden mock fixture (WFED017), benchmark: 200 nodes project in under 10 ms cold and under 1 ms warm with one changed node. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/mappers/canvas`.

## 13. Parallelization notes

Parallel with WFED016 and WFED018 after WFED014. Blocks WFED024.

## 14. Open questions and assumptions

- ASSUMPTION: the kit distributes several ports of one side evenly in the order given; if DS088/DS091 fixes port positions per kind, the mapper must use the kit default port ids of that kind when the names match (check when DS tasks are merged).
- ASSUMPTION: frame padding values above (kit GroupFrame takes a finished rect, DS092).
- OPEN: `PORT_SIDE` for `loop.continue` (top) is a design decision not in the mock; the mock return edge enters the left side of Developer.
