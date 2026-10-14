---
id: OVE_DS043
title: Build TopBar composition with WorkspaceSwitcher, no-wrap layout and responsive collapsing
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS009, OVE_DS013, OVE_DS020, OVE_DS028, OVE_DS029, OVE_DS039, OVE_DS042]
soft_depends_on: []
provides: ["ui:TopBar", "ui:WorkspaceSwitcher"]
needs: ["ui:tokens", "ui:Menu", "ui:StatusDot", "ui:Icon", "ui:Button", "ui:Tooltip"]
owns: ["packages/ui-kit/src/shell/TopBar/**", "packages/ui-kit/src/shell/WorkspaceSwitcher/**"]
reads: []
design: design.png
design_source: "Main#shell/top-bar (crop 72,0,1368,117 CSS px); design-switcher.png = Main (crop 72,0,520,67); design-onerow.png = Pulpit (crop 72,0,1368,67)"
spec_refs: ["SPECIFICATION 13"]
adr_refs: [18, 10]
---

# OVE_DS043: Build TopBar composition with WorkspaceSwitcher, no-wrap layout and responsive collapsing

## 1. Summary

Builds the top bar header: Workspace switcher with path, then the status controls from OVE_DS042, laid out in ONE row that never wraps (inventory E1) with defined collapsing behaviour for narrow windows. Also builds the `WorkspaceSwitcher` button + menu.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C1.2 and E1. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). In the mock the bar with the switcher wraps to two rows (117px) and Global Pause drops to row 2 - accidental, the inventory fixes it: `flex-wrap: nowrap`, path `max-width: 220px` with ellipsis, same 67px bar in every view including Workspaces, and the limit pill collapses below 1280px. Switching Workspace changes which Workspace's data every Workspace view shows; the Owner may have many (SPEC 3).

## 3. Scope (in)

- `WorkspaceSwitcher` (button + path + menu of Workspaces).
- `TopBar` (layout, container-query collapsing, slots for children).
- Variants: with switcher (Workspace views) and without (Workspaces dashboard, App settings).
- Stories at widths 1440, 1280, 1100, 960.

## 4. Out of scope

- The five controls (OVE_DS042).
- Routing, Workspace creation dialog and gateway data (SHELL / WSPACE areas).
- Responsive behaviour below 960px (the app minimum width is OPEN question 7; default minimum 960).

## 5. Detailed requirements

1. Props:
   ```ts
   interface WorkspaceOption { id: string; name: string; path: string; state: 'working'|'idle'|'paused'; isolated?: boolean }
   interface TopBarProps {
     workspace?: WorkspaceOption;            // undefined = variant without switcher
     workspaces?: WorkspaceOption[];         // menu entries
     onSelectWorkspace?: (id: string) => void;
     onCreateWorkspace?: () => void;
     controls: ReactNode;                    // composed from ui:LimitMeter, SlotsPill, ChannelPill, ApprovalsButton, GlobalPauseButton
     banner?: ReactNode;                     // ui:PausedBanner when paused
     labels: { switcher: string; createWorkspace: string; none: string };
   }
   ```
2. Layout: `<header>` with `display:flex; align-items:center; gap: 12px; flex-wrap: nowrap; padding: 12px 20px; min-height: 67px; background: bg-panel (#0D0915); border-bottom: 1px solid line-subtle (#241B36); container-type: inline-size`. Row height is 67 (items 28-42px high). A spacer (`flex: 1 1 0; min-width: 12px`) separates the left group (switcher + path) from `controls`. The bar MUST be 67px high at every width >= 960; no element may wrap or push another to a second row.
3. Shrink order (container queries on the header, not media queries, because the bar width = window - 72): (1) the path shrinks first, `max-width: 220px` then down to 0 with ellipsis; below 1100px the path is hidden and moves into the switcher tooltip; (2) below 1280px `LimitMeter` switches to `compact`; (3) below 1100px `SlotsPill` text collapses to `3/3` (label from `labels`) and `ChannelPill` to dot only with the label as tooltip/aria-label; (4) `ApprovalsButton` and `GlobalPauseButton` never collapse and never shrink (`flex-shrink: 0`).
4. `WorkspaceSwitcher`: button min-height 40, padding 0 12, radius 12, 1px `line`, fill `bg-surface`, gap 8; 10px `StatusDot` (magenta + glow = a Run is working, grey = idle/paused, per the Workspace card state) + name 15/700 (ellipsis at 220px, title) + `chevron-down` 14 (E4: not chevron-right; rotates 180deg when open) in `text-muted`. Next to it the path in mono 12 `text-muted`. Clicking opens `ui:Menu` (listbox pattern: `aria-haspopup="listbox"`, options `role="option"`, current one `aria-selected` with a check) listing every Workspace (dot, name, path, `izolowany` lock marker when `isolated`) and, after a divider, `+ labels.createWorkspace`. Type-ahead and arrow keys per `ui:Menu`.
5. Single Workspace or none: with `workspaces.length <= 1` the chevron stays (the menu still offers 'create'); with `workspace` undefined the left group renders only the `labels.none` text (used by the Workspaces dashboard where no Workspace is selected - but in that view the product shows the plain bar without the switcher, so `workspace` is simply omitted and the left group is empty).
6. `banner` renders above the row inside the same `<header>` (so total height = banner 36 + 67 while paused); the header keeps `position: sticky; top: 0; z-index: var(--om-z-sticky)`.
7. Landmarks: the `<header>` has `role="banner"` only when it is the page header; the status controls are wrapped in a `div role="group" aria-label` supplied by `labels` (add `statusGroup` to labels). Tab order: switcher, limit pill (if focusable popover), approvals, pause.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` is the CURRENT (accidentally wrapped, 117px) top bar of the Workflow view; `design-onerow.png` is the 67px one-row bar of the Workspaces view and is the target for ALL views after normalisation E1 (the visual test compares the one-row crop; the wrapped crop is kept only to show where Global Pause drops and must NOT be reproduced). `design-switcher.png` zooms the switcher and path. Switcher button: 40px, radius 12, #140F20 fill, 1px #2A2040, dot 10px magenta glow, name 15/700 #EFE9F7, chevron 14 #8C80A6, path mono 12 #8C80A6. Not in the mock: switcher menu, multi-Workspace list, hover/focus, narrow layouts, paused banner.

## 7. Reuse

Consumes `ui:Menu`, `ui:StatusDot`, `ui:Icon`, `ui:Tooltip`, `ui:Button` and the five controls from OVE_DS042 (passed as `controls`, so TopBar stays free of data and decoupled from their count: OCP).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. `controls`/`banner` slots keep the bar closed for modification when a new status item is added.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The switcher displays Workspace names/paths from the engine: render as text only; an isolated Workspace is always marked with the lock marker + word (`izolowany`) in the menu.

## 10. Errors and edge cases

- Name or path longer than the room -> ellipsis, full value in title/tooltip, bar height unchanged.
- Container narrower than 960 -> horizontal overflow is clipped at the status group (never wraps); documented minimum width.
- Workspace deleted while the menu is open -> menu closes and `onSelectWorkspace` is not called with a stale id.
- `workspaces` empty and `onCreateWorkspace` missing -> the switcher button is disabled.
- Paused banner appears while the menu is open -> menu stays open, layout shifts down without closing.

## 11. Acceptance criteria

- [ ] Given widths 1440, 1280, 1100 and 960 with the full fixture, Then the header height is exactly 67px (no banner) and no child wraps (measured with `getBoundingClientRect` in the visual test).
- [ ] Given the path longer than 220px, Then it is truncated with an ellipsis and exposed in the title.
- [ ] Given the switcher menu opened with keyboard (Enter), Then arrow keys move, Enter selects, Escape closes and returns focus to the button.
- [ ] Given `banner`, Then it renders above the row and the row stays 67px.
- [ ] Given the one-row fixture, Then the visual test matches `design-onerow.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Layout tests with Playwright component tests at 4 widths asserting height and no wrapping; keyboard tests for the menu.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION (E1): one row everywhere, 67px, path max-width 220px, compact limit below 1280px. This deliberately differs from `design.png` (wrapped).
- OPEN question 7: minimum window width; default 960px.
- DESIGN GAP: switcher menu is not drawn; built from `ui:Menu` rules (B18).
