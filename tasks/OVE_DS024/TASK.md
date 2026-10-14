---
id: OVE_DS024
title: "Checkbox, CheckboxRow and Radio"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS023]
soft_depends_on: []
provides: [ui:Checkbox, ui:CheckboxRow, ui:Radio]
needs: [ui:icons]
owns: [packages/ui-kit/src/forms/Checkbox/**, packages/ui-kit/src/forms/CheckboxRow/**, packages/ui-kit/src/forms/Radio/**]
reads: []
design: design.png
design_source: "Kreator-Folder#onb1/permissions-panel (box 925,216.7,459,249.8); design-rows.png: rights rows"
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS024: Checkbox, CheckboxRow and Radio

## 1. Summary

Implement a custom-drawn but native-backed `Checkbox` (20px, radius 6, indeterminate), `CheckboxRow` (checkbox + title + description, used for rights) and `Radio` (20px circle) replacing the browser `accent-color` checkboxes of the mock (E22).

## 2. Context

Inventory B7: the mock uses native `<input type=checkbox>` 20x20 with `accent-color: #9B7BFF`; the crop shows violet checked boxes with a white check and a plain white unchecked box (native look, clashes with the dark UI). E22 asks for a custom box, 20px, radius 6, border 1.5px `line-strong`; E18 raises the border to `line-control` `#6E5AA6` (3:1) because form controls need 3:1. The rights row: label `align-items: flex-start`, gap 12, title Bricolage 14/600, description 12/400 `#8C80A6`. Wizard step 1 uses three rows (Odczyt checked, Zapis checked, Wykonywanie unchecked); the Workspace folder table uses bare cells.

## 3. Scope (in)

- Native `<input type="checkbox|radio">` kept in the DOM (visually hidden, still focusable) with a drawn box sibling.
- `Checkbox`, `CheckboxRow`, `Radio`, `RadioGroup` wrapper (fieldset + legend + arrow-key support from native radios).

## 4. Out of scope

- Permission matrix (DS part 2 UI-51), card-style radios (OVE_DS025), Switch (OVE_DS023).

## 5. Detailed requirements

**5.1 API**
```ts
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  checked?: boolean | 'indeterminate'; defaultChecked?: boolean; onCheckedChange?: (v: boolean) => void; invalid?: boolean }
interface CheckboxRowProps extends CheckboxProps { title: ReactNode; description?: ReactNode; disabledReason?: ReactNode }
interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> { value: string }
interface RadioGroupProps { name: string; value?: string; onValueChange?: (v: string) => void; legend: ReactNode; children: ReactNode; orientation?: 'vertical' | 'horizontal' }
```
**5.2 Checkbox box (exact)**: 20x20, `box-sizing: border-box`, radius 6, `border: 1.5px solid line-control #6E5AA6`, fill transparent. Checked: fill `violet-500` `#9B7BFF`, border same, `check` icon 14px stroke 2.6 colour `ink` `#12091F` (OVE_DS009). Indeterminate: same fill with a 10x2px rounded `ink` bar and `aria-checked="mixed"` (set through the native `indeterminate` property). Margin-top 1px when inside rows to align with the 14px title.
**5.3 Radio**: 20px circle, same border; checked: border `violet-500`, inner dot 8px `violet-500`, fill transparent (ring variant keeps contrast on dark). Group spacing: gap 12.
**5.4 `CheckboxRow`**: `<label>` flex, `align-items: flex-start`, `gap: 12px`; title Bricolage 14/600 `text-primary`; description 12/400 `text-muted` line-height 1.4 linked via `aria-describedby`; clicking the text toggles; row hover shows nothing (the control is the affordance) except `cursor: pointer`.
**5.5 States**: hover: border `violet-500`; focus-visible: ring on the box (`--om-ring-focus`) via `input:focus-visible + .box`; active: `transform: scale(.96)` (none for reduced motion); disabled: opacity .55, `cursor: not-allowed`, row shows `disabledReason` text below the description (E33); invalid: border `error-500` `#FF8FA3` + `--om-ring-focus-error` on focus; read-only: no pointer events but visible.
**5.6 Keyboard**: Space toggles; radios use native arrow-key navigation and roving focus (single tab stop), `RadioGroup` is `<fieldset>` with `<legend>` (can be visually hidden). Hit target 44px on coarse pointers (pseudo-element).
**5.7 Contrast**: box border `#6E5AA6` on `#140F20` 3.29:1 and on the panel gradient (`#2A1130` to `#120D1C`) >= 3.0:1 (unit test uses the lighter end); check `ink` on violet 6.6:1.

## 6. Design notes

`design.png`: the "PRAWA DLA ~/Projects/aplikacja-rezerwacji" rights panel with Odczyt (checked), Zapis (checked) and Wykonywanie (unchecked, drawn as a native white box in the mock) and the footnote. The implementation draws the unchecked box dark with the `#6E5AA6` border (E22), so the visual test excludes the checkbox pixels from the diff and verifies them by `expectComputed`. `design-rows.png`: the same panel region in closer view.

## 7. Reuse

`Icon` check (OVE_DS009), `useControllableState` (OVE_DS023), `VisuallyHidden` pattern (OVE_DS022) for the native input, text styles (OVE_DS005).

## 8. Architecture and code placement

`packages/ui-kit/src/forms/{Checkbox,CheckboxRow,Radio}/`; `RadioGroup` lives in `Radio/`. Native input stays the source of truth (forms, autofill, assistive tech); the drawn box is `aria-hidden` and styled with sibling selectors.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`).

## 10. Errors and edge cases

- `checked='indeterminate'` clicked: becomes `true`.
- Controlled without handler: dev warning.
- Label-less checkbox: dev warning; axe fails.
- Windows high contrast: box border uses `ButtonText`, check uses `Highlight`.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Checkbox/CheckboxRow/Radio` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Box 20x20 r6 border 1.5px `#6E5AA6`; checked fill `#9B7BFF` with `#12091F` check; indeterminate sets `aria-checked=mixed`.
- [ ] Native input is the single focusable element, label click and Space toggle, radios navigate with arrows.
- [ ] `CheckboxRow` reproduces the rights panel rows (title 14/600, description 12/400 `#8C80A6`, gap 12).

## 12. Test plan

- Vitest + Testing Library + user-event in `forms/(Checkbox|CheckboxRow|Radio).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test forms` and `pnpm --filter @overmind/ui-kit test:visual forms`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task.

## 14. Open questions and assumptions

- ASSUMPTION (E22/E18): custom box with `line-control` border instead of native accent-color.
- ASSUMPTION: radio checked style (ring + dot) is derived, not drawn.
- Open: Execute is unchecked by default in the wizard (a product rule, owned by the wizard task).
