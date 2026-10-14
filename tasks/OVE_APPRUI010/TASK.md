---
id: OVE_APPRUI010
title: "Access Request detail: rights form, Run-only grant, permanent grant at the computer, deny"
area: APPRUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI003, OVE_APPRUI005, OVE_APPRUI006, OVE_APPRUI012, OVE_BOARDUI001, OVE_DS026, OVE_DS036, OVE_DS055, OVE_DS058, OVE_PERM028, OVE_WSPACE014, OVE_WSPACE015]
soft_depends_on: []
provides: ["lib:access-request-decision"]
needs: ["ui:AccessRequestForm", "ui:ApprovalActions", "api:access-requests.decide", "lib:api-client-access-requests", "lib:use-local-approval", "ui:LocalApprovalDialog", "ui:Dialog", "ui:Textarea", "lib:use-gateway-mutation", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/regions/access-request.region.tsx", "apps/desktop/src/features/approvals/components/AccessRequestPane.tsx", "apps/desktop/src/features/approvals/state/use-decide-access-request.ts", "apps/desktop/src/locales/en/approvals-access.json", "apps/desktop/src/locales/pl/approvals-access.json"]
reads: []
design: design.png
design_source: "Zgody#appr/detail-heading (layout reference; the Access Request form and its states are not drawn in the mock, designed from OVE_DS058) (crop 440,130,992,175 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [3, 6, 21]
---

# OVE_APPRUI010: Access Request detail: rights form, Run-only grant, permanent grant at the computer, deny

## 1. Summary

The pane for `PROŚBA O DOSTĘP`: the canonical path and rights the Agent asked for, the Owner narrowing the rights, the choice `tylko ten Run` (default) versus `stałe w tym Workspace` (desktop, Local Approval), and deny.

## 2. Context

AccessRequest (PERM015): `requested {rawPathDisplay, canonicalPath, rights, justification}`; transitions `granted_run` (any Owner channel, creates a Run grant), `granted_permanent` (ONLY `owner_desktop` with a Local Approval proof; Telegram cannot), `denied`. `grantedRights ⊆ requested.rights`: the Owner can narrow, never widen through this flow (`execute` requests are flagged). `POST /v1/access-requests/{id}/decision { decision:'grant_run'|'grant_permanent'|'deny', grantedRights?, note?, localProof? }`; `grant_permanent` without a valid proof -> 403 `perm.local_approval_required` and a violation is logged. Operation for the proof: `access.grant_permanent` with args `{path, rights, workspaceId}`. DS058 `AccessRequestForm`: mono path tile with origin line, rights checkboxes `Odczyt`/`Zapis`/`Wykonywanie`, duration radio cards.

## 3. Scope (in)

- `AccessRequestPane` mapping the request to `AccessRequestForm`.
- Decision wiring for the three outcomes and the Local Approval path.

## 4. Out of scope

- Managing Allowed Directories in settings (WSPACE).

## 5. Detailed requirements

1. Path tile shows `canonicalPath` display form (Workspace- or `~`-relative as returned) and the Agent's raw text separately labelled `Agent wpisał:` (plain text, <=500 chars, display only; decisions never use it).
2. Rights: the requested rights are pre-checked and marked `żądane`; rights the Agent did not request are NOT offered at all (`AccessRequestForm` contract): the Owner can only uncheck; `Wykonywanie` (execute) carries an amber `uwaga` word; at least one right must remain checked to grant.
3. Duration radio: `tylko ten Run` (default, least privilege) and `stałe w tym Workspace`; the permanent card is disabled with the reason text `Stałe zgody tylko przy komputerze` when the request came through Telegram or when the session is not local; choosing permanent changes the primary button label to `Zezwól na stałe: odczyt` (rights spelled out) and styles nothing else (no hidden state).
4. `Zezwól tym razem`/`Zezwól: odczyt, tylko ten Run` -> `{ decision:'grant_run', grantedRights }` with no proof.
5. Permanent: pressing the permanent primary opens the Local Approval via `useLocalApproval.run({operation:'access.grant_permanent', args:{path: canonicalPath, rights: grantedRights, workspaceId}, target:{kind:'access_request', id}, call: (proof) => decide({decision:'grant_permanent', grantedRights, localProof: proof})})`; the dialog states the folder, the rights and `na stałe w Workspace „{name}”`; nothing is sent before the Owner confirms there; the same frozen args feed the mint and the call.
6. `Odmów z komentarzem` -> `{ decision:'deny', note }` (dialog like OVE_APPRUI008, comment <=500, shown to the Agent).
7. The justification (`justification`, untrusted, <=500) is shown as plain text under a heading `Uzasadnienie Agenta (deklaracja)`; it is never used to prefill anything.
8. Protected locations (`perm.protected_location`) never reach the Owner (the engine refuses at filing); `already_allowed` requests are not created.
9. Errors: `perm.local_approval_required{reason}`, `perm.access_request_not_pending` (-> `decided-elsewhere`), `perm.approval_expired` (-> `expired`), `perm.channel_not_permitted`, `perm.paused` (message for Telegram only, not reachable here); failures change nothing.
10. The Run grant outcome says `Dostęp tylko dla Run #14. Agent może wrócić do pracy.`; permanent says `Katalog dodany do Workspace'u` with the rights.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:AccessRequestForm` (OVE_DS058), `ui:ApprovalActions`, `useLocalApproval`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/access-request.region.tsx` (slot `approval-preview`+`decision` for kind `access`), `components/AccessRequestPane.tsx`, `state/use-decide-access-request.ts`.

## 9. Security and safety

This view is the Owner's security gate (ADR 0003, ADR 0021). Rules enforced here and tested in OVE_APPRUI015: (1) an Approval decided here is bound to its `actionHash` and permits exactly ONE execution of exactly the displayed action (`scope: once`); the decision body has no scope field; (2) the UI never broadens an approval: a permanent effect (lifting an Approval requirement, a permanent directory grant, adding a host to the network allow-list) is a SEPARATE explicit action with its own confirmation and a Local Approval (`useLocalApproval`, bound to the exact arguments, single use, desktop only); no button combines `once` and `permanent`, and no default selects permanent; (3) Telegram can only approve for the current Run; this view therefore labels decisions that came from Telegram and never offers to upgrade them; (4) every text from an Agent (justification, commit subjects, message bodies, paths typed by the Agent) is untrusted and rendered only as plain text, labelled as the Agent's claim, never as HTML or a link made from it; (5) the displayed summary and preview are produced by the engine from structured data, so the UI shows `summary` and structured fields, not text that the Agent supplied; (6) fail closed: if the detail cannot be loaded or has expired, no decision control is rendered. The path and rights in the Local Approval args come from the engine's `canonicalPath` and the Owner's narrowed rights; the UI never sends the Agent's raw path. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Rights narrowed to nothing: submit disabled.
- Request from a Telegram-paired channel decided here: allowed (`grant_run`/`deny`), permanent disabled with the reason.
- A second request for the same path while one is pending: the engine returned the same id; the UI shows one pane.
- Run ended: `cancelled`, no controls.
- Execute right requested: it is pre-checked only because the Agent requested it, carries the warning word `uwaga` and an extra line `Zezwolisz na uruchamianie plików z tego katalogu`.

## 11. Acceptance criteria

- [ ] Given a read-only request, Then only `Odczyt` is offered, pre-checked.
- [ ] Given the default state, Then the choice is `tylko ten Run` and the body has no `localProof`.
- [ ] Given the permanent choice and confirmation in the Local Approval dialog, Then exactly one decision request with `grant_permanent` and `localProof` is sent and `useLocalApproval` was called with `access.grant_permanent`.
- [ ] Given a Telegram-origin request, Then the permanent card is disabled with the reason.
- [ ] Given the Local Approval expiring before the call, Then nothing is granted and the message offers a new confirmation.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `AccessRequestPane.test.tsx` (rights narrowing, defaults, permanent path with fake `useLocalApproval`, Telegram origin). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: `grantedRights` can only be a subset of requested rights (PERM015); widening goes through Workspace settings.
- GAP (reported to WSPACE014): its describer for `access.grant_permanent` must show Workspace, folder (display path) and rights (it does per its requirement 5).
