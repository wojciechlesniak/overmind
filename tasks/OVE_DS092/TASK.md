---
id: OVE_DS092
title: Build GroupFrame (loop, parallel, generic)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS017, OVE_DS039, OVE_DS087]
soft_depends_on: []
provides: ["ui:GroupFrame"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Pill"]
owns: ["packages/ui-kit/src/canvas/GroupFrame/**"]
reads: []
design: design.png
design_source: "Main#canvas/group-frame-loop (crop 345,676,767,224 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19]
---

# OVE_DS092: Build GroupFrame (loop, parallel, generic)

## 1. Summary

Builds the group frame drawn behind nodes: rounded rectangle with 2px tinted border, top-left mono label (`Pętla jakości · Build → QA → Review · iteracja 2 z 5`), top-right limit label (`limit 90 min · 5 iteracji`), variants loop (mint), parallel (violet) and generic (grey), plus selected/resize-handle visuals.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.4 (GroupFrame), E28. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). A frame groups nodes that belong to one construct (quality loop, parallel branch). It carries the loop's limits, which the Owner must see (SPEC 8: limit 90 min and 5 iterations, escalation when hit).

## 3. Scope (in)

- `GroupFrame`, variants, label overflow rules, selected state, resize handles (visual only), stories.

## 4. Out of scope

- Membership and layout logic, resize behaviour (OVE_DS096), loop semantics (engine).

## 5. Detailed requirements

1. `GroupFrameProps { kind: 'loop' | 'parallel' | 'generic'; rect: { x; y; w; h }; label: string; limitLabel?: string; iteration?: { current: number; max: number; label: string }; selected?: boolean; state?: 'idle' | 'active' | 'escalated'; onSelect?(): void }`. In world px: absolute at `rect`, mock `(12, 402, 1096, 348)`.
2. Frame: radius 28, `box-sizing: border-box`, `border: 2px solid rgba(98,227,180,.5)`, fill `rgba(98,227,180,.035)` for `loop` (tokens `--om-frame-loop-border/fill`); `parallel`: violet `rgba(155,123,255,.5)` / `.035`; `generic`: `rgba(167,155,191,.4)` / `.03`. The frame sits BELOW nodes and edges (z-index layer `canvas-group`), `pointer-events: none` except for the label strip and the border so nodes inside stay clickable.
3. Label (`mono-canvas-label`, E28): `position: absolute; left: 24px; top: 12px`, mono 15/500 `#BFF3DF` (loop; violet `#D6C9FF` parallel, `#C9C0D8` generic), nowrap, ellipsis, `max-width: calc(100% - 220px)` so it never collides with the limit label; `title` with the full text. Limit label: `right: 18px; top: 14px`, mono 12/400 `#8C80A6`, nowrap; below width 520 the limit label drops under the title.
4. `active` (Run is inside the loop) adds a faint outer glow `0 0 0 1px rgba(98,227,180,.2)`; `escalated` (limit reached) switches border to amber `rgba(255,181,71,.6)` and appends a `Pill` amber `Eskalacja` (word, not colour only). `selected`: 2px violet outline offset 4 and 8 square resize handles (visual only, `nodrag`).
5. The frame is a `role="group"` with `aria-label` = label + limit label; it contains no focusable children; selection via the label strip button.
6. Iteration text: when `iteration` is given, the label is composed by the caller; the component only guards length (iteration number in mono, never wraps).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the mint loop frame with the label top-left, the limit label top-right and the nodes (Developer, QA, Security, Senior Reviewer, Gate) inside it. Values from the mock HTML. Parallel/generic variants, active/escalated and selected are derived. Not drawn: nested frames, resize.

## 7. Reuse

Consumes `ui:Pill`, tokens. Frame rect type from OVE_DS087 `CanvasGroupModel`. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). The limit label is informational; limits are enforced by the engine.

## 10. Errors and edge cases

- Label empty -> frame without label.
- Rect with w/h < 120 -> label ellipsis, limit label hidden.
- Frame partially outside the world -> still drawn.
- Nested frames -> inner frame renders above outer (by area).

## 11. Acceptance criteria

- [ ] Given the loop fixture, Then border/fill/label/limit colours and positions equal the spec.
- [ ] Given a long label, Then it ellipsises before the limit label.
- [ ] Given `escalated`, Then the amber border and the word `Eskalacja` appear.
- [ ] Given clicks on a node inside the frame, Then the frame does not capture them.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION E28: label style token `mono-canvas-label`.
- DESIGN GAP: parallel/generic colours derived.
