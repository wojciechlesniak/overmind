---
id: OVE_BOARDUI007
title: "Lanes region: lane columns with Task cards, selection and keyboard navigation"
area: BOARDUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI003, OVE_BOARDUI004, OVE_BOARDUI005, OVE_BOARDUI006, OVE_DS061, OVE_DS062]
soft_depends_on: []
provides: ["lib:board-lanes-region"]
needs: ["ui:Lane", "ui:LaneRow", "ui:TaskCard", "ui:TaskProgress", "lib:feature-regions", "lib:use-board", "lib:board-view-models"]
owns: ["apps/desktop/src/features/board/regions/lanes.region.tsx", "apps/desktop/src/features/board/components/LanesView.tsx", "apps/desktop/src/features/board/components/use-card-focus.ts"]
reads: []
design: design.png
design_source: "Tablica#board/lanes (crop 84,239,1024,520 CSS px)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11]
---

# OVE_BOARDUI007: Lanes region: lane columns with Task cards, selection and keyboard navigation

## 1. Summary

Renders the five-Lane board (`ui:LaneRow` of `ui:Lane` with `ui:TaskCard`s) from the view-models, handles card selection and gives the board an accessible keyboard model. Cards are NOT draggable: Chief moves Tasks, not the Owner.

## 2. Context

Mock regions `board/lanes`, `board/lane-*` and `board/task-card-*`: Lanes `Do zrobienia` (hint `Chief rozdziela, gdy zwolni się slot`), `Build`, `QA` (active, magenta tint), `Review`, `Gotowe`; cards show id, state word, title, doc chip, assignee and progress for working Tasks; selected card T-31 has the violet ring. Lanes come from the Workflow (`Lane`, OVE_BOARD001) and are ordered by `position`. Task states are shown with dot plus word, never colour alone (design rule).

## 3. Scope (in)

- `regions/lanes.region.tsx` (slot `main`, order 20) with `LanesView`.
- Selection via `useSelectedTask` (click, Enter, Space).
- Keyboard: Tab enters the board once; Arrow Up/Down moves between cards in a Lane, Arrow Left/Right moves to the same index in the neighbouring Lane, Home/End first/last card; focus follows `orderedTaskIds`.
- Scroll position handling and `LaneRow` horizontal scroll.

## 4. Out of scope

- Pagination of older done cards (OVE_BOARDUI008), empty/loading/error (OVE_BOARDUI014), drag and drop (not planned), Owner move menu (not planned, see open questions).

## 5. Detailed requirements

1. `LanesView` receives `lanes: LaneViewModel[]`, `selectedId`, `onSelect` and renders `<LaneRow label={t('board:lanes.label')}>` with one `<Lane>` per lane in the given order (never re-sorted in the UI), cards as `<TaskCard>` built by `taskCardToProps` with `selected` and `onSelect={() => select(id)}`.
2. The component passes no `draggable`, no drag handlers and no `onDrop`. A unit test asserts no element in the rendered tree has `draggable="true"`.
3. Roving focus (`use-card-focus.ts`): exactly one card has `tabIndex=0` (the selected one, else the first); arrow navigation as described; moving focus does not change selection (selection is Enter/click) to avoid reloading the detail panel on every arrow press (ASSUMPTION; documented).
4. Selection is mirrored in the URL by `useSelectedTask`; clicking the already selected card keeps it selected (no toggle-off). Escape in the lanes clears the selection and returns focus to the previously selected card element.
5. Active lane: `lane.active` from the mapper; the region does not compute it again.
6. Cards with `docWarning` render the DS missing-link variant through the TaskCard `doc` omitted state and the lane footer is untouched; the warning text key `board:card.noDoc` is passed to the card `aria-describedby` helper (reported to DS if the variant is missing).
7. The region reads only `useBoardView().lanes`; it never fetches. Lane count pills show the view counts (not the rendered card count).
8. Memoisation: `LanesView` is memoised on `lanes` identity; selecting a card re-renders only the two affected cards (selection passed as `selectedId`, TaskCard `React.memo` by props).
9. Horizontal layout: five Lanes in 1008px fit 192px each (ui-kit rule); below that `LaneRow` scrolls horizontally and is keyboard scrollable.
10. Live region: a visually hidden `aria-live="polite"` element announces `board:live.moved` (`T-31 moved to QA`) for events processed by OVE_BOARDUI013 (this task only renders the element and exposes `announce(text)` through the dialogs-context).

## 6. Design notes

`design.png`: the lane row at 1008px: To do (4 Tasks, hint), Build (T-33 working with a pink progress bar, T-34 queued), QA (tinted; T-31 selected with violet 1.5px ring and 4px glow, progress `testy 38 z 52`; T-30 waiting for Approval in amber), Review (T-28 `ocenia`), Done (T-27 `✓ Quality Gate`, T-26 `✓ zaakceptowane`, dashed `Pokaż 5 starszych` button). Everything is drawn by ui-kit components (OVE_DS061/062). States not in the mock: empty Lane (ui:Lane `emptyLabel` = `board:lane.empty` PL `Brak Zadań`), long titles (3-line clamp in the card), hover and focus (DS rules), blocked and parked cards (DS variants).

## 7. Reuse

`ui:Lane`, `ui:LaneRow`, `ui:TaskCard`, `ui:TaskProgress`; mappers (OVE_BOARDUI004); `useBoardView`, `useSelectedTask` (OVE_BOARDUI005). New reusable piece: `use-card-focus` (kept local; a later view with a card grid would promote it to shared).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/lanes.region.tsx` (thin), `components/LanesView.tsx` (presentational composition), `components/use-card-focus.ts` (pure keyboard logic with a testable reducer).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Zero Lanes (Workflow without TOR nodes): the region renders nothing and the states task shows the empty board message.
- Selected Task not in any visible lane (filtered out): selection stays in the URL until the filter task clears it (OVE_BOARDUI005 rule).
- Duplicate card ids in the payload (defensive): first wins, console warning in dev.
- Lane with 100 cards: renders all (no virtualisation in MVP, documented); layout stays responsive because cards are light.
- Card whose lane is archived: not in the payload.
- Focus on a card that disappears after an event: focus moves to the next card in the same Lane, else the Lane region.

## 11. Acceptance criteria

- [ ] Given the mock fixture, Then five Lanes render in order with the documented counts and cards (visual match with `design.png`).
- [ ] Given a click on T-31, Then it is marked selected and the URL has `task=<id>`.
- [ ] Given ArrowDown in a Lane, Then focus moves to the next card without changing selection.
- [ ] Given no `draggable` attributes anywhere in the tree.
- [ ] Given 40 Tasks in one Lane, Then selecting a card does not re-render the other cards (render-count test).
- [ ] Given axe, Then no violations, and every card has an accessible name `T-31, <title>, <state>`.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `LanesView.test.tsx` (render, selection, no draggable), `use-card-focus.test.ts` (reducer table), render-count test with profiler, story `Board/Lanes` with the mock fixture and the extra states. Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- OPEN design question 3 (Owner drag between Lanes): NOT built. Default decided here: cards are not draggable. If the Owner wants manual moves later, a new task adds a keyboard-first `Move to lane...` menu using `allowedNextLanes` from the Task detail (`POST /tasks/:id/move`), never free drag.
- ASSUMPTION: arrow keys move focus only; Enter or click selects.
