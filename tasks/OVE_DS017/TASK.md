---
id: OVE_DS017
title: "Pill, Chip and CountPill: tones, filter chips, removable chips, quick actions"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS002, OVE_DS003, OVE_DS004, OVE_DS008, OVE_DS009, OVE_DS011, OVE_DS012, OVE_DS020, OVE_DS038]
soft_depends_on: []
provides: [ui:Pill, ui:Chip, ui:CountPill]
needs: [ui:icons]
owns: [packages/ui-kit/src/badges/Pill/**, packages/ui-kit/src/badges/Chip/**, packages/ui-kit/src/badges/CountPill/**]
reads: []
design: design.png
design_source: "Pulpit#shell/top-bar pills (crop 480,5,960,60); design-filter-chips Decyzje#decis/filter-chips; design-quick-actions Chief#chief/quick-actions"
spec_refs: [SPECIFICATION 15]
adr_refs: [28]
---

# OVE_DS017: Pill, Chip and CountPill: tones, filter chips, removable chips, quick actions

## 1. Summary

Implement the pill family base: `Pill` (static capsule: surface/tint/outline/bare appearances, 8 tones, 3 sizes, optional leading icon or status dot), `Chip` (interactive: filter toggle, quick action, removable) and `CountPill` (Lane counts). The domain presets (skill chips, origin, position, status, model, validation) are built on `Pill` in OVE_DS018.

## 2. Context

Inventory B2 lists 14 pill variants. This task covers `meta`, `meta-selected`, `meta-tone`, `count`, `removable`, `quick-action` and the common mechanics (`tone`, `selected`, `removable`, `icon`, `mono`, `size`, `as`); OVE_DS018 covers `skill-uses`, `skill-chip`, `skill-used`, `origin`, `position`, `run`, `model`, `validation`. Crops: the top bar pills ("Claude Max 62% · reset 3 h · wg CLI" with a meter, "Agenci 3 z 3 naraz", "Telegram połączony" with a 6px mint dot); the Decisions filter chips (selected: fill `#1C1330`, border `#5B3E8F`, text `#EFE9F7`); Chief quick actions ("Pokaż Tablicę", "Zacznij Dyskusję", "Podsumuj dzień", Bricolage 12/400, min-height 34). The top-bar composite (limit meter + pills + Approvals button) is DS part 2 (UI-21).

## 3. Scope (in)

- `Pill`, `Chip`, `CountPill` with props below, CSS modules, stories, tests.
- Padding/density normalisation (5.3), tone table, state rules.

## 4. Out of scope

- Tinted domain presets, StatusPill, ModelPill: OVE_DS018. Circle CountBadge and badges: OVE_DS019. Meter inside the limit pill: OVE_DS021 (composition in TopBar).
- Select-like filter chips (dropdown behaviour): OVE_DS030 / Decisions composite.

## 5. Detailed requirements

**5.1 `Pill` API**
```ts
type PillTone = 'neutral' | 'mint' | 'amber' | 'lavender' | 'blue' | 'violet' | 'magenta' | 'error';
interface PillProps extends HTMLAttributes<HTMLElement> {
  tone?: PillTone;                                   // default 'neutral'
  appearance?: 'surface' | 'tint' | 'outline' | 'bare';   // default 'surface'
  size?: 'xs' | 'sm' | 'md';                         // font 10 | 11 | 12; default 'md'
  density?: 'regular' | 'tight';                     // default 'regular'
  mono?: boolean;                                    // default true (JetBrains Mono); false = Bricolage
  weight?: 400 | 500 | 600;                          // default 400
  bordered?: boolean;                                // default true except appearance 'bare'
  selected?: boolean;                                // meta-selected look
  icon?: IconName; iconStrokeWidth?: number;         // leading icon 12px (xs/sm) / 14px (md)
  dot?: AgentState | DotTone;                        // leading StatusDot size 6 (xs, sm) or 8 (md)
  as?: ElementType;                                  // default 'span'
}
```
Root: `display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; white-space: nowrap`.
**5.2 Appearance x tone table (exact)**
| appearance | fill | border | text |
|---|---|---|---|
| `surface` + `neutral` (inventory `meta`) | `bg-surface` | 1px `line` | `text-secondary` |
| `surface` + tone (inventory `meta-tone`) | `bg-surface` | 1px `line` | tone text: mint `mint-500`, amber `amber-300`, lavender `text-lavender`, blue `blue-500`, violet `violet-500`, magenta `magenta-300`, error `error-500` |
| `surface` + `selected` (`meta-selected`) | `bg-raised` | 1px `line-strong` | `text-primary` |
| `tint` + tone | `<family>-a12` (magenta a10 for neutral-magenta skill-uses is OVE_DS018) | 1px `<family>-a35` | family light text (magenta-300, amber-300, mint-300, violet-300, blue-300, error-300) |
| `outline` + tone | transparent | 1px = text colour of the tone (`neutral` = `line-strong`) | tone text (position tags: mint-500, muted `#8C80A6`, amber-300) |
| `bare` (inventory `count`) | `bg-surface` | none | `text-secondary` |
Fonts: `size` xs = 10px, sm = 11px, md = 12px; mono styles `mono-xs`/`mono-sm`/`mono` with `weight`; non-mono uses Bricolage at the same sizes (`caption`, `caption-xs`).
**5.3 Padding (E-noise normalised)**
| size | regular | tight |
|---|---|---|
| `xs` | 3px 8px | 2px 7px |
| `sm` | 3px 8px | 2px 8px (count pill) |
| `md` | 6px 10px | 5px 10px (run/validation) |
With `icon`/`dot`, padding-left stays; a `removable` Chip adds `padding-right: 6px`.
**5.4 `Chip` API (interactive)**
```ts
interface ChipProps extends Omit<PillProps, 'as' | 'children'> {
  kind?: 'filter' | 'action';              // default 'filter'
  onRemove?: () => void;                   // shows a 14px close button
  removeLabel?: string;                    // aria-label of the remove button (default from UiLabels 'remove' + label text)
  children: ReactNode; disabled?: boolean; as?: ElementType;
}
```
- `kind="filter"`: a toggle `button` with `aria-pressed={selected}`; hover per std states (fill `hover-from-surface`, border `line-strong`); focus ring; used for filter chips (Decisions, Skills; selected look = `meta-selected`).
- `kind="action"` (inventory `quick-action`): Bricolage 12/400, `min-height: 34px`, padding `0 12px`, `bg-surface`, border `line`, text `text-secondary`; hover text `text-primary`, border `line-strong`.
- Removable (inventory `removable`, "+ zdejmij wymóg"): `appearance="outline"`, border `line-strong`, text `text-lavender`, mono 12/400, padding 6 10; the close button is a separate focusable `button` inside (14px `close` icon, `aria-label`), Backspace/Delete on the focused chip triggers `onRemove`; removing moves focus to the next chip (callers' list) or the container.
**5.5 `CountPill`**: `count: number` (rendered with `Intl.NumberFormat`), `appearance: 'bare'`, `size: 'sm'`, `density: 'tight'`, `weight: 500` -> padding 2 8, mono 11/500, `bg-surface`, text `text-secondary`; `aria-label` optional (caller gives "3 tasks").
**5.6 Std states**: static `Pill` has no hover/focus; `Chip` has hover, focus-visible (`--om-ring-focus`), pressed (translateY 1px), disabled (.45, no glow). `selected` is a visual only on `Pill`; on `Chip` it is also `aria-pressed`.
**5.7 Hit area and a11y**: Chip min-height 34px (kind action) or 28px height with 34px hit area via `::before` padding for filter chips (so dense chip rows keep the 28px mock look but a 34px click target). Removable chips expose `aria-label="<text>"` on the chip and a distinct label on the remove button. Contrast per OVE_DS003 matrix (all tone texts >= 7.7 on `bg-surface`).

## 6. Design notes

`design.png`: three `Pill meta` (28px high capsules, mono 12/400, `#140F20` fill, `#2A2040` border, text `#A79BBF`), the limit pill contains a 48x6 meter (Meter in OVE_DS021) and the channel pill contains a 6px mint dot (`dot="done"` size 6). `design-filter-chips.png`: selected filter chip (violet-ish raised surface) next to unselected chips ("Wszystkie Workspace'y", "Status", "Wynik"). `design-quick-actions.png`: three 34px action chips with Bricolage text. Not in mock: Chip hover/focus/pressed/disabled, removable close button, error tone.

## 7. Reuse

`Icon`, `StatusDot` (OVE_DS020), `Text` styles, tokens, `UiLabels` for the default remove label (OVE_DS038), `cx`/`mergeRefs`.

## 8. Architecture and code placement

`packages/ui-kit/src/badges/{Pill,Chip,CountPill}/`. `Chip` composes `Pill` (no duplicated CSS, DRY). Appearance and tone are CSS attribute selectors reading tokens (OCP). No domain knowledge (Skills, Run) in these components (domain presets live in OVE_DS018).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Chip text may contain Agent- or repo-provided strings (file names, Skill names): rendered as text only, truncated with ellipsis (`max-width: 100%`), never interpreted. Removing a chip that represents an Owner Rule consent exception is a security-relevant action: `onRemove` is a callback only; the confirmation (Local Approval, ADR 0021) is the caller's.

## 10. Errors and edge cases

- Very long label: ellipsis inside the pill (`min-width: 0; overflow: hidden`), full text available via the caller's `title`.
- `selected` and `tone` together on `surface`: selected look wins (tone text becomes primary).
- Chip `disabled` with `onRemove`: remove button disabled too.
- `onRemove` without text children: dev warning (name).

## 11. Acceptance criteria

- [ ] Pill meta: 12px mono, padding 6/10, radius 999, fill `#140F20`, border `#2A2040`, text `#A79BBF` (computed).
- [ ] Tone table of 5.2 verified for surface/tint/outline/bare (token assertions, 8 tones).
- [ ] Selected chip: fill `#1C1330`, border `#5B3E8F`, text `#EFE9F7`, `aria-pressed="true"`.
- [ ] Quick-action chip is >= 34px high, Bricolage 12/400.
- [ ] Removable chip: close button has its own accessible name, Delete/Backspace removes, focus ring visible on both targets.
- [ ] CountPill renders `2 8` padding and `Intl` formatting.
- [ ] Filter chip hit area >= 34px (bounding box of the `::before` extension tested via `elementFromPoint`).
- [ ] Stories: `Meta`, `Tones`, `Selected`, `Tint`, `Outline`, `Removable`, `QuickAction`, `Count`, `WithDot`, `WithIcon`, `Matrix`; axe clean.
- [ ] Visual: `TopBarPills`, `FilterChips`, `QuickActions` stories match their three crops (structural).

## 12. Test plan

Vitest: `Pill.test.tsx`, `Chip.test.tsx` (toggle, remove keyboard, aria), `CountPill.test.tsx`. Playwright: computed styles + crops; Matrix baselines. Commands: `pnpm --filter @overmind/ui-kit test badges`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. OVE_DS018 builds on `Pill`; start it after this task merges (or against the documented props).

## 14. Open questions and assumptions

- ASSUMPTION: padding noise (5 9 / 6 10; 2 8) normalised to the table in 5.3.
- ASSUMPTION: a 34px hit area via pseudo-element for 28px chips (keeps the mock look, meets inventory minimum click size).
