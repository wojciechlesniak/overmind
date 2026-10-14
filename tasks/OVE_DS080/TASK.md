---
id: OVE_DS080
title: Build FallbackOrder and NumberStepper
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS015, OVE_DS031, OVE_DS039, OVE_DS040, OVE_DS078]
soft_depends_on: []
provides: ["ui:FallbackOrder", "ui:NumberStepper"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:IconButton", "ui:CalloutAmber"]
owns: ["packages/ui-kit/src/settings/FallbackOrder/**"]
reads: []
design: design.png
design_source: "Polaczenia#conn/fallback-panel (crop 1120,162,320,738 CSS px); design-order.png = Polaczenia (crop 1141,268,279,170); design-stepper.png = Polaczenia (crop 1141,495,279,62)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [7, 22]
---

# OVE_DS080: Build FallbackOrder and NumberStepper

## 1. Summary

Builds the right panel of Connections: the reorderable fallback order list (grip + index + provider/model) with a keyboard-accessible reorder alternative, the `NumberStepper` for parallel agents ('Agenci naraz') and the amber compliance notice.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Polaczenia.dc.html` and its 2x render `_design/views/Polaczenia.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C9.4 (FallbackOrder), C9.5 (NumberStepper). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). When a provider limit is reached an Agent falls back to the next entry (SPEC 7, ADR 0007: model per Agent and per node). The number of agents running at once (default 3) is the global concurrency slot count shown in the top bar (`Agenci 3 z 3 naraz`). The amber note explains that CLI automation is subject to the provider terms.

## 3. Scope (in)

- `FallbackOrder` (drag reorder + move up/down buttons), `NumberStepper` (generic), the panel composition with `CalloutAmber`.

## 4. Out of scope

- Persisting the order, validating that a provider exists (feature).

## 5. Detailed requirements

1. `FallbackOrderProps { items: { id: string; title: string; subtitle?: string; disabled?: boolean }[]; onReorder(ids: string[]): void; labels: { list: string; moveUp: (t: string) => string; moveDown: (t: string) => string; position: (i: number, n: number, t: string) => string }; heading: string; description?: string }`. Ordered list `<ol>`; item: radius 14, padding 10 12, bg `#140F20`, 1px `line`, gap 10: index circle 24 (number 12/700, bg `list-selected`, violet ring), title 13/600 + subtitle mono 11 muted, trailing grip icon `grip` 16 (handle) and a `IconButton` pair `chevron-up`/`chevron-down` (visible on focus-within and hover; always in DOM for AT).
2. Reorder: pointer drag on the handle with native HTML5 DnD or pointer events (no dependency; use the same `lib:skillDragPayload`-free approach: a local pointer sorter, 6px activation distance); drop indicator is a 2px violet line between items. Keyboard: focus an item, `Alt+ArrowUp/Down` or the move buttons reorder, announced through a live region (`position` label: `Codex CLI, pozycja 2 z 4`). `onReorder` receives the full new id list; the component is controlled (reverts if the parent does not update).
3. `NumberStepperProps { value: number; min: number; max: number; step?: number; unit?: string; onChange(v: number): void; 'aria-label': string; label?: string }`: `IconButton` square 38 `minus`, value Bricolage 16/700 + unit word (`naraz`), `IconButton` `plus`; the control is `role="spinbutton"` on the value (`aria-valuenow/min/max`), ArrowUp/Down and PageUp/PageDown change by step/10, Home/End jump to min/max; buttons disable at the bounds (R: disabled look = .4 opacity + `aria-disabled`). Hold-to-repeat is NOT implemented.
4. Panel (`ConnectionsSidePanel` story composition, 320px `SidePanel`): heading `Kolejność zapasowa` 15/700 + description 12 muted, the list, then `Agenci naraz` row with the stepper (2 on the right) and below the amber `CalloutAmber` (`Automatyzacja CLI zależy od regulaminu dostawcy...`) pinned to the bottom (margin-top auto).
5. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
6. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
7. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
8. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
9. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
10. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
11. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the whole right panel (list with four entries 1..4, `Agenci naraz` stepper `3`, amber compliance note). Extra crops: the list and the stepper. Not drawn: drag state, focus, bounds-disabled stepper, single item, empty list.

## 7. Reuse

Consumes `ui:IconButton`, `ui:Card`, `ui:CalloutAmber` (OVE_DS040), `ui:SidePanel` (OVE_DS044). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Reordering is a pure view operation: the engine validates order and concurrency limits. Concurrency max is supplied by the feature (never allow > engine cap); the stepper does not exceed `max` by typing. Strings are text only.

## 10. Errors and edge cases

- Single item -> move buttons disabled, grip hidden.
- `value` outside [min,max] -> clamped for display and dev warning.
- Drag released outside -> order unchanged.
- Items change during drag -> drag cancelled.

## 11. Acceptance criteria

- [ ] Given Alt+ArrowDown on item 1, Then `onReorder` receives the swapped list and the live region announces the new position.
- [ ] Given value = max, Then the plus button is `aria-disabled`.
- [ ] Given ArrowUp on the spinbutton, Then `onChange(value+step)` fires.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: pointer sorter is implemented locally (no new dependency); OPEN whether to adopt `@dnd-kit` for all DnD (default: no, ADR 0018 stack only).
