---
id: OVE_DECUI013
title: "Decision register states and live updates: empty, no results, loading, error, events"
area: DECUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DEC001, OVE_DECUI002, OVE_DECUI004, OVE_DECUI006, OVE_DS013, OVE_DS032, OVE_ENGINE027]
soft_depends_on: []
provides: ["lib:decision-states"]
needs: ["ui:EmptyState", "ui:Skeleton", "ui:Button", "event:decision.recorded", "event:decision.status.changed", "event:decision.outcome.verdict_set", "lib:api-client-events", "lib:use-decision-list"]
owns: ["apps/desktop/src/features/decisions/live/**", "apps/desktop/src/features/decisions/components/DecisionStates.tsx", "apps/desktop/src/locales/en/decisions-states.json", "apps/desktop/src/locales/pl/decisions-states.json"]
reads: []
design: design.png
design_source: "Decyzje#decis/list-items (skeleton and empty derived) (crop 88,340,367,300 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI013: Decision register states and live updates: empty, no results, loading, error, events

## 1. Summary

Adds the states not drawn in the mock (empty register, no search results, loading, error, no selection) and announces live changes: a new Decision appears, a status or verdict changes.

## 2. Context

VIEWS.md lists: empty register, no results, loading, deleting intentionally absent, proposed awaiting Owner, superseded read-only, filters open. DS064 provides the empty and no-results texts. Events `decision.*` are pushed to the owner; the list and detail refetch through OVE_DECUI002/005, this task adds the user-facing announcement and the connection note.

## 3. Scope (in)

- `DecisionStates` components and `live/states.region.tsx`, `live/live.region.tsx`.
- Announcements through `useDecisionDialogs().announce`.

## 4. Out of scope

- Data hooks (OVE_DECUI002/005).

## 5. Detailed requirements

1. Loading: 6 row skeletons in the list and a detail skeleton (`ui:Skeleton`).
2. Empty register: `Brak Decyzji. Pojawią się po pierwszej Dyskusji lub Decyzji Chiefa.` (list) and `Wybierz Decyzję z listy` (detail).
3. No results: ui `noResults` with `Wyczyść filtry` calling `clearFilters`.
4. Error: list-level error state with `Spróbuj ponownie`; detail-level error separately; stale data keeps showing with a banner `Pokazuję ostatnio wczytane dane`.
5. Live: `decision.recorded` -> polite announcement `Nowa Decyzja: D-18 <title>` (title plainText clamp 80), `decision.status.changed` -> `D-13 przyjęta`, `decision.outcome.verdict_set` -> `Werdykt D-14: mieszany`; batching like OVE_BOARDUI013 (max one per 2 s, aggregate `N zmian w rejestrze`). No toasts.
6. A new Decision never steals selection or scroll: the list updates in place and the selected row stays.
7. Connection `reconnecting` shows a thin note in the list header.
8. All states keep search and filters usable.

## 6. Design notes

`design.png` shows the real rows used as geometry reference for skeleton rows (padding 12 14, three text lines). Empty/error/no-results use `ui:EmptyState` centred in the column; error tone with glyph.

## 7. Reuse

`ui:EmptyState`, `ui:Skeleton`; announcements pattern from OVE_BOARDUI013 (copied logic is NOT allowed: import the pure batching helper `lib:board-live` is feature-local, so this task re-implements the 20-line batcher in `live/batch.ts`; reported to SHELL as a candidate for a shared helper).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/DecisionStates.tsx`, `live/states.region.tsx`, `live/live.region.tsx`, `live/batch.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Event for a Decision in a filtered-out Workspace: list unchanged, announcement suppressed unless it matches the current filters.
- Flood of events: batching.
- Search with no results and an event arrives: still no results.

## 11. Acceptance criteria

- [ ] Given an empty register, Then the empty message shows; given filters with no match, Then `Wyczyść filtry` resets them.
- [ ] Given `decision.recorded`, Then the row appears and a polite announcement is made once.
- [ ] Given the gateway failing, Then the error state with retry shows.
- [ ] Axe clean.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `DecisionStates.test.tsx`, `live.region.test.tsx`, `batch.test.ts`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- Candidate for a shared batching helper (duplicated between BOARDUI013 and DECUI013); reported.
