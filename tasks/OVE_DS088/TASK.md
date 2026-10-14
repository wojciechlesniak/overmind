---
id: OVE_DS088
title: Build NodeTile anatomy (4 kinds, tabs, ports, model pill, ghost layers)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS017, OVE_DS019, OVE_DS020, OVE_DS039, OVE_DS087]
soft_depends_on: []
provides: ["ui:NodeTile", "ui:ModelPill"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Avatar", "ui:Pill", "ui:StatusText", "ui:Port", "ui:NodeTab", "ui:SkillsTab", "ui:VisibilityBadge"]
owns: ["packages/ui-kit/src/canvas/NodeTile/**"]
reads: []
design: design.png
design_source: "Main#canvas/node-product-owner (anatomy) (crop 400,428,190,115 CSS px); design-discussion.png = Main (crop 636,430,190,160); design-lane.png = Main (crop 360,745,190,110)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19, 28, 25]
---

# OVE_DS088: Build NodeTile anatomy (4 kinds, tabs, ports, model pill, ghost layers)

## 1. Summary

Builds the static visual anatomy of a Workflow node tile: 224x112 face with 2px kind border, type tab top-left, Skills tab top-right, kind icon, title, status line, model pill overlapping the bottom edge, left/right ports and the stacked ghost layers; kinds agent-public, agent-private, lane (build/qa/review) and discussion. States are layered by OVE_DS089.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.2 (NodeTile), B3 (NodeTab, SkillsTab), B4 (Port), E15, E16, styl-wizualny.md. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). A Node is an Agent (or a Discussion) placed in a Workflow. Its visual contract (styl-wizualny): the TAB top-left says what it is (PUBLICZNY, PRYWATNY, TOR · BUILD, DYSKUSJA · GRILL-ME), the TAB top-right is the Skills slot and a drop target, the model pill overlaps the bottom edge. Visibility is always a word (ADR 0028). A TOR (Lane) node drives Tasks across the Task Board (ADR 0011, glossary: Lane).

## 3. Scope (in)

- `NodeTile` presentational component and its sub-parts, kind colour mapping, stack (ghost) rendering, port slots, sizes, text overflow rules, stories for 4 kinds x idle.

## 4. Out of scope

- State glows and drop-target visuals (OVE_DS089), edges, drag and selection handling (OVE_DS096), React Flow wiring (OVE_DS095).

## 5. Detailed requirements

1. `NodeTileProps`:
   ```ts
   interface NodeTileProps {
     kind: 'agent-public' | 'agent-private' | 'lane-build' | 'lane-qa' | 'lane-review' | 'discussion';
     title: string; statusText?: string; state?: NodeVisualState; /* visuals in nodestates */
     tabLabel: string;                       // 'PUBLICZNY' | 'PRYWATNY' | 'TOR · BUILD' | 'DYSKUSJA · GRILL-ME'
     skills?: { count: number; label: string; dropLabel?: string };   // '2 skille'
     model?: { label: string; hue: AgentHue; initials: string };    // 'Sonnet 5.5'
     stack?: 0 | 1 | 2;                      // ghost layers (default 2 like the mock; see E15)
     icon?: IconName;                        // kind default: agent `workflow`, lane `board`, discussion `discussion`
     renderPort?: (p: { side: 'left' | 'right'; role: 'in' | 'out' }) => ReactNode;   // adapter seam
     size?: { w: number; h: number };
     onOpenSkills?(): void;
   }
   ```
   Root `role="group"` with `aria-label` `{tabLabel}: {title}` (matches the mock aria), `data-kind`, `data-state`.
2. Geometry (exact, world px): root 224x112 (discussion 240x112), children absolutely positioned. Main face: radius 20, `border: 2px solid <kind>`, fill `<kind fill>`, `padding: 16px 14px 24px`, flex column centred, gap 3. Kind colours (border / fill): agent-public `#6FA8FF` / `#0B1424`; agent-private `#9B7BFF` / `#130C22`; lane-* `#62E3B4` / `#08171A`; discussion `#C9B8FF` / `#140F22` (all via tokens `--om-node-*`).
3. Ghost layers (E15, kept as the mock until the Owner decides): two aria-hidden copies of the face at `(6,6)` opacity .45 and `(12,12)` opacity .22 with the same border and fill, drawn behind. `stack` 0/1/2 controls how many render. Default for our kit = what the caller passes; Storybook shows all three. Recommendation recorded in section 14: stack only inside loops with the iteration count in the tab.
4. Face content: kind icon 18px top-left at `(12,14)` stroke 1.8 in the kind colour; title 20/700/-0.01em `#F6F1FF` centred (2-line clamp, `overflow-wrap:anywhere`, never wider than 196px); status line 12px centred (single line, `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 194px`, title attr) coloured by state (see OVE_DS089); the status glyph is an SVG (E21) followed by text.
5. Type tab (`ui:NodeTab`): absolute `left: 18px; top: -13px; padding: 4px 10px; border-radius: 8px; background: <kind>; color: #0A0710; font: 700 11px mono; letter-spacing .12em; white-space: nowrap`, text = `tabLabel` (a word, E16). Skills tab (`ui:SkillsTab`): absolute `right: 14px; top: -13px; display: inline-flex; gap: 5px; padding: 3px 9px; border-radius: 999px; border: 2px solid <kind>; background: <fill>; color: <kind>; mono 11/500`; 12px `skill` cube icon + `skills.label` (`2 skille`, `1 skill`); a `button` when `onOpenSkills` is given (opens the Inspector Skills list), `nodrag nopan` class so React Flow does not start a node drag from it. Tabs never exceed the tile width: label ellipsis at 120px.
6. Ports (`ui:Port`, slot `renderPort`): 14x14 circle, `border: 2.5px solid <kind>`, bg `#0A0710`, at `left: -7px; top: 49px` (input) and `right: -7px; top: 49px` (output). In kit/static mode the port is the visual only; in the adapter `renderPort` returns a React Flow `<Handle>` styled by this visual (same box). Port hit area 24x24 (invisible padding) for pointing, visual stays 14.
7. Model pill (`ModelPill`): absolute `left: 22px; top: 95px`, inline-flex gap 8, `padding: 3px 12px 3px 3px`, radius 999, `border: 1px solid #2A2040`, bg `#17111F`, 12px `#EFE9F7` nowrap; leading `ui:Avatar` 26 inside a 2px ring in the kind colour (`ring` prop of Avatar). It overlaps the bottom edge (face bottom = 112, pill spans 95..~126). Label truncates at 120px with title.
8. Lane kinds (`lane-build|qa|review`) use the `board` icon (three bars) and tab labels `TOR · BUILD`, `TOR · QA`, `TOR · REVIEW`; `discussion` uses width 240 and (R) an output caption below (`3 decyzje → 5 Zadań na Tablicy`, mono 12 `#A79BBF`) supplied as `caption` prop and rendered outside the face at `top: 112 + 14`.
9. The component is `React.memo`'d; props are primitives/stable objects; no hooks that subscribe to viewport. Focusable root (`tabIndex=0` only when `interactive`), the focus ring uses the global ring drawn OUTSIDE the selection ring.
10. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
11. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
12. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
13. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
14. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
15. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
16. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Product Owner tile with all anatomy: `PUBLICZNY` tab (blue), `2 skille` Skills tab, `workflow` icon, title, mint status `✓ historie użytkownika`, ports, model pill `Sonnet 5.5` with the PO avatar ring, two ghost layers. `design-discussion.png`: `DYSKUSJA · GRILL-ME` lavender tile with caption. `design-lane.png`: TOR tile (Developer) with state in OVE_DS089. All numbers come from the mock HTML. Not drawn: private kind alone (violet) outside Security, no skills, long title, no model.

## 7. Reuse

Consumes `ui:NodeTab`, `ui:SkillsTab`, `ui:Port`, `ui:Avatar` (ring), `ui:StatusText`, `ui:Icon`. Part 1 owns the NodeTab/SkillsTab/Port primitives; this task only composes them (if a prop is missing, record it in section 14, do not fork). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). Tab and visibility words are mandatory props, so a private node can never render without the word `PRYWATNY` (ADR 0028).

## 10. Errors and edge cases

- No `model` -> pill omitted, bottom padding unchanged.
- No skills -> Skills tab omitted and, in edit mode, shown as a dashed empty tab by OVE_DS089.
- Title longer than 2 lines -> clamped with title attr.
- Unknown kind -> neutral grey kind with the raw tab label.
- `stack` > 2 -> 2.

## 11. Acceptance criteria

- [ ] Given the PO fixture, Then tab, Skills tab, ports and pill positions equal the spec values (unit test reads computed style).
- [ ] Given each of the four kinds, Then border/fill colours match the table.
- [ ] Given a 60-character title, Then it clamps to 2 lines inside the face.
- [ ] Given `stack=0`, Then no ghost layers render.
- [ ] The accessible name is `{tabLabel}: {title}`.
- [ ] Visual match with `design.png` and `design-discussion.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN question 2 (E15): meaning of ghost layers. Default: render per `stack` prop, mock shows 2 everywhere.
- DESIGN GAP: private-kind inside Workflow without Skills tab.
