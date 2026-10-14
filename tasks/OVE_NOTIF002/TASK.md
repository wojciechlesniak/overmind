---
id: OVE_NOTIF002
title: "Implement the pure notification rules: dedupe, coalescing and do-not-disturb"
area: NOTIF
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_NOTIF001]
soft_depends_on: []
provides: ["lib:notification-rules"]
needs: ["lib:result"]
owns: ["packages/domain/src/notification/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [6]
---

# OVE_NOTIF002: Implement the pure notification rules: dedupe, coalescing and do-not-disturb

## 1. Summary

Pure functions that decide whether a new notification is a duplicate, whether it coalesces into an existing one, and what do-not-disturb may reduce. The safety rule lives here once: do-not-disturb never suppresses an Approval, an Access Request or an Escalation.

## 2. Context

Without rules the center fills with duplicates (retrying Run, flapping Telegram) and the Owner stops reading it; too much dedupe could hide the one that matters. Pure rules allow exhaustive table and property tests.

## 3. Scope (in)

- `buildDedupeKey`, `decideDedupe`, coalescing windows.
- `effectiveDeliveryLevel(kind, pref, dnd, now)`.
- `isInDndWindow` including windows across midnight.
- Property tests of the safety invariant.

## 4. Out of scope

- Persistence and service: NOTIF003, NOTIF004. Preference storage: NOTIF006. Sound and reminders: NOTIF008.

## 5. Detailed requirements

1. **Dedupe key:** `<kind>:<subject.type>:<subject.id>`; for `run_completed`/`run_failed` add the Run id; `channel_attention:channel:<status>`; `backup_failed:backup:<yyyy-mm-dd>`; `provider_fallback:provider:<providerId>:<yyyy-mm-dd>`; truncated or hashed to 120 chars.
2. **`decideDedupe(existing, draft, now)`** returns `insert | merge(id) | ignore(id)`. Actionable kinds (approval_requested, access_requested, escalation_raised, discussion_started): the same key while unresolved is `ignore` (idempotent producer retry), never `merge`. Coalescing kinds merge inside their window (`count+1`, `updatedAt=now`, unread again): run_completed 60 s, run_failed 300 s, provider_fallback 1 day, channel_attention 1 h, backup_failed 1 day, system_attention 10 min; outside the window `insert`.
3. **Do-not-disturb** (`pref` is `sound_banner | banner | center_only`, OVE_NOTIF006):
   | kind class | result while DND is active |
   |---|---|
   | approval_requested, access_requested, escalation_raised | preference unchanged, never lower than `banner`; the configured sound is kept |
   | all other kinds | `center_only`; Telegram delivery is sent silent |
   Outside DND the result is the preference. The in-app Center records every notification regardless of DND or preference.
4. **Invariant (MUST, property-tested):** for every `critical` kind, every preference in `{sound_banner, banner}`, every DND configuration and time, the result is at least `banner` and keeps the sound when `sound_banner`. A stored `center_only` for these kinds is treated as `banner`.
5. `isInDndWindow({enabled, from:'HH:mm', to:'HH:mm'}, now, timeZone)`: local time in the Owner's IANA zone; `from > to` crosses midnight; `from == to` means all day; end is exclusive; disabled or malformed means false (never 'always on' by mistake).
6. All functions are pure, synchronous, total and take time as an argument (no `Date.now()`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Catalogue (OVE_NOTIF001) for severity, requiresAction, coalesce; Clock value passed by the caller (ARCH007).

## 8. Architecture and code placement

`packages/domain/src/notification/{dedupe.ts,dnd.ts,delivery-level.ts,index.ts}`; contracts only. Delivery code (NOTIF007) MUST call `effectiveDeliveryLevel` and never re-derive.

## 9. Security and safety

- The invariant is the product rule 'Approvals and Access Requests are never silenced'; a failing property test blocks merge.
- Dedupe never hides an unresolved action request.
- Invalid time zone falls back to UTC and the caller logs a warning.

## 10. Errors and edge cases

- Window 22:00-07:00: 23:30 and 06:59 inside, 07:00 outside.
- DST change inside the window (Europe/Warsaw): correct local arithmetic.
- Producer retries one approval notification 10 times: all `ignore`.
- Failures of two different Runs within 5 minutes: two notifications.

## 11. Acceptance criteria

- [ ] Property: no critical kind is delivered below `banner` under any DND configuration.
- [ ] Five `run_completed` for one Run within 60 s give one chain with `count: 5`.
- [ ] Unresolved `access_requested` plus retry with the same key gives `ignore`.
- [ ] DND window boundaries behave as listed; `from == to` is always active.
- [ ] No `Date.now()` in the module (lint).

## 12. Test plan

Unit and property tests: `dedupe.test.ts`, `dnd.test.ts` (DST), `delivery-level.property.test.ts`. Command: `pnpm vitest run packages/domain/src/notification`.

## 13. Parallelization notes

Parallel with NOTIF003. Consumed by NOTIF004, 006, 007, 008.

## 14. Open questions and assumptions

- ASSUMPTION: DND is an in-app time window; macOS Focus is handled by the OS (Time Sensitive level for critical kinds, OVE_NOTIF012).
- OPEN: exempting more kinds from DND? DEFAULT no.
- Coalescing windows are defaults.
