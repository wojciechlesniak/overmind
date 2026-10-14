---
id: OVE_DECUI008
title: "Proposed Decisions: accept and reject actions with a reason"
area: DECUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DEC011, OVE_DECUI006, OVE_DS013, OVE_DS026, OVE_DS036, OVE_DS037, OVE_DS065]
soft_depends_on: []
provides: ["lib:decision-accept-reject"]
needs: ["ui:DecisionDetail", "ui:Dialog", "ui:Textarea", "ui:Button", "api:decision.status", "lib:api-client-decision", "lib:use-gateway-mutation", "ui:Toast"]
owns: ["apps/desktop/src/features/decisions/regions/status-actions.region.tsx", "apps/desktop/src/features/decisions/dialogs/RejectDecisionDialog.tsx", "apps/desktop/src/features/decisions/state/use-decision-status.ts", "apps/desktop/src/locales/en/decisions-status.json", "apps/desktop/src/locales/pl/decisions-status.json"]
reads: []
design: design.png
design_source: "Decyzje#decis/detail-meta-row (crop 492,131,928,56 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8, 15]
---

# OVE_DECUI008: Proposed Decisions: accept and reject actions with a reason

## 1. Summary

For a Decision in status `proposed` (or `needs_review`) the header shows `Zaakceptuj` and `Odrzuć`; the Owner decides and a reason is recorded as a status event.

## 2. Context

Chief records Decisions within its autonomy and the Owner may accept or reject proposals (ADR 0015). `POST /decisions/:id/status { to: 'accepted'|'rejected'|'needs_review', reason }` is owner-only. VIEWS.md lists `proposed Decision awaiting Owner (accept/reject buttons)` as a state not drawn; DS065 supplies the `onAccept`/`onReject` props. Status changes are append-only events; nothing is edited.

## 3. Scope (in)

- Header actions injected through the detail slot store (`actionsSlot`).
- `RejectDecisionDialog` with a required reason (1..300), accept with an optional reason.
- `useDecisionStatus` mutation hook.

## 4. Out of scope

- Supersede (OVE_DECUI009/010), review date (OVE_DECUI012), marking `needs_review` automatically (engine, DEC010).

## 5. Detailed requirements

1. Show `Zaakceptuj` (primary-violet) and `Odrzuć` (secondary) only when `view.status === 'proposed'`; for `needs_review` show `Potwierdź nadal aktualną` (`to: 'accepted'`, reason optional) and `Odrzuć`. For other statuses render nothing here (the `Zastąp nową Decyzją` button is in OVE_DECUI010).
2. `Zaakceptuj`: opens a small confirm popover `Przyjąć Decyzję D-13?` with optional reason and `Przyjmij`/`Anuluj`; `Odrzuć`: `RejectDecisionDialog` (`ui:Dialog` destructive tone is NOT used: rejecting is a recorded status, not data loss) with a required reason textarea and the note `Odrzucona Decyzja zostaje w rejestrze.`
3. Request body `{ to, reason }` only; header `Idempotency-Key`; `expectedVersion` is not part of the contract (server uses transitions), on `dec.invalid_transition` refetch + toast `Status już się zmienił`.
4. After success: refetch detail and list through events; live announcement `Decyzja D-13 przyjęta`; focus returns to the heading.
5. Accept/reject are disabled while Global Pause is active? NO: they start no work; remain enabled.
6. Buttons carry `aria-describedby` with the line `Zmiana statusu zostaje w historii.`
7. Reject reason is plain text, shown later in the history timeline.

## 6. Design notes

`design.png` shows the header row of D-14: id/Workspace/Run, status pill and the right-aligned `Zastąp nową Decyzją` secondary button. For `proposed` Decisions the DS065 spec puts `Zaakceptuj` (violet) and `Odrzuć` (secondary) in the same place instead; the dialog is derived from ui:Dialog (form).

## 7. Reuse

`ui:Dialog`, `ui:Popover`, `ui:Button`, `ui:Toast`, mutation hook.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-decision-status.ts`, `dialogs/RejectDecisionDialog.tsx`, `regions/status-actions.region.tsx`.

## 9. Security and safety

Only the Owner reaches these routes (gateway enforces); the UI never grants anything. Reasons are untrusted input that Chief may later read; they are stored as data. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Decision accepted elsewhere (Telegram): `invalid_transition`, refetch.
- Empty reject reason: submit disabled.
- Superseded Decision: no actions.

## 11. Acceptance criteria

- [ ] Given a proposed Decision, Then `Zaakceptuj`/`Odrzuć` show and accepting sends `to: accepted` once.
- [ ] Given a reject without a reason, Then submit is disabled.
- [ ] Given a non-proposed Decision, Then neither button shows.
- [ ] Given a conflict, Then a toast explains and the view refetches.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-decision-status.test.tsx`, `RejectDecisionDialog.test.tsx`, `status-actions.region.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: `needs_review` offers `Potwierdź nadal aktualną` (returns it to accepted) because the review date reminder expects an Owner response.
