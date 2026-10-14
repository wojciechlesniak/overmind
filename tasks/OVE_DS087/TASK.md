---
id: OVE_DS087
title: Build CanvasModel types and CanvasStage (dot grid, world layer, zoom and pan)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS032, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:CanvasStage", "ui:CanvasModel", "lib:canvasGeometry", "ui:CanvasViewportController"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:EmptyState"]
owns: ["packages/ui-kit/src/canvas/CanvasStage/**", "packages/ui-kit/src/canvas/model.ts", "packages/ui-kit/src/canvas/geometry.ts"]
reads: ["OVE_ARCH002"]
design: design.png
design_source: "Main#canvas/stage (crop 330,386,802,498 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [18, 19, 5]
---

# OVE_DS087: Build CanvasModel types and CanvasStage (dot grid, world layer, zoom and pan)

## 1. Summary

Creates the foundation of the canvas kit: the `CanvasModel` types (nodes, ports, edges, groups, viewport), pure geometry helpers, and `CanvasStage` (rounded container with the 22px dot grid, a 1120x760 world layer, zoom 0.1-2.0 with 70% default, pan, overlay slots, empty state, keyboard viewport shortcuts).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.1 (CanvasStage), E29, E6. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The Workflow canvas is the visual editor and live monitor of an executable program (SPEC 8). The mock renders the world with CSS `zoom: 0.7`, so all VIEWS canvas boxes are screen px. This task fixes the model and stage so every node/edge task draws into the same coordinate system. The Workflow definition itself lives in `contracts`; `CanvasModel` is the UI view-model derived from it (the UI imports no contracts, CONVENTIONS 6).

## 3. Scope (in)

- `canvas/model.ts` types, `canvas/geometry.ts` pure helpers (world<->screen, bounds, fit), `CanvasStage` static mode (CSS transform, used by Storybook, visual tests and read-only previews), overlay slots, empty state, wheel/space-drag/middle-drag pan and zoom, `CanvasViewportController` interface.

## 4. Out of scope

- Nodes, edges, frames (their own tasks).
- Drag editing and React Flow (OVE_DS095, OVE_DS096).

## 5. Detailed requirements

1. Model (`canvas/model.ts`, exported):
   ```ts
   type NodeKind = 'agent-public' | 'agent-private' | 'lane-build' | 'lane-qa' | 'lane-review' | 'discussion' | 'start' | 'save-decisions' | 'join' | 'quality-gate' | 'if' | 'loop' | 'parallel' | 'review';
   type NodeVisualState = 'idle' | 'selected' | 'working' | 'waiting-approval' | 'done' | 'queued' | 'error' | 'skipped' | 'disabled';
   interface Point { x: number; y: number }
   interface PortModel { id: string; side: 'left' | 'right' | 'top' | 'bottom'; role: 'in' | 'out'; label?: string }
   interface CanvasNodeModel { id: string; kind: NodeKind; position: Point; size?: { w: number; h: number }; title: string; statusText?: string; state: NodeVisualState; skillsCount?: number; model?: { label: string; hue: AgentHue; initials: string }; stack?: number; ports: PortModel[]; data?: Record<string, unknown> }
   interface CanvasEdgeModel { id: string; from: { nodeId: string; portId: string }; to: { nodeId: string; portId: string }; state: 'idle' | 'active' | 'done' | 'return' | 'error'; label?: string; waypoints?: Point[] }
   interface CanvasGroupModel { id: string; kind: 'loop' | 'parallel' | 'generic'; rect: { x: number; y: number; w: number; h: number }; label: string; limitLabel?: string; nodeIds: string[] }
   interface Viewport { x: number; y: number; zoom: number }
   ```
   Every union is exhaustively mapped in `canvas/kinds.ts` (colour, fill, default size, default ports), so adding a kind is a compile error until mapped. Default sizes: agent/lane 224x112, discussion 240x112, start 64x30, save-decisions 118x36, join 26x26, quality-gate 44x44 (rotated).
2. `geometry.ts` pure functions with unit tests: `worldToScreen(p, vp)`, `screenToWorld(p, vp)`, `nodeBounds(node)`, `graphBounds(nodes, groups)`, `fitViewport(bounds, container, padding=40, minZoom=.1, maxZoom=2)`, `zoomAround(vp, factor, anchorScreen)` (zoom stays under the cursor), `clampZoom`, `snap(p, grid=22)` (grid 22 = dot grid, snapping is opt-in).
3. `CanvasViewportController` (exported interface, implemented by both the stage and the React Flow adapter): `{ zoomIn(): void; zoomOut(): void; setZoom(z: number): void; fitView(): void; setViewport(vp: Viewport): void; getViewport(): Viewport; screenToWorld(p: Point): Point }`. Toolbar and minimap depend only on this interface (OVE_DS099, OVE_DS100).
4. `CanvasStageProps { viewport: Viewport; onViewportChange?(vp: Viewport): void; worldSize?: { w: number; h: number } /* 1120x760 */; children: ReactNode /* world layer: edges, groups, nodes */; overlays?: { topRight?: ReactNode; bottomLeft?: ReactNode; bottomRight?: ReactNode; topLeft?: ReactNode }; empty?: ReactNode; interactive?: boolean; 'aria-label': string; controllerRef?: Ref<CanvasViewportController> }`. Container: `position: relative; flex: 1; min-height: 0; border-radius: 24px; border: 1px solid #241B36; background: #0C0814` + dot grid `radial-gradient(rgba(155,123,255,.16) 1px, transparent 1px)` size 22px (tokens `canvas-bg`, `grid-dot`); `overflow: hidden`. The grid scrolls and scales with the viewport (background-position/size derived from `vp`, never drawn per dot).
5. World layer: `transform: translate(x px, y px) scale(zoom)`, `transform-origin: 0 0`, `will-change: transform` only while interacting; mock default `x = 8, y = 12 (screen px)`, `zoom = 0.7`. Overlay slots are positioned in screen space (not scaled): topRight (validation badge, `top 10, right 10`), bottomLeft (toolbar, `left 10, bottom 10`), bottomRight (minimap `right 10, bottom 10`), topLeft (legend). Overlays have `pointer-events: auto` individually, the slot container `none`.
6. Interaction (when `interactive`): wheel + `ctrl/cmd` = zoom around the cursor (factor 1.1 per notch), plain wheel = pan, `Space` + drag or middle-button drag = pan, double-click empty space = `fitView`. Zoom clamped 0.1-2.0. Keyboard (stage focused, `tabIndex=0`, `role="application"` with `aria-roledescription`): `+`/`-` zoom, `0` reset to 70%, `1` fit, arrow keys pan 40px (shift 120). All shortcuts documented in the story and exposed as a `aria-keyshortcuts`. `prefers-reduced-motion`: viewport changes are instant, otherwise 150ms ease for toolbar-driven zoom/fit.
7. Empty state (E29): when `empty` is provided and there are no children it is centred in the stage (the feature passes `ui:EmptyState` with palette hint `Przeciągnij Węzeł z palety, aby zacząć`).
8. Performance contract: the stage must stay interactive with 200 nodes / 300 edges; children are memoised by id and the stage itself re-renders only on viewport changes (nodes receive no viewport prop).
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the stage region: rounded container, dot grid and the scaled world (all nodes are drawn by later tasks; in this task's story the world holds placeholder rectangles). Exact values above are taken from the mock HTML (`radius 24`, `1px #241B36`, grid 22px at alpha .16, world 1120x760 at zoom .7 with margin 12 0 0 8). Not in the mock: pan/zoom, empty state, focus ring on the stage, zoom limits.

## 7. Reuse

Consumes `ui:EmptyState`, tokens. Creates `CanvasModel`/`kinds` maps that EVERY other canvas task imports. Part 1 colour tokens for kind colours (`--om-accent-*`). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). `geometry.ts` clamps all numeric inputs (NaN, Infinity, huge zoom) to finite values so a malformed Workflow cannot freeze the UI.

## 10. Errors and edge cases

- `zoom` NaN or 0 -> falls back to 0.7.
- `graphBounds` of an empty graph -> default world rect.
- Node outside the world rect -> still rendered (world is not clipped), `fitView` includes it.
- Container size 0 (hidden tab) -> `fitView` is a no-op until measured (ResizeObserver).

## 11. Acceptance criteria

- [ ] Given wheel with ctrl at (400,300), Then the world point under the cursor is unchanged after zoom (within 0.5px).
- [ ] Given `fitView` on the mock graph, Then all nodes are inside the container with >= 40px padding.
- [ ] Given `0` key, Then zoom is 0.7.
- [ ] Given `interactive=false`, Then no wheel/pan handlers are active (static mode).
- [ ] `pnpm depcheck` shows `canvas/` (outside `flow/`) imports no `@xyflow/react`.
- [ ] Visual match of the empty stage grid with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit tests for every geometry function (property tests for world<->screen round trip). Storybook: `Stage/Static`, `Stage/Interactive` (play: wheel/space-drag), `Stage/Empty`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN question E29: empty canvas design (default: centred EmptyState).
- ASSUMPTION: min/max zoom 0.1/2.0, default 0.7 (mock label `70%`).
