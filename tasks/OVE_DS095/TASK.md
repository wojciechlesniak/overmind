---
id: OVE_DS095
title: Build FlowCanvas, the React Flow adapter behind the kit canvas components
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS032, OVE_DS039, OVE_DS087, OVE_DS088, OVE_DS089, OVE_DS090, OVE_DS091, OVE_DS092, OVE_DS093, OVE_DS094]
soft_depends_on: ["OVE_SETUP008"]
provides: ["ui:FlowCanvas", "ui:canvasNodeTypes", "ui:canvasEdgeTypes"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:EmptyState"]
owns: ["packages/ui-kit/src/canvas/flow/**"]
reads: ["OVE_SETUP008", "OVE_ARCH002"]
design: design.png
design_source: "Main#canvas/stage (interactive adapter) (crop 330,386,802,498 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [18, 19, 5]
---

# OVE_DS095: Build FlowCanvas, the React Flow adapter behind the kit canvas components

## 1. Summary

Builds the ONLY module that imports `@xyflow/react`: `FlowCanvas` maps our `CanvasModel` to React Flow nodes/edges, registers our components as custom node types and our `EdgeShape` as the custom edge type, implements `CanvasViewportController` over the React Flow instance and translates React Flow events into our own callbacks. The rest of the kit and the engine stay independent of React Flow.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.1, C11.2, C11.5; ADR 0018 (React Flow named in the stack), ADR 0019 (editor only draws, runtime executes). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The stack names React Flow for the canvas (ADR 0018). To keep the editor replaceable and testable, all React Flow types stay inside `canvas/flow/**`; `apps/desktop` imports `FlowCanvas` from the kit and passes our model. The engine contract (`contracts` Workflow definition) never mentions React Flow. Justification of the dependency belongs to OVE_SETUP008.

## 3. Scope (in)

- `FlowCanvas` component, `toFlowNodes/toFlowEdges` mappers, custom node wrapper (`CanvasNodeView`) rendering the kit tiles with `renderPort` = `<Handle>`, custom edge (`CanvasEdgeView`) using `routeEdge`/`EdgeShape`, controller implementation, event translation, theming (CSS overrides of React Flow base styles), a lint rule/test guarding imports.

## 4. Out of scope

- Node palette DnD, snapping, connection rules, keyboard graph navigation (OVE_DS096).
- Toolbar/minimap UI (OVE_DS099, OVE_DS100).
- Workflow persistence and validation (engine, WFLOW).

## 5. Detailed requirements

1. Which parts use React Flow (explicit list, normative): (1) the viewport (pan/zoom/transform) via `<ReactFlow>` + `useReactFlow()`; (2) node dragging, selection, multi-select box; (3) `<Handle>` elements as connection ports; (4) connection creation gesture (`onConnect`, `onConnectStart/End`, `isValidConnection`); (5) custom node types (`agent`, `lane`, `discussion`, `start`, `save-decisions`, `join`, `quality-gate`, `operator`, `group`); (6) custom edge type `canvas-edge` rendering our `EdgeShape`; (7) `<ReactFlowProvider>`. NOT React Flow: the dot grid (our `CanvasStage` background), the minimap (ours), toolbar/controls (ours), edge routing (ours), node visuals (ours), validation, undo/redo history, state colours. Built-in `<Background>`, `<Controls>`, `<MiniMap>`, default node/edge styles are NOT used.
2. Props:
   ```ts
   interface FlowCanvasProps {
     nodes: CanvasNodeModel[]; edges: CanvasEdgeModel[]; groups: CanvasGroupModel[];
     viewport?: Viewport; defaultViewport?: Viewport;               // default {x:8,y:12,zoom:.7}
     mode: 'view' | 'edit';                                         // published/read-only vs v8 draft
     selection?: { nodeIds: string[]; edgeIds: string[] };
     onSelectionChange?(s: { nodeIds: string[]; edgeIds: string[] }): void;
     onNodesMove?(moves: { id: string; position: Point }[]): void;   // emitted on drag END (commit), preview on drag via local state
     onConnect?(c: { from: {nodeId;portId}; to: {nodeId;portId} }): void;
     onEdgeDelete?(id: string): void; onNodeDelete?(ids: string[]): void;
     canConnect?(c: ConnectionIntent): { ok: true } | { ok: false; reason: string };
     onViewportChange?(vp: Viewport): void;
     controllerRef?: Ref<CanvasViewportController>;
     overlays?: CanvasStageProps['overlays']; empty?: ReactNode; 'aria-label': string;
   }
   ```
   Controlled model: the component never mutates props; it emits intents; the parent (feature: engine API through `api-client`) applies them and passes new props. During a drag a local transient position is kept and reconciled on commit.
3. Mapping rules: `toFlowNodes` -> `{ id, type, position, data: { model }, width/height (from kinds), selectable, draggable: mode==='edit', connectable: mode==='edit', zIndex }`; groups become nodes of type `group` with `zIndex: -1`, `selectable` only by the label strip, `draggable` false in view mode, `style.pointerEvents: 'none'` for the body. `toFlowEdges` -> `{ id, source, target, sourceHandle: portId, targetHandle: portId, type: 'canvas-edge', data: { model } }`. IDs are our ids unchanged (no React Flow generated ids).
4. Custom node view: `CanvasNodeView` selects the kit component by `model.kind` (exhaustive switch over `NodeKind`, compile error on a new kind) and passes `renderPort` which returns `<Handle id={port.id} type={role==='out'?'source':'target'} position={Position.Left|Right|Top|Bottom} />` styled to the 14px visual and a 24px hit area; interactive controls inside nodes (Skills tab button) carry `className="nodrag nopan"`. The node's `selected` flag maps to `state=selected` visuals without losing the engine state glow.
5. Custom edge view: `CanvasEdgeView` reads node positions and sizes from the React Flow store (`useInternalNode`), builds anchors with `edgeAnchors`, calls `routeEdge` (memoised) and renders `EdgeShape` inside React Flow's edge SVG; React Flow's own edge path/`getSmoothStepPath` is never used. Return edges are drawn with `kind: 'return'` from `edge.state === 'return'`.
6. Controller: `useCanvasController(): CanvasViewportController` wraps `zoomIn/zoomOut/zoomTo/fitView/setViewport/screenToFlowPosition` of the instance with our clamps (0.1-2.0) and the 150ms animation (instant under reduced motion). `fitView` uses `padding` 40 world px equivalent. It is also exposed via `controllerRef`.
7. Theming: a single CSS module overrides React Flow base classes to remove its default node box, selection box colours, handle styles and attribution position (attribution allowed to be hidden per the library's licence terms only if a Pro subscription is held; default keep `proOptions.hideAttribution = false` and place it bottom-right under the minimap, OPEN to the Owner). `colorMode` fixed `dark`. `.react-flow__pane` cursor rules for space-drag pan.
8. Dependency guard: an ESLint `no-restricted-imports` rule + a vitest `import-boundary` test fail when any file outside `canvas/flow/**` (or `apps/desktop` through our public export) imports `@xyflow/react`; `FlowCanvas` re-exports only OUR types. The package `exports` map exposes `FlowCanvas` as a separate entry `@overmind/ui-kit/canvas-flow` so apps that never draw a canvas do not load React Flow (code split).
9. Performance: `nodeTypes`/`edgeTypes` objects are module-level constants (never created in render); node components are memoised; `onlyRenderVisibleElements` enabled above 150 nodes; selection and viewport changes do not re-render unaffected nodes (verified by a render-count test with 100 nodes).
10. SSR/test environment: the component renders in jsdom with a mocked `ResizeObserver` (utility provided in test setup) so unit tests can run without a browser; Storybook interaction tests run in the real browser.
11. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
12. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
13. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
14. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
15. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
16. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
17. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the entire interactive stage as the Owner sees it: all nodes, frame, edges, overlays. The adapter must produce the same pixels as the static stage for the same model (visual test compares both to the mock). Not drawn: connection preview line, selection box, multi-select, handles hover.

## 7. Reuse

Composes everything from OVE_DS087, OVE_DS088, OVE_DS089, OVE_DS090, OVE_DS091, OVE_DS092, OVE_DS093, OVE_DS094. Adds `@xyflow/react` (version pinned by OVE_SETUP008) as a dependency of `packages/ui-kit` (peer-free, MIT). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default). The adapter is the Anti-Corruption Layer between React Flow and our model (Clean Architecture: framework at the edge). No other task imports React Flow; if a feature needs a capability (e.g. `getNodesBounds`) it is added to `CanvasViewportController`, not by importing React Flow.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). `canConnect` (and the engine) decide validity: the adapter never creates an edge by itself; invalid connections show a refused cursor and the reason; edges are not created by paste/drop of external JSON in this component. React Flow's `connectionMode` is `strict` (out->in only).

## 10. Errors and edge cases

- Edge refers to a missing node/port -> edge skipped with a dev warning (the model is untrusted).
- Two nodes with equal ids -> first wins, dev warning.
- `nodes` empty -> `empty` slot visible.
- Node outside the world -> still rendered; `fitView` includes it.
- `mode=view` -> no drag/connect/delete handlers are attached at all.
- React Flow store not ready (first render) -> render nothing for edges until nodes are measured.

## 11. Acceptance criteria

- [ ] Given the mock model, Then the interactive canvas is pixel-equivalent to the static `CanvasStage` render within tolerance.
- [ ] Given `pnpm lint`, Then importing `@xyflow/react` outside `canvas/flow/**` fails the rule.
- [ ] Given a drag of a node by 66px at zoom .7, Then `onNodesMove` is called once at drag end with a position delta of ~94 world px.
- [ ] Given `mode=view`, Then nodes cannot be dragged and no handle is connectable.
- [ ] Given 100 nodes, When one is selected, Then only that node and its neighbours re-render.
- [ ] The controller methods change zoom within 0.1-2.0 only.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit tests for mappers (exhaustive kinds), controller clamps, render-count test, import-boundary test. Storybook play: drag a node, connect two ports (`canConnect` refusing), zoom via controller.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review. Needs the kit canvas tasks merged first; developed against their prop contracts. Only this task touches `canvas/flow/**`.

## 14. Open questions and assumptions

- OPEN: hide the React Flow attribution (requires the library Pro licence) - default keep it visible bottom-right.
- ASSUMPTION: version of `@xyflow/react` pinned by OVE_SETUP008; ADR 0018 names React Flow.
- OPEN: expose a second entry point `@overmind/ui-kit/canvas-flow` (default yes, for code splitting).
