---
id: OVE_TG010
title: "Send Approval and Access Request bubbles with run-only buttons and opaque callbacks"
area: TG
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH015, OVE_PERM013, OVE_PERM014, OVE_PERM015, OVE_TG004, OVE_TG006, OVE_TG009]
soft_depends_on: []
provides: ["lib:telegram-approval-bubbles"]
needs: ["contract:ApprovalRequest", "contract:AccessRequest", "port:ApprovalRequestReader", "port:Translator", "lib:telegram-formatter"]
owns: ["packages/adapters/telegram/src/approvals/bubbles/**"]
reads: []
design: design.png
design_source: "Telegram#tg/bubble-approval (crop 0,490,390,200)"
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 6, 21]
---

# OVE_TG010: Send Approval and Access Request bubbles with run-only buttons and opaque callbacks

## 1. Summary

Renders an Approval or an Access Request as a Telegram message exactly like the mock (label, title, description with the subject in monospace, buttons 'Zezwól na ten Run' and 'Odmów', and the note that permanent approval is only possible at the computer) and issues the opaque, single-use callback ids behind the buttons.

## 2. Context

Mock bubble: sender label 'Chief', bold title 'Zgoda · Security', text 'Wejście na nową domenę registry.npmjs.org w Run #14.' with the domain in monospace, amber primary button 'Zezwól na ten Run', outlined 'Odmów', small grey note 'Na stałe zatwierdzisz tylko przy komputerze.'. ADR 0006: approvals from Telegram are valid only for the current Run; ADR 0021: some actions always need consent; SEC008 T4: buttons carry opaque server-issued ids.

## 3. Scope (in)

- `ApprovalMessageRenderer` for approval kinds and Access Requests.
- Template registry per action kind.
- Inline keyboard creation with callback ids (TG004 store).
- Not-approvable-from-Telegram variant without buttons.
- Updating the bubble after a decision, expiry or desktop decision (message edit).

## 4. Out of scope

- Handling the button press: TG011. Deciding which kinds are approvable from Telegram: PERM (`telegramApprovable` flag on the action class). Notification pipeline entry: TG013 (sink).

## 5. Detailed requirements

1. **Input view** (read model from PERM, redacted at source): `ApprovalNotificationView = { approvalId, kind: 'approval' | 'access_request', actionKind: string, agentName, runNumber, workspaceId, subject: string /* domain, branch or '~'-shortened display path, already sanitised */, rights?: 'read'|'write'|'execute', expiresAt, telegramApprovable: boolean }`. The adapter never sees commands, diffs or file contents.
2. **Templates** (Polish source, EN in locale; registry keyed by `actionKind`, unknown kinds use the generic one):
   | actionKind | title | body |
   |---|---|---|
   | new_domain | `Zgoda · {{agent}}` | `Wejście na nową domenę <code>{{subject}}</code> w Run #{{run}}.` |
   | git_push | `Zgoda · {{agent}}` | `Wypchnięcie gałęzi <code>{{subject}}</code> w Run #{{run}}.` |
   | delete_files | `Zgoda · {{agent}}` | `Usunięcie plików w Run #{{run}}.` (never lists paths) |
   | budget_exceeded | `Zgoda · {{agent}}` | `Przekroczenie Budżetu w Run #{{run}}.` |
   | access_request | `Prośba o dostęp · {{agent}}` | `Dostęp ({{rights}}) do <code>{{subject}}</code> w Run #{{run}}.` |
   | generic | `Zgoda · {{agent}}` | `Wymagana zgoda: {{label}} w Run #{{run}}.` |
3. **Layout** (HTML via TG009): line 1 `<b>Chief</b>` (the Chief asks on behalf of Agents, as in the mock), line 2 bold title, then the body, then (below the keyboard in Telegram, so part of the same message text as the last line) the note 'Na stałe zatwierdzisz tylko przy komputerze.'. `agentName`, `subject` and `label` go through `sanitizeUntrusted` with caps 40/120/60.
4. **Keyboard:** one row, two buttons: 'Zezwól na ten Run' with `callback_data = <approveId>` and 'Odmów' with `callback_data = <denyId>`; both ids are fresh ULID-based ids (`tcb…`, at most 30 bytes) issued through `TelegramCallbackStore.issue({ action: 'approve_run' | 'deny', approvalId, runId, workspaceId, chatId, expiresAt: min(view.expiresAt, now + 24 h) })` and `attachMessage` after sending. No decision, run id or scope is encoded in the data (T4).
5. **Not approvable from Telegram** (`telegramApprovable: false`: deletion, payments, external messages by default, or the Owner removed the consent requirement only locally, ADR 0021): message without buttons ending with 'Zatwierdź przy komputerze.'. The defaults of which kinds are approvable come from PERM; this task never decides.
6. **Permanent options are never offered:** there is no 'always allow' button or text (mock and ADR 0006); the note is fixed.
7. **Updates of the bubble:** `renderResolved(view, outcome)` is used by TG011 and by the desktop-decided event: removes the keyboard (`editMessageText` with empty `reply_markup`) and replaces the note with one result line: '✓ Zezwolono na ten Run.' / '✗ Odmówiono.' / 'Rozstrzygnięte przy komputerze.' / 'Wygasło.'. All old callback ids of the approval are invalidated (`invalidateForApproval`).
8. **Idempotency:** one bubble per approval (store `approvalId -> messageId`; a retried send after a crash finds the existing message by the callback rows and edits instead of duplicating).
9. The bubble is sent with notification sound (not silent) even under DND (critical kind, OVE_NOTIF002); the sink (TG013) passes `silent: false` for approvals.

## 6. Design notes

`design.png` is the approval bubble of the Telegram mock: label 'Chief', bold 'Zgoda · Security', 'Wejście na nową domenę' then the monospace domain 'registry.npmjs.org' and ' w Run #14.', a row with the amber 40px button 'Zezwól na ten Run' (dark text on amber) and the outlined 'Odmów' button, a small grey note 'Na stałe zatwierdzisz tylko przy komputerze.' and the time 14:20. Real Telegram renders inline buttons in its own style; Overmind controls texts and button labels only. The design-system Telegram preview kit (`ui:TelegramApprovalBubble`, OVE_DS086) mirrors this for docs and stories. States not in the mock: decided (result line replaces the note), expired, decided at the desktop, not approvable (no buttons), pressed (spinner is Telegram's own).

## 7. Reuse

- Formatter builders (TG009), callback store (TG004), `ApprovalRequestReader` and read model (PERM), Translator keys `telegram:approval.*`, `ui:TelegramApprovalBubble` only as the visual reference.

## 8. Architecture and code placement

`packages/adapters/telegram/src/approvals/bubbles/{renderer.ts,templates/<actionKind>.ts,keyboard.ts,resolved.ts}`. One template file per action kind (OCP); the renderer depends on the view type only.

## 9. Security and safety

- ADR 0006/SPEC 16.9: the only offered decision is for the current Run; `scope` is not even a parameter of the keyboard.
- T4: opaque server-side ids, single use, bound to chat and approval, expiring; the callback data cannot be edited into another decision.
- Content minimisation: no commands, diffs, file names or absolute paths; subjects are domains, branch names or `~`-shortened display paths of at most 3 segments.
- Untrusted agent text cannot forge the bubble (TG009 anti-spoofing) and the buttons exist only through this renderer.
- Approvals that ADR 0021 or PERM mark as local-only never get buttons.

## 10. Errors and edge cases

- Approval expires while the message is displayed: TG011 answers 'Wygasło' and the bubble is edited to the expired line.
- Same approval notified twice (retry): one bubble.
- Telegram send fails: no callback rows remain active (issued ids are invalidated when sending fails); the notification stays in the desktop center.
- Owner deletes the message in Telegram: pressing impossible; the approval remains pending at the desktop.
- Two approvals pending: two bubbles, independent ids.
- Name or subject containing HTML or bidi characters: sanitised and escaped.

## 11. Acceptance criteria

- [ ] Given a new_domain approval for registry.npmjs.org in Run 14, Then the message text equals the mock copy (PL) with the domain in `<code>` and two buttons labelled exactly 'Zezwól na ten Run' and 'Odmów'.
- [ ] Callback data of both buttons are distinct opaque ids of at most 30 bytes with no decision encoded.
- [ ] Given `telegramApprovable: false`, Then no keyboard and the line 'Zatwierdź przy komputerze.'.
- [ ] Given an access request, Then the title is 'Prośba o dostęp · <agent>' and the path shown is `~`-shortened.
- [ ] Given the approval resolved at the desktop, Then the bubble is edited, keyboard removed, ids invalidated.
- [ ] No permanent-approval option exists anywhere in the output (test over all templates).
- [ ] English locale renders the same structure.

## 12. Test plan

Unit tests with the real formatter and fake stores: `renderer.test.ts` (golden PL/EN for each template), `keyboard.test.ts`, `resolved.test.ts`, `idempotent-send.test.ts`, `hostile-subject.test.ts`; visual reference compared manually with `design.png` text. Command: `pnpm vitest run packages/adapters/telegram/src/approvals/bubbles`.

## 13. Parallelization notes

Parallel with TG008 after TG009. TG011 consumes the callback ids; TG013's sink calls the renderer.

## 14. Open questions and assumptions

- OPEN: which kinds are approvable from Telegram (ADR 0021 list). DEFAULT: new_domain, git_push, access_request (run only) and budget_exceeded are approvable; delete_files and any payment or external message are local only. PERM owns the flag; Owner confirms.
- ASSUMPTION: the Chief label is used for all bubbles (as in the mock), the Agent name appears in the title.
