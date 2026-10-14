---
id: OVE_NOTIF006
title: "Define notification preferences and the Settings data contract"
area: NOTIF
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DATA001, OVE_NOTIF002]
soft_depends_on: []
provides: ["contract:NotificationPreferences", "usecase:GetNotificationPreferences", "usecase:UpdateNotificationPreferences", "table:notification_preferences"]
needs: ["lib:sqlite-core", "port:Clock"]
owns: ["packages/contracts/src/notification-preferences/**", "packages/application/src/notification-preferences/**", "packages/adapters/sqlite/src/notification-preferences/**", "packages/adapters/sqlite/migrations/V202610131011__OVE_NOTIF006__notification_preferences.sql"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 11"]
adr_refs: [6]
---

# OVE_NOTIF006: Define notification preferences and the Settings data contract

## 1. Summary

Stores and validates the Owner's notification settings exactly as the Settings > Notifications section needs them: five delivery selects, the 'send also to Telegram' switch, do-not-disturb and the sound choice, with allowed options per row so the UI cannot offer an unsafe value.

## 2. Context

Ustawienia mock section 'Powiadomienia': 'Prośba o dostęp' (Agent czeka, dopóki nie odpowiesz.) = 'Dźwięk + baner'; 'Zgoda' = 'Dźwięk + baner'; 'Eskalacja i błąd Runu' = 'Baner'; 'Zakończenie Runu' = 'Tylko Centrum'; 'Dyskusja zaczęta przez Chiefa' = 'Baner'; switch 'Wysyłaj też na Telegram' with the note 'Zgody z Telegrama działają tylko w bieżącym Runie.'. The UI is built in SETUI; this task is its data contract.

## 3. Scope (in)

- `NotificationPreferences` schema, defaults, per-row allowed options.
- Single-row table and repository.
- `GetNotificationPreferences` and `UpdateNotificationPreferences`.

## 4. Out of scope

- The Settings UI: SETUI. Applying preferences when delivering: OVE_NOTIF007. Sound semantics: OVE_NOTIF008.

## 5. Detailed requirements

1. **Schema:**
   ```ts
   NotificationDelivery = 'sound_banner' | 'banner' | 'center_only'      // 'Dźwięk + baner' | 'Baner' | 'Tylko Centrum'
   NotificationPreferences = {
     access_request: NotificationDelivery,          // default 'sound_banner'
     approval: NotificationDelivery,                // default 'sound_banner'
     escalation_and_error: NotificationDelivery,    // default 'banner'
     run_completed: NotificationDelivery,           // default 'center_only'
     discussion_started: NotificationDelivery,      // default 'banner'
     telegram: { enabled: boolean },                // default true (effective only while paired)
     doNotDisturb: { enabled: boolean, from: 'HH:mm', to: 'HH:mm' },   // default { false, '22:00', '07:00' }
     sound: { accessRequest: SoundId, approval: SoundId, reminderMinutes: 5 | 10 | null }    // see OVE_NOTIF008
   }
   ```
2. **Safety validation (MUST):** `access_request` and `approval` accept only `sound_banner` and `banner` (never `center_only`); an attempt returns `notif.invalid_preference` with `details.field`. The read view includes `allowed: Record<field, NotificationDelivery[]>` so the Settings selects offer only valid options.
3. `doNotDisturb.from/to` match `^([01]\d|2[0-3]):[0-5]\d$`; `from == to` is allowed and means all day (the UI warns).
4. **Table** `notification_preferences(id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT`; absent row means defaults. The table is global (not Workspace-scoped).
5. `UpdateNotificationPreferences` accepts a partial patch, merges, validates the whole, stores atomically and publishes `notification.preferences.changed` (not persisted). Only the Owner on desktop may change preferences (Telegram principals get `gateway.forbidden_channel`; preferences are not permissions), because a stolen phone must not silence the alerts.
6. Reading corrupt JSON returns defaults and logs a warning (fail towards MORE notification).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:sqlite-core`, zod, `lib:notification-rules` DND parser (OVE_NOTIF002).

## 8. Architecture and code placement

Contracts in `packages/contracts/src/notification-preferences/`, use cases in `packages/application/src/notification-preferences/`, adapter in `packages/adapters/sqlite/src/notification-preferences/`.

## 9. Security and safety

- Silencing alerts is a security-relevant change: only the Owner on a desktop-class channel; every change is written to the audit sink (`notification.preferences.updated` with changed field names, not values of nothing sensitive).
- Approvals and Access Requests can never be configured below `banner`.
- Corrupt storage fails towards more notifications.

## 10. Errors and edge cases

- Patch with unknown field: `validation.invalid`.
- Existing stored `center_only` for approval (hand edit): treated as `banner` at read.
- Telegram enabled but not paired: stored true, effective false (reported by OVE_NOTIF007).
- Two quick updates: last write wins; each validated whole.

## 11. Acceptance criteria

- [ ] Defaults equal the mock values.
- [ ] Setting `approval` to `center_only` is rejected.
- [ ] The view lists allowed options per row.
- [ ] Update from a Telegram principal is rejected.
- [ ] An audit event is written per change.
- [ ] Corrupt JSON yields defaults.

## 12. Test plan

Unit and contract tests: `preferences-schema.test.ts`, `update-preferences.test.ts`, `sqlite-preferences.test.ts`. Command: `pnpm vitest run packages/application/src/notification-preferences packages/adapters/sqlite/src/notification-preferences`.

## 13. Parallelization notes

Parallel with NOTIF004/005. Gateway exposure in OVE_NOTIF010.

## 14. Open questions and assumptions

- ASSUMPTION: the Telegram switch defaults to on (effective only after pairing).
