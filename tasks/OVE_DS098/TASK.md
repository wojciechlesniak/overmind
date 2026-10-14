---
id: OVE_DS098
title: Build CanvasPalette (node chips) and CanvasLegend (tab on tile)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS019, OVE_DS022, OVE_DS031, OVE_DS039, OVE_DS040, OVE_DS088]
soft_depends_on: []
provides: ["ui:CanvasPalette", "ui:PaletteChip", "ui:CanvasLegend"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Button", "ui:SectionLabel", "ui:Pill", "ui:VisibilityBadge", "ui:Card"]
owns: ["packages/ui-kit/src/canvas/CanvasPalette/**"]
reads: []
design: design.png
design_source: "Main#canvas/nodes-heading + node-palette (crop 72,750,240,150 CSS px); design-legend.png = Main (crop 880,415,235,140)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19, 28]
---

# OVE_DS098: Build CanvasPalette (node chips) and CanvasLegend (tab on tile)

## 1. Summary

Builds the lower half of the canvas left panel (`Węzły` heading and wrapping palette chips: Agent, Parallel, Join, IF, Loop, Dyskusja, Review) with the drag source behaviour, and the floating `ZAKŁADKA NA KAFELKU` legend card that explains tab words and the Skills slot.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.6 (CanvasPalette, legend), E25 (TOR = Lane). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The palette lists the node kinds the Owner can add (SPEC 8). Only part of the list is drawn in the mock (it overflows the panel and scrolls). The legend explains the tab on every tile: PUBLICZNY, PRYWATNY, TOR (the Lane the node drives on the Task Board) and the Skills slot.

## 3. Scope (in)

- `CanvasPalette`, `PaletteChip` (draggable), `CanvasLegend`, overflow scroll, keyboard add, stories.

## 4. Out of scope

- Drop handling and node creation (OVE_DS096), node visuals (OVE_DS088).

## 5. Detailed requirements

1. `PaletteChipProps { kind: NodeKind; label: string; icon: IconName; onAdd?(kind: NodeKind): void; disabled?: boolean; disabledReason?: string }`: `button` height 40, padding 0 14, radius 12, gap 8, bg `bg-surface` + 1px `line`, icon 16 + label 14/600; hover border `line-strong`; `draggable`: payload MIME `application/x-overmind-node+json` `{ v:1, kind }` (kind from the `NodeKind` allowlist), `setDragImage` = a miniature of the default tile, `effectAllowed='copy'`. `Enter`/`Space` = `onAdd(kind)` (keyboard alternative: node added at the viewport centre by OVE_DS096).
2. `CanvasPaletteProps { heading: string; items: PaletteChipProps[]; labels: { list: string } }`: heading `Węzły` 18/700, chips in a wrapping flex (`gap: 8px`), width = panel 211 (chips measured 83.6 for `Agent`: content width, wrap), the panel scrolls (the mock clips it; `overflow: auto` inside the SidePanel, G5). Items per mock: `Agent` (`users`), `Parallel` (`workflow`), `Join` (`workflow`), `IF` (`branch`), `Loop` (`refresh`), `Dyskusja` (`discussion`), `Review` (`check`), icons from the extra icon pass. Disabled chips (view mode) show `aria-disabled` + reason tooltip.
3. `CanvasLegendProps { heading: string; rows: { tab: { label: string; kind: 'public'|'private'|'lane' | 'skills' }; text: string }[] }`: floating card in the stage `topLeft`-ish overlay (mock world `left: 790, top: 40, width: 310`, scaled with the world in the mock; in our overlay it is screen-space, width 217 at 70%): bg `rgba(20,15,32,.92)`, radius 16-18, 1px `line`, padding 12-16, gap 10; heading mono 11 `ZAKŁADKA NA KAFELKU` +0.1em `text-muted`; rows: tab sample (`NodeTab` filled public `#6FA8FF`, private `#9B7BFF`, lane `#62E3B4`, or the Skills tab outline with `2 skille`) + text 14px (`we wszystkich Workspace'ach`, `tylko w tym Workspace`, `prowadzi Zadania po Tablicy`, `tu upuszczasz Skille`). The legend is dismissible (`close` button, remembered by the feature) and collapsible; `role="note"`.
4. The legend samples use the SAME `NodeTab`/`SkillsTab` primitives as the tile (single source of truth), so a change in tab styling updates the legend. Terminology (E25): UI says `TOR`, code and slugs say `lane`.
5. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
6. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
7. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
8. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
9. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
10. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
11. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the `Węzły` heading and the first palette chips (`Agent`, `Parallel`, `Join`, `IF`, ...) at the bottom of the left panel (clipped in the mock; the implementation scrolls). `design-legend.png`: the legend card with the four rows. Not drawn: hover/focus, disabled chips, drag ghost, collapsed legend, remaining chips (`Loop`, `Dyskusja`, `Review`).

## 7. Reuse

Consumes `ui:NodeTab`/`ui:SkillsTab` (part 1), `ui:Card`, `ui:SectionLabel`, `ui:Button` (`palette` variant), `ui:Icon`. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Drag payload is a kind id only (validated allowlist on drop); a chip cannot create any node kind outside `NodeKind`.

## 10. Errors and edge cases

- Unknown icon -> neutral placeholder.
- Panel narrower than a chip -> chip shrinks with ellipsis.
- Legend row empty text -> row hidden.

## 11. Acceptance criteria

- [ ] Given the seven chips, Then they wrap within 211px and the panel scrolls vertically.
- [ ] Given dragstart on a chip, Then the payload has our MIME with `{v:1,kind}` only.
- [ ] Given `Enter` on a chip, Then `onAdd(kind)` fires.
- [ ] Given the legend, Then tab samples are rendered with the same primitives as tiles.
- [ ] Visual match with `design.png` and `design-legend.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: icons for IF/Loop/Review come from the extra icon pass (UI-06).
- OPEN: legend visible by default (default yes, dismissible).
