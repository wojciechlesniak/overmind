---
id: OVE_DS093
title: Build routeEdge (pure orthogonal edge routing) with anchors, rounding and label placement
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS039, OVE_DS087, OVE_DS088, OVE_DS090, OVE_DS091, OVE_DS092]
soft_depends_on: []
provides: ["lib:routeEdge", "lib:edgeAnchors"]
needs: ["ui:tokens", "ui:Text", "ui:Icon"]
owns: ["packages/ui-kit/src/canvas/routing/**"]
reads: []
design: design.png
design_source: "Main#canvas/edges-upper (orthogonal routing reference) (crop 360,430,780,330 CSS px); design-lower.png = Main (crop 330,690,800,210)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19, 18]
---

# OVE_DS093: Build routeEdge (pure orthogonal edge routing) with anchors, rounding and label placement

## 1. Summary

Implements the pure, framework-free routing function that turns an edge model (two anchors, optional waypoints) into an orthogonal polyline with rounded corners and a label anchor, reproducing the mock's routes (fan-out from start, join, loop-back, return edge below the loop) with deterministic, testable output.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.5 (Edge), E29. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The mock draws edges as 2px `div` segments (orthogonal, no arrowheads). We need real SVG paths (E: implementation R) but the routes must look the same and be computed without React so they can be unit tested and shared by the static stage and the React Flow adapter. React Flow's own path helpers are NOT used (our look: rounded corners 10px, fixed 22px grid-friendly channels, return edges under the group).

## 3. Scope (in)

- `routeEdge`, anchor resolution per node kind/port, obstacle-aware simple heuristics, rounding, label/arrow positions, golden tests against the mock routes.

## 4. Out of scope

- SVG rendering and markers (OVE_DS094), React Flow edge type (OVE_DS095), automatic graph layout (not planned).

## 5. Detailed requirements

1. API (pure TS, no DOM):
   ```ts
   interface Anchor { point: Point; side: 'left' | 'right' | 'top' | 'bottom' }
   interface RouteInput { from: Anchor; to: Anchor; waypoints?: Point[]; kind: 'forward' | 'return'; obstacles?: Rect[]; cornerRadius?: number /* 10 */; channelGap?: number /* 22 */ }
   interface RouteResult { points: Point[]; path: string /* SVG d with arcs */; labelAnchor: Point; labelAngle: 0; arrow: { point: Point; angle: 0 | 90 | 180 | 270 }; bounds: Rect }
   function routeEdge(i: RouteInput): RouteResult
   function edgeAnchors(from: CanvasNodeModel, fromPort: PortModel, to: CanvasNodeModel, toPort: PortModel): { from: Anchor; to: Anchor }
   ```
   Anchors: port centres in world px: node `position` + port offset (left `(−0, 56)` i.e. x = left edge, y = top + 56 for tiles (port top 49 + 7); right x = left + w), join ring anchor at ring centre-left/right, gate anchors at diamond vertices, group-less.
2. Routing rules: forward edges leave horizontally from a `right` anchor and enter horizontally into a `left` anchor: if `|dy| < 1` a straight segment; otherwise an H-V-H path with the vertical channel at `x = from.x + max(24, (to.x - from.x)/2)` snapped to multiples of `channelGap` relative to the world origin so parallel edges share channels (the mock uses x = 90 channel for the start fan-out: two edges split at one vertical). When `to.x < from.x + 24` (loop-back) use H-V-H-V-H around obstacles: exit right 24px, go to a lane above/below the lowest/highest obstacle edge + 24, go back horizontal, come down into the target's left port (mock: edge from the discussion node down to y=380 then left to x=24 then into Developer).
3. `kind: 'return'` (dashed amber edge): leaves the source's `bottom` anchor (Quality Gate fail), runs along a lane below the group content (mock: y = 736 world), then up the target's `bottom` (or `left`) with the arrowhead pointing up (mock: arrow at x=240, y=650). Label anchor: midpoint of the longest horizontal segment, offset 10px below (mock label `top: 708`, left 660).
4. Corner rounding: replace each right-angle corner with a quadratic/arc of radius `min(cornerRadius, half the shorter adjacent segment)`; zero-length and collinear points are removed first (path simplification). The `path` string uses absolute `M/L/Q` commands only (no relative commands, easy to diff).
5. Obstacle avoidance is intentionally simple and deterministic (no A*): the router tries (1) the default channel, (2) shifts the vertical channel by +-`channelGap` up to 8 times to avoid obstacles, (3) falls back to the default path and flags `collides: true` in the result. Waypoints, when given (user-dragged bends), take precedence: the path goes through them in order with orthogonal connectors.
6. Arrow: `arrow.point` = last point, angle from the last segment direction; arrow length 9, half-height 6 (mock: border 6px/9px) so the end of the line stops 9px before the target port (`pathEnd` is shortened accordingly).
7. Determinism and performance: same input -> byte-identical output, O(n) in segments, < 0.2ms for a typical edge; the function is memoisable by a stable key (`routeKey(input)`). No randomness, no time.
8. Golden tests: fixtures reproduce the mock edges (start -> PO / Designer fan-out via the join, join -> discussion, discussion -> loop-back to Developer, Developer -> QA, QA -> Gate -> Senior Reviewer, Reviewer -> Save Decisions, Gate fail -> Developer return edge) and assert exact `points`.
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the upper part of the canvas with the fan-out edges from `start`, the join junction, the `join -> Zakres MVP` edge and the long loop-back edge to the Developer. `design-lower.png`: the return edge under the loop and its label. These are the reference routes for the golden tests; the mock has no arrowheads (we add them). Not drawn: edge hover/selected/error, user waypoints.

## 7. Reuse

Pure TS helper. Uses `geometry.ts` (OVE_DS087) and size constants from OVE_DS088, OVE_DS090, OVE_DS091. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default). Folder `canvas/routing/` imports nothing from React.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). Router input is sanitised: non-finite coordinates are replaced by 0 and the result is clamped to +-1e5 world px (a corrupted Workflow must not produce an infinite path).

## 10. Errors and edge cases

- from === to anchor -> a 24px loop stub.
- Waypoints produce diagonal segments -> orthogonalised with an intermediate corner.
- Obstacle list huge (> 500) -> only those intersecting the bounding box are considered.
- NaN input -> 0 with dev warning.

## 11. Acceptance criteria

- [ ] Given the mock fixtures, Then `points` equal the golden arrays and `path` parses as valid SVG.
- [ ] Given the same input twice, Then output is byte-identical.
- [ ] Given collinear points, Then they are removed.
- [ ] Given a loop-back edge, Then it clears all obstacle rects by >= 24px or sets `collides`.
- [ ] Unit coverage >= 90% for `routing/`.

## 12. Test plan

Vitest only (pure): golden snapshots of `points`, property tests (path length >= manhattan distance, rounding never exceeds segment lengths), perf smoke test. No Storybook story other than the debug `Routes` playground drawing routes over rectangles.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: automatic obstacle avoidance beyond the simple heuristic (default: no).
- ASSUMPTION: corner radius 10 and channel gap 22 (matches the dot grid).
