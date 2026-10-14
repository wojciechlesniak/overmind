---
id: OVE_WFED039
title: "Build node search: find a node by label, type, Agent or lane and reveal it on the canvas"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS022, OVE_DS026, OVE_DS028, OVE_DS032, OVE_WFED005, OVE_WFED019, OVE_WFED023, OVE_WFED024, OVE_WFED025]
soft_depends_on: []
provides: ["ui:NodeSearch", "lib:editor-node-search"]
needs: ["lib:editor-session", "lib:editor-selection", "lib:editor-agent-directory", "lib:editor-node-catalog", "lib:editor-announcer", "ui:Popover", "ui:SearchField", "ui:Kbd", "ui:EmptyState", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/search/search-nodes.ts", "apps/desktop/src/features/workflow-editor/canvas/search/normalize.ts", "apps/desktop/src/features/workflow-editor/canvas/search/useNodeSearchItems.ts", "apps/desktop/src/features/workflow-editor/canvas/search/NodeSearch.tsx", "apps/desktop/src/features/workflow-editor/canvas/search/*.test.ts", "apps/desktop/src/features/workflow-editor/canvas/search/*.test.tsx", "apps/desktop/src/features/workflow-editor/canvas/search/NodeSearch.stories.tsx", "apps/desktop/src/locales/en/wfc-search.json", "apps/desktop/src/locales/pl/wfc-search.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED039: Build node search: find a node by label, type, Agent or lane and reveal it on the canvas

## 1. Summary

The search behind the magnifier in the canvas toolbar: type a few letters and jump to a node by its label, type, Agent name or lane. With 200 nodes the canvas is too large to scan, so the search ranks matches, previews the position while you arrow through the results and selects the node on Enter. A pure ranking function plus a small keyboard-first panel.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The mock toolbar (`design.png` of WFED027) ends with a search icon; there is no panel in the mock, so this task designs it from the kit parts (`Popover`, `SearchField`). The panel is mounted by `ViewControls` of WFED027 in the bottom-left overlay above the toolbar, receives items and callbacks as props and never touches the viewport itself (the reveal callback is implemented by WFED027, which avoids a circular dependency). Labels and Agent names are untrusted text (they can come from Chief or from an Agent) and Polish diacritics must not hurt matching.

## 3. Scope (in)

- `normalizeForSearch` and `searchNodes(items, query, limit)` (pure, ranked).
- `useNodeSearchItems()` (derives items from the document and Agent directory, memoised by document identity).
- `NodeSearch` panel: input, result list, empty state, keyboard model, live announcements.
- `wfc-search` strings.

## 4. Out of scope

- Viewport movement (WFED027 `onReveal`).
- Searching Skills, edges, text inside Node configuration or Inspector fields (not planned).
- The `Ctrl/Cmd+F` binding (WFED038) and the toolbar button (WFED027).

## 5. Detailed requirements

1. ```ts
interface SearchItem { key: NodeKey; label: string; typeLabel: string; agentName?: string; laneName?: string; kind: NodeKind; groupLabel?: string }
interface SearchHit { item: SearchItem; score: number; matched: "label" | "type" | "agent" | "lane" | "group"; ranges: Array<[number, number]> /* in label, for highlighting */ }
function searchNodes(items: readonly SearchItem[], query: string, limit = 50): SearchHit[]
interface NodeSearchProps { open: boolean; items: readonly SearchItem[]; onReveal(key: NodeKey, o: { commit: boolean }): void; onClose(o: { restore: boolean }): void; labels: NodeSearchLabels }
```
2. `normalizeForSearch(s)`: NFD, strip combining marks, map `ł`->`l`, `Ł`->`l`, `ø`->`o`, `ß`->`ss`, lower-case, collapse whitespace, trim, clamp to 80 chars. The same function normalises labels and the query, so `lancuch` finds `Łańcuch`.
3. Ranking (`score`, higher first, ties by label then by canvas order): exact label 100; label prefix 80; word-prefix in label 60; substring in label 40; Agent name 35 (same ladder, scaled); lane name 30; type label 25; group (frame) label 20. Multiple words in the query are AND-ed (every word must match some field). An empty query lists the first 50 nodes in canvas order (`nodeOrder`) under a heading `Wszystkie Węzły`. `limit` 50, the footer shows `+ N więcej` when truncated.
4. `useNodeSearchItems`: `label` = node label or the catalogue type label when empty; `typeLabel` from the catalogue (`Agent`, `IF`, ...); `agentName` from `agentDirectory.lookup(agentRef)` when found; `laneName` from `document.lanes`; `groupLabel` from the frame containing the node. The array identity changes only when the document or the directory version changes (200 items built in < 2 ms, unit test).
5. Panel behaviour: opens with the input focused and the text of the last query selected; `ArrowDown/ArrowUp` move the active result (wrapping), the active result is exposed with `aria-activedescendant` on the input (combobox pattern: `role="combobox"` input + `role="listbox"` results with `role="option"` rows); on every active change the panel calls `onReveal(key, { commit: false })` (a peek: the canvas pans, the selection does not change); `Enter` calls `onReveal(key, { commit: true })` after selecting the node through `session.setSelection` and closes with `restore: false`; `Esc` or a click outside closes with `restore: true` (WFED027 restores the viewport saved when the panel opened if the last reveal was a peek); `Tab` leaves the panel without selecting.
6. Rows show an icon of the kind, the label with `<mark>` ranges (built as React elements, never with `dangerouslySetInnerHTML`), a secondary line `typeLabel · agentName · TOR laneName` (only the parts that exist) and the visibility word PUBLICZNY/PRYWATNY for Agent nodes through `ui:VisibilityBadge` when known. A node that is currently selected shows `zaznaczony`.
7. Announcements through the announcer (politeness polite, debounced 300 ms): `3 wyniki`, `Brak wyników`; on peek nothing is announced except the active option which the browser reads through `aria-activedescendant`.
8. Empty results: `ui:EmptyState` compact `Nie znaleziono Węzła „{query}”` (the query is rendered as text). Empty document: `Brak Węzłów na tym canvasie`.
9. Performance: filtering runs synchronously per keystroke for up to 200 items (budget 3 ms measured with the 200-node fixture of WFED045); no debounce needed, no Web Worker.
10. Strings (`wfc-search`): `title` `Szukaj Węzła`, `placeholder` `Nazwa, typ, Agent lub Tor`, `all`, `results` ICU plural, `none`, `more`, `selected`, `lane` `TOR {name}`, `emptyDoc`, `close`.

## 6. Design notes

Not in the mock. Design from the kit: a `Popover` panel 320 px wide anchored above the toolbar (`bottom: 10 + 66 + 8`), radius 16, `bg-surface` (`#140F20`), `1px line-strong`, shadow `glow-menu`; input row 40 px with the search icon; result rows 44 px (one line label 14/600, one line secondary 12 `text-secondary`), active row `bg-hover` with a 2 px violet left bar and the global focus ring; max 6 visible rows then a scroll inside the panel; `mark` uses `#D6C9FF` background at 20 % and no colour change of the text (contrast safe). Narrow stages (< 520): the panel spans the stage width minus 20 px.

## 7. Reuse

- `ui:Popover`, `ui:SearchField`, `ui:Kbd`, `ui:EmptyState`, `ui:VisibilityBadge`, `ui:Icon`; catalogue queries (WFED005); agent directory (WFED023); selection (WFED025); announcer (WFED024).

## 8. Architecture and code placement

Layer: `canvas/search/`: `normalize.ts` and `search-nodes.ts` are pure (own tests); `useNodeSearchItems` reads session and directory; `NodeSearch` is presentational over props. No viewport code here.

## 9. Security and safety

Search text is only compared, never executed or used in a RegExp (use `includes` and prefix tests; a query such as `(.*` must not throw or hang); results render as text; the query is clamped to 80 characters; no query is logged or persisted. The list contains only nodes of the current document, so nothing from other Workspaces can appear (Agent names come from the already visibility-filtered directory).

## 10. Errors and edge cases

- Query with regex metacharacters: matched literally.
- 200 nodes with identical labels: stable order by canvas order.
- A node whose Agent is still loading: `agentName` absent, no flicker of matches (items update when the directory resolves, the active result stays).
- The active node is deleted while the panel is open (another transaction): the list recomputes and the active index clamps.
- Emoji or RTL labels: normalised unchanged, shown as text.
- View mode: search works (read only), Enter selects.
- Hidden container (0x0): `onReveal` is a no-op in WFED027, the panel still selects.

## 11. Acceptance criteria

- [ ] Given nodes `Łańcuch jakości` and `Developer`, When the user types `lanc`, Then the first result is `Łańcuch jakości`.
- [ ] Given the query `qa tor`, Then only nodes matching both words in any field are listed.
- [ ] Given ArrowDown twice, Then `onReveal` was called with `commit: false` for each active node and the selection did not change.
- [ ] Given Enter on the active result, Then the node is the only selected node, `onReveal(..., { commit: true })` ran and the panel closed.
- [ ] Given Esc after a peek, Then `onClose({ restore: true })` is called.
- [ ] Given 200 nodes and any query, Then `searchNodes` takes under 3 ms (benchmark guard).
- [ ] Given the query `(.*`, Then no exception and zero hits.

## 12. Test plan

Table-driven unit tests for `normalizeForSearch` and `searchNodes` (ranking ladder, AND semantics, ties, limit) plus a property test (never throws, hits subset of items); RTL tests for the keyboard model and the combobox ARIA attributes; Storybook (`NodeSearch/Default`, `NoResults`, `ManyResults`, `Narrow`) with play functions; axe. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/search`.

## 13. Parallelization notes

Independent of the toolbar: WFED027 consumes this task (needs `ui:NodeSearch`), not the other way round. Parallel with every other wiring task.

## 14. Open questions and assumptions

- ASSUMPTION: peeking pans the viewport but does not change the selection; the alternative (select on every arrow) was rejected because it pollutes the Inspector.
- OPEN (Owner): search over Skill names of Agent nodes is cheap to add later (the directory already knows `skillIds`) but is not in the MVP.
