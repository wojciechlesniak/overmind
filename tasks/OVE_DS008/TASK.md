---
id: OVE_DS008
title: "Theme root, base CSS (reset, focus, scrollbars) and ThemeRoot component"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS039, OVE_DS002, OVE_DS003, OVE_DS004, OVE_DS006, OVE_DS007]
soft_depends_on: []
provides: [ui:theme, ui:ThemeRoot]
needs: []
owns: [packages/ui-kit/src/theme/ThemeRoot/**, packages/ui-kit/src/theme/30-base.foundation.css, packages/ui-kit/src/theme/applyTheme.ts, packages/ui-kit/src/theme/__tests__/**]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 13]
adr_refs: [17, 18]
---

# OVE_DS008: Theme root, base CSS (reset, focus, scrollbars) and ThemeRoot component

## 1. Summary

Provide the global CSS foundation (box-sizing, root font and colour, button/input font reset, global `:focus-visible` ring, scrollbars, selection, `color-scheme: dark`) and the `ThemeRoot` component and `applyTheme()` helper that apps use to activate the dark theme. After this task, importing `@overmind/ui-kit/styles.css` once makes any page look like the mocks.

## 2. Context

Normalisations solved here: E9 (buttons inherit font: the canvas Agent chips show 13.33px because an unstyled `<button>` used the browser default), E19 (no `outline: none` without replacement), E20 (`box-sizing: border-box` globally so a 40px field is 40px, not 42px). The root of the mocks is Bricolage 14px colour `#EFE9F7` on `#0A0710`. The app is a fixed-height desktop window: screens never scroll the page, panels scroll internally (`styl-wizualny.md`).

## 3. Scope (in)

- `30-base.foundation.css` (layers `om.reset` and `om.base`).
- `ThemeRoot` component (`theme: 'dark'`, default; `as`, `fill`), `applyTheme(el = document.documentElement)`.
- Documentation of the global rules and the opt-outs in the story `Foundation/Theme`.

## 4. Out of scope

- Light theme: not planned for MVP (open question). A `light` value of the prop type is reserved but throws a dev error.
- Fonts and tokens: OVE_DS004 and token tasks. App-level layout: DS part 2 and SHELL area.

## 5. Detailed requirements

**5.1 Reset (`@layer om.reset`)**: `*, *::before, *::after { box-sizing: border-box; }`; `html, body { margin: 0; height: 100%; }`; `button, input, textarea, select { font: inherit; letter-spacing: inherit; color: inherit; }` (E9); `button { background: none; border: 0; padding: 0; cursor: pointer; }`; `button:disabled, [aria-disabled='true'] { cursor: not-allowed; }`; `a { color: inherit; text-decoration: none; }`; `textarea { resize: vertical; }`; `[hidden] { display: none !important; }` (the one allowed `!important`, documented); `svg { display: block; flex-shrink: 0; }` (icons inside flex rows never shrink or sit on a text baseline). List resets are NOT global: components that render `ul`/`ol` reset their own list style.
**5.2 Base (`@layer om.base`)**
1. `:root { color-scheme: dark; }`, `body, [data-om-theme] { background: var(--om-color-bg-app); color: var(--om-color-text-primary); font: 400 14px/1.4 var(--om-font-sans); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; -webkit-tap-highlight-color: transparent; }`; mono utilities: `.om-mono { font-family: var(--om-font-mono); font-variant-ligatures: none; font-variant-numeric: tabular-nums; }`.
2. Global focus: `:where(a, button, input, textarea, select, summary, [tabindex], [role='button'], [role='switch'], [role='tab'], [role='menuitem'], [role='option'], [role='radio']):focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--om-ring-focus); }` (zero specificity through `:where`, so components can refine). Inputs (`input:focus-visible, textarea:focus-visible`) additionally set `border-color: var(--om-color-violet-500)` (inventory B intro: "border to violet"); invalid fields use `--om-ring-focus-error`. No ui-kit rule may contain a bare `outline: none`/`outline: 0` (guard test greps `*.css`).
3. Selection: `::selection { background: var(--om-color-violet-a28); color: var(--om-color-text-bright); }`.
4. Scrollbars (panels scroll, not the page): `* { scrollbar-width: thin; scrollbar-color: var(--om-color-line) transparent; }` and WebKit pseudo-elements `::-webkit-scrollbar { width: 10px; height: 10px }`, thumb `background: var(--om-color-line); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box`, track transparent; thumb hover `--om-color-line-strong`.
5. Placeholder: `::placeholder { color: var(--om-color-text-muted); opacity: 1; }` (5.14:1 on surface).
6. `prefers-reduced-motion` blocks live in OVE_DS007; this file adds `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }`.
**5.3 `ThemeRoot`**
```ts
interface ThemeRootProps extends ComponentPropsWithoutRef<'div'> { theme?: 'dark'; as?: ElementType; fill?: boolean /* height:100%, overflow:hidden */ }
export function applyTheme(el?: HTMLElement, theme?: 'dark'): void   // sets data-om-theme
```
`ThemeRoot` renders a wrapper with `data-om-theme="dark"`, `data-om="ThemeRoot"`, background and colour from tokens; `fill` makes it the fixed-height app frame (`height: 100vh; overflow: hidden; display: flex; min-width: 0`). `applyTheme` sets the attribute on `document.documentElement` (used by `apps/desktop/src/main.tsx` and the Tray/Telegram preview windows).
**5.4 Guards**: a test fails if any ui-kit CSS contains `outline:\s*(none|0)\b` or `!important` (except the `[hidden]` line in this file).

## 6. Design notes

N/A (global foundation); verified through every other component's visual test and the Foundation/Theme story (page with all text styles on the app background).

## 7. Reuse

Tokens from OVE_DS002/003/004/006/007; `useReducedMotion` not needed here. Folder contract and layers from OVE_DS001; foundation aggregation from OVE_DS039.

## 8. Architecture and code placement

`packages/ui-kit/src/theme/`. CSS only plus one trivial component. Layer order makes ui-kit overridable by app CSS (OVE_DS001 5.2 item 8). No JS side effects at import time (SSR-safe, test-safe).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Focus visibility is a safety feature: with keyboard use, the Owner must always see which Approval button is focused. Forced-colours safety: the transparent outline stays visible under `forced-colors: active`.

## 10. Errors and edge cases

- Nested `ThemeRoot`: allowed, idempotent.
- `theme='light'` at runtime: throws in development, falls back to dark in production with `console`-free silent behaviour (no logging in ui-kit).
- A component inside `overflow: hidden`: ring clipped; component uses `--om-ring-focus-inset` (OVE_DS007).
- Third-party widgets with their own focus styling: out of scope.

## 11. Acceptance criteria

- [ ] Importing `styles.css` and rendering `<div data-om-theme>` gives `background #0A0710`, `color #EFE9F7`, `font 400 14px Bricolage Grotesque` (computed style test).
- [ ] A plain `<button>` inherits the page font (13.33px default is gone); a 40px-high `input` is 40px tall (box-sizing) (Playwright).
- [ ] Tabbing to any interactive element shows the 2px/2px ring; `outline` is `transparent`, not `none` (computed style).
- [ ] Guard test: no `outline: none`, no `!important` except `[hidden]`.
- [ ] Scrollbars are thin and dark in WebKit (screenshot baseline).
- [ ] `applyTheme()` sets `data-om-theme="dark"` on the element; `ThemeRoot fill` fills the viewport without page scroll.
- [ ] Story `Foundation/Theme` renders; axe clean.

## 12. Test plan

Vitest: `ThemeRoot.test.tsx`, `applyTheme.test.ts`, `base-css.guard.test.ts`. Playwright (OVE_DS012): computed-style assertions, scrollbar baseline. Commands as in OVE_DS001.

## 13. Parallelization notes

After OVE_DS007. Parallel with OVE_DS009 onward (icons and primitives only need the variables). Hotspot: `30-base.foundation.css` belongs to this task only; other tasks must not add global CSS (extension point: a new `NN-name.foundation.css` file via a proposal).

## 14. Open questions and assumptions

- ASSUMPTION: global mono ligatures off and root 14px as in the mocks.
- Open (inventory open question 4): light theme. Default: none; `ThemeRoot` keeps the prop for forward compatibility.
