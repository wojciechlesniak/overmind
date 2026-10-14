---
id: OVE_NOTIF010
title: "Expose notifications through gateway routes, push events and the api-client"
area: NOTIF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE011, OVE_ENGINE017, OVE_ENGINE019, OVE_NOTIF004, OVE_NOTIF006]
soft_depends_on: []
provides: ["api:notifications.list", "api:notifications.read", "api:notifications.unread-count", "api:notifications.preferences", "lib:api-client-notifications"]
needs: ["lib:route-module", "lib:gateway-principal", "lib:gateway-push", "lib:api-client"]
owns: ["packages/gateway/src/routes/notifications/**", "packages/api-client/src/notifications/**", "packages/contracts/src/notification/api/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 6]
---

# OVE_NOTIF010: Expose notifications through gateway routes, push events and the api-client

## 1. Summary

Gateway routes for the notification center and the notification preferences, push topics for new and changed notifications, and the typed api-client used by the desktop (dashboard panel, rail badge, tray) and by Settings.

## 2. Context

The Pulpit panel, the app badge, the tray and Settings > Powiadomienia all read the same data (SPEC 16.13 parity). The gateway authenticates the principal; this task only declares route modules (auto-registered).

## 3. Scope (in)

- Routes, schemas, error mapping, push topics, api-client.

## 4. Out of scope

- UI components: DS060 and WSPACE/SETUI. Telegram does not browse notifications (it receives them as messages).

## 5. Detailed requirements

1. **Routes:**
   - `GET /v1/notifications?limit&before&unreadOnly` -> `{ items: NotificationView[], nextCursor, unreadCount }` [`api:notifications.list`]
   - `POST /v1/notifications/read` body `{ ids: string[] }` or `{ all: true }` [`api:notifications.read`]
   - `GET /v1/notifications/unread-count` [`api:notifications.unread-count`]
   - `GET /v1/notifications/preferences` -> `{ preferences, allowed, macosPermission: 'granted'|'denied'|'unknown' }` and `PUT /v1/notifications/preferences` (patch) [`api:notifications.preferences`]
2. **Principals:** owner on desktop/tray only. Agent, Chief and Telegram principals get `gateway.forbidden_channel` (agents must not read the Owner's notifications; Telegram must not change alert settings).
3. **Push:** topics `notification.created` (payload `{ view }`) and `notification.changed`; new subscribers receive `{ unreadCount }` first. Views are rendered in the Owner locale; on locale change a `notification.locale_changed` hint makes the client refetch.
4. `macosPermission` comes from `Notifier.requestPermission()` cached for 60 s; the UI uses it for the hint when banners cannot be shown.
5. api-client: `listNotifications`, `markRead`, `markAllRead`, `getUnreadCount`, `getPreferences`, `updatePreferences`, `subscribeNotifications`; all return `Result`.
6. Limits: `limit` 1..100; ids array at most 100; preferences PUT rate limited to 10/min.
7. Schemas live in `contracts/notification/api/` and feed the generated client (ARCH008).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Route-module generator (ARCH009), error mapper (ARCH003), push hub (ENGINE), use cases of NOTIF004/006.

## 8. Architecture and code placement

`packages/gateway/src/routes/notifications/notifications.route.ts` and `preferences.route.ts`; `packages/api-client/src/notifications/`.

## 9. Security and safety

- Strict schemas, channel restriction as above, no free text accepted.
- Views are already redacted (OVE_NOTIF004); the route adds no data.
- Rate limits per principal.

## 10. Errors and edge cases

- `before` malformed: 400.
- Marking ids that do not exist: ignored, no error (idempotent).
- Reconnect: initial unread count plus a refetch hint.
- Preference patch with an invalid combination: `notif.invalid_preference` with the field.

## 11. Acceptance criteria

- [ ] List returns the five mock-like views in order with `unreadCount`.
- [ ] Mark read updates `unread` and pushes `notification.changed`.
- [ ] A Telegram principal receives `gateway.forbidden_channel` on every route.
- [ ] Preferences PUT rejects `approval: center_only`.
- [ ] Generated client types compile.

## 12. Test plan

Route tests with the in-memory gateway harness: `notifications.route.test.ts`, `preferences.route.test.ts`, `principal-filter.test.ts`; api-client tests with a fake transport. Command: `pnpm vitest run packages/gateway/src/routes/notifications packages/api-client/src/notifications`.

## 13. Parallelization notes

Parallel with NOTIF007. Route modules auto-register.

## 14. Open questions and assumptions

- ASSUMPTION: the `/v1` prefix is as in the other areas; ENGINE defines the real framing.
