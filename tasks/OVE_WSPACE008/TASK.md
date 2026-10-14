---
id: OVE_WSPACE008
title: "Notification centre wiring: list, unread state, mark read and open routing"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS032, OVE_DS033, OVE_DS037, OVE_DS060, OVE_NOTIF010, OVE_SHELL027, OVE_WSPACE001, OVE_WSPACE003]
soft_depends_on: []
provides: ["lib:use-unread-notifications"]
needs: ["ui:NotificationCenter", "ui:NotificationItem", "ui:EmptyState", "ui:Skeleton", "ui:useToast", "api:notifications.list", "api:notifications.read", "lib:api-client-notifications", "lib:route-builders"]
owns: ["apps/desktop/src/features/workspaces/api/useNotifications.ts", "apps/desktop/src/features/workspaces/components/slots/Notifications.slot.tsx", "apps/desktop/src/features/workspaces/model/notification-routes.ts"]
reads: []
design: design.png
design_source: "Pulpit#dash/notifications (crop 1120,67,320,390 CSS px)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [3, 6]
---

# OVE_WSPACE008: Notification centre wiring: list, unread state, mark read and open routing

## 1. Summary

Connects `ui:NotificationCenter` to the notification API: the live list (Approval, Access Request, Discussion started, Run completed, Escalation, Telegram, error), unread styling, 'mark all read', paging of older items and opening an item navigates to the right view without granting anything.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Mock regions `dash/notifications-list` (five items: amber shield 'Zgoda: git push', magenta folder-plus 'Prośba o dostęp: ~/Projects/shared-ui', lavender 'Chief zaczął Dyskusję o płatnościach', mint 'Run #13 ukończony', red 'Eskalacja: limit pętli'). Backend: NOTIF010 (`GET /v1/notifications`, `POST /v1/notifications/read`, push `notification.created|changed`). Spec 12: notifications cover completion, error, Access Request, Approval, Escalation, Discussion. NOTIF contracts own the unread state (answering question 6 of the inventory).

## 3. Scope (in)

- `api/useNotifications.ts`: list with cursor, unread count, mark read, subscription.
- `components/slots/Notifications.slot.tsx` (slot id `notifications`).
- `model/notification-routes.ts`: kind + subject -> route (registry).
- Live region announcing new notifications.

## 4. Out of scope

- Notification preferences (SETUI).
- macOS banners and sounds (NOTIF007/011/012).
- The Approvals view itself (APPRUI).

## 5. Detailed requirements

1. Hook: `GET /v1/notifications?limit=20` first page, `nextCursor` for 'Pokaż starsze' (`labels.showOlder`), `unreadCount` from the response; push topics `notification.created` (prepend, de-duplicate by id) and `notification.changed` (replace by id); on `notification.locale_changed` refetch (NOTIF010).
2. Item mapping: OVE_WSPACE001 `map-notification` -> `ui:NotificationItem` props (`kind`, `title`, `subtitle`, `ageLabel`, `unread`, `kindLabel` sr-only 'Approval' etc.). Titles and subtitles are engine-rendered in the Owner locale and shown as plain text.
3. Open: `onOpen` first marks the item read (`POST /v1/notifications/read {ids:[id]}`, optimistic, rolled back on error with a toast) then navigates via the registry: `approval` -> `/approvals?focus=<subjectId>`; `access-request` -> `/approvals?focus=<subjectId>`; `discussion` -> `/chief/discussion/<id>`; `run-completed` -> `/activity?run=<id>`; `escalation` -> `/approvals?focus=<subjectId>&tab=escalations`; `telegram` -> `/settings` (app settings Telegram); `error` -> `/activity`; unknown -> no navigation. Routes are built with route builders owned by the target features; a missing builder (feature not installed) degrades to no navigation + a toast `notifications.unavailable`. Opening NEVER decides anything: an Approval or Access Request is decided only in the Approvals view (ADR 0003); notification items have no inline approve buttons.
4. 'Mark all as read' (`markAllRead`): shown only when `unreadCount > 0`; calls `POST /v1/notifications/read {all:true}`; the list updates from the response and push events.
5. Panel max 20 items visible (kit `max`), 'Pokaż starsze' loads the next page (append). Unread count also feeds the page title suffix `(3)` through the shell (not here) and is exported as `useUnreadCount()` for SHELL/TRAY (reads the same cache).
6. Live region: a polite `aria-live` region announces `notifications.new` ('New notification: {{title}}') for new items of kind approval, access-request, escalation only (others silent), rate-limited to 1 per 3 s.
7. Loading: `loading` prop (4 skeleton rows). Empty: kit `EmptyState` with `notifications.empty` ('No notifications.'). Error: inline `notifications.error` with Retry; the list keeps stale data.
8. Notifications for an isolated Workspace are shown to the Owner as the engine returns them; the Workspace name is part of the text (engine).

## 6. Design notes

`design.png`: panel heading 'Powiadomienia' and 5 items (heights 54/70/70/54/69, 32px tinted icon tile, title 13/600, subtitle 12, mono age at right). Unread: bold title + 6px magenta dot (inventory open question 6, default per DS060). Not in the mock: empty, loading, error, older items, hover/focus, mark-all-read button (ghost, DS060).

## 7. Reuse

- `ui:NotificationCenter`, `ui:NotificationItem` (OVE_DS060), `ui:EmptyState`, `ui:Skeleton`, `ui:useToast`.
- `lib:api-client-notifications` (NOTIF010).
- `map-notification` from OVE_WSPACE001.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: notification text can contain Agent or Telegram-origin text (e.g. a Prośba o dostęp path): plain text only, clamped, no link parsing. Opening a notification only navigates; it never sends an approve/deny call, so a forged notification cannot cause a grant (and Telegram cannot trigger local-only actions). Marking read is not a security action but is owner-only (`gateway.forbidden_channel` otherwise).

## 10. Errors and edge cases

- Notification references a subject that no longer exists: the target view shows not found; this view still marks read.
- Read call fails: unread state reverts, toast, list unchanged.
- Duplicate push event: de-duplicated by id.
- Unknown kind: neutral tile, no navigation.
- Very many unread (> 99): count text '99+' in the shell; list unaffected.
- Offline/engine restarting: stale list with the error line.

## 11. Acceptance criteria

- [ ] Given the five mock fixtures, Then the panel matches `design.png` and heights are 54/70/70/54/69 within 2px.
- [ ] Given an unread item is opened, Then it is marked read optimistically and navigation uses the registry route.
- [ ] Given a new `notification.created` event, Then it appears on top without refetch and kind approval is announced.
- [ ] Given `markAllRead`, Then one request is sent and all dots disappear.
- [ ] Given an access-request notification, Then no decision call is made from this view (test asserts no `access-requests.decide` call).
- [ ] axe clean, items are buttons with accessible names starting with the kind label.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `useNotifications.test.tsx` (paging, optimistic read, rollback, push de-dup, locale refetch), `notification-routes.test.ts` (every kind, unknown, missing builder), `Notifications.slot.test.tsx`, `no-decision-call.test.tsx`, stories `Notifications/Unread|Empty|Loading|Error|Older`, visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test notifications`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/api/useNotifications.ts`, `apps/desktop/src/features/workspaces/components/slots/Notifications.slot.tsx`, `apps/desktop/src/features/workspaces/model/notification-routes.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: route paths for target views are provided by route builders of the owning features (`lib:route-builders`, SHELL); names above are defaults until then.
- OPEN: which kinds announce through the live region (default approval, access-request, escalation).
