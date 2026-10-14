---
id: OVE_DS069
title: Build DataTable and ResultCell (sticky header, tones, empty state)
area: DS
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS020, OVE_DS032, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:DataTable", "ui:ResultCell"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:EmptyState", "ui:Skeleton", "ui:StatusText", "ui:Button"]
owns: ["packages/ui-kit/src/data/DataTable/**"]
reads: []
design: design.png
design_source: "Activity, mock scrolled 110px#activity/events-table (crop 347,746,768,232 CSS px)"
spec_refs: ["SPECIFICATION 15"]
adr_refs: [26]
---

# OVE_DS069: Build DataTable and ResultCell (sticky header, tones, empty state)

## 1. Summary

Builds the generic data table used by the Activity event log, the Agent tools table and the Workspace folder list: typed columns, mono cells, sticky header, row dividers, result cells with tone + glyph + word, optional row click, empty/loading states.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Activity.dc.html` and its 2x render `_design/views/Activity.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C8.5 (DataTable). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The Activity log answers who did what, with which tool and what result, including blocked actions (`zablokowane · izolacja`) and Quality Gate outcomes (SPEC 15). Result words must carry a glyph and text, not only colour.

## 3. Scope (in)

- `DataTable<Row>`, `ResultCell`, stories (events, tools, folders), keyboard behaviour, truncation rules.

## 4. Out of scope

- Tools table composition (OVE_DS070), Permission matrix cells (OVE_DS081), data fetching/filtering.

## 5. Detailed requirements

1. ```ts
   interface Column<Row> { id: string; header: string; cell: (row: Row) => ReactNode; width?: string; align?: 'start' | 'center' | 'end'; mono?: boolean; nowrap?: boolean; ellipsis?: boolean }
   interface DataTableProps<Row> { columns: Column<Row>[]; rows: Row[]; rowKey: (row: Row) => string; onRowClick?: (row: Row) => void; selectedKey?: string; stickyHeader?: boolean; maxHeight?: number; caption: string; loading?: boolean; empty?: ReactNode; maxRows?: number; showMore?: { label: (hidden: number) => string; onClick: () => void } }
   ```
   Semantic `<table>` with a visually hidden `<caption>`, `<th scope="col">`. Container radius 16, 1px `line`, `overflow: hidden`, fill `bg-surface`; header row fill `bg-surface` (#140F20) with `mono-label` text (mono 10/500, +0.08em uppercase, `text-muted`) padding 10 12; body cells padding 10 12, 13px or mono 12 `text-secondary`, row divider 1px `line-subtle`, last row without divider; `table-layout: fixed` with `width` per column; `ellipsis` columns clip with title.
2. `ResultCell` props `{ result: 'ok' | 'delivered' | 'blocked' | 'waiting' | 'failed' | 'gate-failed'; label: string }`: glyph via `StatusText` (✓ mint for ok/delivered; ◆ amber waiting; ✗ error blocked/failed/gate-failed) + the label text (`zablokowane · izolacja`, `czeka na Zgodę`, `nie spełnia → Developer`), mono 12; tone map exhaustive.
3. Sticky header: `position: sticky; top: 0; z-index: var(--om-z-sticky)` inside the scrolling container (`maxHeight`); a 1px bottom shadow appears when scrolled. Horizontal overflow: container `overflow-x: auto` with focusable scroll region (`tabindex=0`, `role="region"` with caption).
4. Row interaction: with `onRowClick` rows are focusable (`tabindex=0`, Enter/Space activate, hover `bg-surface-sel` at 60%, `aria-selected` for `selectedKey` via `aria-current="true"`); without it rows are inert (no hover styling).
5. `loading`: 5 `TableRowSkeleton` rows with column widths. Empty: `empty` node (default `EmptyState` small) inside a full-width row. `maxRows` + `showMore` render a final `Button dashed-more` row.
6. Numeric/time columns align `end` with `font-variant-numeric: tabular-nums`.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Activity event table (head `CZAS | KTO | CO | WYNIK`, rows `14:21:07`, `Security`, `sieć: registry.npmjs.org` ... `czeka na Zgodę`, `zablokowane · izolacja`, `nie spełnia → Developer`). Not in the mock: sticky header, loading, empty, hover/selected, narrow overflow.

## 7. Reuse

Consumes `ui:StatusText`, `ui:EmptyState`, `ui:Skeleton`, `ui:Button`, OVE_DS040 types. Provides the table to OVE_DS070, OVE_DS081 (folders use their own cells), Activity.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Cell content (commands, paths, event text) is agent/CLI-originated and shown verbatim as text; no interpretation. Blocked/denied results must be as visible as successes (no hiding by tone).

## 10. Errors and edge cases

- `rows` empty and no `empty` prop -> default empty text from `caption` + generic label (dev warning).
- Duplicate `rowKey` -> dev warning.
- 10k rows -> no virtualisation in this task (feature paginates; `maxRows` guards the DOM).
- Very long cell -> `ellipsis` columns clip, others wrap with `overflow-wrap: anywhere`.

## 11. Acceptance criteria

- [ ] Given the events fixture, Then the table matches `design.png` within tolerance.
- [ ] Given `ResultCell` for blocked, Then the glyph `✗` and the label are present.
- [ ] Given `onRowClick`, Then Enter on a focused row triggers it and rows have a visible focus ring.
- [ ] Given `stickyHeader` and 30 rows, Then the header stays visible while the body scrolls.
- [ ] axe clean (caption, th scope).

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: column sorting is not designed; not included.
