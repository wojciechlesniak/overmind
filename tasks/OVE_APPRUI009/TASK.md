---
id: OVE_APPRUI009
title: "Permanent allow for an Approval class: separate explicit action with Local Approval"
area: APPRUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI003, OVE_APPRUI008, OVE_BOARDUI001, OVE_DS036, OVE_DS055, OVE_PERM026, OVE_WSPACE014, OVE_WSPACE015]
soft_depends_on: []
provides: ["lib:approval-permanent-allow"]
needs: ["api:perm.overrides", "api:perm.policies", "lib:api-client-perm", "lib:use-local-approval", "ui:LocalApprovalDialog", "ui:ConfirmDialog", "ui:ApprovalActions", "lib:use-gateway-mutation", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/components/PermanentAllowDialog.tsx", "apps/desktop/src/features/approvals/state/use-permanent-allow.ts", "apps/desktop/src/features/approvals/model/permanent-policy.ts", "apps/desktop/src/locales/en/approvals-permanent.json", "apps/desktop/src/locales/pl/approvals-permanent.json"]
reads: []
design: design.png
design_source: "Zgody#appr/decision-panel (the outline `Zezwalaj na git push w tym Workspace`; the confirmation dialog is not drawn in the mock) (crop 452,524,968,134 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [3, 21]
---

# OVE_APPRUI009: Permanent allow for an Approval class: separate explicit action with Local Approval

## 1. Summary

The outline action `Zezwalaj na git push w tym Workspace`: for the classes where a permanent effect exists it opens a dialog that states exactly what will change, then runs the change through `useLocalApproval` (bound to the exact arguments); it never decides the pending Approval itself.

## 2. Context

ADR 0021: the default Approval list can be relaxed only locally. PERM012: `PUT /v1/permissions/approval-overrides/{actionClass}` body `{workspaceId|null, ownerRuleId?, localProof}`, operation `override.lift` with args `{actionClass, workspaceId}`, only for `liftable` classes (`delete_files`, `git_push`, `publish`, `external_message`, `new_domain`; NOT `payment`, `budget_overrun`). For `new_domain` the permanent form in the design says the host joins the Workspace network allow-list, which is a policy widening (`policy.widen`, local proof), not a lift of the requirement for every domain. WSPACE014 provides `useLocalApproval().run({operation, args, target, call})` and `LocalApprovalDialog`; the proof is single use, bound to the args hash, expires in 60 s, desktop only. Decisions that widen can never come from Telegram.

## 3. Scope (in)

- `permanent-policy.ts`: pure table class -> permanent action descriptor.
- `PermanentAllowDialog` and `usePermanentAllow`.
- Wiring of the `allowPermanent` action of the decision panel (provided here through the dialogs context).

## 4. Out of scope

- Permanent directory grants for Access Requests (OVE_APPRUI010).

## 5. Detailed requirements

1. Descriptor table (single source, OCP): `git_push` -> `override.lift` `{actionClass:'git_push', workspaceId}` with label `Zezwalaj na git push w tym Workspace`; `publish`, `external_message` likewise (`Zezwalaj na publikację w tym Workspace`, `...na wysyłanie wiadomości w tym Workspace`); `new_domain` -> `policy.widen` adding exactly this host to the Workspace network allow-list (`Zezwalaj na {host} w tym Workspace`; no wildcard, no sibling domains); `delete_files` -> NO permanent option by default (DS058; high risk), `payment`, `budget_overrun`, unknown classes -> none. The descriptor also says `workspaceId = the item's Workspace` (never global `null` from this UI in MVP).
2. The outline button is rendered only when the descriptor exists AND the Approval is `pending` AND the app runs with the local desktop session (`isLocalSession`); otherwise it is absent and the footnote explains `możliwe tylko przy komputerze`.
3. Pressing it does NOT decide the Approval and does NOT approve this Run: it opens `PermanentAllowDialog` with a plain-words summary (`Od teraz Agenci w Workspace „{name}” będą mogli wykonywać git push bez pytania. Ta zmiana dotyczy wszystkich przyszłych Runów i zmienia Reguły Właściciela.`), the Workspace name, the class word and a clear statement that THIS pending request is decided separately, with `Anuluj` as the initial focus.
4. Confirm runs `useLocalApproval.run({ operation, args, target, call })` where `call(proof)` performs the PUT (or policy PUT) with `localProof:{confirmationId}`; the dialog of WSPACE015 shows the operation summary derived from `args` and the countdown; the proof is never stored or logged by this feature.
5. After success the Approval itself stays pending: the panel shows `Zmieniono Reguły Właściciela. Ta prośba nadal czeka: zdecyduj osobno.` and the Owner presses `Zezwól tym razem` or `Odmów`; (the engine will also stop requiring approval for FUTURE actions of that class).
6. Errors: `perm.local_approval_required{reason}` mapped by the Local Approval client (expired/used/mismatch/session); `perm.override_not_allowed` (class not liftable: message and the option disappears); `perm.channel_not_permitted`; rate limit; every failure leaves everything unchanged and the Approval pending.
7. A restore path exists elsewhere (Rules UI removes the override without proof); this task links to `Reguły Właściciela` in the success notice.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useLocalApproval` and `LocalApprovalDialog` (WSPACE014/015), `ui:ConfirmDialog`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `model/permanent-policy.ts`, `components/PermanentAllowDialog.tsx`, `state/use-permanent-allow.ts`. Registers the `allowPermanent` action into the decision panel through the dialogs context (`openPermanent(id)`), without editing `DecisionPanel.tsx`.

## 9. Security and safety

This view is the Owner's security gate (ADR 0003, ADR 0021). Rules enforced here and tested in OVE_APPRUI015: (1) an Approval decided here is bound to its `actionHash` and permits exactly ONE execution of exactly the displayed action (`scope: once`); the decision body has no scope field; (2) the UI never broadens an approval: a permanent effect (lifting an Approval requirement, a permanent directory grant, adding a host to the network allow-list) is a SEPARATE explicit action with its own confirmation and a Local Approval (`useLocalApproval`, bound to the exact arguments, single use, desktop only); no button combines `once` and `permanent`, and no default selects permanent; (3) Telegram can only approve for the current Run; this view therefore labels decisions that came from Telegram and never offers to upgrade them; (4) every text from an Agent (justification, commit subjects, message bodies, paths typed by the Agent) is untrusted and rendered only as plain text, labelled as the Agent's claim, never as HTML or a link made from it; (5) the displayed summary and preview are produced by the engine from structured data, so the UI shows `summary` and structured fields, not text that the Agent supplied; (6) fail closed: if the detail cannot be loaded or has expired, no decision control is rendered. The args passed to the Local Approval are built from the ENGINE-provided item (class and Workspace id), never from text in the UI or the Agent; the same frozen object is shown in the dialog and sent in the PUT (WSPACE014 binding). All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Workspace deleted meanwhile: PUT fails with not found, nothing changes.
- Approval already decided elsewhere: the dialog is closed and the state updates.
- Override already exists: `perm.override_*` idempotent; message `Już zezwolono`.
- Host with unusual TLD/IDN: shown in punycode and Unicode forms.

## 11. Acceptance criteria

- [ ] Given a pending git push, Then the outline button `Zezwalaj na git push w tym Workspace` is present and the dialog states the future effect.
- [ ] Given confirmation, Then `useLocalApproval.run` is called once with `override.lift` and `{actionClass:'git_push', workspaceId}` and the PUT carries `localProof`.
- [ ] Given `payment`, Then no permanent option is rendered.
- [ ] Given the request fails, Then the Approval remains pending and unchanged.
- [ ] Given a Telegram-origin item, Then the permanent action is not offered.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `permanent-policy.test.ts` (table), `PermanentAllowDialog.test.tsx` with a fake `useLocalApproval`, `use-permanent-allow.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to PERM): the `OwnerOperation` list has no `policy.widen` args schema for `network allow-list add host`; this task assumes args `{workspaceId, capability:'network', host}` and reports it so PERM011 can define it.
- ASSUMPTION: `new_domain` permanent means one exact host, not lifting the whole class (the mock footnote and DS058 say `adds the domain to the Workspace network allow-list`). Needs the Owner's confirmation; liftable class semantics are kept for the other classes.
- GAP: Owner confirmation text for `override.lift` classes should be defined by WSPACE014 describers (`override.lift` row exists); `policy.widen` host row needs a describer.
