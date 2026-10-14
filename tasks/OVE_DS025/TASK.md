---
id: OVE_DS025
title: "RadioCardGroup, SegmentedControl and VerdictSelect"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS017, OVE_DS019, OVE_DS024]
soft_depends_on: []
provides: [ui:RadioCardGroup, ui:SegmentedControl, ui:VerdictSelect]
needs: [ui:icons]
owns: [packages/ui-kit/src/forms/RadioCardGroup/**, packages/ui-kit/src/forms/SegmentedControl/**, packages/ui-kit/src/forms/VerdictSelect/**]
reads: []
design: design.png
design_source: "Agenci#agents/visibility-chooser; extra crops design-segmented (Tablica filter), design-verdict (Decyzje outcome), design-compact (Inspector)"
spec_refs: [SPECIFICATION 8, SPECIFICATION 13]
adr_refs: [28]
---

# OVE_DS025: RadioCardGroup, SegmentedControl and VerdictSelect

## 1. Summary

Implement the three choice controls: `RadioCardGroup` (visibility chooser with big and compact forms), `SegmentedControl` (Task Board filter) and `VerdictSelect` (Decision outcome, four tones). All are single-select groups with proper radio semantics.

## 2. Context

Inventory B8 and E31 (colour follows the option: public blue, private violet, in the Agents chooser and in the Inspector). The mock uses `aria-pressed` buttons; this task uses `role="radiogroup"` with `role="radio"` items and roving tabindex (arrow keys), which is the correct semantics for exclusive choices. Visibility always shows the word (ADR 0028) via `VisibilityBadge outline` (OVE_DS019).

## 3. Scope (in)

- Three components with stories, tests, visual checks.
- Group keyboard model shared through `src/internal/useRovingTabindex.ts` (created here; Tabs OVE_DS035 reuses it).

## 4. Out of scope

- Where they are placed (Agent profile, Inspector, Board, Decisions): DS part 2.
- The Visibility values' meaning and persistence: apps.

## 5. Detailed requirements

**5.1 `RadioCardGroup`**
```ts
interface RadioCardOption { value: string; tone?: 'public' | 'private' | 'neutral'; badge?: ReactNode; title: ReactNode; description?: ReactNode; disabled?: boolean }
interface RadioCardGroupProps { options: RadioCardOption[]; value?: string; onValueChange?: (v: string) => void; legend: ReactNode; variant?: 'default' | 'compact'; name?: string }
```
- Container `display: flex; flex-wrap: wrap; gap: 12px` (compact: `flex-wrap: nowrap`).
- Item `default`: `flex: 1 1 200px`, column, `gap: 3px`, padding 10px 12px, radius 14px. Unselected: `border: 1px solid line` `#2A2040`, transparent, text `text-secondary` `#A79BBF`. Selected: `border: 1.5px solid <tone colour>` and fill `<tone>-a10` (public `#6FA8FF` with `rgba(111,168,255,.10)`, private `#9B7BFF` with `violet-a10`), text `text-primary`; the border width change must not shift layout: unselected also reserves 1.5px via `box-shadow: inset` (`border: 1.5px solid transparent` + inner 1px ring).
- `compact`: `flex: 1 1 0`, padding 8px 10px, radius 12px, same colours.
- Content: `badge` (an outline `VisibilityBadge`, with the word), `title`, `description` 12px `text-secondary`.
- Selected radio mark is not drawn in the mock; selection is communicated by border, fill and `aria-checked`; additionally a 14px `check` icon top-right in the tone colour (a11y: not colour alone) -- ASSUMPTION.
**5.2 `SegmentedControl`**
```ts
interface SegmentedOption { value: string; label: ReactNode; count?: number; disabled?: boolean }
interface SegmentedControlProps { options: SegmentedOption[]; value: string; onValueChange: (v: string) => void; label: string; size?: 'md' }
```
Container: `display: inline-flex; padding: 4px; radius 14px; border: 1px solid line; fill bg-surface #140F20; gap: 2px`. Item: height 36, padding 0 12px, radius 10px, Bricolage 12/400, colour `text-secondary`; selected: fill `bg-raised` `#1C1330`, 600, `text-primary` `#EFE9F7`. `role="radiogroup"` + items `role="radio"` `aria-checked`; roving tabindex; Left/Right/Home/End.
**5.3 `VerdictSelect`**
```ts
type Verdict = 'positive' | 'mixed' | 'unknown' | 'negative';
interface VerdictSelectProps { value?: Verdict; onValueChange?: (v: Verdict) => void; labels: Record<Verdict, ReactNode>; legend: ReactNode }
```
Four buttons h40, padding 0 14px, radius 12px, Bricolage 13/600, gap 8, `border: 1px solid line`, transparent. Unselected text: positive `mint-500`, mixed `amber-300` `#FFCF85`, unknown `text-muted` `#8C80A6`, negative `error-500` `#FF8FA3`. Selected: border 1px in the tone colour and fill `<tone>-a12` (mock: positive `#62E3B4` with `rgba(98,227,180,.12)`; mixed amber, unknown grey, negative error are derived, R). Each also has a leading 12px glyph (`glyph-check`, `glyph-diamond`, `glyph-ring`, `glyph-cross`, OVE_DS011) for non-colour meaning.
**5.4 States for all**: hover: `brightness(1.08)`; focus-visible: `--om-ring-focus` on the item; active: `translateY(1px)`; disabled: opacity .55 plus `disabledReason` support through `title`-free text by the parent; items `disabled` are skipped by arrows.
**5.5 Keyboard**: Tab enters the group at the selected item (or the first); Arrow keys move and select (radio behaviour); Home/End; Space selects focused.

## 6. Design notes

`design.png`: Visibility chooser, PUBLICZNY selected (blue border 1.5px, tint fill) and PRYWATNY unselected, with the hint text below. `design-segmented.png`: Board filter. `design-verdict.png`: Decision outcome row (only positive selected drawn). `design-compact.png`: Inspector compact radio cards. Derived (not drawn): private selected (violet), mixed/unknown/negative selected tints, hover/focus/disabled.

## 7. Reuse

`VisibilityBadge` (OVE_DS019), glyph icons (OVE_DS011, soft), `useControllableState` (OVE_DS023), focus ring (OVE_DS007).

## 8. Architecture and code placement

`packages/ui-kit/src/forms/<Name>/`; roving tabindex hook in `src/internal/useRovingTabindex.ts` (no DOM queries by class; uses refs list).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). The Visibility choice changes who may use a Skill or Agent (ADR 0028): the control never auto-selects public, `value` is required to be passed explicitly for the chooser, and tests assert no default selection.

## 10. Errors and edge cases

- `value` not among options: nothing selected, tab stop on first enabled.
- All options disabled: group `aria-disabled`.
- Long translated titles wrap (cards) or ellipsize (segmented).
- Empty `options`: renders nothing, dev warning.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`RadioCardGroup/SegmentedControl/VerdictSelect` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Selected card border 1.5px with no layout shift between selected and unselected.
- [ ] Segmented container padding 4 r14, item h36 r10; selected `#1C1330` 600.
- [ ] Verdict buttons h40 r12 13/600; four tone colours; selected positive matches mock colours.
- [ ] Arrow/Home/End keyboard model and single tab stop verified in tests for all three.

## 12. Test plan

- Vitest + Testing Library + user-event in `forms/(RadioCardGroup|SegmentedControl|VerdictSelect).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test forms` and `pnpm --filter @overmind/ui-kit test:visual forms`.
- Hook test `useRovingTabindex.test.ts` (skip disabled, wrap-around, RTL).

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Creates `src/internal/useRovingTabindex.ts` used by OVE_DS035 (Tabs) and OVE_DS029 (Menu).

## 14. Open questions and assumptions

- ASSUMPTION (E31): colour follows the option (public blue, private violet).
- ASSUMPTION: a `check` icon is added to the selected card (not in mock) for non-colour meaning.
- Open (R): Verdict selected tints for mixed/unknown/negative are derived.
