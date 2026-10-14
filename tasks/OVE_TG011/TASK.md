---
id: OVE_TG011
title: "Handle approval button callbacks: claim once, decide with run scope, edit the bubble"
area: TG
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE016, OVE_ENGINE019, OVE_ENGINE020, OVE_PAUSE005, OVE_PERM027, OVE_PERM028, OVE_TG001, OVE_TG006, OVE_TG010]
soft_depends_on: ["OVE_PAUSE005"]
provides: ["lib:telegram-callback-handler"]
needs: ["api:approvals.decide", "api:access-requests.decide", "port:PauseGate", "port:TelegramCallbackStore", "lib:api-client", "lib:gateway-inprocess-transport", "port:AuditSink"]
owns: ["packages/adapters/telegram/src/approvals/callbacks/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 8"]
adr_refs: [3, 6, 25]
---

# OVE_TG011: Handle approval button callbacks: claim once, decide with run scope, edit the bubble

## 1. Summary

Turns a tap on an Approval or Access Request bubble into one gateway decision limited to the current Run, with single-use callback ids, conflict handling and an edited bubble that shows the outcome.

## 2. Context

ADR 0006 and 0003: Telegram carries lesser rights; a tap may approve only for this Run, never create a persistent rule. Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. T4-T6: callback data is an opaque id, claimed atomically, bound to the paired chat, expiring after 24 hours.

## 3. Scope (in)

- Callback query dispatch for actions `allow_run`, `deny`.
- Atomic claim, decision call, bubble edit, `answerCallbackQuery`.
- Handling of stale, used, expired, wrong-chat, paused and conflict outcomes.
- Audit entries.

## 4. Out of scope

- Bubble creation: TG010. Persistent rules and "allow always": desktop only. Guard and rate limits: TG006.

## 5. Detailed requirements

1. **Dispatch:** TG006 hands over a `callback_query` only after sender authorisation. The handler calls `TelegramCallbackStore.claim(id, chatId, now)`. `unknown|used|expired|wrong_chat` all produce the same short toast 'Ta zgoda jest już nieaktualna' (`answerCallbackQuery`, no alert) and an audit entry with the reason; no detail goes to the chat.
2. **Decision:** `allow_run` calls the gateway decision API with `scope: 'run'` and a fixed `decidedVia: 'telegram'`; the router never sends any other scope (a type-level literal and a test). `deny` calls the same API with `decision: 'deny'`. For Access Requests only `allow_run` and `deny` exist; the scope never widens.
3. **Pause:** when `PauseGate` reports paused for the Workspace, `allow_run` is rejected locally with the toast 'Overmind jest wstrzymany' and the callback is released (`release(id)`) so the Owner can retry after resume; `deny` is always allowed (PAUSE design: approvals blocked, deny allowed).
4. **Conflict:** if the approval was already decided on the desktop (`approval.already_decided`) the bubble is edited to show who decided ('Rozstrzygnięto na komputerze') and buttons are removed; no second decision is sent. Network or engine errors release the callback and show 'Spróbuj ponownie'.
5. **Edit:** on success `editMessageText` replaces the buttons with an outcome line ('Zezwolono dla tego Runa' / 'Odmówiono') using TG009 formatting; a failed edit is logged and ignored (the decision stands).
6. After any decision `invalidateForApproval(approvalId)` removes remaining callbacks of that approval (the sibling button).
7. Every tap writes an audit entry `telegram.approval.decided` with approval id, outcome, source; no message text.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `TelegramCallbackStore` (TG001, TG004), formatter (TG009), api-client and in-process transport, `PauseGate`.

## 8. Architecture and code placement

`packages/adapters/telegram/src/approvals/callbacks/{callback-handler.ts,outcomes.ts,index.ts}`. Depends on application ports only, never on gateway internals.

## 9. Security and safety

- T4: callback data carries only the opaque id; all meaning is looked up server-side.
- T5: claim is atomic and single use; double taps and replays are no-ops.
- T6: scope is hard-coded to `run`; Telegram can never grant a persistent right.
- A tap from another chat or user never reaches this handler (TG006) and a mismatched chat in `claim` is `wrong_chat`.

## 10. Errors and edge cases

- Two quick taps on both buttons: first wins, second sees `used`.
- Approval expired while the bubble was open: engine returns expired; bubble edited to 'Wygasła'.
- Callback arrives after unpair: dispatch is dropped by TG006; callbacks were deleted by TG015.
- Edit message returns 'message to edit not found': ignored.

## 11. Acceptance criteria

- [ ] Allow-run produces exactly one decision call with `scope: 'run'`; no code path can send another scope.
- [ ] Replay of the same callback id makes no second call and shows the stale toast.
- [ ] While paused allow is refused and the callback stays usable; deny works.
- [ ] Desktop-decided approval leads to an edited bubble without a decision call.
- [ ] Audit entries exist for every outcome and contain no message body.

## 12. Test plan

Integration with fake Telegram API and fake gateway: `callback-run-scope.test.ts`, `callback-replay.test.ts`, `callback-paused.test.ts`, `callback-conflict.test.ts`. Command: `pnpm vitest run packages/adapters/telegram/src/approvals/callbacks`.

## 13. Parallelization notes

Parallel with TG012 and TG013 after TG010. TG013 wires it.

## 14. Open questions and assumptions

- ASSUMPTION: the decision API accepts `decidedVia`; if APPR has not defined it, propose an additive field to the APPR owner.
- OPEN: should deny while paused be silent? DEFAULT no, it works normally.
