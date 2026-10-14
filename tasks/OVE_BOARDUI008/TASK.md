---
id: OVE_BOARDUI008
title: "Older Done Tasks: \"Pokaż N starszych\" pagination in a Lane"
area: BOARDUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD013, OVE_BOARDUI001, OVE_BOARDUI005, OVE_BOARDUI007, OVE_DS062]
soft_depends_on: []
provides: ["lib:board-lane-older"]
needs: ["api:board.view", "lib:api-client-board", "ui:Lane", "lib:use-gateway-resource", "lib:use-board"]
owns: ["apps/desktop/src/features/board/state/use-lane-older.ts", "apps/desktop/src/features/board/regions/lane-older.region.tsx", "apps/desktop/src/locales/en/board-lanes.json", "apps/desktop/src/locales/pl/board-lanes.json"]
reads: []
design: design.png
design_source: "Tablica#board/show-older-button (crop 900,560,208,80 CSS px)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11]
---

# OVE_BOARDUI008: Older Done Tasks: "Pokaż N starszych" pagination in a Lane

## 1. Summary

Makes the dashed `Pokaż 5 starszych` button in the Done Lane work: it loads older Tasks of that Lane page by page from the lane list endpoint and appends them below the newest cards.

## 2. Context

`BoardView` shows only the newest `doneVisible` (default 2) cards of a Lane of category `done` and reports `hiddenOlderCount`. `GET /workspaces/:wid/board/lanes/:laneId/tasks?cursor=&limit=` returns more cards (BOARD013). The button is the `footer` of `ui:Lane` built in OVE_BOARDUI004. Done Tasks may be many; the board must stay light.

## 3. Scope (in)

- `useLaneOlder(laneId)` hook: `loadMore()`, `cards`, `hasMore`, `status`.
- Extension point with the lanes region: `LanesView` (OVE_BOARDUI007) accepts an optional prop `extraCards: Record<LaneId, TaskCardProps[]>`; this task supplies the value through `lane-older.region.tsx`, which publishes the loaded cards into `useOlderCards()` (a tiny external store in `state/use-lane-older.ts`) that `lanes.region.tsx` reads.

## 4. Out of scope

- Searching old Tasks (post-MVP), unloading cards, infinite scroll.

## 5. Detailed requirements

1. `useLaneOlder(laneId)` keeps pages in local state keyed by `(workspaceId, laneId, filter)`; first `loadMore()` requests `limit = 20` with no cursor and `offset` semantic defined by the API (`cursor` opaque); subsequent calls pass `nextCursor`. `hasMore` = response has `nextCursor`.
2. The button label is `board:lane.showOlder` with `count = remaining` (`hiddenOlderCount` minus loaded, never negative). After all are loaded the footer disappears.
3. While loading the footer button is disabled with a spinner (`Button loading`), an `aria-live="polite"` message `board:lane.loadingOlder` is announced; on success focus moves to the first newly loaded card (so keyboard users land in the new content).
4. Error: inline error text under the button `board:lane.olderError` with `Retry`; the loaded cards stay.
5. Loaded older cards are invalidated (discarded) when `view.generatedAt` changes with a different `hiddenOlderCount` for that Lane or on filter/Workspace change; stale duplicates are prevented by de-duplicating by `TaskId`.
6. Older cards use the same `taskCardToProps` mapper; selection works as for any card.
7. The hook never requests more than 5 pages automatically; no polling.
8. `LanesView` extension: prop `extraCards?: Record<LaneId, TaskCardProps[]>` (added by OVE_BOARDUI007 as an optional prop; this task provides the value through the lanes region composition `lane-older.region.tsx` which renders nothing itself but registers the hook output in the dialogs-context store).

## 6. Design notes

`design.png` shows the dashed text button `Pokaż 5 starszych` under the two newest Done cards (40px high, 12px text, `dashed-more` Button variant). Loading shows the DS spinner inside the same button; error shows muted error text below it (derived from the DS error text rule). No other visuals are new.

## 7. Reuse

`ui:Lane` footer + `Button dashed-more` (OVE_DS062/DS014), `useGatewayResource` for the first page cache if useful, mappers (OVE_BOARDUI004).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-lane-older.ts`, `regions/lane-older.region.tsx` (slot `main`, order 21, renders `null`, only wires state). The cross-task contract with OVE_BOARDUI007 is the optional `extraCards` prop and is recorded in both tasks.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- `hiddenOlderCount` shrinks after a Task is reopened: remaining clamped to 0.
- Concurrent `loadMore` clicks: single flight.
- A Task moved out of Done between pages: may appear twice; de-duplicated, later page wins.
- Cursor expired (404/410): reset pages and refetch the first page.
- Filter changes: pages cleared.

## 11. Acceptance criteria

- [ ] Given `hiddenOlderCount=5`, Then the footer reads `Pokaż 5 starszych`; clicking loads up to 20 and removes the button when all are visible.
- [ ] Given the request fails, Then the loaded cards stay and a retry control appears.
- [ ] Given a filter change, Then loaded older cards are cleared.
- [ ] Given keyboard use, Then focus lands on the first new card and the live region announces the loading and the result.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `use-lane-older.test.tsx` (paging, de-dup, reset, errors), `lane-older.region.test.tsx`. Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Cross-task contract: optional prop `extraCards` on `LanesView` (OVE_BOARDUI007). If 007 is not merged yet, develop against its documented prop.

## 14. Open questions and assumptions

- ASSUMPTION: page size 20.
- ASSUMPTION: only Lanes of category `done` have hidden older cards in MVP (the API may return it for others).
