---
id: OVE_DS023
title: "Switch (role=switch toggle)"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS013]
soft_depends_on: []
provides: [ui:Switch]
needs: [ui:icons]
owns: [packages/ui-kit/src/forms/Switch/**]
reads: []
design: design.png
design_source: "Ustawienia#settings/row-autostart (setting row with the switch on); design-rows.png two rows"
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS023: Switch (role=switch toggle)

## 1. Summary

Implement `Switch`, the on/off control of App and Workspace settings, as a real `button role="switch"` (E23) with a 44x26 track and 20px knob, plus an optional label/description layout helper `SwitchField` (label and help text left, switch right) that matches the setting rows.

## 2. Context

Inventory B6. In the mock it is a `<button>` without a role: no screen reader can tell it is a toggle. Used for autostart, "Pracuj po zamknieciu okna", Telegram forward, Workspace isolation and private items. Off state in the mock is track `#2A2040` with a grey knob, which has only about 1.2:1 contrast with the page; E18 introduces `line-control` `#6E5AA6` (3.29:1 on `#140F20`) for the off outline so the control is perceivable (WCAG 1.4.11). The crop shows the On state (violet track, dark knob on the right) inside a setting row (title 14/600-ish regular, help 12px muted).

## 3. Scope (in)

- `Switch`, `SwitchField`, CSS module, stories, tests, visual checks.
- Controlled and uncontrolled use.

## 4. Out of scope

- Setting rows in screens (`SettingRow`, `SettingsSection`): DS part 2 (UI-50).
- Persisting the value: apps.

## 5. Detailed requirements

**5.1 API**
```ts
interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'type'> {
  checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean; loading?: boolean; 'aria-label'?: string; 'aria-labelledby'?: string; name?: string }
interface SwitchFieldProps { label: ReactNode; description?: ReactNode; switchProps: SwitchProps; disabledReason?: ReactNode }
```
Renders `<button type="button" role="switch" aria-checked>`; with `name` a visually hidden `<input type="checkbox" hidden>` mirrors the value for native forms. Either `aria-label`, `aria-labelledby` or `SwitchField` label is required (dev warning otherwise).
**5.2 Geometry and colours (exact)**
| Part | Off | On | Disabled |
|---|---|---|---|
| Track | 44x26, `padding: 3px`, radius 13px, `box-sizing: border-box`, fill `bg-raised-track` `#2A2040`, `box-shadow: inset 0 0 0 1px line-control` `#6E5AA6` | fill `violet-500` `#9B7BFF`, no outline | off `#1C1330`, on `violet-500` at `--om-state-disabled-opacity` .55 |
| Knob | 20px circle, fill `text-muted` `#8C80A6`, `justify-content: flex-start` | fill `ink` `#12091F`, end | knob unchanged, whole control `cursor: not-allowed` |
| Transition | knob `transform: translateX(18px)` over `--om-duration-fast` ease-out; none under reduced motion | | |
Implementation uses a pseudo-element or child knob moved with `transform` (not `justify-content`) so it can animate; end position 18px. The `On` knob contrast on violet: `#12091F` on `#9B7BFF` 6.6:1.
**5.3 States**
- hover: track `filter: brightness(var(--om-state-hover-brightness))` (1.08), pointer.
- focus-visible: `box-shadow: var(--om-ring-focus)` (stacked with the inset outline using a second shadow layer in the token composition, OVE_DS007 `--om-ring-focus-inset`), never `outline: none` alone (E19).
- active: knob widens to 24px (stretch) over 80ms, none under reduced motion.
- disabled: `disabled` attribute, no events, `aria-disabled` kept, tooltip/hint through `disabledReason` (E33) text below the description.
- loading: knob replaced by a 12px `Spinner` (OVE_DS013), input ignored (`aria-busy="true"`), state keeps its previous value until the promise in the parent resolves.
**5.4 Keyboard**: Space and Enter toggle (button semantics); Tab focus; arrows not used. Hit area: `::before` extends to 44x44 (`--om-hit-min`) when `@media (pointer: coarse)`.
**5.5 `SwitchField` layout**: `display: flex; justify-content: space-between; align-items: center; gap: 16px`; label Bricolage 14/400 `text-primary`, description 12/400 `text-muted` `#8C80A6` (contrast 5.1:1 on `#0D0915`), label click toggles the switch (`<label for>` wiring through an auto id).

## 6. Design notes

`design.png`: a setting row "Uruchamiaj przy logowaniu" with help "Silnik startuje jako usluga uzytkownika." and the On switch right. `design-rows.png`: two rows with different states. The mock's off track is drawn without outline; the implementation adds the `line-control` outline (E18), a deliberate, documented deviation: the visual test crops compare only the On state pixel-wise and assert the Off outline with `expectComputed`.

## 7. Reuse

`Spinner` (OVE_DS013), focus ring and state tokens (OVE_DS007), `Text` styles (OVE_DS005).

## 8. Architecture and code placement

`packages/ui-kit/src/forms/Switch/{Switch.tsx,SwitchField.tsx,Switch.module.css,index.ts,stories,tests}`. Controlled/uncontrolled through the shared `useControllableState` hook in `src/internal/useControllableState.ts` (created here if absent; owned by this task; Checkbox, Tabs and Dialog reuse it).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). A switch can guard security-relevant settings (isolation, private items): `loading` blocks double toggles and the component never changes its visual state on its own when `checked` is controlled and the parent rejects the change.

## 10. Errors and edge cases

- Controlled `checked` without `onCheckedChange`: read-only, dev warning.
- Rapid double click while `loading`: ignored.
- Missing accessible name: dev warning, axe test fails in stories.
- RTL: knob direction follows `dir` (logical translate through a CSS variable).

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Switch` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] `role=switch`, `aria-checked` toggles on click, Space and Enter; disabled blocks all.
- [ ] Track 44x26 r13, knob 20px; On `#9B7BFF`/`#12091F`, Off `#2A2040` with `#6E5AA6` inset outline (contrast >= 3:1 vs `#140F20`).
- [ ] Focus ring visible on keyboard focus only; reduced motion removes transitions.
- [ ] `SwitchField` label click toggles; description linked with `aria-describedby`.

## 12. Test plan

- Vitest + Testing Library + user-event in `forms/Switch.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test Switch` and `pnpm --filter @overmind/ui-kit test:visual Switch`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Creates `src/internal/useControllableState.ts`; OVE_DS024, OVE_DS035 and OVE_DS036 reuse it; if they start first they must create it identically (same signature) and the later merge keeps one copy.

## 14. Open questions and assumptions

- ASSUMPTION (E18): off outline `line-control` is added; the mock shows none.
- ASSUMPTION: the disabled-on state uses 55% opacity, the mock only specifies off disabled `#1C1330`.
- Open: `loading` is an addition for async settings (engine round trip).
