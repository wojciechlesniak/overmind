---
id: OVE_NOTIF008
title: "Add the configurable Access Request sound signal and reminders"
area: NOTIF
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH012, OVE_NOTIF007]
soft_depends_on: []
provides: ["lib:notification-sounds", "service:NotificationReminders"]
needs: ["port:Clock", "port:Notifier"]
owns: ["packages/contracts/src/notification-sound/**", "packages/application/src/notification-sound/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 18"]
adr_refs: [3]
---

# OVE_NOTIF008: Add the configurable Access Request sound signal and reminders

## 1. Summary

Implements the sound signal for Access Requests and Approvals with a configurable, safe default and optional reminders while the Agent is still waiting. The final kind of sound is an OPEN item (SPEC 18); this task ships a default and the setting, and OVE_NOTIF009 records the decision.

## 2. Context

SPEC 11: an Agent that needs a directory outside the list pauses, 'gives a sound signal and sends a notification (signal OPEN)'. The Settings row says 'Agent czeka, dopóki nie odpowiesz.', so a single sound can be missed when the Owner is away from the desk.

## 3. Scope (in)

- `SoundId` allowlist and defaults.
- Reminder scheduler for unresolved actionable notifications.
- Extension of the preferences sound fields (defined in OVE_NOTIF006).

## 4. Out of scope

- The decision on the sound: OVE_NOTIF009. Playing sound in the macOS adapter: OVE_NOTIF011/012. UI picker: SETUI.

## 5. Detailed requirements

1. `SoundId` is an allowlist of macOS system sound names: `Glass`, `Ping`, `Hero`, `Submarine`, `Funk`, `Sosumi`, `Tink`, `Pop`, `Basso`, plus `default` (the system notification sound). **Default for Access Requests: `Glass`; for Approvals: `Ping`.** Anything else is rejected by the schema (the name is later passed to the OS and must be harmless).
2. The dispatcher passes `sound` (a `SoundId`) to the macOS sink only when `level == sound_banner`. If the Notifier does not support named sounds (capability flag), `default` is used (proposal to ARCH012 for `soundName`, see section 14).
3. **Reminders:** for unresolved `approval_requested` and `access_requested`, `NotificationReminders` re-delivers the banner (with sound) after `reminderMinutes` (default 5) up to 3 times, using Clock timers; stopped when the notification is resolved or read-and-resolved; Global Pause does not stop reminders (the Owner still needs to know). Reminders are suppressed by DND only for non-critical kinds (never for these two). `reminderMinutes: null` disables them.
4. Reminder state is derived, not stored: at start the scheduler recomputes from unresolved actionable rows (`createdAt` and the count of `deliveries` with `reason: 'reminder'`), so a restart neither loses nor doubles reminders.
5. A reminder is a new `DeliveryRecord` on the same notification, not a new notification (no duplicates in the center).
6. The sound is never played for notifications resolved elsewhere (check right before delivery).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Clock` timers, dispatcher and `effectiveDeliveryLevel` (OVE_NOTIF007/002), preferences (OVE_NOTIF006).

## 8. Architecture and code placement

`packages/contracts/src/notification-sound/` (allowlist) and `packages/application/src/notification-sound/{reminders.ts,sound-selection.ts}`.

## 9. Security and safety

- Allowlist prevents injection into the platform call; the sound name is never built from text.
- Reminders ensure an Agent is not left waiting silently, but are capped at 3 to avoid harassment.
- Reminders stop immediately when the request is resolved on any channel.

## 10. Errors and edge cases

- Engine asleep: timers fire after wake; at most one catch-up reminder, not a burst.
- Request resolved while the reminder is in flight: re-check before delivering.
- Owner sets `none`-like behaviour: the way to mute is the `banner` preference (still visible), not removing the signal for Access Requests entirely.

## 11. Acceptance criteria

- [ ] Default sounds are Glass and Ping.
- [ ] An unresolved Access Request produces up to 3 reminders 5 minutes apart and stops on resolution.
- [ ] Restart in the middle keeps the count.
- [ ] An unknown sound name is rejected.
- [ ] Reminders are not shown for resolved requests.

## 12. Test plan

Unit tests with FakeClock: `reminders.test.ts`, `sound-selection.test.ts`, `restart-recompute.test.ts`. Command: `pnpm vitest run packages/application/src/notification-sound`.

## 13. Parallelization notes

After NOTIF007. Proposal file for the Notifier addition is part of this task.

## 14. Open questions and assumptions

- Proposal `tasks/_proposals/OVE_NOTIF008-notifier-sound-name.md`: add optional `soundName?: SoundId` to `Notifier.notify` (additive).
- The choice of sound and whether reminders exist at all is the Owner's (OVE_NOTIF009); defaults stay until then.
