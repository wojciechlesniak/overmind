---
id: OVE_DS034
title: "Row shells: DecisionRow, RunRow, ApprovalRow and SkillPaletteItem"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS011, OVE_DS031, OVE_DS033]
soft_depends_on: []
provides: [ui:DecisionRow, ui:RunRow, ui:ApprovalRow, ui:SkillPaletteItem]
needs: [ui:icons]
owns: [packages/ui-kit/src/lists/DecisionRow/**, packages/ui-kit/src/lists/RunRow/**, packages/ui-kit/src/lists/ApprovalRow/**, packages/ui-kit/src/lists/SkillPaletteItem/**]
reads: []
design: design.png
design_source: "Decyzje#decis/list (box 72,117,~370,780: DecisionRow list); design-approvals Zgody#approvals/list; design-runs Activity#activity/runs-list"
spec_refs: [SPECIFICATION 8, SPECIFICATION 9]
adr_refs: [28]
---

# OVE_DS034: Row shells: DecisionRow, RunRow, ApprovalRow and SkillPaletteItem

## 1. Summary

Implement the layout shells of the four selectable list rows whose content is domain specific: `DecisionRow`, `RunRow`, `ApprovalRow` and `SkillPaletteItem` (draggable palette entry with grip). They are slots-based: meta line, title, sub line, aside; domain meaning (IDs, verdict words, state words) arrives as props.

## 2. Context

Inventory B13. Decision list crop: each row shows `D-14` (mono, muted) + status word (mono: accepted mint, proposal lavender, to review amber, superseded grey) at the left and `wynik: pozytywny` (verdict word coloured: positive mint, unknown grey, mixed amber, negative error) at the right, a 15-16px/600 title, and a muted sub line "Workspace . Source". Selected row: `#1A1422` + 1px `#5B3E8F` border, r14 (first row in the crop). Unselected rows: transparent with a bottom hairline. Approvals and Runs lists use the same selected look with other paddings; Approvals rows also carry an 8px square kind marker (StatusDot square, OVE_DS020). The Skill palette item is the draggable Skill entry in the Canvas left panel.

## 3. Scope (in)

- Four components with CSS modules on top of `lists/_shared/listRow.module.css` conventions (OVE_DS033), stories, tests, visual checks.
- `dragging` visual state for `SkillPaletteItem` (no drag logic).

## 4. Out of scope

- Drag and drop mechanics, drop targets, palette container: DS part 2 (UI-64). Detail panes: DS part 2.
- Domain word choice (status words, verdict labels): i18n in apps.

## 5. Detailed requirements

**5.1 Common**: each row is one `button`/`a` (`as`), `text-align: left`, `width: 100%`, `box-sizing: border-box`, `cursor: pointer`, `selected` -> `aria-current="true"`. States as in OVE_DS033 5.6. All use `Text` styles by CSS variables.
**5.2 `DecisionRow`**
```ts
type VerdictTone = 'positive' | 'mixed' | 'unknown' | 'negative';
type DecisionStatusTone = 'accepted' | 'proposal' | 'review' | 'superseded';
interface DecisionRowProps { id: string; status: ReactNode; statusTone: DecisionStatusTone; verdict?: ReactNode; verdictTone?: VerdictTone; title: ReactNode; subtitle?: ReactNode; selected?: boolean; as?: ElementType; href?: string; onClick?: () => void }
```
Column, `gap: 6px`, `padding: 12px 14px`, `border-radius: 14px`. Unselected: `border: 1px solid transparent; border-bottom-color: line-subtle` `#241B36` (hairline separator); selected: full `1px solid #5B3E8F`, fill `#1A1422` (no separator). Top line: flex space-between; left `id` mono 12 `text-muted` + status word mono 12 coloured: accepted `mint-500`, proposal `text-lavender-strong` `#C9B8FF`, review `amber-300` `#FFCF85`, superseded `text-muted`; right `verdict` mono 12 coloured: positive `mint-500`, mixed `amber-300`, unknown `text-muted`, negative `error-500`. Title Bricolage 15/600 `text-primary` (wraps up to 3 lines), subtitle 13px `text-muted`. Non-colour meaning: status and verdict are words (the verdict text comes with "wynik:" from the caller).
**5.3 `RunRow`**: `{ title: ReactNode; meta?: ReactNode; aside?: ReactNode; subtitle?: ReactNode; selected?: boolean }`; column `gap: 4px`, `padding: 10px 12px`, radius 14; selected as above; `aside` is typically a `StatusPill` (OVE_DS018) right of the title row; title 14/600, meta mono 11 `text-muted`.
**5.4 `ApprovalRow`**
```ts
interface ApprovalRowProps { kind: 'approval' | 'access' | 'escalation'; kindLabel: string; title: ReactNode; subtitle?: ReactNode; age?: string; selected?: boolean }
```
Column `gap: 8px`, `padding: 12px 14px`, radius 16; unselected `1px solid #2A2040` fill `#140F20`; selected `#1A1422` + `#5B3E8F`. First line: `StatusDot square size=8` (amber for approval, magenta for access request, error for escalation, glow) + `kindLabel` in a `SectionLabel`-style mono 10/500 uppercase tinted (`SectionLabel tone` amber for approval) + `age` mono 11 right. Title 14/600, subtitle 12px `text-secondary`. The marker is never the only kind carrier: `kindLabel` is required.
**5.5 `SkillPaletteItem`**
```ts
interface SkillPaletteItemProps { name: string; visibility: ReactNode /* a VisibilityBadge node */; description?: ReactNode; dragging?: boolean; draggableProps?: HTMLAttributes<HTMLElement>; actionLabel?: string; onAction?: () => void }
```
Flex row, `gap: 10px`, `padding: 9px 10px`, radius 14, `border: 1px solid #2A2040`, fill `#140F20`, `cursor: grab`; leading `grip` icon 14px `text-muted`; body: name mono 12/500 `text-lavender` + outline `VisibilityBadge` (OVE_DS019) + optional description 12px. `dragging`: `border-style: dashed`, `border-color: magenta-500`, fill `magenta-a05`, `--om-glow-drag`, `cursor: grabbing`. Keyboard alternative to dragging: when `onAction` is set, an `IconButton`-like trailing button ("add to node", label from `actionLabel`) appears on focus-within so drag is not the only way (a11y 2.5.7). `aria-roledescription` is left to the caller's DnD library via `draggableProps`.
**5.6 Unit rules**: all text slots truncate with ellipsis except Decision/Approval titles (wrap up to 3 lines with `-webkit-line-clamp: 3`).

## 6. Design notes

`design.png`: the Decisions list with five rows: id + status, verdict, title, sub-line; the first row selected. `design-approvals.png`: Approvals list rows (amber square kind marker, selected row). `design-runs.png`: Activity runs list rows. SkillPaletteItem dragging state is in the Canvas view (VIEWS `canvas/skill-item-dragging`); no separate crop (the visual test uses story values from inventory B13/B14).

## 7. Reuse

`listRow.module.css` conventions (OVE_DS033), `Card` tokens (OVE_DS031) for the dashed drag look, `StatusDot`, `SectionLabel`, `VisibilityBadge`, `Icon` (grip).

## 8. Architecture and code placement

`packages/ui-kit/src/lists/<Name>/`. These shells never import a domain type: all domain words are slots/strings, so DS part 2 composites (DecisionDetail, ApprovalDetail) and apps stay separate (ISP).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Row titles are Agent-controlled text; clamped and never HTML. For `ApprovalRow`, `kindLabel` guarantees that an Escalation is not distinguishable by colour alone.

## 10. Errors and edge cases

- Missing `verdict`: right side empty (no placeholder).
- Unknown tones: neutral grey + dev warning.
- Long ids: `id` never shrinks, title wraps.
- `dragging` with reduced motion: no animation, static dashed border.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`DecisionRow/RunRow/ApprovalRow/SkillPaletteItem` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] DecisionRow: gap 6, padding 12/14, r14; selected border `#5B3E8F` fill `#1A1422`; unselected hairline `#241B36`; four status and four verdict tones coloured per 5.2.
- [ ] RunRow gap 4, padding 10/12; ApprovalRow gap 8, padding 12/14, r16, square marker 8px with glow.
- [ ] SkillPaletteItem padding 9/10, r14, border `#2A2040`, grip icon; dragging state dashed magenta; `onAction` button appears on focus-within.
- [ ] Rows are single interactive elements with `aria-current` when selected.

## 12. Test plan

- Vitest + Testing Library + user-event in `lists/(DecisionRow|RunRow|ApprovalRow|SkillPaletteItem).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test lists` and `pnpm --filter @overmind/ui-kit test:visual lists`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task.

## 14. Open questions and assumptions

- ASSUMPTION: Decision title is 15/600 (the crop shows ~16px; 15 matches the type scale).
- ASSUMPTION: Approval kind marker colours: approval amber, access request magenta, escalation error (VIEWS: approvals list).
- Open: keyboard alternative to drag is an addition for WCAG 2.5.7.
