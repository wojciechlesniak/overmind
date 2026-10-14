---
id: OVE_DS026
title: "Form fields: Field, TextField, SearchField and Textarea"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS011, OVE_DS022, OVE_DS013]
soft_depends_on: []
provides: [ui:Field, ui:TextField, ui:SearchField, ui:Textarea]
needs: [ui:icons]
owns: [packages/ui-kit/src/forms/Field/**, packages/ui-kit/src/forms/TextField/**, packages/ui-kit/src/forms/SearchField/**, packages/ui-kit/src/forms/Textarea/**]
reads: []
design: design.png
design_source: "Decyzje#decis/search (SearchField); design-skills-search Main#canvas/skills-search (box 86,211,211,42); design-textarea Agenci#agents/instructions"
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS026: Form fields: Field, TextField, SearchField and Textarea

## 1. Summary

Implement the text-entry primitives: `Field` (label, hint, error wrapper with correct ARIA wiring), `TextField`, `SearchField` and `Textarea`, with the 40px field height (E20), the control-border contrast fix (E18) and a real focus ring replacing `outline: none` (E19).

## 2. Context

Inventory B10. The mock builds the search field from a `div` with `content-box` sizing (40 + 2 border = 42px, while buttons are 40) and removes the outline on the inner `<input>`; labels are visually hidden. `TextField` is not drawn as a bordered field anywhere; the recommendation is the SearchField without the icon plus error and helper text. Textarea (Agent instructions) has padding 12 14, radius 14, 14px/1.5, vertical resize. Crops: "Szukaj: biblioteka dat, platnosci..." field, Skills search (211px wide), instructions textarea.

## 3. Scope (in)

- Four components + stories + tests. `Field` composes any control through render-prop/`useFieldIds`.
- States: default, hover, focus-visible, filled, invalid, disabled, read-only, loading (search).

## 4. Out of scope

- Composer (OVE_DS027), Select (OVE_DS030), TelegramInput (DS part 2, built from `TextField variant="pill"`).
- Debounce and search logic: callers; `SearchField` only reports `onValueChange`.

## 5. Detailed requirements

**5.1 Common field box (exact)**: `box-sizing: border-box` (E20), `min-height: 40px`, padding `0 10px` (search) or `0 12px` (text), radius 12px, `border: 1px solid line-control` `#6E5AA6` (E18; the mock's `#2A2040` is 1.2:1 and fails 3:1), fill `bg-surface` `#140F20` (Settings contexts may pass `surface="panel-alt"` to use `#0C0814`), text 13px Bricolage `text-primary` (14px in `md` TextField), placeholder `text-muted` `#8C80A6` (5.1:1 on `#140F20`), caret `violet-500`.
**5.2 `Field`**
```ts
interface FieldProps { label: ReactNode; labelHidden?: boolean; hint?: ReactNode; error?: ReactNode; required?: boolean; optional?: boolean; children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode }
```
Label Bricolage 13/600 `text-primary` (`labelHidden` -> `VisuallyHidden`); hint 12/400 `text-muted` line-height 1.4 (margin-top 6); error 12/400 `error-500` `#FF8FA3` with a 12px `warning`-style glyph (OVE_DS011) and `role="alert"` only when it appears after first blur. `required` appends a marker with UiLabels `required` text (never only an asterisk).
**5.3 `TextField`**: `{ value, onValueChange, type?: 'text' | 'email' | 'url' | 'password' | 'number', size?: 'md' | 'pill', leading?: ReactNode, trailing?: ReactNode, invalid?: boolean, ...InputHTMLAttributes }`. `size="pill"`: min-height 44, radius 22, padding 0 14, 14px (Telegram input look). Password reveal is NOT built in.
**5.4 `SearchField`**: wrapper `display: flex; align-items: center; gap: 8px`, leading `search` icon 16px `text-muted`, `<input type="search">` transparent, no border, no own outline; the wrapper shows the ring through `:focus-within`. Trailing clear button (`close` icon 14px, `IconButton`-like, `aria-label` from UiLabels `clearSearch`) appears only when non-empty; Escape clears; `onSubmit` on Enter. `loading` shows a 14px `Spinner` instead of the clear button. `role="search"` is NOT put on the field (the page decides); input has `type="search"` and `enterkeyhint="search"`.
**5.5 `Textarea`**: padding 12px 14px, radius 14px, 14px/1.5, `resize: vertical`, min-height 96px, same border/fill; optional `autosize` (grows to `maxRows`, default 12) using `field-sizing: content` with a `ResizeObserver` fallback; character counter slot `meta` (mono 11 `text-muted`).
**5.6 States**
- hover: border `violet-500` at 60% (`--om-color-border-hover`).
- focus-visible/focus-within: border `violet-500` + `--om-ring-focus` (no `outline: none` without it, E19).
- invalid: border `error-500` + helper in `error-500` + `aria-invalid="true"`; focus uses `--om-ring-focus-error`.
- disabled: opacity .55, `cursor: not-allowed`, `disabledReason` shown as hint (E33); read-only: no hover border, text selectable.
- placeholder never replaces a label.
**5.7 a11y**: label via `<label for>`; `aria-describedby` hint + error; `autocomplete` passthrough; 16px minimum font on touch (iOS zoom) is not needed (desktop app).

## 6. Design notes

`design.png`: SearchField with the 16px search icon and placeholder, 40px high in this implementation (the mock crop is 42px, E20) so the visual comparison accepts the +2px. `design-skills-search.png`: the 211px wide Skills panel search. `design-textarea.png`: instructions textarea (radius 14, padding 12/14, 14px). Not drawn: error, disabled, filled, loading, `TextField` plain.

## 7. Reuse

`Icon`, `Spinner` (OVE_DS013), `VisuallyHidden` (OVE_DS022), `Text`, focus-ring tokens (OVE_DS007), UiLabels (OVE_DS038).

## 8. Architecture and code placement

`packages/ui-kit/src/forms/{Field,TextField,SearchField,Textarea}/`. Shared `useFieldIds` + `fieldBox.module.css` (composes one class used by the four controls: DRY).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Fields may hold secrets (API keys are post-MVP, but password-type fields exist): `autocomplete="off"` is the caller's choice; the component never logs values, never stores them, and `type="password"` disables the clear button. Pasted content is plain text only.

## 10. Errors and edge cases

- Very long values: input scrolls horizontally, never grows the layout.
- `Textarea autosize` beyond `maxRows`: scrolls.
- IME composition: `onValueChange` fires on composition end only for SearchField's Enter/Escape logic.
- Label missing: dev warning.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Field/TextField/SearchField/Textarea` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Fields are 40px tall (md) with `box-sizing: border-box`; Textarea min 96px; border `#6E5AA6` (>= 3:1 on `#140F20`, unit test).
- [ ] Focus-visible shows the ring; there is no `outline: none` in the CSS (guard).
- [ ] Error wiring: `aria-invalid`, `aria-describedby` to hint and error ids.
- [ ] SearchField clear (button and Escape), Enter submit; loading replaces the clear button.

## 12. Test plan

- Vitest + Testing Library + user-event in `forms/(Field|TextField|SearchField|Textarea).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test forms` and `pnpm --filter @overmind/ui-kit test:visual forms`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. OVE_DS027 (Composer) and OVE_DS030 (Select) reuse `fieldBox.module.css` from this task (export through `forms/_shared`).

## 14. Open questions and assumptions

- ASSUMPTION (E18/E20): 40px height and `#6E5AA6` border; the mock is 42px and `#2A2040`.
- ASSUMPTION: Escape clears the search (convention, not in mock).
- Open: `Field` required marker text comes from UiLabels `required`.
