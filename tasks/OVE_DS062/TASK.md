---
id: OVE_DS062
title: Build Lane, LaneRow and BoardFilterBar
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS019, OVE_DS025, OVE_DS032, OVE_DS039, OVE_DS045, OVE_DS061]
soft_depends_on: []
provides: ["ui:Lane", "ui:LaneRow", "ui:BoardFilterBar"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Pill", "ui:Button", "ui:SegmentedControl", "ui:VersionBadge", "ui:PageHeader", "ui:EmptyState"]
owns: ["packages/ui-kit/src/board/Lane/**", "packages/ui-kit/src/board/BoardFilterBar/**"]
reads: []
design: design.png
design_source: "Tablica#board/header + board/lanes (crop 92,135,1008,617 CSS px)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11, 2]
---

# OVE_DS062: Build Lane, LaneRow and BoardFilterBar

## 1. Summary

Builds the Task Board frame: `BoardFilterBar` (title, source Workflow badge, segmented filter, new-Task action), `LaneRow` (horizontal scroller) and `Lane` (header with count, hint, card stack, 'show older' footer; default, active, empty variants).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Tablica.dc.html` and its 2x render `_design/views/Tablica.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C5.2 (Lane), C5.3 (BoardFilterBar). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Lanes come from the `board` Workflow (Build, QA, Review, plus To do and Done); the title chip shows which Workflow version defines them (`Tory z Workflow „board” v3`). The Lane that contains the selected/working Task is 'active' (magenta tint). Glossary: Lane = Tor.

## 3. Scope (in)

- The three components, filters `Wszystkie / Moje Zgody / Zablokowane / Odłożone · N`, empty Lane, scrolling behaviour.

## 4. Out of scope

- Cards (OVE_DS061), detail (OVE_DS063), filtering logic (BOARDUI feature).

## 5. Detailed requirements

1. `LaneProps { id: string; title: string; count: number; hint?: string; active?: boolean; children: ReactNode; footer?: { label: string; onClick: () => void }; emptyLabel?: string }`. Section: radius 20, padding 12, column gap 10, `min-width: 180px; flex: 1 1 180px`, `bg-panel-alt` (#0C0814), 1px `line-subtle`; `role="region"` `aria-label=title`. Header: `h2` 15/700 + count `Pill` variant `count` (padding 2 8, 11/500). Hint 11px `text-muted` line-height 1.3 (To do: `Chief rozdziela, gdy zwolni się slot`). Cards in a `<ul>` gap 10. Footer: `Button` `dashed-more` (h40, 12/400) e.g. `Pokaż 5 starszych`.
2. `active`: 1px `rgba(242,95,196,.35)` border + background gradient `linear-gradient(180deg, rgba(242,95,196,.07), transparent 40%)` over the base fill. `empty` (R): when there are no children show a dashed 1px `line` box (radius 14, padding 16, 12px `text-muted`, `emptyLabel`) instead of the stack.
3. `LaneRow`: `display:flex; gap: 12px; align-items: flex-start; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x proximity`, `role="group"` with label; keyboard scrollable (`tabindex=0` when overflowing). Lane order is the Workflow's order; the component does not reorder.
4. `BoardFilterBarProps`:
   ```ts
   interface BoardFilterBarProps {
     title: string; sourceBadge: string;                // VersionBadge text 'Tory z Workflow „board” v3'
     filters: { id: string; label: string; count?: number }[]; activeFilter: string; onFilter: (id: string) => void;
     newTask: { label: string; onClick: () => void; disabled?: boolean };
   }
   ```
   Built with `ui:PageHeader` (title `Tablica Zadań` page size, badges = `VersionBadge`, actions = `SegmentedControl` + violet `Button primary-violet` with `plus` icon). `SegmentedControl` (container padding 4, radius 14, 1px `line`, items height 36, radius 10, 12px; selected `bg-raised` 600) with `aria-pressed` items; `count` rendered as ` · N` in the label by the caller or via the `count` prop (`Odłożone · 1`). The action group wraps under the title row on narrow widths (PageHeader rule).
5. Filter semantic: the bar only reports `onFilter(id)`. `Moje Zgody` and `Zablokowane` are ids defined by the feature. The component never filters cards.
6. Scrolling: vertical scrolling happens inside the Board main region, each Lane grows with content; with very tall Lanes the whole LaneRow scrolls vertically in the page main (documented: Lanes do not have internal scrollbars so cards are never hidden).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Board header (title `Tablica Zadań`, badge `Tory z Workflow „board” v3`, segmented filter, `Odłożone · 1`, violet `+ Zadanie z Dokumentacji` on row 2 in the mock) and all five Lanes (QA active magenta tint). Exact paddings in requirements. Not in the mock: empty Lane, loading skeleton Lanes, filter hover/focus, no Tasks at all (EmptyState from the feature: `Tablica jest pusta. Chief doda Zadania, gdy Dokumentacja będzie gotowa.`).

## 7. Reuse

Consumes `ui:PageHeader` (OVE_DS045), `ui:SegmentedControl`, `ui:Pill` (`count`), `ui:VersionBadge`, `ui:Button`, `ui:EmptyState`.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel).

## 10. Errors and edge cases

- Count differs from rendered cards -> shown as given (the feature owns counts).
- `activeFilter` unknown -> none selected.
- Five Lanes at 1008px -> exactly 192px each fits; at 900px the row scrolls horizontally.
- Footer click while loading -> button disabled by the feature.

## 11. Acceptance criteria

- [ ] Given 5 Lanes in a 1008px row, Then each Lane is 192px wide with gap 12 (matches `design.png`) and no vertical clipping.
- [ ] Given the QA Lane `active`, Then border and gradient are applied.
- [ ] Given narrower than 5x180+gaps, Then the row scrolls horizontally with keyboard access.
- [ ] Given the filter group, Then `aria-pressed` reflects `activeFilter` and Arrow keys are not required (buttons).

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN question 3 (drag between Lanes): not supported.
