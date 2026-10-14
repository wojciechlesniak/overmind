---
id: OVE_DS089
title: Build NodeTile states (selected, working, waiting, done, error) and Skills drop-target
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS017, OVE_DS020, OVE_DS028, OVE_DS039, OVE_DS088]
soft_depends_on: []
provides: ["ui:NodeStateStyles", "ui:SkillsTabDropTarget"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:StatusText", "ui:Pill", "ui:Tooltip"]
owns: ["packages/ui-kit/src/canvas/NodeTile/states/**"]
reads: []
design: design.png
design_source: "Main#canvas/node-*-states (developer selected, qa working, security waiting, reviewer drop target) (crop 350,690,660,210 CSS px); design-working.png = Main (crop 560,700,180,110); design-waiting.png = Main (crop 560,800,180,100); design-drop.png = Main (crop 820,745,190,110); design-selected.png = Main (crop 360,745,190,110)"
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 3"]
adr_refs: [3, 28]
---

# OVE_DS089: Build NodeTile states (selected, working, waiting, done, error) and Skills drop-target

## 1. Summary

Adds the visual states of the node tile: idle, selected (violet ring), working (magenta glow), waiting for Approval (amber glow), done, queued, plus the states the mock lacks (error, skipped, disabled, validation badge) and the Skills-tab drop-target look (dashed magenta border, text `upuść → 1 skill`) including accepted/rejected feedback.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.2 states table, B3, E19, E21, E29, styl-wizualny.md. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Node states mirror Agent and Run state (SPEC 8) but are supplied by the engine: the editor must never invent `working`. Glow semantics are fixed by styl-wizualny: magenta = working, amber = waiting for Approval, violet = selected. Skill drops are the only way to attach Skills visually (SPEC 3); a drop onto an incompatible node must be refused visibly.

## 3. Scope (in)

- State styles + status text glyph/colour map, `NodeValidationBadge`, drop-target and rejected visuals, reduced-motion handling, stories per state.

## 4. Out of scope

- Drag/drop logic (kit OVE_DS067 and canvas wiring OVE_DS096).
- Run state data.

## 5. Detailed requirements

1. State table (face styles on top of OVE_DS088; all values from the mock HTML):
   - `idle`: base.
   - `selected`: `box-shadow: 0 0 0 4px rgba(155,123,255,.28)` (token `ring-node-selected`), border unchanged.
   - `working`: `box-shadow: 0 0 0 4px rgba(242,95,196,.16), 0 0 36px rgba(242,95,196,.45)` (`glow-node-working`); status text magenta `#F25FC4` with `●` glyph (`● testy e2e 38 z 52`).
   - `waiting-approval`: `box-shadow: 0 0 0 4px rgba(255,181,71,.14), 0 0 30px rgba(255,181,71,.35)` (`glow-node-waiting`); status amber `#FFB547` with `◆` (`◆ czeka na Zgodę · npmjs.org`).
   - `done`: no glow; status mint `#62E3B4` with `✓` (`✓ 4 pliki · testy 112 z 112`).
   - `queued`: no glow; status grey `#A79BBF` with `○` (`○ czeka na Quality Gate`).
   - `error` (R): error border `#FF8FA3` replaces the kind border, `0 0 0 4px rgba(255,143,163,.14), 0 0 28px rgba(255,143,163,.35)`, status `✗ ...` in `#FF8FA3`.
   - `skipped` (R): opacity .55, dashed border, status `– pominięty`.
   - `disabled` (R): opacity .4, `pointer-events: none`, `aria-disabled`.
2. Combination rules (documented + tested): `selected` ring COMBINES with any glow (ring drawn first, glow beyond); `working` + `selected` shows both; precedence for the status line colour: error > waiting-approval > working > done > queued > idle. Glyphs are SVG (E21): `StatusText` renders `<svg>` for `● ◆ ✓ ○ ✗ –` with the same shapes and an sr-only word (`pracuje`, `czeka na Zgodę`, `gotowe`, `w kolejce`, `błąd`, `pominięty`), so the status is never colour only.
3. Glow animation: `working` glow pulses 2.4s ease-in-out (opacity .75 to 1); `waiting-approval` is static (calm). Under `prefers-reduced-motion` all animation is disabled and the glow stays at full strength.
4. Validation badge (`NodeValidationBadge`, R): 18px circle top-right outside the Skills tab at `right: -8px; top: -22px`, error or warning icon (`activity`/`warning`), `role="img"` with the issue count and `title`; shown when `issues` prop > 0; clicking calls `onShowIssues`. Does not change the border colour except `error` state.
5. Skills drop target (`ui:SkillsTab` + face): prop `drop?: { active: boolean; accepting: 'idle' | 'valid' | 'invalid'; label: string; invalidLabel?: string }`. While a skill is dragged over the canvas every node that CAN accept gets the subtle hint (SkillsTab brighter); `valid` hover: Skills tab becomes `border: 2px dashed #F25FC4`, bg `#08171A`/kind fill, text `#FFB3E6` with the cube icon and `drop.label` (`upuść → 1 skill`, the number = skills after drop; the label is formatted by the caller) and the FACE border turns dashed magenta (the mock's 2px dashed `#F25FC4` face border). `invalid` (node cannot take the skill: already assigned, visibility conflict): dashed `#FF8FA3` and `invalidLabel` (`ten Skill jest już tutaj`), cursor `not-allowed`.
6. After a drop the node plays a 400ms confirmation (tab flashes mint, count updates) unless reduced motion; failure flashes the error tint and announces the reason through the adapter's live region. The visuals are fully controlled by props; this task contains no drag logic.
7. All state colours/glows use tokens (`--om-glow-node-*`, `--om-ring-node-selected`); `NodeStateStyles` is a CSS-module exported helper `nodeStateClass(state)` + `statusTextFor(state)`.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the four state tiles (Developer selected with violet ring and done status; QA working with magenta glow and `● testy e2e 38 z 52`; Security waiting with the amber glow; Senior Reviewer as the drop target with dashed magenta border and `upuść → 1 skill`). Extras zoom on each. Not drawn: error, skipped, disabled, validation badge, invalid drop, hover/focus. NOTE: in the mock the zoom toolbar overlaps the lower nodes (Developer, Security) and the viewport clips them at 900px: ignore the overlay and the clipping when comparing; the full tile is 224x112 world px.

## 7. Reuse

Consumes `ui:StatusText` (SVG glyph variants, E21), `ui:Pill`, `ui:Tooltip`, and the tile from OVE_DS088. Drop semantics come from OVE_DS067 (`lib:skillDragPayload`). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). `waiting-approval` is purely informational: approving happens in the Approvals view, not by clicking the node. The drop-valid visual only appears when the caller passes `accepting='valid'`, which the adapter derives from `canAccept` (re-checked on drop, so a spoofed drag cannot attach a Skill).

## 10. Errors and edge cases

- Unknown state -> idle + dev warning.
- `statusText` missing -> nothing rendered but the sr-only state word remains.
- `drop.active` while `disabled` -> ignored.
- Both error and working flags -> error wins.

## 11. Acceptance criteria

- [ ] Given each state, Then the computed box-shadow equals the table value.
- [ ] Given `working` + reduced motion, Then no animation runs.
- [ ] Given `drop.accepting=valid`, Then the Skills tab text is `upuść → 1 skill` and the face border is dashed magenta.
- [ ] Given `invalid`, Then the reason text and `not-allowed` cursor show.
- [ ] axe: status words exist for every state (not colour only).
- [ ] Visual match with the four crops within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- DESIGN GAP E29: error/skipped/disabled/validation looks are derived (listed above).
- ASSUMPTION: error colour is the existing `#FF8FA3`.
