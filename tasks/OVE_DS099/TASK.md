---
id: OVE_DS099
title: Build CanvasToolbar and ValidationBadge
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS015, OVE_DS017, OVE_DS022, OVE_DS028, OVE_DS039, OVE_DS087]
soft_depends_on: []
provides: ["ui:CanvasToolbar", "ui:ValidationBadge"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:IconButton", "ui:Button", "ui:Divider", "ui:Pill", "ui:Popover", "ui:Kbd"]
owns: ["packages/ui-kit/src/canvas/CanvasToolbar/**"]
reads: []
design: design.png
design_source: "Main#canvas/zoom-toolbar (crop 335,812,330,66 CSS px); design-badge.png = Main (crop 940,390,190,40)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19]
---

# OVE_DS099: Build CanvasToolbar and ValidationBadge

## 1. Summary

Builds the floating canvas toolbar (zoom out, `70%` label, zoom in, divider, `Cofnij`, `Ponów`, search node, fit) over `CanvasViewportController` and the `ValidationBadge` pill (`Walidacja: 0 błędów`, plus warning/error variants with a popover list).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.8 (CanvasToolbar), C11.10 (ValidationBadge), E29. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Zoom/fit/undo/search sit in one toolbar (mock `role="toolbar" aria-label="Widok"`). The validation badge tells the Owner whether the Workflow can be published/run; validation is computed by the engine, the badge only shows it (ADR 0019).

## 3. Scope (in)

- Toolbar, zoom label, buttons with tooltips, node search popover trigger, `ValidationBadge` variants and issue list, stories.

## 4. Out of scope

- Zoom logic (OVE_DS087 controller), undo history (OVE_DS096), validation computation (engine).

## 5. Detailed requirements

1. `CanvasToolbarProps { controller: Pick<CanvasViewportController, 'zoomIn'|'zoomOut'|'fitView'>; zoomPercent: number; canUndo: boolean; canRedo: boolean; onUndo(): void; onRedo(): void; onSearch(): void; labels: { toolbar: string; zoomIn: string; zoomOut: string; undo: string; redo: string; search: string; fit: string }; mode?: 'edit' | 'view' }`. Container `position: absolute` (slot bottomLeft: `left 10, bottom 10`), `role="toolbar" aria-label="Widok"`, flex gap 4, padding 4, radius 14 (mock; inventory 16), bg `#140F20` (alpha .92 token `bg-overlay`), 1px `line`.
2. Buttons 40x40 radius 10: `−` (`Pomniejsz`), zoom label mono 12/500 `70%` (min-width 48, centred, `aria-live=off`, click resets to 70% as a button with name `Resetuj powiększenie`), `+` (`Powiększ`), 1x22 divider, text buttons `Cofnij` / `Ponów` (13px `#A79BBF`, padding 0 12, disabled at .4 opacity + `aria-disabled` when `!canUndo/!canRedo`; hidden in `view` mode), divider, search icon button (`Szukaj Węzła`, opens the feature's node search Popover; `Ctrl/Cmd+F` shortcut documented), fit icon button (`expand`, `Dopasuj widok`). Roving tabindex per toolbar pattern (arrows move, Home/End).
3. Zoom bounds: `−` disabled at 10%, `+` at 200%. Every icon button has a `Tooltip` with the shortcut (`Pomniejsz · −`).
4. `ValidationBadgeProps { status: 'valid' | 'warning' | 'error' | 'checking'; label: string; issues?: { id: string; severity: 'warning'|'error'; text: string; nodeId?: string }[]; onFocusNode?(nodeId: string): void }`: slot topRight (`top 10, right 10`), pill padding 6 10, radius 999, bg `#140F20`, 1px `line`, mono 12; dot 6 with glow: valid mint (`Walidacja: 0 błędów`, mint text), warning amber (`Walidacja: 2 ostrzeżenia`), error `#FF8FA3` (`Walidacja: 3 błędy`, with `✗` glyph), checking grey spinner. When `issues` exist the badge is a button opening a `ui:Popover` list (severity icon + text + `Pokaż` link calling `onFocusNode`). Status is words + glyph (E21).
5. The toolbar and badge never overlap each other or the minimap: the stage overlay slots reserve space; at stage width < 520 the `Cofnij/Ponów` labels collapse to icons (`undo`, `redo`).
6. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
7. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
8. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
9. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
10. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
11. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
12. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the toolbar bottom-left: `−`, `70%`, `+`, divider, `Cofnij`, `Ponów`, divider, search. `design-badge.png`: mint `Walidacja: 0 błędów` pill. Not drawn: disabled undo, bounds, fit button, warning/error badge and popover, view mode.

## 7. Reuse

Consumes `ui:IconButton`, `ui:Divider`, `ui:Pill`, `ui:Popover`, `ui:Tooltip`, `ui:Kbd`; controller from OVE_DS087. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). The badge reflects engine validation only; a `valid` status cannot be set by the component. Issue text is untrusted (may quote node titles).

## 10. Errors and edge cases

- `zoomPercent` NaN -> shows `—`.
- Issues > 50 -> popover scrolls, first 50 shown + `+N`.
- `issues` empty but status `error` -> badge shows the label only.
- `onFocusNode` for a missing node -> ignored.

## 11. Acceptance criteria

- [ ] Given zoom 70, Then the label reads `70%` and `−`/`+` are enabled.
- [ ] Given zoom at 200, Then `+` is `aria-disabled`.
- [ ] Given `canUndo=false`, Then `Cofnij` is disabled.
- [ ] Given an error badge with issues, Then the popover lists them and `Pokaż` calls `onFocusNode`.
- [ ] Roving tabindex: arrows move focus among toolbar buttons.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: radius 14 follows the mock (inventory says 16).
- OPEN: node search UI (popover with filter) is a feature; only the trigger is here.
