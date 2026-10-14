---
id: OVE_DS044
title: Build PageLayout and SidePanel (rail + top bar + tabs + list/main/detail grid)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS022, OVE_DS039, OVE_DS041, OVE_DS043]
soft_depends_on: []
provides: ["ui:PageLayout", "ui:SidePanel"]
needs: ["ui:tokens", "ui:Divider"]
owns: ["packages/ui-kit/src/shell/PageLayout/**", "packages/ui-kit/src/shell/SidePanel/**"]
reads: []
design: design.png
design_source: "Chief#layout (list panel + main + detail panel) (crop 72,117,1368,783 CSS px); design-board.png = Tablica (crop 72,117,1368,783)"
spec_refs: ["SPECIFICATION 13"]
adr_refs: [18]
---

# OVE_DS044: Build PageLayout and SidePanel (rail + top bar + tabs + list/main/detail grid)

## 1. Summary

Builds the fixed-height application frame and its panel presets: `rail + topbar + [tabs] + [left list panel] + main + [right detail panel]`, with scrolling inside panels only. Normalises page padding to 24 (E6) and exposes the panel width presets used by every view.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Chief.dc.html` and its 2x render `_design/views/Chief.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C1.4 (PageLayout), C1.5 (SidePanel) and A.9. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Screens have a fixed window height and scroll inside panels (styl-wizualny). Panel widths per view: list 270 (Chief, Direct chat), 290 (Agents), 340, 360 (Approvals), 400 (Decisions), 260 (Discussion), 250 (Runs), 240 (Workflow left, Workspace settings nav); detail 290 (Inspector), 300, 310, 320, 340. Page padding 22/24/26/28 in the mocks is normalised to 24 (dense canvas/board 20).

## 3. Scope (in)

- `PageLayout` (grid + slots + presets).
- `SidePanel` (left/right variants, scroll, padding).
- `PageMain` helper for padded scrolling main with `max-width` option.
- Stories for 6 layout combinations.

## 4. Out of scope

- Rail/TopBar/Tabs content (OVE_DS041, OVE_DS043, OVE_DS045).
- Feature panels (conversation list etc.).
- Responsive collapsing of panels below 1100px (OPEN).

## 5. Detailed requirements

1. `PageLayout` props:
   ```ts
   type ListWidth = 240 | 250 | 260 | 270 | 290 | 340 | 360 | 400;
   type DetailWidth = 290 | 300 | 310 | 320 | 340 | 400;
   interface PageLayoutProps {
     rail: ReactNode; topBar: ReactNode; tabs?: ReactNode;
     list?: ReactNode; listWidth?: ListWidth;     // left SidePanel slot
     detail?: ReactNode; detailWidth?: DetailWidth; // right SidePanel slot
     children: ReactNode;                          // main
     mainPadding?: 'page' | 'dense' | 'none';       // 24 | 20 | 0
     mainMaxWidth?: number;                         // e.g. 780 chat column, 980 settings
   }
   ```
   Widths are a closed union so tests can enumerate them; adding a preset is a one-line change.
2. Structure: root `display: grid; grid-template-columns: 72px minmax(0,1fr); height: 100dvh; min-height: 560px; overflow: hidden; background: bg-app`. Column 2 is a flex column: `topBar` (auto), `tabs` (auto), then a row `display:flex; min-height:0; flex:1` holding list | main | detail. Only panels and `main` have `overflow: auto`; the document never scrolls (`html, body { overflow: hidden }` is the app's concern, asserted in a story decorator).
3. `SidePanel` props `{ side: 'left'|'right'; width: number; padding?: number /* default 16; 20-22 allowed */; children; 'aria-label': string; as?: 'aside'|'section'|'nav' }`. Left: background `bg-panel-alt` (#0C0814), border-right 1px `line-subtle`. Right: background `bg-panel` (#0D0915), border-left 1px `line-subtle`. Flex column, gap 16, `overflow-y: auto; overscroll-behavior: contain`, `flex: 0 0 <width>px`, `min-width: 0`. Scrollbar styled thin (token), always reachable by keyboard (`tabindex=0` only when it actually overflows, with the label as name).
4. Main: `flex: 1 1 0; min-width: 0; overflow: auto;` padding by `mainPadding` (page = 24 all sides, dense = 20, none = 0; E6). When `mainMaxWidth` is set the content is wrapped in a centred `max-width` box (chat column 780, Discussion 820, settings 980) that never exceeds the panel.
5. Landmarks: rail is `<nav>`, topBar `<header>`, main `<main id="main">`, side panels `<aside>` with labels; a visually-hidden 'skip to main' link as the first focusable element (label from props `labels.skip`).
6. Panel width presets are exported as constants `LIST_WIDTHS`/`DETAIL_WIDTHS` (the Skill library detail 340 equals the Direct chat terminal panel 340; Chief right 300; Discussion right 310; Task Board 320; Workflow Inspector 290; Activity usage 300; Approvals list 360; Decision list 400).
7. When the window is narrower than the sum of panel widths + 320px for main, the detail panel is hidden first (becomes an overlay drawer opened by the feature, out of scope), then the list panel; below that `main` keeps `min-width: 320px` and the layout scrolls horizontally inside `main` only. Document this in a short Storybook docs block; real responsive behaviour is OPEN question 7.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` shows the Chief view frame: 270px conversation list (`bg-panel-alt`), central column, 300px right panel, each with its own scroll; `design-board.png` shows the Task Board frame (main + 320px detail, dense padding 20). Heights: bar 67 + tabs 45 where present (in the mock tabs start at y=117 because the bar wrapped; after E1 they start at y=67). NOTE: after E1 all vertical offsets in mock crops shift up by 50px; panel heights become 833 (no tabs) / 788 (with tabs) at 900px viewport. Not in the mock: panel collapse, drawer overlays, loading skeleton frame (use `ui:Skeleton` in features).

## 7. Reuse

Consumes `ui:Divider` for borders only where a visible divider element is needed; tokens for colours. Composes the slots from OVE_DS041, OVE_DS043, OVE_DS045; features pass their own panels.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Layout only; no data.

## 10. Errors and edge cases

- Both `list` and `detail` absent -> single-column main.
- Unknown width not in the union -> TypeScript error; at runtime clamp to the nearest preset.
- Nested scrolling inside `main` and a panel -> `overscroll-behavior: contain` prevents scroll chaining.
- Very small window height (< 560) -> root keeps `min-height: 560px` and the window scrolls (documented fallback).

## 11. Acceptance criteria

- [ ] Given the Chief fixture (list 270, detail 300), Then column widths are exactly 270/300 and main fills the rest at 1440 (measured).
- [ ] Given 2000 lines of content in a panel, Then only that panel scrolls and the document does not.
- [ ] Given Tab from the top, Then the first focusable element is the skip link, which moves focus to `#main`.
- [ ] Given `mainMaxWidth=780`, Then content is centred, never wider than 780.
- [ ] Visual match with `design.png` frame (colours/borders) within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Layout measurements for 8 presets; scroll containment test.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION (E6): page padding 24, dense 20. Mocks use 22-28.
- OPEN question 7: behaviour under 1280px; default as in requirement 7.
