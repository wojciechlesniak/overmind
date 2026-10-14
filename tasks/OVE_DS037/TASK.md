---
id: OVE_DS037
title: "Toast: provider, stack and tones"
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS015, OVE_DS022, OVE_DS028]
soft_depends_on: []
provides: [ui:Toast, ui:ToastProvider, ui:useToast]
needs: [ui:icons]
owns: [packages/ui-kit/src/overlays/Toast/**]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS037: Toast: provider, stack and tones

## 1. Summary

Implement the transient notification stack: `ToastProvider` (region + queue), `useToast()` (imperative API) and the `Toast` visual (tones success, info, warning, error), with auto-dismiss rules, pause on hover/focus and correct live-region semantics.

## 2. Context

Inventory B17 (not in the mocks): bottom-right stack, width 360, r14, fill `#1A1422`, 1px `line-strong` (tone border: success mint, warning amber, error `#FF8FA3`), leading 16px icon, title 13/600, body 12px, optional action link, auto-dismiss 5s (error and warning persist), `role="status"` / `alert`. Used for: Run completed, Approval decided elsewhere, copy confirmation, backup done. Important Owner decisions (Approvals, Access Requests) are NEVER toast-only: they persist in the Approvals list and Notification center; toast is a convenience.

## 3. Scope (in)

- `ToastProvider`, `useToast`, `Toast`, store (pure TS, framework-agnostic `createToastStore`), stories, tests.
- Stack rules, dedupe, queue limits, pause/resume timers.

## 4. Out of scope

- Native OS notifications and Telegram messages (engine/apps). Notification center list: OVE_DS033 / DS part 2.
- Mapping engine events to toasts: apps.

## 5. Detailed requirements

**5.1 API**
```ts
type ToastTone = 'info' | 'success' | 'warning' | 'error';
interface ToastInput { id?: string; tone?: ToastTone; title: ReactNode; description?: ReactNode; action?: { label: string; onAction: () => void } | { label: string; href: string };
  duration?: number | 'persist'; dismissLabel?: string }
interface ToastApi { show(t: ToastInput): string; update(id: string, patch: Partial<ToastInput>): void; dismiss(id?: string): void }
function ToastProvider(props: { children: ReactNode; regionLabel?: string; maxVisible?: number /* 4 */; placement?: 'bottom-right' | 'bottom-center' }): JSX.Element;
function useToast(): ToastApi;
function createToastStore(clock?: { now(): number; setTimeout: typeof setTimeout }): ToastStore; // exported for apps and tests
```
**5.2 Visual (exact)**: region `position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column-reverse; gap: 8px; width: 360px; z-index: var(--om-z-toast)`; toast: `border-radius: 14px; background: bg-surface-sel #1A1422; border: 1px solid line-strong #5B3E8F; padding: 12px 14px; box-shadow: var(--om-shadow-popover); display: grid; grid-template-columns: 16px 1fr auto; gap: 10px`. Tone borders: success `mint-500` `#62E3B4`, warning `amber-500` `#FFB547`, error `error-500` `#FF8FA3`, info keeps `line-strong`. Leading 16px icon (`check` mint, `warning` amber, `warning`/`close-circle` error, `info` lavender; OVE_DS011) coloured by tone. Title Bricolage 13/600 `text-primary`, description 12px/1.4 `text-secondary`, action = `TextLink`-styled button (13/600, `text-link`), dismiss `IconButton` 28px `close` (label from UiLabels `dismiss`). Enter animation: translateY(8px)+fade over `--om-duration-base`; none under reduced motion.
**5.3 Timing**: default `duration`: success/info 5000ms; warning and error `'persist'` (inventory), overridable. Timer pauses while the toast is hovered, focused-within, or the document is hidden, and restarts with the remaining time; `maxVisible` (default 4): extra toasts wait in a FIFO queue; errors are promoted to the front. `id` dedupes: showing an existing id updates it in place and resets its timer.
**5.4 Semantics**: the region is `<section aria-label>` (UiLabels `toastRegion`, prop `regionLabel` overrides) containing two live containers created at mount: polite (`role="status"`) for info/success and assertive (`role="alert"`) for warning/error, so screen readers announce new entries; every toast is a `div` with its text; actions and dismiss are buttons; focus is never stolen on show. Keyboard: `Alt+T`? NOT assumed; the region is reachable by Tab order after the page content; Escape on a focused toast dismisses it.
**5.5 States**: hover/focus pause (subtle border brightness), action hover (underline), dismiss hover fill; disabled none; loading: `update(id, { tone: 'info', title })` pattern for "working..." then success.
**5.6 Limits**: title max 120 chars and description 280 chars visually clamped (2 lines) with `title` omitted (full text stays in DOM for screen readers); `action.href` through `safeHref` (OVE_DS022).

## 6. Design notes

No mock exists; inventory B17 plus 5.2 are the spec. Gallery story shows four tones, with action, with long text, stack of five (queue).

## 7. Reuse

`IconButton` (OVE_DS015), `TextLink` look (OVE_DS022), portal root (OVE_DS028), icons (OVE_DS009/011), UiLabels (OVE_DS038).

## 8. Architecture and code placement

`packages/ui-kit/src/overlays/Toast/{store.ts,ToastProvider.tsx,Toast.tsx,Toast.module.css,index.ts}`. `store.ts` is pure TypeScript with injectable clock (testable without React, DIP). The provider subscribes via `useSyncExternalStore`.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Toasts can be triggered by Agent-originated events: all text is rendered as text, queue and per-minute rate are bounded (`maxVisible` 4, queue cap 50 dropping the oldest info toasts) so a flood from a misbehaving Agent cannot cover the UI or exhaust memory; security-relevant decisions are never toast-only (documented rule, story callout).

## 10. Errors and edge cases

- Provider missing: `useToast()` throws a clear error in dev and a no-op in production builds.
- `dismiss` of unknown id: no-op.
- Rapid duplicate ids: coalesced.
- Page hidden for a long time: timers paused, so no mass dismissal on return.
- Queue cap exceeded: oldest non-error dropped.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Toast` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Toast 360 wide, r14, `#1A1422`, border `#5B3E8F` / tone colours; title 13/600, body 12; stack gap 8 bottom-right with 16px margin.
- [ ] Defaults: success/info auto-dismiss at 5s; warning/error persist; hover/focus pauses and resumes with remaining time (fake timers).
- [ ] Live regions: status for info/success, alert for warning/error; focus is not stolen.
- [ ] Queue (max 4 visible), dedupe by id, errors promoted, cap 50.
- [ ] Action and dismiss are keyboard operable; Escape dismisses the focused toast.

## 12. Test plan

- Vitest + Testing Library + user-event in `overlays/Toast.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test Toast` and `pnpm --filter @overmind/ui-kit test:visual Toast`.
- `store.test.ts` with an injected fake clock (pure logic).

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task.

## 14. Open questions and assumptions

- ASSUMPTION: warnings persist like errors (inventory); the Owner may prefer auto-dismiss for warnings later.
- ASSUMPTION: no global hotkey to focus the region.
- Open: `close-circle`/`info` icons come from OVE_DS011 (soft dependency; fall back to `warning`/`check` when missing).
- Priority P1: first consumer is the copy-confirmation and Run-completed feedback.
