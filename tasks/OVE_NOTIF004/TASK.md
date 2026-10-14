---
id: OVE_NOTIF004
title: "Implement notification use cases and the notification-center read model"
area: NOTIF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT003, OVE_ARCH007, OVE_ARCH010, OVE_ARCH015, OVE_DATA010, OVE_NOTIF001, OVE_NOTIF002, OVE_NOTIF003]
soft_depends_on: []
provides: ["usecase:CreateNotification", "usecase:ListNotifications", "usecase:MarkNotificationsRead", "usecase:ResolveNotificationsBySubject", "usecase:GetUnreadCount", "usecase:Notify", "port:NotificationPublisher"]
needs: ["port:Translator", "port:EventBus", "port:Clock", "port:IdGenerator", "port:WorkspaceRepository", "port:AgentRepository", "port:NotificationDispatcher"]
owns: ["packages/application/src/notification/**"]
reads: []
design: design.png
design_source: "Pulpit#dash/notifications-list (crop 1120,60,320,400)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [6, 17]
---

# OVE_NOTIF004: Implement notification use cases and the notification-center read model

## 1. Summary

The application service behind the notification center: create (dedupe, coalescing), list (rendered read model), mark read, resolve by subject, unread count and daily pruning. `design.png` is the exact content of the read model.

## 2. Context

The Pulpit right panel lists notifications: coloured icon tile, title ('Zgoda: git push'), source line ('Developer · Aplikacja rezerwacji'), relative time ('3 min', 'wczoraj'). VIEWS notes unread/read styling and the empty state are not drawn. This task builds everything behind the panel; the panel itself is `ui:NotificationCenter` (OVE_DS060).

## 3. Scope (in)

- `CreateNotification` (producer-facing).
- `ListNotifications`, `GetUnreadCount`, `MarkNotificationsRead`, `ResolveNotificationsBySubject`.
- Rendering through the Translator with Workspace and Agent name lookup.
- Daily prune job; events `notification.created` / `notification.changed`.

## 4. Out of scope

- Mapping domain events to notifications: NOTIF005. Delivery to macOS and Telegram: NOTIF007. Gateway: NOTIF010. UI: DS060 and the WSPACE dashboard.

## 5. Detailed requirements

1. **`CreateNotification.execute(draft)`**, `draft = { kind, titleRef, bodyRef?, source, subject, extraDedupe? }` (the producer supplies no id and no flags): validate against the catalogue; build the key; `findByDedupeKey`; `decideDedupe`. `insert`: assign id, `requiresAction` and `severity` from the catalogue, persist, publish `notification.created`, call `NotificationDispatcher.dispatch` (fire and forget: a delivery failure never fails creation). `merge`: update count and `updatedAt`, clear `readAt`, publish `notification.changed`, dispatch only if more than 60 s passed since the last dispatch (no banner storms). `ignore`: return the existing id.
2. **`ListNotifications({limit, before, unreadOnly})`** returns `{ items: NotificationView[], nextCursor, unreadCount }`. `title`/`body` come from `Translator.withLocale(ownerLocale)`; `source.label` is `<agent> · <workspace>` (names capped at 80 chars, control characters stripped, deleted source falls back to the stored param or ''). `target`: approval_request and access_request -> `/approvals/<id>`; discussion -> `/chief?discussion=<id>`; run -> `/activity/run/<id>`; escalation -> `/approvals/<id>`; backup -> `/settings#backup`; channel -> `/connections#telegram`; provider -> `/connections`; system -> null.
3. `unread = readAt === null`. Resolved items stay listed with `resolution` and `unread: false`.
4. **`MarkNotificationsRead({ids} | {all:true})`** sets `readAt` and publishes `notification.changed` (one batched event). Reading an actionable notification does NOT resolve it.
5. **`ResolveNotificationsBySubject(subject, resolution)`** is called by NOTIF005 when an approval or access request is decided on any channel or expires.
6. `GetUnreadCount()` is an indexed count (app badge, tray).
7. **Pruning:** a daily job (Clock timer at 04:00 local and once at start) calls `prune({keepReadDays:30, keepMax:500})`.
8. Use cases are idempotent and return `Result`; logs carry kind and ids only, never params.

## 6. Design notes

`design.png` is the 'Powiadomienia' panel with five rows. Mapping to `NotificationView`: 'Zgoda: git push' / 'Developer · Aplikacja rezerwacji' / '3 min' = approval_requested (amber shield); 'Prośba o dostęp: ~/Projects/shared-ui' / 'Designer · Aplikacja rezerwacji' / '12 min' = access_requested (magenta folder-plus); 'Chief zaczął Dyskusję o płatnościach' / 'Czeka na Twój głos' / '20 min' = discussion_started (lavender chat; second line is the BODY); 'Run #13 ukończony' / 'Strona fundacji · 4 nowe Zadania' / '1 h' = run_completed (mint check); 'Eskalacja: limit pętli' / 'Strona fundacji · wczoraj rozstrzygnięta' / 'wczoraj' = escalation_raised, resolved (red pulse). Rule for the second line: `body` when present, otherwise `source.label`; the view carries both. Unread styling, empty, loading and error states are UI decisions in OVE_DS060.

## 7. Reuse

- `Translator` (ARCH015), `EventBus`, `Clock`, `IdGenerator`, name lookups through small `NameLookup` interfaces defined here, rules (OVE_NOTIF002).

## 8. Architecture and code placement

`packages/application/src/notification/{create-notification.usecase.ts,list-notifications.usecase.ts,mark-read.usecase.ts,resolve-by-subject.usecase.ts,view-renderer.ts,target-map.ts,prune-job.ts}`. The renderer is a pure function over entity, names and Translator. `NotificationDispatcher` is defined in OVE_NOTIF007 (no-op default in tests).

## 9. Security and safety

- Rendering is where untrusted agent and workspace names become visible: capped, stripped, inserted only as template parameters (no nested interpolation, ARCH015).
- The view holds no secrets and no absolute paths beyond `~`-shortened strings from producers; a test pushes corpus secrets through params.
- Marking read never resolves anything; resolution comes only from the owner of the subject via NOTIF005.

## 10. Errors and edge cases

- Unknown kind: `notif.kind_unknown`, logged, nothing stored.
- Missing translation key: EN fallback, logged once.
- Workspace deleted: label fallback, `target` null if needed.
- Crash between persist and dispatch: NOTIF007's boot catch-up re-dispatches rows younger than 10 minutes without delivery records.
- `before` cursor of a pruned row: next older rows.

## 11. Acceptance criteria

- [ ] A new approval draft stores one row, publishes `notification.created` and dispatches once.
- [ ] The same draft again is `ignore` with no second dispatch.
- [ ] Five `run_completed` for one Run in 60 s give one row `count: 5`.
- [ ] The five mock items render to the exact Polish titles of the crop in `pl` and to English in `en`.
- [ ] An approval decided on Telegram resolves and reads its notification.
- [ ] Prune keeps unresolved actionable rows.
- [ ] A corpus secret in a param is redacted in the view and logs.

## 12. Test plan

Unit tests with fakes and the real Translator with real strings for golden rendering: `create-notification.test.ts`, `list-notifications.test.ts` (EN and PL goldens), `mark-read.test.ts`, `resolve-by-subject.test.ts`, `prune-job.test.ts`, `target-map.test.ts`. Command: `pnpm vitest run packages/application/src/notification`.

## 13. Parallelization notes

Parallel with NOTIF005 and NOTIF006 after NOTIF001 to 003.

## 14. Open questions and assumptions

- ASSUMPTION: second line = body else source label (derived from the five mock rows).
- OPEN: unread styling is a DS decision (OVE_DS060).
