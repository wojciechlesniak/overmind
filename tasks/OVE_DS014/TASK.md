---
id: OVE_DS014
title: "Button tone variants: approve, deny, pause, danger, dashed add/more, palette"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013]
soft_depends_on: []
provides: [ui:ButtonTones]
needs: []
owns: [packages/ui-kit/src/actions/Button/ButtonTones.module.css, packages/ui-kit/src/actions/Button/ButtonTones.stories.tsx, packages/ui-kit/src/actions/Button/ButtonTones.test.tsx]
reads: []
design: design.png
design_source: "Chief#chief/approval-actions (crop 375,583,732,180); extra crops design-pause, design-dashed, design-danger-secondary, design-telegram-approve"
spec_refs: [SPECIFICATION 11, SPECIFICATION 16]
adr_refs: [3, 6, 21]
---

# OVE_DS014: Button tone variants: approve, deny, pause, danger, dashed add/more, palette

## 1. Summary

Style the nine tone variants of `Button` declared by OVE_DS013 (`approve`, `approve-outline`, `deny`, `deny-quiet`, `pause`, `danger`, `dashed-add`, `dashed-more`, `palette`) in `ButtonTones.module.css` with exact colours, borders and sizes, plus their stories and tests. These buttons carry the security-critical choices of the product (Approval, Access Request, Global Pause, destructive actions), so legibility and distinctness are part of the requirement.

## 2. Context

Mock evidence: Chief approval card (3 actions, 44px: "Zezwól na ten Run" amber filled, "Zezwól na stałe" amber outline, "Odmów" neutral outline); Approvals page (46px); Telegram (40px, run-scoped approve + quiet deny, never offers permanent approval, ADR 0006); top-bar and Tray Global Pause; Agent controls ("Wstrzymaj Agenta" secondary, "Przerwij" danger); dashed "Nowy Agent"; "Pokaż 5 starszych"; canvas palette items. E8 sets approve and deny to `lg` (44) everywhere, Telegram touch target 44. E26: the permanent-grant label is one string, "Zezwalaj na stałe w tym Workspace", used by both desktop surfaces (copy is the caller's). ADR 0003/0021: approvals are explicit Owner decisions; ADR 0006: Telegram only run-scoped.

## 3. Scope (in)

- CSS for the nine variants in `ButtonTones.module.css` (file handed over by OVE_DS013).
- Stories per variant, `Matrix` extension (tone variants x allowed sizes x states), tests, crops comparison.
- Documentation in stories of which variant to use for which decision.

## 4. Out of scope

- Button base, sizes, loading, core variants: OVE_DS013. The Approval card, Approvals detail and Telegram bubble compositions: DS part 2 (UI-33, UI-34, UI-54).
- Dialog for "Odmów z komentarzem": OVE_DS036.

## 5. Detailed requirements

**5.1 Exact variant table** (radius, height from OVE_DS013 size; fonts: `button-lg` 14/700 for filled, 14/600 for outlines; `button` 13/600 at md)
| variant | allowed sizes | fill | border | text / icon | hover | pressed | notes |
|---|---|---|---|---|---|---|---|
| `approve` | lg (default here), md | `amber-500` `#FFB547` | transparent | `ink-amber` `#1A1005` | brightness 1.06 + `0 0 24px amber-a35` | translateY(1px) | "Zezwól na ten Run"; 14/700, padding 0 18 |
| `approve-outline` | lg, md | transparent | 1px `amber-line` `#6B4E22` | `amber-200` `#FFE2B5` | fill `amber-a12`, border `amber-a50` | fill `amber-a18` | "Zezwól na stałe"; desktop only; 14/600 |
| `deny` | lg, md | transparent | 1px `line-neutral-outline` `#3A2E44` | `text-body-soft` `#E3DAF0` (mock `#D9C7EA`, E11) | fill `bg-surface`, border `line-strong` | fill `bg-raised` | "Odmów", "Odmów z komentarzem"; 14/600 |
| `deny-quiet` | lg, md | transparent | 1px `line` `#2A2040` | `text-secondary` `#A79BBF` | fill `bg-surface`, border `line-strong`, text primary | fill `bg-raised` | Telegram "Odmów" (mock 13/700; normalised 14/600 lg 44) |
| `pause` | md (sm) | `magenta-bg-pause` `#2A1026` | 1px `magenta-border-pause` `#5A2A4F` | `magenta-200` `#FFD3F1`, icon `pause` 16 | brightness 1.06 + `0 0 18px magenta-a22` | translateY(1px) | Global Pause (top bar, Tray; 13/600); Tray width 100%, mock 42px -> 40px |
| `danger` | md, sm | `error-bg-button` `#2A0F18` | 1px `error-line` `#6A2A3A` | `error-300` `#FFC2CD` | brightness 1.06, border `error-a50` | translateY(1px) | Cancel Run, Stop/Interrupt Agent ("Przerwij"), Disconnect, Delete Workspace; 13/600 |
| `dashed-add` | lg (default), md | transparent | 1px dashed `line-strong` `#5B3E8F` | `text-lavender` `#D6C9FF`, icon `plus`/`folder-plus` 16 | fill `violet-a08`, border `violet-500` | fill `violet-a12` | full width by default (`fullWidth` default true for this variant); 13/600; radius from size (mock 12 or 14 -> lg 14) |
| `dashed-more` | md | transparent | 1px dashed `line` `#2A2040` | `text-secondary` | border `line-strong`, text primary | fill `bg-surface` | "Pokaż 5 starszych"; full width; 12/400 |
| `palette` | md | `bg-node-start` `#160F24` | 1px `line` | `text-primary`; icon `text-lavender` | border `line-strong`, fill `bg-raised` | `cursor: grabbing` | node palette item, `cursor: grab`; 13/600; padding 0 10 |
1. All variants inherit sizes, focus ring, disabled (.45), loading and `disabledReason` behaviour from OVE_DS013; none overrides the focus ring.
2. `pause` selected (`selected` true = Global Pause active, E33 not drawn): fill `magenta-a30`, border `magenta-500`, text `magenta-200`, `aria-pressed="true"` (ASSUMPTION until the Owner designs the paused state; the label change "Wznów" is the caller's).
3. Semantics of use (documented in stories): `approve` = the safe, run-scoped grant; `approve-outline` = permanent grant, never the visually dominant choice; `deny` never amber or magenta; Telegram surfaces use only `approve` + `deny-quiet` at `lg` with `fullWidth` in a flex row (each `flex: 1 1 0`, gap 8).
4. Disabled approvals during Global Pause use `disabledReason` (OVE_DS013); the look is disabled (.45) yet distinguishable (the reason is exposed to AT).
5. No tone variant changes size on hover; glow is `box-shadow`, never layout.
6. Contrast (test, OVE_DS003 numbers): `ink-amber` on amber-500 >= 10.6; `amber-200` and `text-body-soft` on `bg-app` >= 12; `magenta-200` on pause fill >= 10; `error-300` on error fill >= 8; `text-lavender` on bg-app >= 12.

## 6. Design notes

`design.png`: Chief approval actions, three 44px buttons, gap 12 (card padding 18): amber filled "Zezwól na ten Run", amber outline "Zezwól na stałe" (border `#6B4E22`, text `#FFE2B5`), neutral outline "Odmów" (border `#3A2E44`). `design-pause.png`: top bar Global Pause (`#2A1026`, border `#5A2A4F`, text `#FFD3F1`, pause icon) next to the amber "3 czekają" Approvals button (composite in DS part 2). `design-dashed.png`: dashed "Nowy Agent" (44px, r14, dashed `#5B3E8F`, text `#D6C9FF`). `design-danger-secondary.png`: `secondary` "Wstrzymaj Agenta" + `danger` "Przerwij" (`#2A0F18`, border `#6A2A3A`, text `#FFC2CD`). `design-telegram-approve.png`: Telegram approval bubble with amber 40px + outlined deny; normalised to 44. Not in mocks: hover, pressed, focus, disabled, loading (std states, OVE_DS007), `deny-quiet` hover, paused `pause`.

## 7. Reuse

Everything from `Button` (OVE_DS013): this task adds only a CSS file, stories and tests. Tokens from OVE_DS002/003/007. Do NOT create new components for these (inventory: tone variants of one Button).

## 8. Architecture and code placement

CSS-only extension via `[data-variant='approve']` selectors in `ButtonTones.module.css` (OCP). No TS changes. Stories live in `ButtonTones.stories.tsx` to keep OVE_DS013's story file untouched.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Security-relevant design rules enforced by tests: (1) `approve-outline` (permanent grant) has lower visual weight than `approve` (filled) so the safe default is the prominent one; (2) `deny` and `approve` are never the same colour; (3) amber is reserved for waiting/approval (never used for `danger`); (4) focus ring visible on all (keyboard approval flows); (5) loading/disabled approve cannot fire twice (inherited tests re-run for these variants).

## 10. Errors and edge cases

- Telegram approve + deny in a 314px row: each `flex: 1 1 0`, labels must not truncate for the Polish strings "Zezwól tym razem" / "Odmów" (story checks).
- `dashed-add` inside a narrow panel (245px): fills the panel width, label centered.
- `palette` inside a draggable parent: the button does not stop `dragstart` (it forwards events; `draggable` is passed through).
- `pause` icon-only (rail/compact): not provided; use `IconButton` (OVE_DS015) when needed.

## 11. Acceptance criteria

- [ ] Each of the nine variants matches the colour/border/text of 5.1 (`expectToken` per variant, default + hover).
- [ ] `approve` lg is 44px high with radius 14, `approve-outline` and `deny` are the same height; gap in the Chief card composition is 12px.
- [ ] `pause`, `danger` are 40px (md); `dashed-add` is 44px and full width; `dashed-more` 40px.
- [ ] Hover and pressed states exist for every variant; focus ring visible on every variant (screenshot cells).
- [ ] Contrast assertions of 5.1 item 6 pass.
- [ ] A story `TelegramApprovePair` renders approve + deny-quiet at lg, fullWidth, in a 314px container without truncation of the Polish copy.
- [ ] `ApprovalActions` composition story matches `design.png`; the other crops match their stories (structural tolerance).
- [ ] Stories: one per variant + `Matrix`; axe clean.

## 12. Test plan

Vitest (`ButtonTones.test.tsx`: data attribute mapping, fullWidth default for `dashed-add`, disabledReason on approve). Playwright (OVE_DS012): token/box assertions and 5 crop comparisons. Commands: `pnpm --filter @overmind/ui-kit test:visual ButtonTones`.

## 13. Parallelization notes

After OVE_DS013 merges. It touches only its three files, so it can run in parallel with every other primitive. Do not edit `Button.tsx`.

## 14. Open questions and assumptions

- ASSUMPTION: `deny` and `deny-quiet` both kept (inventory lists both); recommendation to unify on `deny` for desktop and `deny-quiet` only in Telegram. Owner decision (inventory E8/E26 area).
- ASSUMPTION: paused-state look of `pause` (5.1 item 2) until E33 is designed.
- ASSUMPTION: Telegram approve/deny use `lg` 44 instead of the mock's 40 (E8).
