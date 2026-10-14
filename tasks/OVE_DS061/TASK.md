---
id: OVE_DS061
title: Build TaskCard (all Task states) with TaskProgress
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS020, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:TaskCard", "ui:TaskProgress"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Avatar", "ui:StatusDot"]
owns: ["packages/ui-kit/src/board/TaskCard/**"]
reads: []
design: design.png
design_source: "Tablica#board/task-card-* (build + QA lanes) (crop 296,247,400,360 CSS px); design-selected.png = Tablica (crop 500,280,200,170)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11, 16]
---

# OVE_DS061: Build TaskCard (all Task states) with TaskProgress

## 1. Summary

Builds the Task Board card: id, state word with dot, title, documentation reference chip, assignee or 'nieprzypisane', optional progress bar; states unassigned, queued, working, waiting for Approval, reviewing, done (Quality Gate / accepted), selected, plus blocked and parked.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Tablica.dc.html` and its 2x render `_design/views/Tablica.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C5.1 (TaskCard), B12 (selected), B14 (TaskProgress). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The Task Board is the source of truth for work (ADR 0011). Every Task points to the Documentation place it follows (SPEC 6, ADR 0016); a Task without it is rejected. Chief assigns Tasks to Agents; whether the Owner can drag cards between Lanes is OPEN question 3, so this card is NOT draggable in MVP.

## 3. Scope (in)

- `TaskCard`, `TaskProgress`, stories for 9 states.

## 4. Out of scope

- Lane container and filters (OVE_DS062), detail pane (OVE_DS063), drag and drop (not planned).

## 5. Detailed requirements

1. `TaskCardProps`:
   ```ts
   interface TaskCardProps {
     id: string;                       // 'T-31' (mono 11)
     state: TaskState; stateLabel: string;   // 'pracuje' | 'w kolejce' | 'czeka na Zgodę' | 'ocenia' | '✓ Quality Gate' | '✓ zaakceptowane'
     title: string;
     doc?: { path: string; anchor?: string };   // DocRefChip
     assignee?: { name: string; hue: AgentHue; initials: string };
     unassignedLabel: string;          // 'nieprzypisane'
     progress?: { value: number /* 0..1 */; label: string /* 'testy 38 z 52' */ };
     selected?: boolean; onSelect?: () => void;
     labels: { progress: string };
   }
   ```
2. Card: a `button` (so the whole card selects), radius 16, padding 12, column gap 8, `bg-surface` + 1px `line`, text-align left, width 100% of the Lane. Row 1: id mono 11 `text-muted`; right-aligned state word with a `StatusDot` 8: working magenta (glow), queued grey, waiting-approval amber, reviewing violet, done/accepted mint (the `✓` is part of the label text), blocked error, parked grey. Title 14/600/1.35 (3-line clamp + title). Doc chip: OVE_DS040 `DocRefChip` (`spec.md#koszyk`). Assignee row: `Avatar` 22 + name 12px `text-secondary`; unassigned: label muted italic-free `text-muted`.
3. `selected`: 1.5px `#9B7BFF` border + `ring-select-sm` (0 0 0 4px rgba(155,123,255,.16)), `aria-pressed`/`aria-current="true"`. Hover (R): border `line-strong`. Focus: global ring (the 4px selection ring and the focus ring must remain distinguishable: focus ring is drawn with the `bg-app` gap outside the selection ring).
4. `TaskProgress` (exported): `role="progressbar"` `aria-valuemin=0 aria-valuemax=100 aria-valuenow=round(value*100)` `aria-label`, height 4, radius 2, track `#3A1C3A`, fill `#F25FC4`; shown ONLY for `state=working`; the numeric label (`testy 38 z 52`) is rendered as mono 11 text next to the state word or under the bar (mock: inside the state row). Progress is a hint (reported by the Agent/CLI), so the label always says what it counts.
5. `blocked` (R): 3px error left border and the word `zablokowane`; `parked` (R): opacity .7 and dashed 1px border, word `odłożone`. `unassigned`: the footer shows `unassignedLabel` and the dot is grey.
6. Variable height: cards size to content; the Lane stacks them with gap 10. Titles with very long words wrap (`overflow-wrap: anywhere`).
7. Accessible name: `{id}, {title}, {stateLabel}[, {assignee.name}]`; the doc chip inside a button must not be a nested interactive element: inside `TaskCard` the chip renders as static (non-button) text.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: Build lane (T-33 working with progress, T-34 queued) and QA lane (T-31 selected with the violet ring, 73% progress; T-30 waiting for Approval amber). `design-selected.png` zooms the selected card. Exact values above. Not in the mock: blocked, parked, hover/focus, long titles, loading skeleton (`TaskCardSkeleton`: 3 lines).

## 7. Reuse

Consumes `ui:Card`, `ui:Avatar`, `ui:StatusDot`, `DocRefChip` and `taskStateTone` (OVE_DS040).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Task titles originate from documentation/agents: text only. The card exposes no action that changes state (selecting only).

## 10. Errors and edge cases

- Progress value outside 0..1 -> clamped.
- No `doc` -> chip row omitted (and the feature shows a validation warning because Tasks must have a doc reference).
- Title empty -> `—`.
- Unknown state -> neutral.

## 11. Acceptance criteria

- [ ] Given the nine states, Then dot colour + word appear for each and none relies on colour alone.
- [ ] Given `selected`, Then border 1.5px violet and the ring are present and `aria-current` is set.
- [ ] Given progress 0.73, Then the bar fill is 73% and `aria-valuenow=73`.
- [ ] Given a nested chip, Then no interactive element exists inside the button (axe nested-interactive clean).
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN question 3: Owner dragging cards is not supported; no `draggable` attributes. If approved later, a new task adds a drag handle.
