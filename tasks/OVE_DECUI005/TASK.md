---
id: OVE_DECUI005
title: "Decision detail data hook: view, history and linked Decisions"
area: DECUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DEC011, OVE_DECUI001, OVE_DECUI002]
soft_depends_on: []
provides: ["lib:use-decision-detail"]
needs: ["api:decision.get", "api:decision.history", "lib:api-client-decision", "lib:use-gateway-resource"]
owns: ["apps/desktop/src/features/decisions/state/use-decision-detail.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI005: Decision detail data hook: view, history and linked Decisions

## 1. Summary

`useDecisionDetail(id)` loads the folded `DecisionView` and the event history of the selected Decision and refreshes them when `decision.*` events for that Decision arrive.

## 2. Context

`GET /decisions/:id` returns the projection (current status, outcome, proposal, evidence, supersedes/supersededBy refs, `confidenceLabel`, `thin`) and `GET /decisions/:id/history` the append-only events with actor labels. The fold is authoritative on the server; the UI never recomputes status.

## 3. Scope (in)

- `useDecisionDetail(id?)`: `{ view, history, status, error, hasVerdict, refetch }`.
- Event invalidation limited to the selected id.

## 4. Out of scope

- Rendering (OVE_DECUI006), mutations (OVE_DECUI007-010).

## 5. Detailed requirements

1. `useGatewayResource(['decision', id], ...)` and `(['decision-history', id], ...)` with `enabled: !!id`; both invalidated by events `decision.status.changed|outcome.proposed|outcome.verdict_set|review_due|recorded` whose payload `decisionId === id`.
2. `hasVerdict` = history contains an `outcome_verdict` event (see OVE_DECUI001 assumption).
3. `status` is `loading` on first load, `refreshing` afterwards; switching between Decisions keeps the previous detail until the new one arrives (`keepPreviousData`) but the region greys it (`aria-busy`).
4. 404/`dec.not_found` or `dec.workspace_isolated`: status `notFound` (same UI for both, no leak).
5. History is loaded lazily only when the history section is expanded or the Decision is superseded (saves a request): the hook takes `{ withHistory: boolean }`.
6. Linked refs (`supersedes`, `supersededBy`) come embedded in the view; navigating uses `select(id)` of OVE_DECUI002 filters hook.
7. The hook exposes `version` (last event seq) so mutation tasks can detect stale views (`dec.version_conflict`).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource`, DEC api-client (OVE_DEC011).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. File: `state/use-decision-detail.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Event for another Decision: ignored.
- History request fails: detail still renders, history section shows its own retry.
- Decision becomes superseded while open: refetch shows the banner (OVE_DECUI011).

## 11. Acceptance criteria

- [ ] Given an id, Then the view loads once and refetches on its events only.
- [ ] Given a verdict event in history, Then `hasVerdict` is true.
- [ ] Given 404, Then status `notFound`.
- [ ] Given switching ids quickly, Then stale responses are ignored.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-decision-detail.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: history is lazy-loaded.
