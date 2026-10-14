---
id: OVE_DS030
title: "Select and ModelPicker"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS011, OVE_DS026, OVE_DS028, OVE_DS029]
soft_depends_on: []
provides: [ui:Select, ui:ModelPicker, ui:SelectButton]
needs: [ui:icons]
owns: [packages/ui-kit/src/forms/Select/**, packages/ui-kit/src/forms/ModelPicker/**]
reads: []
design: design.png
design_source: "Ustawienia#settings/language-select (SelectButton 'Polski'); design-model.png and design-model-row.png Agenci#agents/model (ModelPicker)"
spec_refs: [SPECIFICATION 7, SPECIFICATION 13]
adr_refs: [22]
---

# OVE_DS030: Select and ModelPicker

## 1. Summary

Implement `Select` (custom listbox with a field-like trigger, two sizes) and `ModelPicker` (the "CLI . model" chooser with fallback line, disabled options for CLIs that are not logged in). Both use `chevron-down` (E4) instead of the mock's right-pointing chevron.

## 2. Context

Inventory B11: `SelectButton` is inline-flex, gap 8, min-h 38, padding 0 12, r10, 1px `#2A2040`, fill `#0C0814`, 13px, trailing 12px chevron (mock uses `chevron-right`); `ModelPicker`: space-between, min-h 42, padding 0 12, r12, 1px `#2A2040`, fill `#140F20`, 14/600, section label above ("MODEL", "MODEL ZAPASOWY"), value "Claude Code . Opus 5.5" (CLI name, middle dot, model), second line mono 11 for the fallback ("Zapasowy: Codex CLI . gpt-5.5"). SPEC 7: provider/model is per Agent and per Node; a CLI that is not logged in cannot be chosen (the list shows it disabled with "zaloguj w Polaczeniach"). Normalisations: heights 38/42 -> 40 (md), borders `line-control` (E18), caret chevron-down rotating when open (E4), real focus ring (E19).

## 3. Scope (in)

- `Select` (single-select listbox, grouped options, disabled options, clear nothing), `ModelPicker` as a composition on top of `Select` with a typed option model.
- Stories, tests, visual checks.

## 4. Out of scope

- Multi-select, async search combobox, native select fallback: not in scope.
- Reading which CLIs are logged in: apps (`options[].disabled` + reason come from props).
- Agent config form layout: DS part 2 (UI-46).

## 5. Detailed requirements

**5.1 `Select`**
```ts
interface SelectOption<V extends string = string> { value: V; label: ReactNode; description?: ReactNode; icon?: IconName; disabled?: boolean; disabledReason?: ReactNode; group?: string }
interface SelectProps<V extends string = string> {
  options: SelectOption<V>[]; value?: V; onValueChange?: (v: V) => void; placeholder?: string; size?: 'sm' | 'md'; label: string; labelHidden?: boolean;
  disabled?: boolean; invalid?: boolean; surface?: 'surface' | 'panel-alt'; width?: 'auto' | 'full'; name?: string; renderValue?: (o: SelectOption<V>) => ReactNode }
```
**5.2 Trigger (exact)**: `<button role="combobox" aria-haspopup="listbox" aria-expanded aria-controls aria-labelledby>`, inline-flex, gap 8, `justify-content: space-between`, `box-sizing: border-box`, `border: 1px solid line-control #6E5AA6`, fill `bg-panel-alt` `#0C0814` (`surface="panel-alt"`, Settings default) or `bg-surface` `#140F20`. `md`: height 40, padding 0 12, radius 12, 13px/1.2 Bricolage `text-primary`; `sm`: height 34, padding 0 10, radius 10, 13px (filters). Placeholder colour `text-muted`. Caret: `chevron-down` 12px `text-muted` `#8C80A6`, `transform: rotate(180deg)` when open over `--om-duration-fast` (none under reduced motion).
**5.3 Listbox**: `Popover` surface (OVE_DS028) with `width="trigger"` (min-width = trigger), `role="listbox"`, options `role="option"` `aria-selected`, built with the `MenuItem` look (`menuItemClassName`, OVE_DS029): min-height 40 (sm 34), padding 0 10, r10; selected option shows `check` 14px `violet-500` at the right; `description` is a second line 12px `text-muted`; groups show a `MenuLabel` heading (`role="group"`). Disabled option: opacity .55, `aria-disabled`, reason line (12px `text-muted`).
**5.4 Keyboard**: trigger Enter/Space/ArrowDown open; in list ArrowUp/Down (skip disabled), Home/End, typeahead, Enter/Space select and close, Escape closes (focus returns to trigger), Tab closes without selecting. Focus stays on the trigger with `aria-activedescendant` pointing to the active option (combobox pattern).
**5.5 States**: hover: border `violet-500` 60%; focus-visible: `--om-ring-focus`; open: border `violet-500`; invalid: border `error-500`; disabled: opacity .55, `cursor: not-allowed`; loading options: parent passes `options=[]` and `loading` shows a `Skeleton` row (OVE_DS032 optional soft dependency not required; plain text row "..." from UiLabels `loading`).
**5.6 `ModelPicker`**
```ts
interface ModelOption { cli: string /* 'Claude Code' */; model: string /* 'Opus 5.5' */; value: string; loggedIn: boolean; hint?: ReactNode }
interface ModelPickerProps { options: ModelOption[]; value?: string; onValueChange?: (v: string) => void; label: string /* 'MODEL' | 'MODEL ZAPASOWY' */; fallback?: { cli: string; model: string }; fallbackLabel?: string; loginHint: ReactNode; disabled?: boolean }
```
- Renders a `SectionLabel` (OVE_DS022) with `label` above, then `Select` `md` with `surface="surface"` (`#140F20`), radius 12, text 14/600 `text-primary`; value format `"{cli} . {model}"` using the middle dot U+00B7 with spaces (formatter `formatModelLabel(cli, model)` exported for tests).
- Options group by CLI; options with `loggedIn=false` are disabled and show `loginHint` ("zaloguj w Polaczeniach") as reason.
- `fallback` renders a second line under the field: mono 11/400 `text-muted`, text `{fallbackLabel}: {cli} . {model}`.
**5.7 a11y**: label association (visible `SectionLabel` is the accessible name through `aria-labelledby`); the value text is announced with the label; disabled options announce their reason via `aria-describedby`.

## 6. Design notes

`design.png`: the language select "Polski >" in Settings (trigger fill `#0C0814`, 1px border, 13px, chevron). Mock shows `chevron-right`; implementation uses `chevron-down` (E4) so the visual test masks the 12px caret box. `design-model.png` / `design-model-row.png`: ModelPicker with the label above, value "Claude Code . Opus 5.5" and the chevron, plus the mono fallback line. Not drawn: open list, disabled options, invalid.

## 7. Reuse

`Popover` and `MenuItem` styles (OVE_DS028, OVE_DS029), `fieldBox` styles (OVE_DS026), `SectionLabel` (OVE_DS022), `Icon` (OVE_DS009), `useControllableState` (OVE_DS023).

## 8. Architecture and code placement

`packages/ui-kit/src/forms/Select/` (generic) and `forms/ModelPicker/` (presentation-only composition; no knowledge of providers: the app maps CLI/provider registries to `ModelOption[]`, keeping ui-kit free of domain logic).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). ModelPicker must never allow choosing a CLI that is not logged in: disabled options are not selectable by mouse, keyboard or typeahead, and `onValueChange` is never called with a disabled value (test). Model labels are plain text.

## 10. Errors and edge cases

- `value` not in options: shows placeholder, no selection.
- Selected option later disabled: stays displayed, marked, can be changed away.
- Zero options: trigger disabled with placeholder.
- Long labels: ellipsis in trigger, wrap in list.
- Popover opens upward when low on space (flip).

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Select/ModelPicker` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Trigger md 40 r12 / sm 34 r10, border `#6E5AA6`, caret `chevron-down` rotating 180 on open (not chevron-right).
- [ ] Combobox/listbox ARIA wiring and full keyboard model of 5.4; Tab closes without selecting.
- [ ] ModelPicker formats "Claude Code . Opus 5.5" with U+00B7; logged-out CLIs are disabled with the reason and never emitted.
- [ ] Fallback line is mono 11 `#8C80A6`; label above uses `SectionLabel`.

## 12. Test plan

- Vitest + Testing Library + user-event in `forms/(Select|ModelPicker).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test forms` and `pnpm --filter @overmind/ui-kit test:visual forms`.
- Property test: random option arrays with disabled entries never emit a disabled value.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Depends on OVE_DS028/029 for the floating surface and item look.

## 14. Open questions and assumptions

- ASSUMPTION (E4/E20): caret is chevron-down, heights normalised to 40px.
- ASSUMPTION: model value separator is a middle dot with spaces as in the SPEC.
- Open: Ollama local models list is dynamic; handled by the app passing options.
