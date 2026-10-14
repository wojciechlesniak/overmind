---
id: OVE_APPRUI012
title: "Decision outcomes: expired, decided elsewhere, paused and permission errors as states"
area: APPRUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI001, OVE_APPRUI003, OVE_APPRUI005, OVE_DS040, OVE_DS055, OVE_SHELL004]
soft_depends_on: []
provides: ["lib:approval-conflict-handling"]
needs: ["ui:ApprovalCard", "ui:InfoNote", "lib:use-approval-detail", "lib:ui-error-mapper", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/model/decision-errors.ts", "apps/desktop/src/features/approvals/components/DecisionResultLine.tsx", "apps/desktop/src/locales/en/approvals-results.json", "apps/desktop/src/locales/pl/approvals-results.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 6]
---

# OVE_APPRUI012: Decision outcomes: expired, decided elsewhere, paused and permission errors as states

## 1. Summary

One place that turns engine answers (409 already decided, 410 expired, paused, forbidden, audit unavailable) into detail states and result lines for all three decision kinds, so the conflict behaviour is identical.

## 2. Context

Several actors can decide the same item: the desktop, Telegram (current Run only) and expiry. PERM014/015/027/028 define `perm.approval_not_pending` (409), `perm.approval_expired` (410), `perm.access_request_not_pending`, `perm.paused`, `perm.local_approval_required`, `perm.channel_not_permitted`, `perm.owner_required`, `perm.audit_unavailable`. The mock design states list `Item expired / decided elsewhere (Telegram) conflict` as NOT drawn.

## 3. Scope (in)

- `decision-errors.ts` (pure mapping error code -> `{ nextState, messageKey, retryable, refetch }`).
- `DecisionResultLine` (word + time + channel via `OriginLine`).

## 4. Out of scope

- The decision actions themselves.

## 5. Detailed requirements

1. Mapping table: `approval_not_pending|access_request_not_pending` -> `decided-elsewhere` + refetch (the result line shows who decided: `Zezwolono z Telegrama · 13:41`); `approval_expired` -> `expired`; `paused` -> notice (no state change); `local_approval_required{reason}` -> stay `pending` with the reason message and a `Spróbuj ponownie` for `expired` only; `channel_not_permitted|owner_required` -> `Sesja nie ma uprawnień do tej zgody`, stay pending; `audit_unavailable` -> `Nie udało się zapisać decyzji. Nic nie zmieniono.`; everything else generic.
2. The result line always carries WORDS: `Zezwolono na ten Run`, `Zezwolono na stałe`, `Odmówiono`, `Wygasła`, `Anulowana`, plus the time and the origin (`z desktopu`, `z Telegrama`).
3. Telegram-decided results say explicitly `tylko dla tego Runa` for approvals and `tylko ten Run` for access requests (what Telegram can do).
4. A decision made in this window is announced politely once.
5. The mapping is consumed by OVE_APPRUI008, 009, 010 and 011 through `lib:approval-conflict-handling` (they depend on this task; it depends only on the mappers and the detail hook, so the graph stays acyclic).
6. Unknown codes show a generic message with the code in a tooltip (code only, no server text).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:InfoNote`, `OriginLine`, shared `ui-error-mapper` (SHELL).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `model/decision-errors.ts` (pure), `components/DecisionResultLine.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Both 409 and 410 conditions at once: expired wins.
- Result time in the Owner's locale and zone.

## 11. Acceptance criteria

- [ ] Given a 409 on approve, Then the state is `decided-elsewhere` with the channel word.
- [ ] Given a 410, Then `expired`.
- [ ] Given `local_approval_required{reason:'expired'}`, Then the item stays pending and offers a retry.
- [ ] Given an unknown code, Then no server text is shown.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `decision-errors.test.ts` (table-driven), `DecisionResultLine.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: tasks 008-011 import this mapper and depend on it; the id order is not the build order.
