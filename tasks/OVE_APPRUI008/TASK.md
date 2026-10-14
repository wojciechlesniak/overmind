---
id: OVE_APPRUI008
title: "Decision panel: Zezwól tym razem and Odmów z komentarzem"
area: APPRUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI003, OVE_APPRUI005, OVE_APPRUI006, OVE_APPRUI012, OVE_BOARDUI001, OVE_DS026, OVE_DS036, OVE_DS055, OVE_PERM027]
soft_depends_on: []
provides: ["lib:approval-decision-panel"]
needs: ["ui:ApprovalActions", "ui:ApprovalCard", "lib:approval-conflict-handling", "api:approvals.decide", "lib:api-client-approvals", "ui:Dialog", "ui:Textarea", "lib:use-gateway-mutation", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/regions/decision.region.tsx", "apps/desktop/src/features/approvals/components/DecisionPanel.tsx", "apps/desktop/src/features/approvals/components/DenyDialog.tsx", "apps/desktop/src/features/approvals/state/use-decide-approval.ts", "apps/desktop/src/locales/en/approvals-decision.json", "apps/desktop/src/locales/pl/approvals-decision.json"]
reads: []
design: design.png
design_source: "Zgody#appr/decision-panel + appr/decision-action-primary (crop 452,524,968,134 CSS px) (crop 452,524,968,134 CSS px)"
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 6, 21]
---

# OVE_APPRUI008: Decision panel: Zezwól tym razem and Odmów z komentarzem

## 1. Summary

The decision panel of an Approval: amber `Zezwól tym razem` (one execution of exactly this action), the outline `Odmów z komentarzem` with its dialog, and the footnote that permanent changes exist only at the computer. The permanent option is OVE_APPRUI009.

## 2. Context

`POST /v1/approvals/{id}/decision { decision:'approve'|'deny', note? }` (PERM027): no scope field, `by` derived from the channel (never the body), the approval permits exactly one execution bound to its `actionHash`, lazy expiry, idempotent for the same decision, conflicting decision -> 409 `perm.approval_not_pending`, expired -> 410 `perm.approval_expired`, Global Pause: the desktop Owner can still approve but execution is refused until resume (`perm.paused`, PERM029). The mock panel: three actions and an amber footnote.

## 3. Scope (in)

- `DecisionPanel` composing `ApprovalActions` (`allowOnce`, `denyWithComment`) and the footnote.
- `DenyDialog` (comment 0..500).
- `useDecideApproval` mutation.

## 4. Out of scope

- The permanent action (OVE_APPRUI009), Access Request and Escalation decisions (OVE_APPRUI010, 011).

## 5. Detailed requirements

1. `Zezwól tym razem` sends `{ decision:'approve' }` only (plus optional `expectedActionHash` as an additive safeguard if PERM adopts it, see Open questions); there is NO scope, duration, remember or Workspace field in the body, and no checkbox that changes the meaning of the button.
2. The button label always says what is permitted: `Zezwól tym razem`; below it a mono line `Jedno wykonanie: {summary}`; the button is amber filled 46 px (DS055) and is not auto-focused (initial focus is the heading/Deny so Enter cannot approve by habit).
3. `Odmów z komentarzem` opens `DenyDialog` (`Textarea`, max 500, plain text); submit sends `{ decision:'deny', note }`; the comment is shown to the Agent by the engine as the Owner's note, so the dialog says `Komentarz zobaczy Agent`; an empty comment is allowed (a quick `Odmów` is the same dialog with an empty comment).
4. Double click or Enter repeat: the second call is ignored while `submitting`; the same decision twice is idempotent server-side.
5. Result handling: success -> state `decided` with the result line `Zezwolono na ten Run` / `Odmówiono` (words) and a toast; `perm.approval_not_pending` -> refetch and show `decided-elsewhere` (OVE_APPRUI012); `perm.approval_expired` -> `expired`; `perm.paused` -> a notice `Pauza: zgoda zapisana, ale Agent ruszy dopiero po wznowieniu` is shown when approving succeeded during pause (the engine accepts the decision from desktop); `perm.audit_unavailable` -> error and nothing is changed; `perm.owner_required`/`perm.channel_not_permitted` -> stale session message.
6. The footnote (`Stałe zdjęcie wymogu Zgody zmienia Reguły Właściciela i jest możliwe tylko tutaj, przy komputerze. Z Telegrama zatwierdzasz wyłącznie ten Run.`) is linked with `aria-describedby` to the permanent button when present.
7. No optimistic state: the panel changes only after the engine's answer.
8. Keyboard: Tab order follows the DOM order of the mock (Allow once, Allow permanent when present, Deny); `Esc` in a dialog cancels without a request.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:ApprovalActions`, `ui:ApprovalCard` states (OVE_DS055), `ui:Dialog`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/decision.region.tsx` (slot `decision`), `components/DecisionPanel.tsx`, `components/DenyDialog.tsx`, `state/use-decide-approval.ts`.

## 9. Security and safety

This view is the Owner's security gate (ADR 0003, ADR 0021). Rules enforced here and tested in OVE_APPRUI015: (1) an Approval decided here is bound to its `actionHash` and permits exactly ONE execution of exactly the displayed action (`scope: once`); the decision body has no scope field; (2) the UI never broadens an approval: a permanent effect (lifting an Approval requirement, a permanent directory grant, adding a host to the network allow-list) is a SEPARATE explicit action with its own confirmation and a Local Approval (`useLocalApproval`, bound to the exact arguments, single use, desktop only); no button combines `once` and `permanent`, and no default selects permanent; (3) Telegram can only approve for the current Run; this view therefore labels decisions that came from Telegram and never offers to upgrade them; (4) every text from an Agent (justification, commit subjects, message bodies, paths typed by the Agent) is untrusted and rendered only as plain text, labelled as the Agent's claim, never as HTML or a link made from it; (5) the displayed summary and preview are produced by the engine from structured data, so the UI shows `summary` and structured fields, not text that the Agent supplied; (6) fail closed: if the detail cannot be loaded or has expired, no decision control is rendered. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Approve clicked at the exact second of expiry: 410 -> `expired` state.
- Run cancelled meanwhile: `cancelled` and no controls.
- Telegram decided first: `decided-elsewhere` with the channel word.
- Offline: buttons disabled.

## 11. Acceptance criteria

- [ ] Given a pending git push, Then the panel matches `design.png` within tolerance and the body of approve is exactly `{decision:'approve'}`.
- [ ] Given deny with a comment, Then the body has `note` and no other fields.
- [ ] Given a 409 on approve, Then the state becomes `decided-elsewhere` and no buttons remain.
- [ ] Given the page opened, Then the approve button is not focused.
- [ ] Given the DOM, Then no control combines once and permanent.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `DecisionPanel.test.tsx` (bodies, double click, errors, focus), `DenyDialog.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to PERM): requested additive safeguard `expectedActionHash` on `approvals.decide` (engine answers 409 `perm.approval_mismatch` when it differs from the stored hash). Approval ids are already immutable and bound to the hash, so this only defends against a UI/engine desync; if PERM declines, the UI relies on the id binding.
- ASSUMPTION: during Global Pause the desktop Owner may still approve (PERM029 3); execution is delayed until resume.
