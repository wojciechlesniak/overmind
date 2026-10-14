---
id: OVE_DS100
title: Build Minimap (own implementation over CanvasModel)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS039, OVE_DS087, OVE_DS088]
soft_depends_on: []
provides: ["ui:Minimap"]
needs: ["ui:tokens", "ui:Text", "ui:Icon"]
owns: ["packages/ui-kit/src/canvas/Minimap/**"]
reads: []
design: design.png
design_source: "Main#canvas/minimap (crop 960,770,170,112 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [18, 19]
---

# OVE_DS100: Build Minimap (own implementation over CanvasModel)

## 1. Summary

Builds our own `Minimap` (140x92) that draws node rectangles by kind colour and the viewport rectangle, with click and drag to pan, driven only by `CanvasModel` and `CanvasViewportController`; React Flow's MiniMap is deliberately not used.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.9 (Minimap). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The minimap helps the Owner navigate a Workflow larger than the stage. Keeping it ours avoids coupling the look to React Flow and lets the static stage use it too (ADR 0018 keeps React Flow behind our components).

## 3. Scope (in)

- `Minimap`, coordinate mapping, pointer pan, keyboard, stories (static + interactive).

## 4. Out of scope

- The stage/controller (OVE_DS087).

## 5. Detailed requirements

1. `MinimapProps { nodes: { id: string; rect: Rect; kind: NodeKind; state?: NodeVisualState }[]; groups?: Rect[]; viewport: Viewport; container: { w: number; h: number }; controller: Pick<CanvasViewportController, 'setViewport'>; labels: { minimap: string }; size?: { w: number; h: number } /* 140x92 */ }`. Root `role="img"` (+ an interactive overlay with `role="slider"`-like pointer handling), `position: absolute` (slot bottomRight `right 10, bottom 10`), 140x92, radius 12 (mock; inventory 10), bg `#140F20`, 1px `line`, overflow hidden.
2. Rendering: a single `<svg viewBox>` computed from `graphBounds(nodes, groups)` expanded by the viewport rect and padding 8; nodes as rects radius 3 filled by kind colour (public `#6FA8FF`, private `#9B7BFF`, lane `#62E3B4`, discussion `#C9B8FF`, gate `#FFB547`), working nodes get a magenta fill; groups as 1px outlines; the viewport rectangle (screen container mapped to world) `1.5px #9B7BFF` stroke + fill `rgba(155,123,255,.08)` (mock: violet 1.5px rectangle). Min rect size 3px so tiny nodes stay visible.
3. Interaction: pointer down/drag inside the minimap centres the viewport on the world point under the pointer (`controller.setViewport`), dragging the viewport rect moves it relatively; wheel inside = zoom is NOT handled (pass through). Keyboard: the minimap is focusable (`tabIndex=0`) and arrows pan the viewport by 10% of the visible size, `Home` fits all. Pointer capture is used so drags outside keep working.
4. Performance: rects drawn from memoised arrays; updates throttled to animation frames; 500 nodes render < 4ms. In `view` mode it works the same.
5. Hidden (`display: none`) when the stage width < 560 (container query) because it would cover nodes.
6. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
7. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
8. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
9. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
10. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
11. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
12. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the 140x92 minimap bottom-right with blue/green/lavender rectangles and the violet viewport frame. Exact values from the mock. Not drawn: hover cursor, focus ring, empty graph (draws only the viewport), working node colour.

## 7. Reuse

Consumes geometry helpers and kind colour map from OVE_DS087; no primitives besides tokens. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21).

## 10. Errors and edge cases

- Empty nodes -> only the viewport rectangle.
- Viewport larger than the graph -> map scales to the viewport.
- Non-finite values -> ignored.

## 11. Acceptance criteria

- [ ] Given the mock model, Then colours/positions map within 1px of the mock minimap.
- [ ] Given a click at the minimap centre, Then `setViewport` centres the world point there.
- [ ] Given arrow keys, Then the viewport pans 10% of the visible size.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: whether the minimap can be hidden by the Owner (default: auto-hide only when narrow).
