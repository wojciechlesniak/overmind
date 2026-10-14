---
id: OVE_DS021
title: "Meter, SegmentBar, ProgressBar and GanttBar"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS006, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038]
soft_depends_on: []
provides: [ui:Meter, ui:SegmentBar, ui:ProgressBar, ui:GanttBar]
needs: []
owns: [packages/ui-kit/src/indicators/Meter/**, packages/ui-kit/src/indicators/SegmentBar/**, packages/ui-kit/src/indicators/ProgressBar/**, packages/ui-kit/src/indicators/GanttBar/**]
reads: []
design: design.png
design_source: "Polaczenia#conn/limits (Meter, 'Limity wg CLI'); design-segment Pulpit#dash/workspace-progress-bar; design-gantt Activity#activity/trace"
spec_refs: [SPECIFICATION 9]
adr_refs: []
---

# OVE_DS021: Meter, SegmentBar, ProgressBar and GanttBar

## 1. Summary

Implement the four quantity visuals: `Meter` (usage limit with track and fill), `SegmentBar` (Lane distribution, four segments), `ProgressBar` (Task progress, Discussion round, wizard steps) and `GanttBar` (one bar on a Run trace track).

## 2. Context

Inventory B14. All are decorative graphics that must expose their numbers as text or ARIA: `Meter` -> `role="meter"`/`progressbar`, `SegmentBar` -> an `img` with a text caption supplied by the caller, `GanttBar` -> parent row reads the text. Mono captions next to them are owned by the caller. Hotspots from the mocks: top bar limit meter 48x6 with "62%", Limits panel with full-width bars and "62% . reset 3 h", Workspace card 8px segmented bar with the caption "4 do zrobienia . 5 w toku . 1 review . 7 gotowe z 17", Task card 4px progress, Discussion round bar 6px, Run trace Gantt.

## 3. Scope (in)

- Four components with CSS modules, tokens only, stories, tests.
- Threshold colours for `Meter` (inventory R rule: >=90% amber, 100% error) as a documented, overridable behaviour.

## 4. Out of scope

- Captions, labels and percent text (callers via `Text`). Top bar composition: DS part 2 (UI-21). Run trace layout and time axis: DS part 2 (UI-49).

## 5. Detailed requirements

**5.1 `Meter`**
```ts
interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number /* 0..100 */; size?: 'sm' | 'md'; tone?: 'auto' | 'violet' | 'amber' | 'error'; label: string /* aria-label, required */; valueText?: string }
```
- `sm` (top bar): track 48x6, radius 3, track `line` `#2A2040`, fill `violet-500` `#9B7BFF`; `md` (Limits panel): `width: 100%`, height 8, radius 4, same colours.
- `tone="auto"` (default): value < 90 violet, 90..99 amber `#FFB547`, 100 error `#FF8FA3` (inventory R). Fill width is `value%` clamped to 0..100 with `transition: width var(--om-duration-base)`, none under reduced motion.
- a11y: `role="meter"` with `aria-valuemin=0 aria-valuemax=100 aria-valuenow aria-label aria-valuetext`. The percent text is rendered by the caller.
**5.2 `SegmentBar`**
```ts
interface SegmentBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  segments: { key: 'todo' | 'doing' | 'review' | 'done'; count: number }[]; label: string }
```
Container height 8, radius 4, `display: flex; gap: 2px; overflow: hidden`, track fill none. Segment `flex: <count> 1 0` (zero-count segments are not rendered). Colours: todo `text-muted` `#8C80A6`, doing `magenta-500` `#F25FC4`, review `violet-500` `#9B7BFF`, done `mint-500` `#62E3B4`. Empty total renders a single `line` coloured segment. a11y: `role="img"` + `aria-label={label}` (caller text "4 do zrobienia ... z 17"); segments are `aria-hidden`.
**5.3 `ProgressBar`**
```ts
interface ProgressBarProps { value: number; variant?: 'task' | 'round'; label: string; indeterminate?: boolean }
```
`task`: height 4, radius 2, track `#3A1C3A` (`--om-color-magenta-track`), fill `magenta-500`; shown only for working Tasks (caller decides). `round`: height 6, radius 3, track `line`, fill `magenta-500`. `role="progressbar"` with `aria-valuenow`; `indeterminate` animates a 40% highlight (`om-anim-shimmer`, static under reduced motion).
**5.4 `GanttBar`**
```ts
interface GanttBarProps { startPct: number; widthPct: number; state: 'done' | 'failed' | 'current' | 'waiting'; label?: string }
```
Rendered inside a `GanttTrack` wrapper component (same folder, exported): track height 22, radius 6, fill `violet-a04` (`rgba(155,123,255,.04)` token), `position: relative`. Bar `position: absolute; top: 3px; height: 16px; radius: 5px; left/width` in %, min width 1.7% (failed bars stay visible). Fills: done `#62E3B4`, failed `#FF8FA3`, current `#F25FC4` + `--om-glow-dot-working`, waiting `#FFB547` + glow + 45deg hatch `repeating-linear-gradient(45deg, black-a25 0 4px, transparent 4px 8px)`. Each bar has a `title`-free accessible label through `aria-label` when `label` is set; otherwise `aria-hidden`.
**5.5 States**: no hover/focus (decorative). Reduced motion: no width transition, no shimmer.

## 6. Design notes

`design.png`: two Limits rows ("Claude Max 62% . reset 3 h", "ChatGPT Pro . Codex 38% . reset 5 dni") with 8px violet-on-dark bars. `design-segment.png`: Workspace card segmented bar (grey, magenta, violet, mint) with the mono caption below. `design-gantt.png`: Run trace tracks with done/failed/current/waiting bars (waiting has a hatch). Note: the Limits bar in the mock is 8px; the top-bar variant (48x6) is not in the crops, its size comes from inventory B14.

## 7. Reuse

Colours/tints from OVE_DS002/003, glows and shimmer from OVE_DS007, `Text` for captions in stories only.

## 8. Architecture and code placement

`packages/ui-kit/src/indicators/<Name>/`. Pure presentational, props -> CSS custom properties (`--om-meter-value`) on the element; no inline hex.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Values come from callers and may be NaN or huge: clamp and sanitise (`Number.isFinite`) so a malformed usage payload cannot produce an invalid CSS value.

## 10. Errors and edge cases

- NaN/Infinity/negative -> 0; > 100 -> 100.
- `SegmentBar` with all counts 0 -> single neutral segment, `aria-label` still required.
- `GanttBar` `startPct + widthPct > 100` -> width clipped to the remainder.
- Missing `label` (JS) -> dev warning (a11y).
- Reduced motion and forced colours: bars keep a visible border `1px solid currentColor` fallback in `forced-colors`.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Meter/SegmentBar/ProgressBar/GanttBar` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] `Meter sm` is exactly 48x6 r3 and `md` 8px high; fill colour switches at 90 and 100.
- [ ] `SegmentBar` segments have flex ratios equal to counts, gap 2, colours per key; zero segments are absent.
- [ ] `ProgressBar task` 4px/`#3A1C3A`, `round` 6px/`#2A2040`, magenta fill.
- [ ] `GanttBar` geometry (top 3, height 16, radius 5, min width 1.7%) and the four state fills incl. hatch.

## 12. Test plan

- Vitest + Testing Library + user-event in `indicators.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test indicators` and `pnpm --filter @overmind/ui-kit test:visual indicators`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task.

## 14. Open questions and assumptions

- ASSUMPTION: Meter threshold colours (amber >= 90, error 100) are from the inventory R rule, not drawn in the mock.
- Open: `Meter` for 'unknown limit' (CLI does not report): caller renders text 'brak danych'; no component state.
- ASSUMPTION: `#3A1C3A` is promoted to token `--om-color-magenta-track` (only used by task progress).
