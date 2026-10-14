---
id: OVE_BOARDUI014
title: "Board empty, loading, error and no-selection states"
area: BOARDUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI003, OVE_BOARDUI005, OVE_BOARDUI006, OVE_BOARDUI007, OVE_BOARDUI009, OVE_DS013, OVE_DS032, OVE_DS062]
soft_depends_on: []
provides: ["lib:board-states"]
needs: ["ui:EmptyState", "ui:Skeleton", "ui:Lane", "ui:Button", "lib:use-board", "lib:feature-regions"]
owns: ["apps/desktop/src/features/board/regions/states.region.tsx", "apps/desktop/src/features/board/components/BoardSkeleton.tsx", "apps/desktop/src/features/board/components/BoardError.tsx", "apps/desktop/src/locales/en/board-states.json", "apps/desktop/src/locales/pl/board-states.json"]
reads: []
design: design.png
design_source: "Tablica#board/lane-todo + board/lane-build (skeleton and empty derived) (crop 84,239,420,300 CSS px)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11]
---

# OVE_BOARDUI014: Board empty, loading, error and no-selection states

## 1. Summary

Adds the states the mock does not draw: skeleton Lanes while loading, the empty-board message, an error banner with retry, the empty Lane message and the filter-with-no-result message.

## 2. Context

VIEWS.md lists for the Task Board: empty Lane, empty board, loading, error, selected Task none. They derive from the design system rules (skeletons, EmptyState, error text with glyph). Empty-board copy suggested in OVE_DS062: `Tablica jest pusta. Chief doda Zadania, gdy Dokumentacja będzie gotowa.`

## 3. Scope (in)

- `BoardSkeleton` (5 skeleton Lanes with 2-3 card skeletons), `BoardError`, empty states.
- `states.region.tsx` (slot `main`, order 5) that decides which state to show and suppresses the lanes region when needed (through `useBoardView().status`).

## 4. Out of scope

- Detail panel empty/loading (OVE_BOARDUI009), deferred empty (OVE_BOARDUI011).

## 5. Detailed requirements

1. Loading (first load, no data): `BoardSkeleton` with the same lane widths and heights ranges as real lanes (5 columns of 192px) using `ui:Skeleton`; `aria-busy=true` and a visually hidden `board:states.loading` text.
2. Refreshing (data exists): no skeleton; subtle top progress indicator is NOT added (ui-kit has none); `aria-busy` on main only.
3. Error (no data): `ui:EmptyState` variant error with title `board:states.errorTitle` (`Nie udało się wczytać Tablicy`), description mapped from the error code through `renderMessage`, button `Spróbuj ponownie` (`refetch`), and for `gateway.unreachable` the text `Silnik nie odpowiada` with a hint to check the system status in the tray.
4. Error (data exists, refresh failed): inline banner above the lanes `board:states.staleBanner` (`Pokazuję ostatnio wczytane dane`) with retry; data stays.
5. Empty board (no Lanes or zero Tasks and filter `all`): `ui:EmptyState` `board:states.emptyTitle` (`Tablica jest pusta`) + description `Chief doda Zadania, gdy Dokumentacja będzie gotowa.` and a secondary link to the Chief chat (`routes.chief()`).
6. Filter without results (filter `blocked` or `my_approvals` yields zero cards): message `board:states.noMatch` with `Pokaż wszystkie` (sets `filter=all`).
7. Empty Lane: handled by ui:Lane `emptyLabel` (`board:lane.empty`) mapped in OVE_BOARDUI004; this task only verifies it in stories.
8. Workspace without any Board (provisioning): treated as error with a specific message `board:states.notProvisioned`.
9. All states keep the header region usable.
10. Every state has a story and an axe-clean test; reduced motion removes skeleton shimmer (ui-kit).

## 6. Design notes

`design.png` crops the Todo and Build lanes as the visual reference for skeleton geometry (lane 192px wide, padding 12, gap 10, card height 100-148). Skeleton: `ui:Skeleton` bars inside lane-shaped cards on `bg-panel-alt`. Empty/error use `ui:EmptyState` centred in the main area (max width 420). Copy as listed; error tone has a glyph, not colour only.

## 7. Reuse

`ui:Skeleton`, `ui:EmptyState`, `ui:Button`, `useBoardView` status; `renderMessage` (OVE_ARCH011).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `components/BoardSkeleton.tsx`, `components/BoardError.tsx`, `regions/states.region.tsx`. The lanes region reads `useBoardView().status` itself to hide when states show; this task documents the rule: `states.region` renders for `loading|error|empty|noMatch`, `lanes.region` renders for `ready` with at least one card.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Slow load > 10 s: skeleton stays, no timeout (engine timeouts apply).
- Error code unknown: generic message with `retryable` hint.
- Board becomes empty after Tasks were deferred: empty state with the deferred link.
- Offline: handled by OVE_BOARDUI013 banner, not here.

## 11. Acceptance criteria

- [ ] Given first load, Then skeleton Lanes appear and disappear without layout shift when data arrives.
- [ ] Given the gateway fails, Then the error state shows a retry that refetches.
- [ ] Given an empty Board, Then the empty message with the Chief link shows.
- [ ] Given filter `blocked` with no results, Then `Pokaż wszystkie` resets the filter.
- [ ] Axe clean for all states.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `states.region.test.tsx` for each state, stories `Board/States/*`, layout-shift check in Playwright (OVE_BOARDUI016). Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: no progress bar for refreshing.
