---
id: OVE_APPRUI002
title: "Approvals inbox data hook: pending, escalations, resolved today, live updates"
area: APPRUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_APPRUI001, OVE_BOARDUI001, OVE_CHIEF015, OVE_CHIEF019, OVE_PERM027, OVE_PERM028, OVE_SHELL011]
soft_depends_on: []
provides: ["lib:use-approval-inbox"]
needs: ["api:approvals.list", "api:access-requests.list", "api:escalations.list", "api:agents.list", "lib:api-client-approvals", "lib:api-client-access-requests", "lib:api-client-chief", "lib:use-gateway-resource", "lib:use-current-workspace-id", "lib:use-run-summary"]
owns: ["apps/desktop/src/features/approvals/state/use-approval-inbox.ts", "apps/desktop/src/features/approvals/state/use-selected-item.ts", "apps/desktop/src/features/approvals/state/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 15]
---

# OVE_APPRUI002: Approvals inbox data hook: pending, escalations, resolved today, live updates

## 1. Summary

Hooks that merge Approvals, Access Requests and open Escalations into one Owner inbox (pending, escalations, resolved today), keep the selected item in the URL and refresh on live events.

## 2. Context

`GET /v1/approvals?status=&workspaceId=&runId=&cursor=&limit=` and `GET /v1/access-requests?...` return items with the Owner scope; `GET /v1/escalations` lists open Escalations (CHIEF015). Events: `approval.requested|decided|expired`, `access_request.requested|decided|expired`, `run.escalated`, `run.escalation_resolved`. The top-bar counter `3 czekają` in the shell is the same population as pending + open escalations. The Owner inbox covers the current Workspace by default; the Approvals view in the mock has no Workspace switcher, so items of all Workspaces the Owner can decide appear (Owner scope), each carrying its Workspace in the detail.

## 3. Scope (in)

- `useApprovalInbox()` returning `{ pending, escalations, resolved, counts, status }`.
- `useSelectedItem()` URL state `?kind=&id=`.

## 4. Out of scope

- Rendering (OVE_APPRUI004), detail loading (OVE_APPRUI005).

## 5. Detailed requirements

1. Three resources: `['approvals','pending']` (`status=pending`), `['access-requests','pending']`, `['escalations','open']`; and `['approvals','resolved-today']` / `['access-requests','resolved-today']` with `status` in the terminal set and a client-side filter on `decidedAt` >= local midnight (limit 50); all invalidated by the events above, coalesced to one refetch per 500 ms.
2. `pending` = merged approvals and access requests sorted by `requestedAt` ascending (FIFO fairness, PERM014: the Owner can decide in any order, the order is only the default); `escalations` sorted by reason priority (`rule_conflict`, `missing_what` first, CHIEF015) then `raisedAt` descending; `resolved` sorted by `decidedAt` descending, max 20 shown.
3. `counts = { pending, escalations, total }`; the page title shows `Zgody i Prośby`, the section label `OCZEKUJĄ · {pending}`.
4. Lazy expiry: a 30 s timer re-evaluates `expiresAt` locally so items past expiry flip to `expired` without waiting for the server sweep, and the next refetch confirms (never shows decision controls for an item known expired).
5. `useSelectedItem()`: `kind` in `approval|access|escalation` and `id` in the URL (deep link from notifications and the top-bar counter); unknown ids clear the selection after load; the first pending item is auto-selected on widths >= 1280 only when no `id` is given.
6. Pause marking: items created during Global Pause carry `paused: true`; the hook exposes it so the list can show the word `wstrzymane`.
7. The hook never decides anything and sends no Workspace id except the optional filter.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource` (OVE_BOARDUI001), mappers (OVE_APPRUI001).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-approval-inbox.ts`, `state/use-selected-item.ts`, `state/index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Hundreds of resolved items: capped at 50 fetched, 20 shown.
- An item decided in Telegram while selected: refetch moves it to resolved and the detail shows `decided-elsewhere` (OVE_APPRUI012).
- Escalations endpoint unavailable: approvals still work; a banner says `Eskalacje chwilowo niedostępne`.
- Clock set back: timer uses monotonic time for countdown labels.

## 11. Acceptance criteria

- [ ] Given an `approval.requested` event, Then the item appears within one refetch and the counts update.
- [ ] Given an item past `expiresAt`, Then it is not in `pending` after the timer tick.
- [ ] Given `?kind=approval&id=apr_1`, Then that item is selected after load.
- [ ] Given a resolved item from yesterday, Then it is not listed.
- [ ] Given an escalation of reason `rule_conflict`, Then it is first in escalations.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-approval-inbox.test.tsx` (merge, order, events, expiry timer), `use-selected-item.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to CHIEF/SHELL): `api-client-chief` must export the escalations client (`list`, `resolve`); the top-bar counter source is assumed to be the same three queries (SHELL `use-top-bar-summary`).
- ASSUMPTION: the Approvals view lists items of all Workspaces for the Owner (no switcher in the mock).
