---
id: OVE_DS007
title: "Elevation, glow, focus ring, state and motion tokens with reduced-motion handling"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS039, OVE_DS002, OVE_DS003]
soft_depends_on: []
provides: [ui:tokens-effects]
needs: []
owns: [packages/ui-kit/src/tokens/effects.tokens.ts, packages/ui-kit/src/theme/20-motion.foundation.css, packages/ui-kit/src/tokens/__tests__/effects.test.ts, packages/ui-kit/src/tokens/stories/Effects.stories.tsx]
reads: []
design: design.png
design_source: "Pulpit#dash/chief-summary + workspace cards (crop 100,165,992,380)"
spec_refs: [SPECIFICATION 13]
adr_refs: [18]
---

# OVE_DS007: Elevation, glow, focus ring, state and motion tokens with reduced-motion handling

## 1. Summary

Define glows and rings (the system uses glow instead of drop shadows), the global focus ring, the shared interaction-state rules (hover brightness, pressed offset, disabled opacity), motion durations and easings, the four looping animations (pulse, caret blink, spinner, shimmer) as keyframes, and the `prefers-reduced-motion` behaviour.

## 2. Context

Inventory A.6 (elevation), A.8 (motion), and the "std states" paragraph of section B: the mocks have no hover, focus, pressed, disabled, loading or transitions, so all of it is derived once here and every component references it (never ad hoc). `outline: none` appears on every input of the mock (E19): the focus ring below replaces it everywhere. The crop shows glow in use: working Workspace card (`glow-card-working`), Chief strip, status dots.

## 3. Scope (in)

- `effects.tokens.ts`: glow and ring box-shadows (5.1), state tokens (5.2), motion tokens (5.3).
- `20-motion.foundation.css`: `@keyframes om-pulse`, `om-caret`, `om-spin`, `om-shimmer` and the `prefers-reduced-motion` block, inside `@layer om.base`.
- Story that renders each glow on a sample card and demonstrates the animations; tests for values.

## 4. Out of scope

- Applying glows to specific components: each component task. Node-state glows use these tokens in DS part 2 (UI-61).
- Global focus-ring CSS rules for native elements: OVE_DS008 (`30-base`), which uses `--om-ring-focus` defined here.

## 5. Detailed requirements

**5.1 Shadows (exact; `a<NN>` tokens from OVE_DS003)**
| Variable | Value | Used for |
|---|---|---|
| `--om-glow-dot-working` / `-waiting` / `-done` / `-failed` | `0 0 10px var(--om-color-magenta-500)` / amber-500 / mint-500 / error-500 | status dots (idle and paused: none) |
| `--om-glow-avatar-blur` | `14px` | avatar glow = `0 0 var(--om-glow-avatar-blur) var(--om-hue-<key>-glow)` built in OVE_DS016 |
| `--om-glow-logo` | `0 0 22px var(--om-color-magenta-a22)` | logo tile |
| `--om-glow-rail-active` | `0 0 18px var(--om-color-violet-a25)` | active rail item, active filter |
| `--om-glow-cta` | `0 0 24px var(--om-color-magenta-a35)` | wizard CTA (`xl` primary magenta) |
| `--om-glow-send` | `0 0 18px var(--om-color-magenta-a50)` | Chief send button |
| `--om-glow-step` / `--om-glow-step-sm` | `0 0 16px var(--om-color-magenta-500)` / `0 0 12px ...` | wizard step dot / StepRing waiting |
| `--om-glow-card-working` | `0 0 30px var(--om-color-magenta-a12)` | Workspace card with active Run |
| `--om-glow-card-chief` | `0 0 24px var(--om-color-magenta-a15)` | selected Chief row |
| `--om-glow-card-approval` | `0 0 40px var(--om-color-amber-a18)` | inline Approval card |
| `--om-glow-card-rule` | `0 0 28px var(--om-color-magenta-a18)` | magenta callout card |
| `--om-glow-composer` | `0 0 30px var(--om-color-violet-a12)` | Composer |
| `--om-ring-select` | `0 0 0 4px var(--om-color-violet-a14)` | selected Skill/Task card (mock uses .14 and .16; normalised to .14) |
| `--om-ring-node-selected` | `0 0 0 4px var(--om-color-violet-a28)` | selected node |
| `--om-glow-node-working` | `0 0 0 4px var(--om-color-magenta-a16), 0 0 36px var(--om-color-magenta-a45)` | working node |
| `--om-glow-node-waiting` | `0 0 0 4px var(--om-color-amber-a14), 0 0 30px var(--om-color-amber-a35)` | node waiting for Approval |
| `--om-glow-edge-active` | `0 0 8px var(--om-color-magenta-500)` | active edge |
| `--om-glow-drag` | `0 12px 30px var(--om-color-magenta-a55)` | dragged Skill chip |
| `--om-shadow-popover` | `0 20px 60px var(--om-color-black-a60), 0 0 40px var(--om-color-violet-a12)` | Tray menu, Menu, Select list, Dialog, Toast |
| `--om-shadow-tooltip` | `0 8px 24px var(--om-color-black-a60)` | Tooltip (ASSUMPTION, no mock) |
| `--om-ring-focus` | `0 0 0 2px var(--om-color-bg-app), 0 0 0 4px var(--om-color-violet-500)` | focus-visible on every interactive element |
| `--om-ring-focus-inset` | `inset 0 0 0 2px var(--om-color-violet-500)` | focus inside overflow-hidden containers (list rows in scroll panels, table cells) |
| `--om-ring-focus-error` | `0 0 0 2px var(--om-color-bg-app), 0 0 0 4px var(--om-color-error-500)` | focus of an invalid field |

**5.2 Interaction-state tokens (the "std states", defined once)**
`--om-state-hover-brightness: 1.06` (filled controls brighten 6%), `--om-state-press-brightness: 0.94`, `--om-state-press-offset: 1px` (translateY), `--om-state-disabled-opacity: 0.45` (controls; no glow, `cursor: not-allowed`), `--om-state-disabled-opacity-card: 0.55` (the only dimmed element in the mocks, "Klucze API"), `--om-state-loading-spinner-size: 14px`. Rule text for the component tasks: hover = surface +1 step (OVE_DS002 `hover-from-*`), border `line-strong`; focus-visible = `--om-ring-focus` and `outline: 2px solid transparent; outline-offset: 2px` (the transparent outline keeps a visible ring in forced-colours modes); pressed = translateY(1px) and brightness .94; disabled = opacity .45, no glow; loading = spinner replaces leading icon, `aria-busy="true"`.

**5.3 Motion**
`--om-duration-fast: 120ms`, `--om-duration-base: 200ms`, `--om-duration-slow: 320ms`; `--om-ease-out: ease-out`, `--om-ease-emphasis: cubic-bezier(.2, .8, .2, 1)`; composites `--om-motion-fast: var(--om-duration-fast) var(--om-ease-out)` (hover, press), `--om-motion-base: var(--om-duration-base) var(--om-ease-emphasis)` (panels, tabs, toggles, node glow), `--om-motion-slow: var(--om-duration-slow) var(--om-ease-emphasis)` (dialog, toast enter). Animation durations: `--om-anim-pulse: 1.6s`, `--om-anim-caret: 1s`, `--om-anim-spin: 0.9s`, `--om-anim-shimmer: 1.4s`.
**5.4 Keyframes (`20-motion.foundation.css`)**: `om-pulse` (opacity 1 -> .65 -> 1 and glow radius 10px -> 16px -> 10px via `box-shadow`; used by the working dot), `om-caret` (`steps(1)` blink 1s, terminal caret), `om-spin` (rotate 360deg linear), `om-shimmer` (background-position sweep of `linear-gradient(90deg, transparent, var(--om-color-violet-a08), transparent)`).
**5.5 Reduced motion**: `@media (prefers-reduced-motion: reduce)` sets all `--om-duration-*` to `0.01ms`, `--om-anim-*` unused because `animation: none` is applied to `om-pulse`, `om-caret` and `om-shimmer` through the helper classes `.om-anim-pulse/.om-anim-caret/.om-anim-shimmer` (components attach these classes); the spinner keeps rotating at 2s (essential progress feedback). Colour changes stay (instant). The same rule is mirrored in JS by `useReducedMotion` (OVE_DS001) for JS-driven animation (Toast timers, canvas).

## 6. Design notes

`design.png` shows glow-based elevation: Chief strip (magenta border + gradient), the working Workspace card with the soft magenta glow, dots with glow. Hover, focus, pressed, disabled and loading are not drawn in any mock; they come from 5.2 (inventory B intro).

## 7. Reuse

`defineTokens` (OVE_DS039); alpha and family tokens from OVE_DS003; colours from OVE_DS002.

## 8. Architecture and code placement

Tokens in `src/tokens/`, global CSS (keyframes) in `src/theme/20-motion.foundation.css` picked by the foundation generator. Components never declare their own keyframes or durations (DRY); they attach `om-anim-*` helper classes or use `var(--om-motion-*)`.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Accessibility-as-safety: respecting `prefers-reduced-motion` and keeping a visible focus ring are requirements, not polish. Never remove the ring on a destructive button.

## 10. Errors and edge cases

- Component inside `overflow: hidden` clips the outer ring: use `--om-ring-focus-inset` (documented in the story).
- Browser without `prefers-reduced-motion` support: animations run; acceptable.
- Glow on idle or paused dot: forbidden (no token exists), enforced by test (`--om-glow-dot-idle` must not exist).

## 11. Acceptance criteria

- [ ] All variables in 5.1-5.3 exist with exact values (table-driven test).
- [ ] `--om-ring-focus` equals `0 0 0 2px var(--om-color-bg-app), 0 0 0 4px var(--om-color-violet-500)`.
- [ ] Keyframes `om-pulse`, `om-caret`, `om-spin`, `om-shimmer` exist; under emulated `prefers-reduced-motion: reduce` the helper classes compute `animation-name: none` except spinner (Playwright).
- [ ] Story renders every glow on a labelled sample; axe clean.
- [ ] No raw colour in `20-motion.foundation.css` (guard).

## 12. Test plan

Vitest `effects.test.ts`; Playwright (OVE_DS012) `reduced-motion.visual.ts` using `page.emulateMedia({ reducedMotion: 'reduce' })`; story `Foundation/Effects`.

## 13. Parallelization notes

Parallel with OVE_DS004/006. OVE_DS008 and every component depend on the ring/state tokens; publish them early.

## 14. Open questions and assumptions

- ASSUMPTION: tooltip shadow and the 5.2 state numbers are the inventory's recommendations (R); designers may tune them once, here.
- Open: whether pressed state also applies to selects/rows. Default: only buttons, chips and switches.
