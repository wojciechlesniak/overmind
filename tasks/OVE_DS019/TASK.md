---
id: OVE_DS019
title: "Badges: VisibilityBadge, NodeTab, SkillsTab, VersionBadge, CountBadge, LaneBadge"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS009, OVE_DS011, OVE_DS012, OVE_DS017, OVE_DS038]
soft_depends_on: []
provides: [ui:VisibilityBadge, ui:NodeTab, ui:SkillsTab, ui:VersionBadge, ui:CountBadge, ui:LaneBadge]
needs: [ui:icons]
owns: [packages/ui-kit/src/badges/VisibilityBadge/**, packages/ui-kit/src/badges/NodeTab/**, packages/ui-kit/src/badges/SkillsTab/**, packages/ui-kit/src/badges/VersionBadge/**, packages/ui-kit/src/badges/CountBadge/**, packages/ui-kit/src/badges/LaneBadge/**]
reads: []
design: design.png
design_source: "Main#canvas/node-tile (node tab + Skills tab + model pill); extra crops design-header (workflow header), design-agent-row (CountBadge + outline badge), design-legend"
spec_refs: [SPECIFICATION 8, SPECIFICATION 13]
adr_refs: [28]
---

# OVE_DS019: Badges: VisibilityBadge, NodeTab, SkillsTab, VersionBadge, CountBadge, LaneBadge

## 1. Summary

Implement the label family that carries Visibility and counts: `VisibilityBadge` (two shapes after E16: `outline` and `filled`), `NodeTab` (the tab on top of a canvas node), `SkillsTab` (the Skills pill on a node, with the drop-target state), `VersionBadge`, `CountBadge` (amber by default, E10) and `LaneBadge` (mint filled "TOR" label).

## 2. Context

ADR 0028: Visibility (public/private) is always shown with the WORD, never colour alone. Colours: public `#6FA8FF`, private `#9B7BFF`, Lane `#62E3B4`, Discussion `#C9B8FF` (Visibility map, OVE_DS003). The mocks draw the word in four shapes (outline 9px, filled 10px, filled 11px, node tab 11px, inventory B3); E16 reduces this to two shapes plus the node tab, E17 forbids text below 10px (outline badge becomes 10/600/+0.06em), E10 makes the Approvals count amber (the mock draws magenta). Words are caller-supplied (i18n: "PUBLICZNY", "PRYWATNY", "TOR", "DYSKUSJA"); the component uppercases nothing itself, because the CSS `text-transform: uppercase` is applied so the stored string stays natural. Default labels for the two Visibility values come from `UiLabels` (OVE_DS038: `visibilityPublic`, `visibilityPrivate`) when `children` is omitted.

## 3. Scope (in)

- Six components, CSS modules, stories, tests, visual checks, per-variant tables below.
- `visibilityColors` helper (kind -> CSS variable names) exported from `badges/_shared/kinds.ts` for NodeTab/SkillsTab/Port to avoid duplicated maps (DRY).

## 4. Out of scope

- Node tile layout and tab positioning (absolute left 18, top -13 is NodeTile's job; the tab only renders its own box): DS part 2 (UI-61).
- Pill base: OVE_DS017. State pills: OVE_DS018. Visibility chooser cards (RadioCardGroup): OVE_DS025.
- Real drag and drop: DS part 2 (UI-64); this task only renders the `dropTarget` state.

## 5. Detailed requirements

**5.1 Kinds**: `type VisibilityKind = 'public' | 'private'`; `type NodeKind = 'public' | 'private' | 'lane' | 'discussion'`. Kind colour variables from OVE_DS003: public `--om-visibility-public-color` (`#6FA8FF`), private `--om-visibility-private-color` (`#9B7BFF`), lane mint-500 (`#62E3B4`), discussion `text-lavender-strong` (`#C9B8FF`). Node tile fills (for SkillsTab): public `#0B1424`, private `#130C22`, lane `#08171A`, discussion `#140F22` (`--om-color-node-fill-*`).
**5.2 `VisibilityBadge`**
```ts
interface VisibilityBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  visibility: VisibilityKind; appearance?: 'outline' | 'filled'; size?: 'sm' | 'md'; children?: ReactNode; icon?: boolean }
```
| Variant | Spec |
|---|---|
| `outline` (default, `size` fixed) | mono 10/600 (E17: mock 9px), letter-spacing 0.06em, padding 2px 6px, radius 5px, `border: 1px solid <kind>`, text = kind colour, transparent fill, `text-transform: uppercase`, `line-height: 1.2`, `white-space: nowrap` |
| `filled sm` | mono 10/700, ls 0.1em, padding 3px 8px, radius 7px, fill = kind colour, text `ink-badge` `#0A0710` (`--om-color-on-badge`), no border |
| `filled md` | same as sm with mono 11/700 (Inspector cards) |
Optional `icon` (private only) renders the `lock` icon at 10px (OVE_DS009) in front of the word; public has no icon. Rendering is a `<span>`; text is the word, so screen readers read "PUBLICZNY" (no extra aria-label needed). Contrast: `#0A0710` on `#6FA8FF` 8.6:1, on `#9B7BFF` 6.2:1 (asserted in a unit test); outline text `#9B7BFF` on `#140F20` 5.1:1.
**5.3 `NodeTab`**
```ts
interface NodeTabProps extends HTMLAttributes<HTMLSpanElement> { kind: NodeKind; children: ReactNode; iteration?: number }
```
Mono 11/700, ls 0.12em, padding 4px 10px, radius 8px, fill = kind colour (public `#6FA8FF`, private `#9B7BFF`, lane `#62E3B4`, discussion `#C9B8FF`), text `#0A0710`, uppercase, `display: inline-block`. `iteration` (E15 recommendation) appends " it. N" in the same tab when set; absent by default. Not interactive.
**5.4 `SkillsTab`**
```ts
interface SkillsTabProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  kind: NodeKind; count: number; children?: ReactNode /* "2 skille" */; dropTarget?: boolean; dropLabel?: ReactNode /* "upusc -> 1 skill" */; as?: 'span' | 'button' }
```
Pill: padding 3px 9px, radius 999px, `border: 2px solid <kind colour>`, fill = node tile fill of the kind, text = kind colour, Bricolage 12/600 (mock text "2 skille"), leading `skill-cube` 12px icon stroke 2, gap 5. `dropTarget`: border `magenta-500` (`#F25FC4`), text `magenta-300` (`#FFB3E6`), content replaced by `dropLabel`, plus `--om-glow-drag`. With `as="button"` it is focusable (opens the node's Skills list) and uses the focus ring; default is a static span.
**5.5 `VersionBadge`**: `{ children: ReactNode }`; mono 11/500, padding 4px 8px, radius 8px, fill `bg-badge-version` `#191226`, text `text-lavender-strong` `#C9B8FF`, no border ("v7 · opublikowana"). Static.
**5.6 `CountBadge`**
```ts
interface CountBadgeProps extends HTMLAttributes<HTMLSpanElement> { count: number; tone?: 'amber' | 'magenta' | 'violet'; max?: number /* default 99 */; label?: string }
```
Circle-pill: `min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px`, mono 11/700, centred, fill amber-500 `#FFB547` with text `ink-amber` `#1A1005` (default, E10: Approvals waiting), `magenta` = fill `#F25FC4` text `ink` `#12091F` (working counts only), `violet` = `#9B7BFF` text `ink`. Values above `max` render "99+". `count = 0` renders nothing unless `showZero`. `label` (caller i18n, e.g. "1 czeka na Zgode") becomes `aria-label` with `role="img"`; without it the number is plain text and the parent row provides the context.
**5.7 `LaneBadge`**: alias of `VisibilityBadge filled md` look with kind lane (mint fill, `#0A0710` text, mono 11/700, ls 0.1em, padding 3px 8px, radius 7px) for the Inspector "TOR" label; `children` required.
**5.8 States**: badges are static; only `SkillsTab as="button"` has hover (`brightness(1.08)`), focus-visible ring, active (`translateY(1px)` via `--om-state-press-offset`), disabled (`opacity .55`). Reduced motion: no transitions.

## 6. Design notes

`design.png`: node tile with `NodeTab` PUBLICZNY (blue, top-left over the border), `SkillsTab` "2 skille" (blue outline pill, top-right), the model pill below (OVE_DS018). `design-header.png`: workflow header with the filled PRYWATNY badge (`filled sm`), `VersionBadge` "v7 · opublikowana" and the Run pill. `design-agent-row.png`: Agent list with the magenta "1" count badge on the Security row (mock colour; the implementation default is amber per E10, and the visual test uses `tone="magenta"` for this one comparison) and outline Visibility badges. `design-legend.png`: canvas legend showing public/private/lane/discussion colours with their words. Drop-target state of SkillsTab is derived (mock shows it only while dragging).

## 7. Reuse

`Pill` is NOT reused for these (they have fixed shapes), but they share text styles from `Text` (OVE_DS005) through CSS variables `--om-text-mono-*`; icons from OVE_DS009; kind colours from OVE_DS003; glow from OVE_DS007.

## 8. Architecture and code placement

`packages/ui-kit/src/badges/<Name>/` per component + `badges/_shared/kinds.ts` (pure data, no React). Kind -> colour resolution is CSS-only through `data-kind` selectors reading the Visibility map tokens, so a new kind is a token + selector (OCP).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Visibility is a trust boundary of the product (ADR 0028): a private Skill must never look public. The tests pin that the word is rendered for every kind and that `children` cannot be an empty string for `VisibilityBadge` (falls back to the UiLabels word).

## 10. Errors and edge cases

- Unknown `visibility`/`kind` at runtime: neutral grey outline plus dev warning; never silently public-blue.
- Empty/whitespace `children` on NodeTab/LaneBadge: dev warning, renders kind word fallback from UiLabels where available.
- `count` negative or NaN: renders nothing.
- Very long word (e.g. translated): `white-space: nowrap`, ellipsis when `max-width` is set by the parent.
- Forced colours: border and text use `CanvasText`/`LinkText` fallback via `forced-colors` media block so outline badges remain readable.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`VisibilityBadge/NodeTab/SkillsTab/VersionBadge/CountBadge/LaneBadge` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] `VisibilityBadge outline` is 10px (not 9), filled sm 10px, filled md 11px; fills/borders per kind match 5.2.
- [ ] `NodeTab` has radius 8, padding 4x10, text `#0A0710`; four kind fills match.
- [ ] `SkillsTab` drop-target state switches border to `#F25FC4` and text to `#FFB3E6` and shows `dropLabel`.
- [ ] `CountBadge` default fill is amber (`#FFB547`), "99+" overflow works, zero hides.
- [ ] Contrast unit tests: all fill/text pairs >= 4.5:1 (except outline text on surface >= 4.5:1 too).

## 12. Test plan

- Vitest + Testing Library + user-event in `badges.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test badges` and `pnpm --filter @overmind/ui-kit test:visual badges`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. OVE_DS025 (RadioCardGroup) uses `VisibilityBadge`; DS part 2 NodeTile uses NodeTab, SkillsTab, Port, ModelPill.

## 14. Open questions and assumptions

- ASSUMPTION (E16/E17): outline badge text is 10px, not the mock's 9px; the visual comparison therefore allows a +1px text height difference.
- ASSUMPTION (E10): CountBadge defaults to amber; magenta only for working counts.
- Open: lock icon on private badges is an addition (not in the mock) to reinforce the word; default `icon=false`.
- Open (E13/E15): node ghost layers and `iteration` text on NodeTab await the Owner's decision; the prop exists but is unused by default.
