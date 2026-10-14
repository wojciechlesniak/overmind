---
id: OVE_DS076
title: Build RunTrace (Gantt) with TraceRow, TimeAxis and legend
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS017, OVE_DS020, OVE_DS021, OVE_DS028, OVE_DS031, OVE_DS032, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:RunTrace", "ui:TraceRow", "ui:TimeAxis"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:GanttBar", "ui:Avatar", "ui:StatusText", "ui:Pill", "ui:Tooltip", "ui:Skeleton", "ui:EmptyState"]
owns: ["packages/ui-kit/src/activity/RunTrace/**"]
reads: []
design: design.png
design_source: "Activity#activity/trace (crop 346,292,770,397 CSS px); design-rows.png = Activity (crop 363,336,736,340)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19, 5]
---

# OVE_DS076: Build RunTrace (Gantt) with TraceRow, TimeAxis and legend

## 1. Summary

Builds the Run trace: a Gantt chart with a 170px label column (node/agent + iteration), a time axis, one bar per node execution (done, failed, running, waiting for Approval, queued, skipped), an iteration legend and a 'now' marker for running Runs.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Activity.dc.html` and its 2x render `_design/views/Activity.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C8.6 (RunTrace), B14 (GanttBar). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The trace is the Owner's way to see what happened in a Run (SPEC 8): which Node ran when, how long, with which result. Quality-loop iterations repeat the same nodes (`Developer · it. 2`), so rows are per node execution, not per node. The trace is derived from engine events; the UI only draws.

## 3. Scope (in)

- `RunTrace` card (header, axis, rows, legend), `TraceRow`, `TimeAxis`, `GanttBar` usage, tooltips, scroll, running tick.

## 4. Out of scope

- Event data and time computation (feature maps events to `TraceRowData`).
- Activity events table (`ui:DataTable`, OVE_DS069).

## 5. Detailed requirements

1. Types:
   ```ts
   type TraceStatus = 'done' | 'failed' | 'running' | 'waiting-approval' | 'queued' | 'skipped';
   interface TraceRowData { id: string; label: string; sublabel?: string; hue?: AgentHue; initials?: string; status: TraceStatus; startMin: number; endMin?: number; resultLabel: string /* '✓ 4 pliki', '✗ 2 testy' */; iteration?: number }
   interface RunTraceProps { title: string; rows: TraceRowData[]; totalMin: number; nowMin?: number; axisStepMin?: number /* 5 */; legend?: { status: TraceStatus; label: string }[]; labels: { axis: (m: number) => string; list: string }; loading?: boolean; selectedRowId?: string; onSelectRow?(id: string): void }
   ```
2. Card: `ui:Card` radius 20 padding 17 (mock x=363 inside card x=346), column gap 12. Header: title 15/700 + legend chips (right, wraps). Axis row (height 17): offset by the 170px label column + 12 gap, labels mono 10 `text-muted` at every `axisStepMin` (`0 min`, `5 min`...), tick lines 1px `line-subtle` drawn across all rows behind the bars. Track width = remaining width; position `left = startMin/totalMin * 100%`, `width = (endMin - startMin)/totalMin * 100%` with a 6px minimum so very short steps stay visible.
3. `TraceRow` (height 30, gap 12, border-bottom none): label column fixed 170 with `Avatar` 22 + name 13/600 (ellipsis) + sublabel mono 11 (`it. 2`); track (height 22, radius 6) holding one `GanttBar`. Bar fills by status: done mint `#62E3B4` a35 with mint border and `✓` result, failed error with `✗ 2 testy`, running magenta with `glow-bar-working` and an animated shimmer only if motion allowed, waiting-approval amber with diagonal hatch (repeating-linear-gradient 45deg), queued dashed grey outline, skipped grey a15. Result text mono 11 inside the bar when the bar is wide enough (>= 90px) otherwise right of the bar. Row is a button when `onSelectRow` is given (selected: violet outline); focus ring global.
4. Running Run: bar for the running row extends to `nowMin`; a 'now' vertical marker 1.5px magenta with label `teraz` in the axis; the feature re-renders on its own ticker (the component has no timers).
5. Overflow: the card scrolls vertically when rows exceed the available height (max-height by parent, G5) and horizontally never; at width < 700 the label column shrinks to 120 and sublabel is hidden. The axis labels thin out (skip alternate) if they would overlap (`axisStepMin` doubled until labels have >= 56px).
6. Accessibility: the chart is a `<table>`-equivalent: root `role="table"` with `aria-label`, rows `role="row"` (cells: label, status text, start, duration, result); status is in the accessible text, never colour alone. Each bar has a `Tooltip` (start, end, duration, result) and the same text is available on focus.
7. Empty: `EmptyState` (`Brak kroków w tym Runie`). Loading: 6 skeleton rows. Rows beyond 200: caller windows.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the trace card: axis `0 min ... 20 min`, done rows with mint bars and checks (Product Owner, Designer, Developer it.1), the failed QA row (`✗ 2 testy`, red), the running Developer it. 2 row (magenta glow), the Security row waiting for Approval (amber hatched), legend. `design-rows.png`: zoom on the row anatomy. Not drawn: queued, skipped, now marker, tooltip, hover/focus, empty/loading.

## 7. Reuse

Consumes `ui:GanttBar` (part 1), `ui:Card`, `ui:Avatar`, `ui:StatusText`, `ui:Pill` (legend), `ui:Tooltip`, `agentStateTone` (OVE_DS040). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Labels and result strings are untrusted (agent output): text only, clamped, no HTML. Durations shown are engine facts; the UI never computes billing or limits from them.

## 10. Errors and edge cases

- `endMin` < `startMin` -> bar of minimum width and dev warning.
- `totalMin` 0 -> axis shows a single `0 min` and bars at minimum width.
- Row beyond `totalMin` -> clipped at 100% with a right arrow glyph.
- Two rows overlapping in time -> separate rows, no overlap handling needed.

## 11. Acceptance criteria

- [ ] Given the fixture, Then bar left/width percentages match start/total within 0.5%.
- [ ] Given a running row and `nowMin`, Then the bar ends at the marker and the marker label is shown.
- [ ] Given keyboard Tab, Then each selectable row is focusable and Enter fires `onSelectRow`.
- [ ] Given a screen reader, Then every row announces label, status word, duration and result.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: zoom/scroll of the time axis for Runs longer than 60 min (default: axis step scales, no zoom UI in MVP).
- ASSUMPTION: hatched amber pattern is a CSS gradient, not an image.
