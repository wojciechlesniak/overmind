---
id: OVE_DS031
title: "Card: 16 tones, 5 sizes, selected and interactive"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS022]
soft_depends_on: []
provides: [ui:Card]
needs: []
owns: [packages/ui-kit/src/surfaces/Card/**]
reads: []
design: design.png
design_source: "Pulpit#dash/workspace-grid (box 100,284,992,511: working, default, nested bar areas); design-approval Zgody#approvals/card; design-disabled Polaczenia#conn/api-keys"
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS031: Card: 16 tones, 5 sizes, selected and interactive

## 1. Summary

Implement `Card`, the one surface component behind Workspace cards, Task cards, Skill cards, status lists, Approval cards, Owner Rule refusals, danger zones, callouts, drop zones and terminals: 16 tones, 5 radius sizes, `selected`, `interactive`, `padding`.

## 2. Context

Inventory B12 lists 16 tones with exact border/fill/glow per use. Gradients are written as tokens in OVE_DS003 (`magenta-bg-chief-start #2A1130`, `-bg-chief-row-end #1A1029`, `amber-bg-card-from #2A1D0C`, `-to #170F1A`, etc.) and glows in OVE_DS007; no raw hex or rgba here. The Workspace grid crop shows the `working` tone (magenta border + glow, r22), plain default cards (r22), a dashed lock pill (Pill, OVE_DS017) and the segmented bar. E18 note: card borders are decorative and keep `line` (`#2A2040`); only form controls use `line-control`.

## 3. Scope (in)

- `Card` with CSS module and a tone table, sub-parts `CardHeader`, `CardBody`, `CardFooter` (layout only), stories per tone, tests.
- Polymorphic `as` (`div`, `section`, `article`, `button`, `a`).

## 4. Out of scope

- WorkspaceCard, TaskCard, ApprovalCard composites: DS part 2. Skeleton and EmptyState: OVE_DS032. ListRow selected look is separate (OVE_DS033) but uses the same `list-selected` tokens.

## 5. Detailed requirements

**5.1 API**
```ts
type CardTone = 'default' | 'nested' | 'selected' | 'list-selected' | 'working' | 'chief' | 'chief-row' | 'approval' | 'rule-refusal' | 'danger'
  | 'callout-amber' | 'callout-magenta' | 'drop' | 'ok' | 'section' | 'disabled' | 'terminal';
type CardSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'; // radius 14 | 16 | 18 | 20 | 22
interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: CardTone; size?: CardSize; selected?: boolean; interactive?: boolean; padding?: 'none' | 'sm' | 'md' | 'lg'; as?: ElementType; dropActive?: boolean }
```
`chief-row` is the row variant of `chief` (17th value; the inventory has 16 tones, `chief` appears in two geometries).
**5.2 Tone table (exact)** `box-sizing: border-box`; each tone sets `border`, `background`, `box-shadow`, default radius (overridable by `size`).
| Tone | Border | Fill | Shadow | Default r | Used |
|---|---|---|---|---|---|
| `default` | 1px `line` `#2A2040` | `bg-surface` `#140F20` | none | md 16 | Workspace/Skill/Task/Connection cards (Connection r22) |
| `nested` | 1px `line-subtle` `#241B36` | `#140F20` | none | sm 14 (or 16) | status lists, stat tiles, Decision sub-cards |
| `selected` | 1.5px `violet-500` `#9B7BFF` | `#140F20` | `--om-ring-select` (selection halo) | md 16 | selected Task/Skill card |
| `list-selected` | 1px `line-strong` `#5B3E8F` | `bg-surface-sel` `#1A1422` | none | sm 14 | selected list row/card |
| `working` | 1px `magenta-a45` | `#140F20` | `--om-glow-card-working` | 2xl 22 | Workspace card with active Run |
| `chief` | 1px `magenta-a40` | `linear-gradient(120deg, #2A1130, #120D1C 60%)` via tokens `magenta-bg-chief-start`, `bg-composer` | `--om-glow-card-chief` | 2xl 22 (summary) | Chief summary |
| `chief-row` | 1px `magenta-a40` | `linear-gradient(135deg, magenta-bg-chief-start, magenta-bg-chief-row-end)` | `--om-glow-card-chief` | lg 18 | Chief row |
| `approval` | 1.5px `amber-500` `#FFB547` | `linear-gradient(160deg, amber-bg-card-from, amber-bg-card-to 70%)` | `--om-glow-card-approval` | xl 20 / 2xl 22 | Approval card |
| `rule-refusal` | 1.5px `error-a50` | `error-bg-rule` `#1E0E16` | none | md 16 | Owner Rule refusal |
| `danger` | 1px `error-line` `#6A2A3A` | `error-bg-card` `#1A0B12` | none | md 16 | Delete Workspace |
| `callout-amber` | 1px `amber-a35` | `amber-bg-callout` `#1E160A` | none | sm 14 | subscription-policy note; text colour `amber-body` `#E9D2AE`, 12px/1.45 |
| `callout-magenta` | 1px `magenta-a50` | `magenta-bg-callout` `#1F0F25` | `--om-glow-card-rule` | lg 18 | Chief proposal |
| `drop` | 1px dashed `magenta-500` | `magenta-a05` | none | sm 12 to lg 18 | Skill drop zones; `dropActive` raises fill to a10 |
| `ok` | 1px `mint-a35` | `mint-bg-ok` `#10161A` | none | sm 14 | Skill-use result |
| `section` | 1px `line-subtle` | `bg-panel-alt` `#0C0814` | none | xl 20 / 2xl 22, padding lg | Settings sections, Lanes |
| `disabled` | as `default` | as `default` | none | md | `opacity: var(--om-state-disabled-opacity-card)` (.55) ("Klucze API po MVP") |
| `terminal` | 1px `line-subtle` | `bg-code` `#06040A` | none | sm 14 | terminals, previews |
**5.3 Padding**: `none` 0, `sm` 12px, `md` 16px (default), `lg` 20px; `section` uses 16-20 by `size`. Tables inside cards use `overflow: hidden` via `clip` prop (`overflow: clip`) so radius clips children.
**5.4 `selected` prop**: forces tone visuals of `selected` on top of the current tone (border 1.5px violet and selection halo) and sets `aria-current="true"` when `interactive`; for list-like cards callers use tone `list-selected` instead.
**5.5 `interactive`**: renders `button` (when `as` omitted and `onClick` given) or keeps `as`; hover: border `border-hover` (`color-mix(violet-500 40%, line)`) and `translateY(-1px)` only with motion allowed; focus-visible: `--om-ring-focus`; active: `translateY(0)` + brightness 1.04; disabled tone: no hover. Non-interactive cards have no hover effects.
**5.6 a11y**: tone is never the only carrier (approval/danger/refusal cards must contain a text heading); `role` is not set by default; `section` tone with `aria-labelledby` support via props passthrough.

## 6. Design notes

`design.png`: Workspace card grid: `working` card with magenta border and glow (top-left), default cards, nested content. `design-approval.png`: approval tone with amber 1.5px border and gradient. `design-disabled.png`: the disabled card ("Klucze API po MVP"). Not drawn: `drop` active, `danger`, `rule-refusal`, `ok`, `terminal` (verified through `expectToken` and inventory values).

## 7. Reuse

Tokens from OVE_DS002, OVE_DS003 (gradient/tint tokens), OVE_DS006 (radius), OVE_DS007 (glows, ring-select, disabled opacity).

## 8. Architecture and code placement

`packages/ui-kit/src/surfaces/Card/{Card.tsx,Card.module.css,tones.ts}`. `tones.ts` is a typed list of tone names for stories only; the visual rules live in CSS `[data-tone]` blocks (OCP: a new tone is one CSS block + one union member).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Cards such as `approval` and `danger` frame risky actions: the tone styling must not be removable by consumers (class override only through `className` additions; the component does not accept raw `style` for border/background in stories, lint rule documented).

## 10. Errors and edge cases

- Unknown tone (JS): falls back to `default`, dev warning.
- `interactive` with nested interactive children: documented anti-pattern; story shows `as="div"` with a stretched-link pattern instead.
- Very tall content: card grows; no internal scroll.
- Forced colours: border `CanvasText`, glow removed.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Card` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] All 17 tones match the table (`expectComputed` on border width/style/colour, radius, fill token, shadow token) in a `Matrix` story.
- [ ] Radius per size: 14/16/18/20/22; padding presets 0/12/16/20.
- [ ] `selected` keeps layout stable (no content shift between 1px and 1.5px borders: use inset ring).
- [ ] `interactive` renders a focusable element with the ring; `disabled` tone has opacity .55 and no hover.
- [ ] No raw colour literals in `Card.module.css` (guard).

## 12. Test plan

- Vitest + Testing Library + user-event in `surfaces/Card.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test Card` and `pnpm --filter @overmind/ui-kit test:visual Card`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Many part-2 composites depend on `ui:Card`; keep `CardTone` and `CardSize` unions stable (additive changes only).

## 14. Open questions and assumptions

- ASSUMPTION: `chief-row` is added as the 17th value (the inventory lists `chief` with two geometries).
- ASSUMPTION: `drop` fill `magenta-a05` uses the alpha set from OVE_DS003; if missing, add through a proposal.
- Open: default radius per tone is a convention; callers may override with `size`.
