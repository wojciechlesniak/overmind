---
id: OVE_TG016
title: "Deliver notifications to Telegram: notification sink with DND and pause rules"
area: TG
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_NOTIF007, OVE_PAUSE005, OVE_TG010, OVE_TG013]
soft_depends_on: ["OVE_NOTIF007"]
provides: ["lib:telegram-notification-sink"]
needs: ["port:NotificationSink", "port:NotificationDispatcher", "port:PauseGate"]
owns: ["packages/adapters/telegram/src/channel/notification-sink.ts", "packages/adapters/telegram/src/channel/notification-sink.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12"]
adr_refs: [6]
---

# OVE_TG016: Deliver notifications to Telegram: notification sink with DND and pause rules

## 1. Summary

Registers Telegram as a sink of the NOTIF dispatcher so the Owner gets the important events on the phone.

## 2. Context

Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. NOTIF defines kinds, dedupe and DND; this task only maps them to messages.

## 3. Scope (in)

- `NotificationSink` implementation.
- Kind to message mapping.
- DND and pause behaviour.

## 4. Out of scope

- Rules and preferences: NOTIF. Approval bubble content: TG010.

## 5. Detailed requirements

1. Delivers kinds `approval_requested`, `access_requested` (as TG010 bubbles), `escalation_raised`, `run_completed`, `run_failed`, `channel_attention` as one short message through TG009. Never delivers `provider_fallback`, `backup_failed` or `system_attention` details.
2. DND: critical kinds are still delivered; others are held and sent as one digest when DND ends.
3. While globally paused new approval bubbles are not created; completion messages of stopped Runs are dropped.
4. A failed send (blocked bot, network) reports `channel_attention` once and does not retry more than 3 times with backoff.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- TG009 formatter, TG010 bubbles, NOTIF sink port.

## 8. Architecture and code placement

`packages/adapters/telegram/src/channel/notification-sink.ts`; registered in the TG013 module.

## 9. Security and safety

- Messages contain titles only, no file contents or command output; all text passes `assertTelegramSafe`.

## 10. Errors and edge cases

- Kind not in the list: ignored.
- Unpaired: sink returns not-delivered without error.

## 11. Acceptance criteria

- [ ] Each allowed kind produces one message; disallowed kinds none.
- [ ] DND holds non-critical kinds and critical pass.
- [ ] Paused: no new approval bubbles.

## 12. Test plan

Unit with fakes: `notification-sink.test.ts`. Command: `pnpm vitest run packages/adapters/telegram/src/channel/notification-sink.test.ts`.

## 13. Parallelization notes

After TG013; parallel with TG014.

## 14. Open questions and assumptions

- None.
