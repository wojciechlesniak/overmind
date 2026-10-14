---
id: OVE_DS015
title: "IconButton and SendButton (icon-square, icon-send, icon-send-flat)"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS008, OVE_DS009, OVE_DS011, OVE_DS012, OVE_DS013, OVE_DS038]
soft_depends_on: []
provides: [ui:IconButton, ui:SendButton]
needs: [ui:icons]
owns: [packages/ui-kit/src/actions/IconButton/**, packages/ui-kit/src/actions/SendButton/**]
reads: []
design: design.png
design_source: "Chief#chief/send-button (crop 1030,830,110,90); design-toolbar.png Main#canvas/zoom-toolbar"
spec_refs: [SPECIFICATION 13]
adr_refs: [23]
---

# OVE_DS015: IconButton and SendButton (icon-square, icon-send, icon-send-flat)

## 1. Summary

Implement `IconButton` (square icon-only button: zoom +/-, stepper +/-, search, close) and `SendButton` (the composer send button in its gradient and flat forms), both with required accessible names and the shared std states.

## 2. Context

Inventory B1 rows `icon-square` (36x36 r10 with border `#2A2040`, or 40x40 r10 without border; glyph 16-18), `icon-send` (44x44 r14, avatar gradient, glow-send on Chief only, icon 18 stroke 2 `ink`) and `icon-send-flat` (44 round `#F25FC4`, Telegram). The Chief send button is magenta gradient `#FF9BDD` -> `#C23FA0` with glow; the Direct-chat and Discussion composers use the Agent's hue gradient (Direct chat: no glow, `VIEWS.md agentchat/send-button`). Zoom toolbar crop shows minus, "70%", plus, divider, "Cofnij" "Ponów" ghost buttons and a search icon button (toolbar composite is DS part 2 UI-65).

## 3. Scope (in)

- `IconButton` (variants `outline`, `ghost`; sizes sm 34, md 40, lg 44), optional `pressed` toggle.
- `SendButton` (`variant`: `gradient` | `flat`; `hue`: `AgentHueKey`, default `chief`; `glow`).
- Stories, tests, visual comparison.

## 4. Out of scope

- Composer container and textarea: OVE_DS027. Toolbar and minimap: DS part 2 (UI-65). Avatar: OVE_DS016 (only the hue variables are shared).
- Text-labelled buttons: OVE_DS013.

## 5. Detailed requirements

**5.1 `IconButton`**
```ts
interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName; label: string;             // label -> aria-label, REQUIRED (TS)
  variant?: 'outline' | 'ghost';             // default 'outline'
  size?: 'sm' | 'md' | 'lg';                 // 34 | 40 | 44, default 'md'
  pressed?: boolean;                         // toggle, aria-pressed
  loading?: boolean; as?: ElementType;
}
```
| variant / size | box | radius | border | colour | hover |
|---|---|---|---|---|---|
| `outline` | 34/40/44 square | 10 (sm), 12 (md), 14 (lg) | 1px `line` | icon `text-primary` | fill `bg-raised`, border `line-strong` |
| `ghost` | same | same | none | icon `text-secondary` | fill `bg-surface`, icon `text-primary` |
Icon size: sm 14, md 16, lg 18. Pressed (`pressed` true): fill `bg-raised`, border `line-strong`. Stepper +/- of the mock (36px) becomes `sm` 34 (E8); zoom/search (40px r10) becomes `md` with radius 12 (documented deviation). Disabled `.45`, loading shows the 14px spinner instead of the icon, focus ring from tokens.
**5.2 `SendButton`**
```ts
interface SendButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;                                  // aria-label, e.g. "Send"
  variant?: 'gradient' | 'flat';                  // default 'gradient'
  hue?: AgentHueKey;                              // gradient only, default 'chief'
  glow?: boolean;                                 // default: hue === 'chief'
  loading?: boolean;
}
```
- `gradient`: 44x44, radius `--om-radius-14`, `background: radial-gradient(circle at 35% 30%, var(--om-hue-<hue>-light), var(--om-hue-<hue>-dark))`, icon `send` 18 stroke 2, colour `ink`; glow `--om-glow-send` when `glow`. `flat` (Telegram): 44x44, `border-radius: 50%`, fill `magenta-500`, icon `send` 18, colour `ink`, no glow.
- Hover brightness 1.06; pressed translateY(1px); disabled (empty composer, Global Pause) opacity .45 and no glow; loading (message sending) spinner.
- `type="submit"` is the default for SendButton (it submits the composer form); can be overridden.
**5.3 A11y**: both render real `button`s; `label` mandatory (type error otherwise, dev warning for empty string); keyboard Enter/Space; focus ring; touch target >= 34 (Telegram 44). Icons decorative. A tooltip is optional via OVE_DS028 (not built in).

## 6. Design notes

`design.png`: Chief send button 44x44, magenta gradient with outer glow, paper-plane icon dark. `design-toolbar.png`: toolbar with `-` and `+` icon buttons (outline, no border visible because the toolbar draws its own surface; ghost look), a ghost text group ("Cofnij", "Ponów") and the search icon (secondary colour). States not in mock: hover, pressed, disabled (empty composer), loading, Global Pause disabled; derived from OVE_DS007 std states.

## 7. Reuse

`Icon` (OVE_DS009) and icons `plus`, `minus`, `search`, `close`, `send` (OVE_DS009/011); hue tokens (OVE_DS003); glows (OVE_DS007); `Spinner` from `../Spinner` (OVE_DS013).

## 8. Architecture and code placement

`packages/ui-kit/src/actions/IconButton/` and `SendButton/`. Two components because their APIs and shapes differ (ISP); both wrap native `button` with the same state tokens. `Spinner` reused from OVE_DS013 (DRY).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Icon-only controls are the classic accessibility hole: `label` is required by the type and tests fail when `aria-label` is empty. SendButton must not fire when disabled or loading (double-send of an Owner command, which is binding for Agents, ADR 0023).

## 10. Errors and edge cases

- Missing `label` (JS caller): dev warning, button still renders with `aria-label=""` (axe fails, caught in CI).
- `hue` unknown: falls back to `chief`.
- Very small container: fixed square, never shrinks (`flex-shrink: 0`).
- Click while `loading`: ignored.

## 11. Acceptance criteria

- [ ] IconButton boxes are 34/40/44 with radii 10/12/14 (Playwright); `outline` has a 1px `#2A2040` border, `ghost` none.
- [ ] `aria-label` equals `label`; `pressed` sets `aria-pressed`.
- [ ] SendButton gradient is 44x44 r14 with the radial gradient from the hue tokens, `ink` icon 18px stroke 2; glow only for `chief` by default; `flat` is a 44px circle `#F25FC4`.
- [ ] Disabled and loading buttons ignore click and Enter; hover/pressed/focus states exist.
- [ ] Stories: one per variant/size, `Hues` (8 hues), `Matrix`; axe clean (name present).
- [ ] Visual: `SendButtonChief` story matches `design.png`; `ZoomToolbarButtons` story matches `design-toolbar.png` (structural).

## 12. Test plan

Vitest: `IconButton.test.tsx`, `SendButton.test.tsx` (props, a11y, disabled/loading, submit default). Playwright: boxes, gradient computed background, crops. Commands: `pnpm --filter @overmind/ui-kit test IconButton SendButton`.

## 13. Parallelization notes

After OVE_DS013 (Spinner); `AgentHueKey` comes from tokens (`hues.ts`, OVE_DS003). Parallel with other primitives. Own folders only.

## 14. Open questions and assumptions

- ASSUMPTION: send icon is `send` outline at stroke 2 on a gradient fill (as in the mock), not a filled glyph.
- Open: the Discussion composer uses the Chief gradient (inventory) while the Direct chat uses the Agent hue; both are `hue` values chosen by the composite.
