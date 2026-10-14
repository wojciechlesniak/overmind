---
id: OVE_BOARDUI013
title: "Live Board updates: event handling, version conflicts and announcements"
area: BOARDUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD001, OVE_BOARDUI001, OVE_BOARDUI005, OVE_BOARDUI007, OVE_BOARDUI009, OVE_ENGINE027]
soft_depends_on: []
provides: ["lib:board-live"]
needs: ["event:task.created", "event:task.moved", "event:task.assigned", "event:task.status_changed", "event:task.deferred", "event:task.progress_reported", "event:board.lanes_changed", "lib:api-client-events", "lib:use-gateway-resource"]
owns: ["apps/desktop/src/features/board/live/**", "apps/desktop/src/locales/en/board-live.json", "apps/desktop/src/locales/pl/board-live.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 16"]
adr_refs: [5, 11]
---

# OVE_BOARDUI013: Live Board updates: event handling, version conflicts and announcements

## 1. Summary

Keeps the Board and the open Task panel current while Chief and Agents work: applies progress events without refetching, refetches on structural events, announces moves for screen readers and recovers after reconnects.

## 2. Context

The engine pushes `task.*` and `board.lanes_changed` events (BOARD001/013; `task.progress_reported` is ephemeral). Work continues with the window closed (ADR 0005) so the UI must resynchronise on reconnect: the api-client calls `onResync` and the shared hook refetches (OVE_BOARDUI001). Progress is a hint reported by the Agent, updated up to once a second per Task.

## 3. Scope (in)

- `useBoardLiveUpdates()` mounted by a region (slot `overlay`, order 90).
- Local progress patching for cards and the open detail.
- Live announcements and a subtle `Odświeżono` marker (no toast spam).
- Offline/reconnecting banner state for the Board.

## 4. Out of scope

- The generic resource invalidation (OVE_BOARDUI001), rendering of cards (OVE_BOARDUI007).

## 5. Detailed requirements

1. Subscribe through the shared event subscription with the types listed in `needs` for the active Workspace only (`workspaceId` filter).
2. `task.progress_reported {taskId, done, total}`: patch the matching card's `progress` in the cached view and in the detail resource using the resource hook's `setData` escape hatch (added in OVE_BOARDUI001 as `mutateCache(key, updater)`); throttle patches to 1 per 500 ms per Task; never triggers a refetch.
3. `task.created|moved|assigned|status_changed|deferred|board.lanes_changed`: already refetch through `invalidateOn`; this task adds the human-readable announcement: `board:live.moved` (`{{id}} przeniesiono do {{lane}}`), `board:live.assigned`, `board:live.statusChanged`, `board:live.created`, announced politely at most once per 2 s (batched `N zmian na Tablicy` when more).
4. Announcements are not toasts; they use the visually hidden live region from OVE_BOARDUI007 via `useBoardDialogs().announce`.
5. Version conflicts: when a mutation in this view fails with a `version_conflict`, `isVersionConflict` handling lives in the action tasks; this task only guarantees the next refetch happens (it listens to the mutation-failed signal from `useGatewayMutation` through `onConflict` callbacks registered by actions).
6. Connection state: `useGatewayStatus()` `reconnecting` shows a thin inline note above the lanes (`board:live.reconnecting` = `Łączenie z silnikiem...`, `aria-live=polite`, hidden on `live`); data stays visible; actions are disabled while reconnecting (buttons read `disabled` from `useBoardDialogs().offline`).
7. After a resync the view refetches once and the announcement `board:live.resynced` is NOT spoken (to avoid noise).
8. The hook unsubscribes on unmount and on Workspace change; cleanup test required.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource` invalidation and `mutateCache` (OVE_BOARDUI001, additive method requested there), event types from contracts, `useBoardDialogs` (OVE_BOARDUI006).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `live/use-board-live-updates.ts`, `live/announcements.ts` (pure batching), `live/live.region.tsx` (slot `overlay`, renders null and mounts the hook). The route glob in `regions/index.ts` (OVE_BOARDUI006) covers both `./*.region.tsx` and `../live/*.region.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Progress event for a Task not in the cache: ignored.
- Event flood (Agent reporting each second for 10 Tasks): throttled to 2 patches per second per Task, UI stays responsive (test).
- Event for another Workspace: ignored.
- Events arrive before the first load completes: ignored, the initial fetch is newer.
- `done > total` in an event: clamped.

## 11. Acceptance criteria

- [ ] Given a progress event, Then the card's bar updates within 500 ms and no network request is made.
- [ ] Given a `task.moved` event, Then one refetch occurs and one polite announcement is made.
- [ ] Given 20 events in 1 s, Then at most one batched announcement is spoken.
- [ ] Given reconnecting, Then the inline note shows and buttons are disabled; after reconnect it clears and the view refetches.
- [ ] Given unmount, Then all subscriptions are released.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `use-board-live-updates.test.tsx` with a fake event emitter (progress throttling, batching, cleanup), `announcements.test.ts`. Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Needs the small additive `mutateCache` API in OVE_BOARDUI001 and the extra glob in `regions/index.ts` (OVE_BOARDUI006).

## 14. Open questions and assumptions

- ASSUMPTION: announcements in Polish by default (locale), no sound.
- GAP: OVE_BOARDUI001 must expose `mutateCache`; added to its requirement list by the linker note (reported).
