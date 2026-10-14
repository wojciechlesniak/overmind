---
id: OVE_CHATUI014
title: "Implement the permanent-grant flow as a Local Approval with an operation summary dialog"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI013, OVE_DS022, OVE_DS024, OVE_DS036, OVE_PERM009, OVE_PERM028]
soft_depends_on: []
provides: ["lib:chat-local-approval"]
needs: ["api:perm.local-confirmation.create", "usecase:RequireLocalProof", "contract:LocalProof", "api:access-requests.decide", "ui:ConfirmDialog", "ui:Dialog", "ui:PathText", "ui:Checkbox"]
owns: ["apps/desktop/src/features/chat/approvals/local/**", "apps/desktop/src/locales/en/chat-014.json", "apps/desktop/src/locales/pl/chat-014.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 6]
---

# OVE_CHATUI014: Implement the permanent-grant flow as a Local Approval with an operation summary dialog

## 1. Summary

Implements the desktop-only path for `Zezwalaj na stałe w tym Workspace` on an Access Request: a confirmation dialog that shows exactly what will be added (path, rights), mints a short-lived Local Confirmation bound to the arguments, then sends `grant_permanent` with the `localProof`. This is the Local Approval of the glossary: never remote, never from Telegram.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. PERM009: `POST /v1/local-confirmations {operation, args, ttlSeconds}` returns `{confirmationId, expiresAt, actionHash}` only for owner on desktop with `local===true`; `RequireLocalProof` checks the proof against the ACTUAL call arguments (hash), one use, session bound, TTL default 60 s; the UI must show the operation summary derived from `args` before calling (WebviewModalPresence semantics). PERM028: `POST /v1/access-requests/{id}/decision {decision:'grant_permanent', grantedRights?, note?, localProof}`.

## 3. Scope (in)

- `PermanentGrantFlow` hook and dialog.
- Rights selection (read, write, execute) with the requested rights preselected.
- Confirmation minting and decision call.
- Error handling for expired or mismatched proofs.

## 4. Out of scope

- Run-scoped grant (CHATUI013).
- The `AccessRequestForm` in the Approvals page (APPRUI).
- Policy lift of Approval requirements (Settings area).

## 5. Detailed requirements

1. Trigger: the card's `allowPermanent` for `access_request` kind opens a `ui:Dialog` (confirm style, not destructive) titled `chat-cards:permanent.title` ('Add this folder permanently?'). Body: workspace name, the path (`ui:PathText`, display form from the engine, full path in the tooltip), requested rights as checkboxes (the Owner may NARROW rights; widening beyond the request is impossible: boxes not requested are not shown), and the sentence `This changes the Workspace's Allowed Directories. Agents will keep this access in every Run.`. Buttons: `Add permanently` (primary violet, never auto-focused: initial focus on the dialog title) and `Cancel`.
2. On confirm: (1) `POST /v1/local-confirmations` with `operation:'permission.allowed_directory.add'` (name as in the PERM `OwnerOperation` registry; use the registry constant, do not invent) and `args:{ accessRequestId, path, rights, workspaceId }` where `path` is the engine's canonical id/ref returned in the request, NOT text typed or parsed by the UI; (2) immediately `POST .../decision {decision:'grant_permanent', grantedRights, localProof:{confirmationId}}` with the same `args` content; the two calls happen within the 60 s TTL; the dialog shows a spinner and disables controls between them.
3. If step 1 fails with `perm.local_approval_required` (not local, session mismatch): show `chat-cards:permanent.notLocal` ('Permanent access can only be granted at this computer.') and keep the card pending; never fall back to a run grant automatically.
4. If step 2 fails with `perm.local_approval_required` (expired, used, mismatch): show `permanent.expired` and offer `Try again` which mints a new confirmation (never reuse the old id).
5. `perm.protected_location` (system folders refused): show the engine's message key and keep the card pending with only the run grant and deny available.
6. Success: the card shows `Zezwolono na stałe w tym Workspace · 14:21 · przy komputerze`; the Workspace Allowed Directory list refreshes through its own event (not this task).
7. The dialog is not reachable from Telegram by definition (desktop UI only); additionally the flow checks `window` channel = desktop through the session capability (`useSessionChannel()` from shell) and hides the permanent action if it is not `desktop`.
8. Rights narrowing: `grantedRights` is sent only if it differs from the requested rights; it is always a subset (validated client-side and by the server).
9. Logging: nothing of path or proof id is logged; the confirmation id is never rendered or put into the DOM.

## 6. Design notes

Not in the mock (E30: Access Request details not drawn). Derived from the kit Dialog (DS036) and the amber card language: dialog uses `Card` tone default, path in mono, rights checkboxes in a row (`Read`, `Write`, `Execute`), footnote `InfoNote`. Copy keys under `chat-cards:permanent.*`.

## 7. Reuse

- `ui:Dialog`/`ui:ConfirmDialog` (OVE_DS036), `ui:Checkbox` (OVE_DS024), `ui:PathText` (OVE_DS022), approvals hook (OVE_CHATUI013).

## 8. Architecture and code placement

`features/chat/approvals/local/`: `usePermanentGrant()` (state machine: idle -> confirming -> minting -> deciding -> done|error), `PermanentGrantDialog`. Owner-only logic lives in the engine; the UI only orchestrates the two calls. **i18n namespace:** this task writes its strings into its own namespace `chat-014` (files `locales/en|pl/chat-014.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-014`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

This is the single desktop path that widens permissions from chat (ADR 0003, 0006, SPEC criterion 9, 10). Controls: operation summary built from the same `args` that are hashed (what the Owner reads is what is bound: the summary is rendered from the `args` object itself, not from separate strings); proof is one use and short lived; never reused across retries; no remote path; Agents and Telegram cannot reach this UI. Prompt injection in the Agent's `justification` is shown as plain text, labelled `Agent says:`, and never influences the preselected rights beyond what the request contains. Audit events are written by PERM.

## 10. Errors and edge cases

- Dialog open for more than 60 s: confirmation is minted only after the click, so there is no stale proof; if the click-to-decision gap exceeds TTL the error path `permanent.expired` applies.
- Request decided elsewhere meanwhile: 409 -> card state refresh, dialog closes with a notice.
- Rate limit on local confirmations (10/min): friendly message.
- Path no longer exists: engine returns a path error key; shown, card stays pending.
- Escape closes the dialog without effect.

## 11. Acceptance criteria

- [ ] `grant_permanent` is never sent without a freshly minted proof for the same arguments.
- [ ] The dialog shows the exact path and rights that will be granted and nothing else is granted.
- [ ] From a non-desktop session the permanent action is absent and, if forced, the server refuses.
- [ ] A failed or expired proof never degrades into a run grant.
- [ ] Cancel and Escape leave no side effect (no confirmation minted).

## 12. Test plan

- Vitest: state machine tests with a fake client (proof expiry, mismatch, retry with a new id, not-local, protected location).
- Playwright scenario `access-request-pending` (CHATUI035): permanent grant happy path and expired proof.
- Security test: assert that no request body contains a scope field other than the contract fields (strict schema check against the route).
- Command: `pnpm --filter @overmind/desktop test features/chat/approvals/local`.

## 13. Parallelization notes

No hotspot besides `chat-cards.json` section `permanent.*`. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the operation name for adding an Allowed Directory comes from PERM009's `OwnerOperation` registry (`lib:perm-owner-operations`); if the registry uses another constant, use it.
- Open question (E30/SPEC 18): default duration and rights UI of Access Requests are undecided; the dialog implements run-vs-permanent only.
