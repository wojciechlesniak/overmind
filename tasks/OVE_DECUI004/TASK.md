---
id: OVE_DECUI004
title: "Decision list region: search, filter chips and rows"
area: DECUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI003, OVE_DECUI001, OVE_DECUI002, OVE_DECUI003, OVE_DS026, OVE_DS029, OVE_DS030, OVE_DS034, OVE_DS064]
soft_depends_on: []
provides: ["lib:decision-list-region"]
needs: ["ui:DecisionList", "ui:DecisionRow", "ui:SearchField", "ui:Select", "ui:Menu", "lib:feature-regions", "lib:use-decision-list"]
owns: ["apps/desktop/src/features/decisions/regions/list.region.tsx", "apps/desktop/src/features/decisions/components/DecisionListPanel.tsx", "apps/desktop/src/locales/en/decisions-list.json", "apps/desktop/src/locales/pl/decisions-list.json"]
reads: []
design: design.png
design_source: "Decyzje#decis/list (crop 72,117,400,783 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI004: Decision list region: search, filter chips and rows

## 1. Summary

Fills the list column: title `Rejestr decyzji`, the append-only subtitle, the search field, the three filter chips (Workspace, status, outcome) and the Decision rows with selection and `Pokaż więcej`.

## 2. Context

Mock regions `decis/list-title`, `decis/search`, `decis/filter-chips`, `decis/list-items`: rows show id, status chip, outcome words, title and `Workspace · origin`; the selected row is `D-14`. `ui:DecisionList` takes plain props (OVE_DS064): `search`, `filters: FilterDef[]`, `items`, `selectedId`, `labels`, `loading`. Hard rule: no delete/edit controls (ADR 0008).

## 3. Scope (in)

- `list.region.tsx` (slot `list`) and `DecisionListPanel` mapping state to `DecisionListProps`.
- Filter option lists (Workspaces, statuses, outcomes with counts).
- `Pokaż więcej` footer for pagination, `Wyczyść filtry` for no results.

## 4. Out of scope

- Detail (OVE_DECUI006), empty/error states (OVE_DECUI013).

## 5. Detailed requirements

1. Map `useDecisionFilters` + `useDecisionList` to `DecisionListProps`: `title` `Rejestr decyzji`, `subtitle` (append-only sentence), `search { value, placeholder: 'Szukaj: biblioteka dat, płatności…', onChange }`, `filters` = Workspace (value `''` or id), Status (options `każdy` + five statuses with counts), Outcome (`każdy` + four outcomes with counts); chip label shows the selected option text, non-default chips use the `meta-selected` look (ui-kit).
2. Rows: `decisionSummaryToRow`; `selected` by `selectedId`; `onSelect` -> `select(id)`.
3. Footer: when `hasMore`, a dashed `Pokaż więcej` button (`dashed-more`) loading the next page, with the same focus rule as OVE_BOARDUI008 (focus the first new row, live announcement `Wczytano 50 kolejnych Decyzji`).
4. Search field: `aria-label` `Szukaj w Decyzjach`; Escape clears the text; the input keeps focus while results update (no remount).
5. The list keeps its scroll position when selection or events refresh it.
6. Superseded and rejected rows stay in the list, with their status chip; they are never hidden or struck through (ADR 0008); default filters show all statuses.
7. A test asserts the rendered panel has no element whose accessible name matches `delete|remove|edit|usuń|edytuj` (case-insensitive), like DS064.
8. Keyboard: roving focus (ArrowUp/Down), Enter selects; `/` focuses the search field when the list column has focus (ASSUMPTION; documented as a shortcut hint only in the placeholder tooltip).

## 6. Design notes

`design.png` shows the 400px column: title 24/700 `Rejestr decyzji`, subtitle, search, three chips (`Wszystkie Workspace'y` active-looking violet, `Status: każdy`, `Wynik: każdy`) and six rows (D-14 selected `przyjęta`/`wynik: pozytywny`, D-13 `propozycja`, D-12 `mieszany`, D-09, D-07 `do przeglądu`, D-03 `zastąpiona`/`negatywny`). All drawn by ui-kit (OVE_DS064). Not in the mock: open chip menu (ui:Menu listbox), hover/focus, loading (skeleton rows), the footer button.

## 7. Reuse

`ui:DecisionList`, `ui:DecisionRow`, `ui:SearchField`, `ui:Menu`; hooks of OVE_DECUI002; mappers OVE_DECUI001.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/DecisionListPanel.tsx`, `regions/list.region.tsx`; namespace `decisions-list` holds the placeholder, footer and live strings.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Search without results: ui `noResults` with `Wyczyść filtry`.
- Selected row filtered out: selection stays; detail still shows (the Owner may keep reading).
- Facet count `0` option selected via URL: allowed, list empty.
- Very long Workspace name: chip ellipsis with title.

## 11. Acceptance criteria

- [ ] Given the fixture, Then the column matches `design.png` within tolerance with D-14 selected.
- [ ] Given typing in search, Then rows filter after the debounce and the input keeps focus.
- [ ] Given a status chip selection, Then the URL and request update and counts adjust.
- [ ] Given 60 rows, Then `Pokaż więcej` loads the next page.
- [ ] Given the accessible-name test, Then no delete/edit controls exist.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `DecisionListPanel.test.tsx`, `list.region.test.tsx`, append-only invariant test, visual test of the column against `design.png`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: the `/` shortcut is not built unless the shell defines global shortcuts.
