---
id: OVE_TG013
title: "Compose the Telegram channel: factory, engine module and Chief reply delivery"
area: TG
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_ARCH010, OVE_ARCH012, OVE_ENGINE020, OVE_PAUSE005, OVE_TG005, OVE_TG006, OVE_TG007, OVE_TG008, OVE_TG010, OVE_TG011, OVE_TG012]
soft_depends_on: ["OVE_PAUSE008"]
provides: ["lib:telegram-adapter", "lib:telegram-module", "port:TelegramChannel"]
needs: ["port:PauseGate", "port:Keychain", "port:EventBus", "lib:gateway-inprocess-transport", "port:DefineModule"]
owns: ["packages/adapters/telegram/src/index.ts", "packages/adapters/telegram/src/channel/**", "apps/engine/src/composition/modules/telegram.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12"]
adr_refs: [5, 6]
---

# OVE_TG013: Compose the Telegram channel: factory, engine module and Chief reply delivery

## 1. Summary

Wires poller, guard, router, formatter, bubbles, callbacks and routes into one `createTelegramChannel` factory and the engine module; delivers Chief replies and selected notifications to the paired chat.

## 2. Context

ADR 0005: the engine lives without the window; Telegram keeps working with the lid closed (SPEC 12). Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them.

## 3. Scope (in)

- `createTelegramChannel(deps)` factory with start/stop.
- Engine `defineModule` registration and lifecycle.
- Reply delivery of Chief messages that originated from Telegram.
- Behaviour when paused or unpaired.

## 4. Out of scope

- Notification sink: TG016. Notification rules and preferences: NOTIF. Bubble content: TG010.

## 5. Detailed requirements

1. **Lifecycle:** module starts the poller only when a token exists and a pairing exists; subscribes to `telegram.pairing.changed` and token rotation to start/stop; stops on engine shutdown within 5 seconds (abort the long poll).
2. **Reply routing:** a Chief message in a conversation that began from Telegram is formatted by TG009 and sent to the paired chat; messages from the desktop conversation are not mirrored unless they are approvals or notifications below.
3. **Notification sink:** registers with `NotificationDispatcher` as a sink; delivers kinds `approval_requested`, `access_requested`, `escalation_raised`, `run_completed`, `run_failed`, `channel_attention` as one short message (approvals as TG010 bubbles). Never delivers `provider_fallback` or `system_attention` details. Honors DND: critical kinds still delivered, others queued until DND ends.
4. **Pause:** while globally paused the sink still delivers `/pause` confirmations and status; queued replies from stopped runs are dropped.
5. **Failure isolation:** an exception in any inbound handler is caught per update, logged without content, and the poller continues; the channel never crashes the engine.
6. Exports only the factory and types from `index.ts` (`lib:telegram-adapter`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- All TG001-TG012 outputs; `defineModule`; NOTIF sink port.

## 8. Architecture and code placement

`packages/adapters/telegram/src/channel/{telegram-channel.ts,reply-delivery.ts,notification-sink.ts}`; module file only composes. No business rules here.

## 9. Security and safety

- Outbound goes only to the paired chat id read from the repository at send time (re-read to survive unpair).
- Every outbound string passes `assertTelegramSafe`.
- The module registers no HTTP listener (long polling only).

## 10. Errors and edge cases

- Unpair during a send: message dropped, no retry.
- Engine start without network: status `disconnected`, poller retries with backoff.
- Two engine instances: second gets 409, shows `conflict`.
- Sink receives a kind not in the allowed list: ignored.

## 11. Acceptance criteria

- [ ] With token and pairing the poller runs; without them it does not.
- [ ] A Chief reply reaches the fake Telegram chat once.
- [ ] Handler exceptions do not stop polling.
- [ ] Module registers and unregisters cleanly in the composition test.

## 12. Test plan

Integration: `telegram-channel.test.ts`, `module-lifecycle.test.ts`. Command: `pnpm vitest run packages/adapters/telegram/src/channel`.

## 13. Parallelization notes

Last implementation task of the area; TG014 tests it.

## 14. Open questions and assumptions

- OPEN: mirror all desktop Chief output to Telegram? DEFAULT no.
