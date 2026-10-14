---
id: OVE_DECUI002
title: "Decision list data hook: search, filters, facets and cursor pagination"
area: DECUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DATA011, OVE_DEC011, OVE_DECUI001, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:use-decision-list"]
needs: ["api:decision.list", "api:decision.facets", "api:workspaces.list", "lib:api-client-decision", "lib:use-gateway-resource", "lib:route-links"]
owns: ["apps/desktop/src/features/decisions/state/use-decision-list.ts", "apps/desktop/src/features/decisions/state/use-decision-filters.ts", "apps/desktop/src/features/decisions/state/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI002: Decision list data hook: search, filters, facets and cursor pagination

## 1. Summary

Hooks that load the Decision Register list across all Workspaces: debounced full-text search, Workspace/status/outcome filters kept in the URL, filter counts from facets and `Pokaż więcej` cursor pagination.

## 2. Context

`GET /decisions?q=&workspaceId=&status=&outcome=&tag=&cursor=&limit=` returns `DecisionSummary` rows (Owner sees all Workspaces including isolated ones; the `Wszystkie Workspace'y` chip means no `workspaceId`). `GET /decisions/facets` returns counts by status and outcome for the chips. The register is append-only (ADR 0008) so lists only grow and change status/outcome through events (`decision.*`).

## 3. Scope (in)

- `useDecisionFilters()` (URL: `?q=&ws=&status=&outcome=&id=`).
- `useDecisionList()` returning rows, facets, status, `loadMore`, `hasMore`.
- Workspace options from `workspaces.list`.

## 4. Out of scope

- Rendering (OVE_DECUI004), the detail (OVE_DECUI005).

## 5. Detailed requirements

1. `useDecisionFilters()` exposes `{ q, workspaceId, status, outcome, selectedId, setQ, setWorkspace, setStatus, setOutcome, select(id), clearFilters }`. Unknown/tampered URL values reset to defaults. `select` replaces the history entry. `q` is limited to 200 chars client-side.
2. Search is debounced 250 ms; the request only fires for the settled value; an empty query removes `q`.
3. `useDecisionList()` uses `useGatewayResource(['decisions', filters], ..., { keepPreviousData: true, invalidateOn: ['decision.recorded','decision.status.changed','decision.outcome.verdict_set','decision.outcome.proposed','decision.review_due'] })`, page size 50; `loadMore()` appends the next cursor page; rows are de-duplicated by id; changing any filter resets pages.
4. Facets: `useGatewayResource(['decision-facets', filters-without-status-and-outcome])` so each chip shows counts that respect the other filters (a chip option with count 0 is disabled with the count shown as `0`).
5. Workspace options: `[ { value: '', label: t('decisions:filter.workspace') }, ...workspaces ]` with names plain text and the word `izolowany` appended for isolated Workspaces (key `decisions:filter.isolated`) so the Owner knows they are visible only to them.
6. Selection: when the list loads and no `id` is set, nothing is auto-selected on narrow lists; on wide windows (`min-width: 1280`) the first row is auto-selected (mock shows D-14 selected). The auto-select is applied only once per route visit.
7. Exposes `totalShown` and the `status` values `loading|ready|error|refreshing|empty|noResults` (`noResults` when filters or `q` are set and the list is empty; `empty` otherwise).
8. Every list request carries no Workspace from the client other than the filter (the Owner scope is established by the gateway).
9. `Idempotency` not relevant (reads only).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource`, `lib:api-client-decision` (OVE_DEC011), workspaces client (OVE_DATA), mappers (OVE_DECUI001).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-decision-filters.ts`, `state/use-decision-list.ts`, `state/index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- `q` with FTS special characters: sent as typed; the engine sanitises (DEC007); the UI never builds FTS syntax.
- Workspace deleted while its id is in the URL: the list returns empty; filter chip shows the raw `Nieznany Workspace`; Owner can clear.
- Rapid typing: only last request result is used.
- Facet request fails: chips still work without counts.
- A row changes status via event while visible: the refetch updates it in place (stable order by `createdAt desc`).

## 11. Acceptance criteria

- [ ] Given typing `date`, Then one request with `q=date` fires after 250 ms and the list shows matches.
- [ ] Given a status filter, Then facets recompute counts for the other chips.
- [ ] Given `loadMore`, Then the next 50 rows append without duplicates.
- [ ] Given an event `decision.status.changed`, Then the visible row updates after one refetch.
- [ ] Given tampered URL params, Then defaults apply.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-decision-filters.test.tsx` (URL round trip, defaults), `use-decision-list.test.tsx` (debounce, paging, facets, events). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: page size 50 (matches DS064 note).
- ASSUMPTION: auto-select of the first row only at widths >= 1280.
