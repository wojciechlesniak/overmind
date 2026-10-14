---
id: OVE_NOTIF007
title: "Build the delivery pipeline: in-app, macOS and Telegram sinks honouring preferences"
area: NOTIF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH012, OVE_ARCH015, OVE_NOTIF004, OVE_NOTIF006, OVE_TG005]
soft_depends_on: []
provides: ["port:NotificationDispatcher", "port:NotificationSink", "service:NotificationDispatcher"]
needs: ["port:Notifier", "port:Translator", "port:Clock", "port:Logger", "port:ChannelStatusReader"]
owns: ["packages/application/src/ports/NotificationDispatcher.ts", "packages/application/src/ports/NotificationSink.ts", "packages/application/src/notification-delivery/**", "apps/engine/src/composition/modules/notification.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 5"]
adr_refs: [6]
---

# OVE_NOTIF007: Build the delivery pipeline: in-app, macOS and Telegram sinks honouring preferences

## 1. Summary

Delivers each created notification to the right channels: the in-app center (always), a macOS banner and sound through the `Notifier` port, and Telegram through a sink the TG area registers. Honours preferences and do-not-disturb through the single rule function and records a delivery result per channel.

## 2. Context

Delivery channels (SPEC 12, ADR 0006): in-app center, macOS notification, Telegram where allowed. Banner and sound for Access Requests are the main signal that an Agent is waiting. A delivery failure must never lose the notification or break the flow that raised it (ARCH012: failure to notify never blocks the underlying flow).

## 3. Scope (in)

- `NotificationDispatcher` and `NotificationSink` ports (multi-token for sinks).
- Dispatcher logic and delivery records.
- In-app sink and macOS sink (uses `Notifier`).
- Boot catch-up; the notification module wiring.

## 4. Out of scope

- The Telegram sink (formatting, buttons): OVE_TG013 registers it. macOS implementation: OVE_NOTIF011/012. Sounds and reminders: OVE_NOTIF008.

## 5. Detailed requirements

1. **Ports:**
   ```ts
   interface NotificationSink { readonly channel: 'in_app'|'macos'|'telegram'; deliver(n: Notification, view: NotificationView, opts: { level: NotificationDelivery; silent: boolean; sound: SoundId|null }): Promise<Result<void>> }
   export const NotificationSinksToken = multiToken<NotificationSink>('port:NotificationSink');
   interface NotificationDispatcher { dispatch(n: Notification): Promise<void> }     // never throws
   ```
2. **Algorithm per notification:** load preferences; `level = effectiveDeliveryLevel(kind, prefFor(prefGroup), dnd, now)` (OVE_NOTIF002; the ONLY place this is derived); in-app sink always (the view is pushed through the gateway, OVE_NOTIF010); macOS sink when `level != center_only`, with `sound` only when `level == sound_banner`; Telegram sink when the catalogue `telegram != none` AND `prefs.telegram.enabled` AND the channel is `connected` and paired (`ChannelStatusReader`), `silent` when DND is active; sinks run in parallel with a 5 s timeout each.
3. Each result is stored as a `DeliveryRecord` (`sent|skipped|failed` with reason `preference|dnd|unpaired|unavailable|error`). A failed sink is retried once after 30 s and then left `failed`; the notification stays in the center. A failure raises no new notification except through the existing `channel_attention` rule.
4. **Content rules:** the macOS and Telegram text is rendered by the view renderer in the Owner's locale, passes `redactForBanner` (lib:redaction + no absolute paths + length 100 title / 200 body) and for Telegram additionally `assertTelegramSafe` (ARCH015) inside the Telegram sink.
5. No approve or deny action buttons in macOS notifications (ARCH012, ADR 0006); the banner click opens the app at `view.target`.
6. **Boot catch-up:** at start, rows created within the last 10 minutes with no `DeliveryRecord` are dispatched once; older ones are not re-announced.
7. Under Global Pause delivery continues (notifications are not work).
8. `notification.module.ts` provides dispatcher and rules registry, requires `NotificationSinksToken` (collect), preferences, repository, Notifier.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Notifier` (ARCH012), `effectiveDeliveryLevel` (OVE_NOTIF002), view renderer (OVE_NOTIF004), `multiToken`, redaction (ARCH004), `assertTelegramSafe` (ARCH015).

## 8. Architecture and code placement

`packages/application/src/notification-delivery/{dispatcher.ts,in-app.sink.ts,macos.sink.ts,catch-up.ts}`; ports in `ports/`; Telegram sink lives in `adapters/telegram`. The dispatcher knows sinks only by interface (DIP, OCP).

## 9. Security and safety

- Banners reach the lock screen: content is minimal, redacted and path-free; critical kinds still deliver under DND by rule.
- Telegram delivery respects `telegramSafe` filtering; Owner-only data never goes out.
- Sink errors are mapped to codes and never contain tokens or message text in logs.
- Preferences cannot be bypassed by producers; only this dispatcher calls sinks.

## 10. Errors and edge cases

- Notifier permission denied: macOS result `failed/unavailable`, in-app unaffected; the Settings UI shows a hint (OVE_NOTIF010 status).
- Telegram down: `skipped/unavailable`, no retry storm.
- Dispatch called twice for the same notification (retry): second call is a no-op when delivery records exist.
- Preference changes between create and dispatch: the latest preferences apply.
- 100 notifications in a burst: the macOS sink rate-limits to 1 banner per 2 s and folds the rest into 'N nowych powiadomień' (one banner).

## 11. Acceptance criteria

- [ ] Given an Access Request with `sound_banner`, Then the macOS sink is called with sound and the in-app sink once.
- [ ] Given DND active, Then a `run_completed` is center only and an Access Request still banners with sound.
- [ ] Given Telegram disabled in preferences, Then the Telegram sink is skipped with reason `preference`.
- [ ] A throwing sink does not affect the others and is recorded `failed`.
- [ ] Given a crash after create, Then catch-up delivers once.
- [ ] Delivery continues during Global Pause.

## 12. Test plan

Unit tests with fake sinks and fake Notifier: `dispatcher.test.ts` (matrix of kinds x DND x preferences), `catch-up.test.ts`, `burst-folding.test.ts`; integration with the real rules and in-memory repository. Command: `pnpm vitest run packages/application/src/notification-delivery`.

## 13. Parallelization notes

Port files first in a tiny PR (NOTIF004 consumes the dispatcher). TG013 and NOTIF011/012 implement sinks/notifier later.

## 14. Open questions and assumptions

- ASSUMPTION: macOS banners are folded after bursts; thresholds are defaults.
