---
id: OVE_DS101
title: Build AgentStateChipsStrip (Chief nadzoruje) and AgentStateChip
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS017, OVE_DS020, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:AgentStateChipsStrip", "ui:AgentStateChip"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Avatar", "ui:Pill", "ui:StatusText"]
owns: ["packages/ui-kit/src/canvas/AgentStateChipsStrip/**"]
reads: []
design: design.png
design_source: "Main#canvas/chief-supervision-strip (crop 330,280,802,94 CSS px); design-chips.png = Main (crop 341,285,520,84)"
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 8"]
adr_refs: [15, 23]
---

# OVE_DS101: Build AgentStateChipsStrip (Chief nadzoruje) and AgentStateChip

## 1. Summary

Builds the supervision strip above the canvas: a Chief block (avatar, `Chief nadzoruje`, `6 agentów · 3 z 3 slotów`) followed by a wrapping row of per-Agent state chips (done, working, waiting for Approval, idle, failed, paused).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.11 (AgentStateChipsStrip), B5, E27. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Chief supervises the Run and the Owner needs the per-Agent state at a glance (SPEC 4, 8). Agent state is a hint reported by CLIs/herdr; the strip shows what the engine passes, and the words `skończył`/`pracuje`/`czeka na Zgodę`/`czeka` carry the meaning (not only colour).

## 3. Scope (in)

- `AgentStateChipsStrip`, `AgentStateChip`, wrapping, states, interaction (click focuses the node), stories.

## 4. Out of scope

- State derivation (engine), the Inspector (OVE_DS103).

## 5. Detailed requirements

1. `AgentStateChipProps { name: string; initials: string; hue: AgentHue; state: AgentState; stateLabel: string; onSelect?(): void; selected?: boolean }`: pill radius 999, bg `#140F20`, 1px `line`, padding 4 14 4 4, height 34, gap 8: `Avatar` 24, name 13/600 `#EFE9F7`, state word mono 11/12 coloured by `agentStateTone` (OVE_DS040): done mint `skończył`, working magenta `pracuje`, waiting-approval amber `czeka na Zgodę`, idle grey `czeka`, failed error `błąd`, paused grey `wstrzymany`; an SVG glyph before the word (E21). Button when `onSelect` (click selects the node and centres it); `selected` = violet 1.5px border.
2. `AgentStateChipsStripProps { chief: { name: string; initials: string; summary: string /* '6 agentów · 3 z 3 slotów' */; label: string /* 'Chief nadzoruje' */ }; chips: AgentStateChipProps[]; labels: { list: string } }`: `ui:Card` tone `chief-strip` radius 16, padding 8 10 (mock strip 94 tall for two rows), 1px magenta-gradient edge (`rgba(242,95,196,.4)` to `line`), bg gradient `#1C0B19` to `#120D1C`; layout flex-wrap gap 8 12: Chief block (Avatar 28 chief gradient, label 14/700, summary mono 11 `text-muted`) then chips.
3. Wrapping: chips wrap to a second row; Chief block stays first; the strip height grows to content (mock 94 with two rows) and never exceeds 3 rows (beyond that a `+N` chip opens a popover list with the rest). Slots text `3 z 3 slotów` is supplied (it mirrors the top bar slots pill).
4. A11y: strip `role="region"` `aria-label` `Chief nadzoruje`; chips in a `<ul>`; a live region politely announces state changes (`Developer: pracuje`) throttled to once per 2s.
5. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
6. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
7. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
8. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
9. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
10. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
11. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the whole strip: Chief block + chips: Product Owner skończył (mint), Designer skończył, Developer skończył, QA pracuje (magenta), Security czeka na Zgodę (amber), Senior Reviewer czeka (grey). `design-chips.png`: chip detail. Not drawn: failed/paused, selected, hover/focus, overflow `+N`.

## 7. Reuse

Consumes `ui:Card`, `ui:Avatar`, `ui:StatusText`, `agentStateTone`/labels (OVE_DS040). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). State words are hints from CLIs (herdr state is only a hint): the strip never offers actions that assume the state is certain.

## 10. Errors and edge cases

- No chips -> only the Chief block.
- Name long -> ellipsis 140px.
- Unknown state -> neutral + raw label.
- > 12 chips -> `+N` popover.

## 11. Acceptance criteria

- [ ] Given the six fixtures, Then word + glyph + tone match the mock for each state.
- [ ] Given 10 chips, Then the strip wraps to at most 3 rows and a `+N` chip appears.
- [ ] Given click on a chip, Then `onSelect` fires.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION E27: chip state colours come from the shared state map.
