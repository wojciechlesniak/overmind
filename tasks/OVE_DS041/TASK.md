---
id: OVE_DS041
title: Build AppRail with RailItem and LogoTile (72px navigation rail)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS009, OVE_DS010, OVE_DS019, OVE_DS022, OVE_DS028, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:AppRail", "ui:RailItem", "ui:LogoTile"]
needs: ["ui:tokens", "ui:Icon", "ui:LogoMark", "ui:Divider", "ui:Tooltip", "ui:CountBadge"]
owns: ["packages/ui-kit/src/shell/AppRail/**", "packages/ui-kit/src/shell/LogoTile/**"]
reads: []
design: design.png
design_source: "Main#shell/rail (crop 0,0,72,900 CSS px); design-active.png = Main (crop 8,110,56,120); design-logo.png = Main (crop 8,10,56,56)"
spec_refs: ["SPECIFICATION 13"]
adr_refs: [18]
---

# OVE_DS041: Build AppRail with RailItem and LogoTile (72px navigation rail)

## 1. Summary

Builds the 72px left navigation rail used by 14 of the 18 views: the logo tile, five primary route items, a divider, the Agents item and the Settings item pinned to the bottom, with active, hover, focus, tooltip and badge states. `LogoTile` is also exported because the wizard, Tray and Telegram reuse it at other sizes.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C1.1 (AppRail) and B15 (Tooltip). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The rail only holds places the Owner returns to daily; sub-sections go to tabs and urgent items to the top bar (styl-wizualny, 'Szkielet aplikacji'). Items: Workspaces (home), Chief (chat), Workflow (workflow), Task Board (board), Decision Register (scales), divider, Agents (agents), spacer, Settings (settings). Approvals has no rail item (opened from the top-bar button). Routing is owned by SHELL; this component is router-agnostic.

## 3. Scope (in)

- `LogoTile` (any size, with radius/mark table).
- `RailItem` (icon button/link, active/hover/focus/pressed/disabled, tooltip, optional badge).
- `AppRail` (layout, groups, divider, pinned footer, scroll behaviour, a11y landmark).
- Stories and visual test against the Main rail crop.

## 4. Out of scope

- Route table, active-route logic and the router link implementation (OVE_SHELL area; `AppRail` receives `renderLink`).
- Global Pause banner variant of the rail (none designed).
- TopBar (OVE_DS043).

## 5. Detailed requirements

1. `LogoTile` props `{ size?: number /* default 44 */; radius?: number; glow?: boolean /* default true */; 'aria-hidden'?: boolean }`. Box = square `size`, background `linear-gradient(160deg, bg-logo-tile-start, bg-logo-tile-end)` (#1E1330 -> #0A0710), 1px `line-strong` (#5B3E8F), `glow-logo` (0 0 22px rgba(242,95,196,.22)), contents `ui:LogoMark` centred. Size table (exact from the mocks): 28 -> radius 8, mark 20 (Tray); 42 -> radius 13, mark 28 (Telegram); 44 -> radius 14, mark 30 (rail); 46 -> radius 14, mark 30 (wizard). For other sizes radius = round(size*0.32), mark = round(size*0.68). The gradient id inside `LogoMark` MUST be unique per instance (`useId`) because several tiles can be on one page.
2. `RailItem` props `{ icon: IconName; label: string; active?: boolean; badge?: { count: number; label: string }; href?: string; onClick?: () => void; as?: 'button'|'a'|ElementType; disabled?: boolean }`. Box 44x44, radius 14 (`r-14`), icon 20px (`Icon size=20`). Inactive: color `text-secondary` (#A79BBF), `1px solid transparent` (keeps size identical to active), transparent fill. Active: 1px `line-strong`, fill `bg-raised` (#1C1330), color `text-bright` (#F6EFFF, E11), `glow-rail-active` (0 0 18px rgba(155,123,255,.25)), `aria-current="page"`. Hover (not in mock, std states): fill `bg-surface`, border `line-strong`, 120ms. Pressed: translateY(1px). Disabled: opacity .45 + `aria-disabled`.
3. Accessible name = `label` via `aria-label`; the visible tooltip (`ui:Tooltip`, placement `right`, offset 8, delay 400ms, shown on hover AND keyboard focus) shows the same `label`; the mock's native `title` attribute is dropped in favour of the tooltip (otherwise two tooltips appear).
4. Badge (not in mock, recommended): `ui:CountBadge` tone `amber` (E10), positioned `top:-4px; right:-4px`, hidden when `count <= 0`, capped display `9+`; `badge.label` is appended to the accessible name (for example `Chief, 2 unread`) and the badge itself is `aria-hidden`.
5. `AppRail` props:
   ```ts
   interface RailEntry { id: string; icon: IconName; label: string; badge?: RailItemProps['badge'] }
   interface AppRailProps {
     primary: RailEntry[];     // above the divider (5 in the product)
     secondary?: RailEntry[];  // below the divider (Agents)
     footer?: RailEntry[];     // pinned bottom (Settings)
     activeId?: string;        // item with aria-current="page"; undefined = none (Approvals view has none)
     renderLink: (entry: RailEntry, content: ReactNode, state: { active: boolean }) => ReactNode; // router link injection
     labels: { navigation: string };  // aria-label of the nav landmark
   }
   ```
   The component renders `<nav aria-label={labels.navigation}>` containing a `<ul>` of items; it never imports a router.
6. Layout (px, exact): width 72, `flex-shrink: 0`, height 100% of the app frame, padding 16 12, background `bg-panel` (#0D0915), right border 1px `line-subtle` (#241B36), column flex gap 6. `LogoTile` 44 at the top with margin-bottom 8 (first item lands at y=74 in the 900px viewport, then pitch 50: 74,124,174,224,274). The divider is `ui:Divider` 28px wide, centred, with margin 6 0 (Agents item lands at y=343). The footer group is pushed down with `margin-top: auto`; Settings sits at y=840 (bottom padding 16).
7. Small-window behaviour (open question 7: the window may be shorter than 900px): the middle region (primary + secondary) gets `overflow-y: auto` with the scrollbar visually hidden (`scrollbar-width: none`), the logo and the footer stay pinned. Minimum supported height 560px; below that the rail scrolls as a whole.
8. Keyboard: items are native links/buttons in DOM order (logo is not focusable), Tab moves through them, Enter/Space activates; focus ring per std states (`0 0 0 2px bg-app, 0 0 0 4px #9B7BFF`) drawn outside the 44px box and not clipped (`overflow: visible` on the item wrapper, scroll container has 4px inline padding to avoid clipping).
9. Do not hard-code the item list: the product list lives in `apps/desktop` (SHELL) as a manifest; stories use a fixture `railFixture.ts` with the Polish aria labels from the mock (`Workspace'y`, `Chief, czaty i Dyskusje`, `Workflow i Runy`, `Tablica Zadań`, `Rejestr decyzji`, `Agenci i Skille`, `Ustawienia`, nav label `Główna nawigacja`).
10. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
11. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
12. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
13. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
14. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
15. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
16. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` is the full 72x900 rail from the Workflow view (active = Workflow). `design-active.png` zooms the active item, `design-logo.png` the logo tile. Tokens: bg `bg-panel`, border `line-subtle`, active `bg-raised` + `line-strong` + `glow-rail-active`, icon strokes 1.8 `currentColor`. Icons: `home`, `chat`, `workflow`, `board`, `scales`, `agents`, `settings`. States NOT in the mock and derived: hover, focus-visible, pressed, disabled, tooltip, badge, long-label tooltip wrap (max-width 260), short window scroll. Per-view active item: Pulpit y=74, Chief y=124, Workflow y=174, Board y=224, Decisions y=274, Agents y=343, Settings y=840, Approvals none.

## 7. Reuse

Consumes `ui:Icon`, `ui:LogoMark`, `ui:Divider`, `ui:Tooltip`, `ui:CountBadge`, `ui:tokens`. MUST create `ui:LogoTile` here (reused by OVE_DS073, OVE_DS085, OVE_DS086). Must not duplicate Button styles (`RailItem` is its own control, not a Button variant, per inventory).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. `renderLink` inversion keeps routing (react-router/TanStack) out of ui-kit (DIP).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Tooltip and aria text come from props, so they are escaped text. The rail has no actions beyond navigation; there is no way to hide the Approvals entry point because it lives in the top bar.

## 10. Errors and edge cases

- `activeId` not found in any group -> no item is active, no `aria-current` (valid for the Approvals view).
- Two entries with the same id -> dev warning, keyed by index.
- Label missing -> TypeScript error (required prop); at runtime an empty label logs a dev warning because the item would be unnamed.
- Window height < 560 -> whole rail scrolls vertically, no clipped focus ring on the first/last item.
- `badge.count` 0 or negative -> badge not rendered.

## 11. Acceptance criteria

- [ ] Given the Workflow fixture, When rendered at 72x900, Then the item y positions are 74/124/174/224/274, Agents 343, Settings 840 (measured in the visual test within 1px).
- [ ] Given `activeId="workflow"`, Then exactly one element has `aria-current="page"` and carries the active styles.
- [ ] Given keyboard Tab from the page start, Then focus visits items in DOM order and each shows the 2px violet ring; hovering or focusing shows the tooltip after 400ms with the same text as the aria-label.
- [ ] Given a badge `{count: 12}`, Then `9+` is shown, the accessible name includes the badge label and axe is clean.
- [ ] Given `LogoTile` sizes 28/42/44/46, Then radius/mark follow the table.
- [ ] Visual match with `design.png` (rail) within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit: size table, badge cap, `aria-current`, tooltip on focus. Visual: rail crop for the 7 active positions.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: Approvals badge is NOT placed on the rail (the top-bar button owns it). Rail badges exist for future unread Chief messages only.
- OPEN (question 7): minimum window height; default 560px as above.
- Tooltip replaces native `title`; if part 1 `Tooltip` cannot show on focus, record it for part 1.
