---
id: OVE_DS064
title: Build DecisionRow and DecisionList (search, filters, rows)
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS017, OVE_DS026, OVE_DS029, OVE_DS030, OVE_DS032, OVE_DS033, OVE_DS039, OVE_DS040, OVE_DS044]
soft_depends_on: []
provides: ["ui:DecisionRow", "ui:DecisionList"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:ListRow", "ui:Pill", "ui:SearchField", "ui:SelectButton", "ui:Menu", "ui:EmptyState", "ui:Skeleton"]
owns: ["packages/ui-kit/src/decisions/DecisionList/**"]
reads: []
design: design.png
design_source: "Decyzje#decis/list (crop 72,117,400,783 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DS064: Build DecisionRow and DecisionList (search, filters, rows)

## 1. Summary

Builds the 400px Decision Register list: title and append-only notice, search, three filter chips (Workspace, Status, Outcome) with menus, and `DecisionRow` showing id, status chip, outcome words, title and origin.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Decyzje.dc.html` and its 2x render `_design/views/Decyzje.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C5.6 (DecisionRow) and B13. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The register is append-only (ADR 0008): a Decision is never deleted or edited, a change is a new Decision that supersedes the old one. Therefore this list and its rows must NOT contain any delete or edit affordance. Statuses: proposed, accepted, rejected, superseded, needs_review; outcomes: unknown, positive, mixed, negative (SPEC 10).

## 3. Scope (in)

- `DecisionList` (header, search, filters, list, empty/no results/loading) and `DecisionRow` in all status/outcome combinations.

## 4. Out of scope

- Detail (OVE_DS065), search execution (DEC feature; the SearchField is controlled).

## 5. Detailed requirements

1. `DecisionRowProps { id: string /* 'D-14' */; title: string; meta: string /* 'Aplikacja rezerwacji · Chief' */; status: DecisionStatus; statusLabel: string; outcome: DecisionOutcome; outcomeLabel: string /* 'wynik: pozytywny' */; selected?: boolean; onSelect: () => void }`. Button, column gap 6, padding 12 14, radius 14. Unselected: transparent with a bottom border 1px `line-subtle`; selected: `bg-surface-sel` + 1px `line-strong` (no bottom border). Line 1: id mono 12 `text-secondary`, status chip (`Pill` tone from `decisionStatusTone`: przyjęta mint tint, propozycja lavender, do przeglądu amber, zastąpiona neutral, odrzucona error; mono 10-11), spacer, outcome words mono 11 coloured by `decisionOutcomeTone` (mint/amber/grey/error). Line 2: title 14/600 (2-line clamp). Line 3: meta mono 11 `text-muted` (ellipsis). Superseded rows: title `text-secondary` and the status chip says `zastąpiona`; they are NEVER hidden or strike-through.
2. `DecisionListProps`:
   ```ts
   interface FilterDef { id: 'workspace' | 'status' | 'outcome'; label: string; value: string; options: { value: string; label: string }[]; tone?: Tone }
   interface DecisionListProps { title: string; subtitle: string; search: { value: string; placeholder: string; onChange: (v: string) => void }; filters: FilterDef[]; onFilter: (id: FilterDef['id'], value: string) => void; items: DecisionRowProps[]; selectedId?: string; labels: { list: string; empty: string; noResults: string }; loading?: boolean }
   ```
   Header: title 24/700 (`title-section`, -0.48px) `Rejestr decyzji`, subtitle 13px `text-secondary` (`Tylko dopisywanie. Zmiana to nowa Decyzja, która zastępuje starą.`). `ui:SearchField` min-height 40 (E20: 40, not 42) with `search` icon. Filter chips: three `ui:SelectButton`-styled pills (the active/non-default one uses the `meta-selected` look, #1C1330 + 1px #5B3E8F) with a `chevron-down` caret (E4) opening `ui:Menu` listbox; chips wrap, gap 8.
3. List: `<ul>`, keyboard roving like OVE_DS049; the list scrolls inside the panel (padding 16). Empty register: `EmptyState` `Brak Decyzji. Pojawią się po pierwszej Dyskusji lub Decyzji Chiefa.`; no results: `noResults` with a `Wyczyść filtry` ghost button (callback from the feature through `labels` + `onFilter` resets).
4. Hard requirement (ADR 0008): a test asserts that no DecisionList/DecisionRow story contains elements with an accessible name matching delete/remove/edit (case-insensitive, EN + PL: `usuń`, `edytuj`) and that the component props have no `onDelete`/`onEdit`.
5. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
6. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
7. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
8. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
9. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
10. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
11. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the left Decision column: title, notice, search `Szukaj w Decyzjach`, chips `Wszystkie Workspace'y` (selected look), `Status: każdy`, `Wynik: każdy`, rows D-14 (selected, przyjęta, wynik: pozytywny), D-13 (propozycja, wynik: nieznany), D-12 (wynik: mieszany amber), D-09, D-07 (do przeglądu amber), D-03 (zastąpiona, wynik: negatywny red). Not in the mock: empty, no results, loading, hover/focus, open filter menus.

## 7. Reuse

Consumes `ui:ListRow` base (variant `decision`), `ui:Pill`, `ui:SearchField`, `ui:SelectButton`, `ui:Menu`, `ui:EmptyState`, `ui:Skeleton`, tone maps from OVE_DS040.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Decision titles/meta come from Chief/Agents: text only. The absence of delete/edit is a product invariant (ADR 0008) enforced by API shape and test. Isolated Workspace Decisions are filtered by the engine before they reach the UI (the UI cannot reveal them).

## 10. Errors and edge cases

- Unknown status/outcome -> neutral chip with raw label.
- Search value very long -> input scrolls; no layout change.
- Hundreds of rows -> plain list (feature paginates by 50 with `Pokaż więcej`).
- Filter options empty -> chip disabled.

## 11. Acceptance criteria

- [ ] Given the fixture, Then the six rows render with the status/outcome colours of the mock and the selected row has the border/fill.
- [ ] Given the invariant test, Then no delete/edit affordance exists in any story.
- [ ] Given filter chip activated by keyboard, Then the menu opens, arrows move, Enter selects, focus returns to the chip.
- [ ] Given search field height, Then it is 40px.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Invariant test `decisions-are-append-only.test.tsx`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION (E20): search field 40px, not 42 as in the mock.
- OPEN: whether rejected Decisions show in the default filter; feature decision.
