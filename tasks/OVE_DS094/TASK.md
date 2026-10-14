---
id: OVE_DS094
title: Build Edge SVG rendering (EdgeShape, markers, label, states)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS039, OVE_DS093]
soft_depends_on: []
provides: ["ui:EdgeShape", "ui:EdgeLayer", "ui:EdgeLabel"]
needs: ["ui:tokens", "ui:Text", "ui:Icon"]
owns: ["packages/ui-kit/src/canvas/EdgeShape/**"]
reads: []
design: design.png
design_source: "Main#canvas/edge-back + edge-active (crop 330,690,800,210 CSS px); design-active.png = Main (crop 515,785,90,40); design-label.png = Main (crop 440,520,270,60)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19]
---

# OVE_DS094: Build Edge SVG rendering (EdgeShape, markers, label, states)

## 1. Summary

Renders routed edges as SVG: `EdgeShape` (path + arrowhead marker), `EdgeLabel` (mono caption with background plate), states idle/active/done/return/error/selected/hover, and `EdgeLayer` (one SVG per world layer with unique marker ids).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.5 (Edge), E29. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Edges in the mock: 2px `#5B4596` orthogonal lines, active segments `#F25FC4` with glow, the return edge dashed 2px `#FFB547` with a label. The mock has no arrowheads; the implementation adds 8px SVG markers, hover width 3px and selected `#9B7BFF`.

## 3. Scope (in)

- SVG components consuming `routeEdge` output, markers, states, label plates, hit area, stories.

## 4. Out of scope

- Routing (OVE_DS093), React Flow edge type (OVE_DS095), edge editing handles (OVE_DS096).

## 5. Detailed requirements

1. `EdgeShapeProps { id: string; route: RouteResult; state: 'idle' | 'active' | 'done' | 'return' | 'error'; label?: string; selected?: boolean; hovered?: boolean; dimmed?: boolean; onSelect?(id: string): void; labelPlacement?: 'auto' | Point }`. Output is a `<g>` for use inside the shared `<svg>` of `EdgeLayer`; the layer SVG is `position:absolute; inset:0; overflow:visible; pointer-events:none` in world coordinates (no viewBox scaling), edges re-enable `pointer-events: stroke` on the hit path only.
2. Stroke table: idle `#5B4596` 2px; active `#F25FC4` 2px + `filter: drop-shadow(0 0 6px rgba(242,95,196,.6))` (`glow-edge-active`, mock glow segment); done `#62E3B4` a60 2px; return `#FFB547` 2px `stroke-dasharray: 6 5`; error `#FF8FA3` 2px; hover width 3px; selected `#9B7BFF` 3px (selection wins over state colour but the dash of `return` is kept); `dimmed` opacity .35. `stroke-linejoin: round`, `stroke-linecap: round`. All colours via tokens.
3. Arrowhead: `<marker>` per colour with unique ids (`om-edge-{layerId}-{colour}`; layerId from `useId`), `markerUnits="userSpaceOnUse"`, 9x12 triangle (mock border 6/9), `orient="auto"`, `refX` = tip; `return` edges use the amber marker. The line stops at the arrow base (route already shortened).
4. Active flow animation: `active` edges show a moving dash (`stroke-dasharray: 2 10`, offset animating 1s linear infinite) over the solid line; disabled under reduced motion (solid glow only).
5. `EdgeLabel`: mono 12/400 (`#FFCF85` for return; `#A79BBF` for normal captions like `3 decyzje → 5 Zadań na Tablicy`; 10px `#8C80A6` for node captions `join · wszyscy`) rendered as SVG `<text>` with a 2px stroke halo in `canvas-bg` (paint-order stroke) so it stays readable over the dot grid and other lines; or an HTML plate via `foreignObject` NOT used (security + Safari quirks). `white-space` is single-line; label width capped at 280 world px with ellipsis (computed with `getComputedTextLength` once, memoised).
6. Hit target: an invisible 14px-wide stroke path clones the route for easier pointing; `role="img"` is NOT used: each edge is a `<g role="group" aria-label="{from} -> {to}{, label}">` and selectable edges are reachable through the Inspector/keyboard graph navigation (see OVE_DS096), the SVG itself is not in the tab order.
7. `EdgeLayer`: `{ edges: { id; route; state; label? }[]; selectedId?; hoveredId?; layerId }` renders edges sorted so selected is last (on top) and `active` above idle; one `<defs>` for all markers; `shape-rendering: geometricPrecision`.
8. State legend entries (`edgeLegendItems`) exported so OVE_DS098 legend can show them.
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: bottom of the canvas: the dashed amber return edge with `nie spełnia → wróć do Developera z raportem` and the arrow under the loop. `design-active.png`: the magenta active segment with glow. `design-label.png`: the join caption / `3 decyzje → 5 Zadań na Tablicy`. Arrowheads, hover, selected are additions (R) per inventory. Not drawn: error edge, dimmed, selected.

## 7. Reuse

Consumes `RouteResult` from OVE_DS093 and tokens only. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). Labels are rendered as SVG text nodes (no HTML injection). Marker ids are generated, never taken from data.

## 10. Errors and edge cases

- Empty path -> renders nothing.
- Duplicate ids -> dev warning, second edge keyed by index.
- Very long label -> ellipsis with title.
- Many edges (300) -> single SVG, no per-edge filter on idle edges (only active).

## 11. Acceptance criteria

- [ ] Given the return-edge fixture, Then the path is dashed amber with an arrowhead and the label uses `#FFCF85`.
- [ ] Given `active`, Then the glow filter and moving dash are present (absent under reduced motion).
- [ ] Given two layers on one page, Then marker ids are unique.
- [ ] Given `selected`, Then stroke is violet 3px on top of other edges.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- DESIGN GAP E29: edge hover/selected/error looks are derived.
- ASSUMPTION: SVG text halo instead of HTML label plates.
