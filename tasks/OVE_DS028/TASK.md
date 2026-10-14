---
id: OVE_DS028
title: "Tooltip and Popover (floating-ui foundation)"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS022]
soft_depends_on: []
provides: [ui:Tooltip, ui:Popover, lib:ui-floating]
needs: []
owns: [packages/ui-kit/src/overlays/Tooltip/**, packages/ui-kit/src/overlays/Popover/**, packages/ui-kit/src/overlays/_shared/**, packages/ui-kit/package.json#dependencies.@floating-ui/react]
reads: []
design: design.png
design_source: "Tray#tray/popover-surface (the Tray popover is the only popover instance: surface, padding, radius, shadow)"
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS028: Tooltip and Popover (floating-ui foundation)

## 1. Summary

Add the floating layer foundation: the single runtime dependency `@floating-ui/react` (pinned), a shared `useFloatingSurface` hook and portal root, then `Tooltip` (hover/focus hint, no mock instance) and `Popover` (non-modal anchored panel, e.g. Tray surface, Workspace switcher, row more-menu base). Menu, Select and Dialog (OVE_DS029, 030, 036) build on `overlays/_shared`.

## 2. Context

Inventory B15 (tooltip, R spec: bg `#1C1330`, border 1px `#5B3E8F`, r8, padding 6 10, 12px, max-width 260, delay 400ms, offset 8, `z-tooltip`, no arrow; rail tooltips right of the item) and B18 (popover container padding 8, r16, `rgba(20,15,32,.96)`, 1px `#2A2040`, `shadow-popover`, Tray width 380). The mocks use only `title` attributes (slow, not styled, not keyboard accessible). Dependency decision (OVE_DS001): ui-kit has exactly one runtime dependency, `@floating-ui/react` (MIT, tree-shakeable, headless), because hand-rolling collision handling, focus return, outside-press and list navigation is a known source of accessibility bugs. Version is pinned exactly in `package.json`; `pnpm-lock.yaml` records the integrity hash; OVE_OSS adds the licence to NOTICE.

## 3. Scope (in)

- `overlays/_shared`: `FloatingPortal` root resolution (`useOmPortalRoot()` returns the nearest `[data-om]` ThemeRoot element, falls back to `document.body` with a `data-om` wrapper so tokens apply), `useFloatingSurface` (placement, offset, flip/shift, size middleware, `autoUpdate`), z-index mapping (`--om-z-popover`, `--om-z-tooltip`).
- `Tooltip`, `Popover` (compound), stories, tests.

## 4. Out of scope

- Menu items and keyboard list navigation: OVE_DS029. Select: OVE_DS030. Modal dialogs: OVE_DS036. Toasts: OVE_DS037.
- Tray window composition: DS part 2 (UI-53).

## 5. Detailed requirements

**5.1 Dependency and portal**: add `@floating-ui/react` (exact pinned version chosen at implementation time, at least two weeks old, recorded in the task PR), `@floating-ui/react` is imported ONLY inside `src/overlays/**` and `src/internal/**` (guard rule, OVE_DS001). Portal container: the closest ancestor with `data-om` (OVE_DS008 `ThemeRoot`) so overlays inherit the `--om-*` variables; if none, a fixed `<div data-om class="om-portal">` is appended to `body`.
**5.2 `Tooltip`**
```ts
interface TooltipProps { content: ReactNode; shortcut?: string; placement?: Placement /* default 'top' */; delay?: number /* 400 */; offset?: number /* 8 */; disabled?: boolean; children: ReactElement /* single focusable child */ }
```
- Surface: fill `bg-raised` `#1C1330`, `border: 1px solid line-strong` `#5B3E8F`, radius 8px, padding 6px 10px, Bricolage 12/400 `text-primary`, `max-width: 260px`, `box-shadow: var(--om-shadow-tooltip)`, `z-index: var(--om-z-tooltip)`, no arrow. `shortcut` renders a `Kbd` (OVE_DS022) after the text, gap 8.
- Open: hover with delay 400ms (instant when another tooltip was closed < 300ms ago, "warm" group via `FloatingDelayGroup`) and on keyboard focus (no delay); close on blur, pointer leave, Escape, scroll of the reference.
- WCAG 1.4.13: the tooltip is hoverable (`safePolygon`), dismissible with Escape, persistent until dismissed.
- a11y: `role="tooltip"`, trigger gets `aria-describedby`; the tooltip never contains interactive content and never carries the only name of an icon button (IconButton requires `label`, OVE_DS015). Not shown on touch (`pointerType === 'touch'`).
- Placement: rail items use `placement="right"`.
- Motion: fade+translate 4px over `--om-duration-fast`, none under reduced motion.
**5.3 `Popover`** (compound)
```ts
interface PopoverProps { open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; placement?: Placement /* 'bottom-start' */; offset?: number /* 8 */; modal?: false; children: ReactNode }
// <Popover><PopoverTrigger asChild>...</PopoverTrigger><PopoverContent width="auto|trigger|tray" label="...">...</PopoverContent></Popover>
```
- Surface `PopoverContent`: padding 8px, radius 16px, fill `surface-a96` (`color-mix(in srgb, var(--om-color-bg-surface) 96%, transparent)`), `border: 1px solid line` `#2A2040`, `box-shadow: var(--om-shadow-popover)`, `backdrop-filter: blur(12px)` where supported, `z-index: var(--om-z-popover)`, `max-height: min(var(--om-layout-tray-max-h), calc(var(--available-height) - 16px))` with internal scroll. `width="tray"` = `--om-layout-tray-w` (380px).
- Behaviour: click on trigger toggles (`aria-expanded`, `aria-haspopup="dialog"`, `aria-controls`); outside press and Escape close; focus moves to the first tabbable inside (or the container with `tabIndex=-1`) and returns to the trigger on close; Tab order stays in the page (non-modal) but `FloatingFocusManager` with `modal={false}` and `returnFocus`.
- `role="dialog"` with `aria-label`/`aria-labelledby` (prop `label` required).
- Collision: flip, shift (padding 8) and `size` middleware set `--available-height`.
**5.4 States**: Tooltip has none besides open/closed. Popover trigger styling is the child's. Reduced motion removes transitions.
**5.5 Z-order contract**: toast 70 > tooltip 60 > dialog 50 > popover 40 (OVE_DS006 `--om-z-*` values; this task asserts the order in a test reading the variables).

## 6. Design notes

`design.png`: the Tray popover surface (rounded 16, 1px border, dark translucent fill, 8px inner padding, hairline dividers). It is the only instance in the mocks; Tooltip has no mock, so its visuals come from inventory B15 and are verified by `expectComputed`.

## 7. Reuse

`Kbd` (OVE_DS022), shadows/z/motion (OVE_DS006, OVE_DS007), `ThemeRoot` (OVE_DS008), `useControllableState` (OVE_DS023 if merged; else created identically).

## 8. Architecture and code placement

`packages/ui-kit/src/overlays/{Tooltip,Popover,_shared}/`. The only adapter over `@floating-ui/react` is `_shared/useFloatingSurface.ts` (DIP: swapping the library touches one folder). No global state; the delay group provider is local to `Tooltip`.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Overlays render in a portal: they must stay inside the themed root and never escape into untrusted DOM; `content` is ReactNode but never HTML strings. Tooltips must not be the only place to read a security-relevant fact (for example, an Approval target); stories document that rule. Supply-chain: the dependency is pinned and its postinstall scripts are disabled by the repo policy (OVE_SETUP).

## 10. Errors and edge cases

- Reference element unmounts while open: close and clean up listeners.
- No space in any direction: shift/flip, finally clamp to viewport with scroll.
- Trigger disabled: `Tooltip disabled` wrapper span is documented (disabled buttons do not fire pointer events).
- SSR/test env without layout: no crash (`autoUpdate` guarded by `ResizeObserver` presence).
- Nested popovers: Escape closes only the topmost.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Tooltip/Popover` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Tooltip opens after 400ms on hover, immediately on focus, closes on Escape/blur, is hoverable, and has `role=tooltip` + `aria-describedby`.
- [ ] Tooltip computed style: `#1C1330`, border `#5B3E8F`, r8, padding 6/10, max-width 260, 12px, offset 8, no arrow.
- [ ] Popover: padding 8, r16, `--om-shadow-popover`, width `tray` = 380; focus enters and returns; outside press and Escape close.
- [ ] `@floating-ui/react` is imported only under `src/overlays` and `src/internal` (guard); portal inherits tokens (computed `--om-color-bg-app` available inside).

## 12. Test plan

- Vitest + Testing Library + user-event in `overlays/(Tooltip|Popover).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test overlays` and `pnpm --filter @overmind/ui-kit test:visual overlays`.
- Fake timers for delay and warm-up group; jsdom needs `ResizeObserver` stub from `test/setup.ts` (OVE_DS001).

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. This task blocks OVE_DS029, OVE_DS030 and OVE_DS036 (they import `overlays/_shared`). `package.json` and `pnpm-lock.yaml` are shared files: only one added dependency line; resolve rebase conflicts by keeping both sides and re-running `pnpm install`.

## 14. Open questions and assumptions

- ASSUMPTION: `@floating-ui/react` is the accepted dependency (decided in OVE_DS001); the alternative (own positioning) is rejected for a11y risk.
- ASSUMPTION: popover blur/backdrop-filter is optional enhancement; the 96% fill alone is the contract.
- Open: tooltip delay 400ms default from inventory; hidden on touch.
