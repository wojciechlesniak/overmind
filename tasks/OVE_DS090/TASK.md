---
id: OVE_DS090
title: Build StartNode, SaveDecisionsNode and JoinNode
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS020, OVE_DS039, OVE_DS087]
soft_depends_on: []
provides: ["ui:StartNode", "ui:SaveDecisionsNode", "ui:JoinNode"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Port"]
owns: ["packages/ui-kit/src/canvas/SimpleNodes/**"]
reads: []
design: design.png
design_source: "Main#canvas/node-start + node-join (crop 338,495,330,80 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19, 8]
---

# OVE_DS090: Build StartNode, SaveDecisionsNode and JoinNode

## 1. Summary

Builds the three small structural nodes: `StartNode` (pill `start`), `SaveDecisionsNode` (pill `zapisz Decyzje`) and `JoinNode` (ring with caption `join · wszyscy`), with ports, states (idle, active, done, error, selected) and sizes from the mock.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.3 (StartNode, SaveDecisionsNode, JoinNode). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). A Workflow starts at `start`, may join parallel branches (`join · wszyscy` = wait for all) and ends by saving Decisions to the append-only register (ADR 0008): the save node is the visible proof that Discussion outcomes are persisted, not discarded.

## 3. Scope (in)

- Three components, states, captions, ports, stories.

## 4. Out of scope

- Node semantics and run logic (engine, WFLOW).
- Edges between them (OVE_DS094).

## 5. Detailed requirements

1. `StartNodeProps { label: string; state?: SimpleNodeState; selected?: boolean; renderPort? }`: 64x30, radius 999, `border: 1.5px solid #5B4596`, bg `#160F24`, mono 12/500 `#C9B8FF`, centred text (`start`); one output port at `right: -7px; top: 8px` (14px, 2.5px border `#5B4596`). `SimpleNodeState = 'idle' | 'active' | 'done' | 'error' | 'disabled'`.
2. `SaveDecisionsNodeProps { label: string; state?; selected?; renderPort? }`: 118x36, same pill style, label `zapisz Decyzje` mono 12 `#C9B8FF`, one input port left; `done` shows mint `✓` SVG before the label.
3. `JoinNodeProps { caption: string; state?; selected?; ports?: { in: number; out: number }; renderPort? }`: ring 26x26, `border: 2.5px solid #5B4596`, bg `#160F24`; caption (`join · wszyscy`, mono 11 `#8C80A6`) positioned at `top: 33px; left: -14px` (below, not clipped), nowrap; input port on the left edge, output on the right edge (visual: the ring itself acts as both anchors for multiple incoming edges, `ports.in` only affects the model).
4. States: `active` border/ring `#F25FC4` + `glow-edge-active`-style 0 0 14px rgba(242,95,196,.45) (the node currently executing); `done` border `#62E3B4` a60; `error` `#FF8FA3`; `selected` the same violet 4px ring as tiles (`ring-node-selected`); `disabled` opacity .4. Glyph + sr-only word for each non-idle state (E21).
5. Roles/a11y: roots `role="group"` with aria names `Start`, `Zapisz Decyzje`, `Join: wszyscy` (copy from the mock aria labels via props). The join ring is `role="img"` in the mock; here the group name carries the same text. All three are focusable only in `interactive` mode.
6. Sizes are exported constants (`SIMPLE_NODE_SIZES`) used by the model default sizes and the router's anchor calculations (OVE_DS093).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the `start` pill and the `join · wszyscy` ring with its caption (they sit left of the Product Owner / Designer branch). The `zapisz Decyzje` pill (118x36 at world about (1017,786) screen) is hidden under the minimap in the mock, so it has no crop; its values come from the mock HTML. Not drawn: active/done/error, selected, disabled, join with 3+ inputs.

## 7. Reuse

Consumes `ui:Port`, `ui:StatusText`; sizes shared with OVE_DS087 `kinds` map. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21).

## 10. Errors and edge cases

- Caption missing on Join -> only the ring.
- Label longer than the pill -> ellipsis (pill keeps size).
- Unknown state -> idle.

## 11. Acceptance criteria

- [ ] Given the three nodes, Then sizes are 64x30, 118x36 and 26x26.
- [ ] Given `state=active`, Then the magenta ring/glow shows and a status word exists for AT.
- [ ] Given `selected`, Then the 4px violet ring appears.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: whether `start` also shows a trigger kind (manual, schedule) later (post-MVP).
