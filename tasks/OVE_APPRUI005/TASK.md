---
id: OVE_APPRUI005
title: "Approval detail data hook: Approval, Access Request or Escalation with Run context"
area: APPRUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_APPRUI001, OVE_APPRUI002, OVE_BOARDUI001, OVE_CHIEF015, OVE_PERM027, OVE_PERM028]
soft_depends_on: []
provides: ["lib:use-approval-detail"]
needs: ["api:approvals.get", "api:access-requests.get", "api:escalations.list", "api:agents.get", "lib:api-client-approvals", "lib:api-client-access-requests", "lib:use-gateway-resource", "lib:use-run-summary"]
owns: ["apps/desktop/src/features/approvals/state/use-approval-detail.ts", "apps/desktop/src/features/approvals/state/detail-state.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3]
---

# OVE_APPRUI005: Approval detail data hook: Approval, Access Request or Escalation with Run context

## 1. Summary

Loads one inbox item with its preview, Agent and Run context and derives the detail state (`pending`, `submitting`, `decided`, `expired`, `decided-elsewhere`) used by every detail region.

## 2. Context

`GET /v1/approvals/{id}` returns the Approval with its engine-built preview for the Owner; `GET /v1/access-requests/{id}`; Escalations come from the open list. Lazy expiry is evaluated by the engine on every read; the UI also evaluates locally. Telegram or the other channel may decide first: `perm.approval_not_pending` (409) and `perm.approval_expired` (410) must show as states, not errors.

## 3. Scope (in)

- `useApprovalDetail(kind, id)`.
- `detail-state.ts`: a pure state machine `deriveState(item, localMutation)`.

## 4. Out of scope

- Rendering and actions.

## 5. Detailed requirements

1. Resource keys `['approval', id]`, `['access-request', id]`, `['escalation', id]`; invalidated by the matching events; Run context from `useRunSummary(runId)` (`Run #14`, Workflow name and version, node name) and Agent from `AgentRef`.
2. State derivation: `pending` (status pending and `now < expiresAt`), `submitting` (a local decision mutation in flight), `decided` (terminal with `decision` by this window), `decided-elsewhere` (terminal and the decision was made by the other channel or another window, including `consumed`), `expired` (status `expired` or past `expiresAt`), `cancelled` (Run ended) shown as `expired` with the word `anulowana`.
3. `canDecide` is true ONLY when the state is `pending`, the item loaded without error and the engine channel is the desktop; every other case renders no decision controls (fail closed).
4. Detail never fetches or follows anything from the Agent's text; Run/Workflow/node names come from the engine.
5. Errors: `perm.not_found` -> `not found` state; network -> error with retry; permission errors mapped by `renderMessage`.
6. Exposes `shortHash` and the `channel` of an already made decision for the result line.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource` (OVE_BOARDUI001).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-approval-detail.ts`, `state/detail-state.ts` (pure).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Item deleted with its Workspace: not found.
- Decided in Telegram a second before the click: the 409 is turned into `decided-elsewhere`.
- Run finished: pending item becomes `cancelled`.

## 11. Acceptance criteria

- [ ] Given a pending item before `expiresAt`, Then `canDecide` is true.
- [ ] Given `expiresAt` passed, Then state is `expired` and `canDecide` false.
- [ ] Given a decision by `owner_telegram`, Then state is `decided-elsewhere` with the channel word.
- [ ] Given a failed load, Then `canDecide` is false.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `detail-state.test.ts` (table of transitions), `use-approval-detail.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: `GetRunSummary`/`use-run-summary` exposes workflow name, version and node name for the Run context line.
