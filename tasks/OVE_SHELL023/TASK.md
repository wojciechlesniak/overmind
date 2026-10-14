---
id: OVE_SHELL023
title: "Implement the native notification bridge for engine-requested macOS banners"
area: SHELL
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_ENGINE017, OVE_SETUP010, OVE_SHELL003, OVE_SHELL006, OVE_SHELL010]
soft_depends_on: []
provides: ["lib:tauri-notification-bridge", "lib:use-native-notification-bridge"]
needs: ["api:notifications.native-ack", "port:Notifier", "api:events.subscribe", "lib:tauri-capabilities", "lib:use-navigate-to-route"]
owns: ["apps/desktop/src/app/notify/native/**", "apps/desktop/src/shared/platform/tauri/notification.ts", "apps/desktop/src/shared/platform/mock/notification.ts", "tasks/_proposals/OVE_SHELL023-notification-command.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9]
---

# OVE_SHELL023: Implement the native notification bridge for engine-requested macOS banners

## 1. Summary

Implements the desktop side of OVE_NOTIF012: the app listens to the push topic `notification.native.requested`, shows a native macOS notification with Overmind's identity through a Tauri command, acknowledges it to the engine, and navigates to the validated route when the banner is clicked.

## 2. Context

The engine cannot show notifications under the app's identity; NOTIF012 publishes `notification.native.requested { id, title, body, soundName?, urgency, route? }` to local app subscribers and waits up to 1.5 s for `POST /v1/notifications/native-ack { id, shown, permission }`, otherwise it falls back to osascript. NOTIF012 names the capability `lib:tauri-notification-bridge` as coming from SETUP010/SHELL; this task owns the TypeScript side and proposes the Rust command. The app keeps running in the menu bar after the window closes (ADR 0005), so the bridge must also work when the window is hidden: it lives in the always-running tray window/webview (TRAY002 hosts the shared hub) or in the hidden main webview.

## 3. Scope (in)

- TypeScript bridge `NativeNotificationBridge` subscribing via the event hub topic (SHELL006) with strict zod validation of the payload.
- Platform adapter `shared/platform/tauri/notification.ts`: `showNotification(spec)`, `permissionState()`, `requestPermission()`, event `notification:clicked`.
- Ack call `api:notifications.native-ack` through the api-client with `{ id, shown, permission }`.
- Click handling: show/focus the main window and navigate to `route` after `isKnownRoute` and regex validation.
- Dedupe by `id` (ring of 100) so a double delivery shows one banner.
- Proposal file for the Rust command `show_notification` and the click event, plus the capability `notification` permission (`tasks/_proposals/OVE_SHELL023-notification-command.md`).

## 4. Out of scope

- Choosing what to notify, DND and preferences (NOTIF002/006/007).
- Osascript fallback (NOTIF011).
- Settings UI for notifications (SETUI).
- In-window toasts (SHELL022).

## 5. Detailed requirements

1. **Payload validation.** zod strict: `id` string 1..64, `title` 1..120, `body` 0..400, `soundName?` one of the closed list from NOTIF008 (`default|none|...` names only, never a path), `urgency` `'normal'|'high'`, `route?` regex `^/[a-z0-9/_\-?=&#.]*$` max 200. Invalid payloads are dropped, logged at debug (no content) and acked `{ shown: false, permission }` so the engine can fall back.
2. **Show.** `showNotification({ title, body, soundName, urgency, id })` calls the Rust command (proposal): the shell uses the notification plugin API in Rust; the webview needs only `core:allow-show-notification` custom permission, not the plugin's wide permission set. Text is passed as data; the shell never interprets it. `urgency: 'high'` -> Time Sensitive interruption level.
3. **Permission.** On first use call `permissionState()`; if `'default'` call `requestPermission()` once (macOS prompt); results `'granted'|'denied'|'unknown'` are included in every ack. If `denied`: ack `{ shown:false, permission:'denied' }` (NOTIF12 then does NOT fall back to osascript) and do nothing else.
4. **Ack.** `POST /v1/notifications/native-ack` within 1 s of receipt (budget under NOTIF012's 1.5 s). Retries: none (the engine falls back after the timeout; a late ack is ignored). The call uses the standard client with a fresh idempotency key; failure is logged only.
5. **Click.** Rust emits `notification:clicked { id }`; the bridge looks up the stored `route` by id (kept in memory for 10 min; the route never travels through Rust), brings the main window to front (`desktopShell.showWindow()`), and navigates with `useNavigateToRoute` only if `isKnownRoute(route)`; otherwise it just shows the window. Clicks for unknown ids only show the window.
6. **Lifecycle.** The bridge hook `useNativeNotificationBridge()` is mounted by `AppProviders` slot `bridges` and by the tray window host (TRAY002) so exactly one webview handles delivery: a `BroadcastChannel` lock (`overmind-native-notifications`, Web Locks API `navigator.locks.request`) elects the handler; if the holder closes the lock passes on.
7. **Dev and web runtime.** In web/mock runtime the adapter is a no-op that records calls for tests (`MockNotification`), so Storybook and Playwright can assert banners.
8. **Logging.** Id, urgency and result only. Never title or body (may carry Agent names or Task titles).

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `useEvent` and the hub (SHELL006), `usePlatform` (SHELL003 patterns), `useNavigateToRoute`/`isKnownRoute` (SHELL010), `desktopShell.showWindow`, generated api-client for `notifications.native-ack` once routed, NOTIF008 closed sound list.

## 8. Architecture and code placement

`apps/desktop/src/app/notify/native/{use-native-notification-bridge.ts,validate-native-payload.ts,election.ts}` and `apps/desktop/src/shared/platform/tauri/notification.ts` plus `.../mock/notification.ts`, proposal `tasks/_proposals/OVE_SHELL023-notification-command.md`. Platform adapter + application hook.

## 9. Security and safety

- Banner text may include names derived from untrusted content: it is passed to the OS as text only, length capped, never as markup or a command.
- `route` is validated twice (payload regex and the known-route table); no external URL, no `javascript:`, no file path.
- A banner can never approve anything (no action buttons; NOTIF012 requirement 'no actions that approve').
- Only the local app token can ack; the bridge listens only to the local hub.
- No notification content in logs.

## 10. Errors and edge cases

- Permission denied: ack with `denied`; no retry loop; settings hint is the SETUI task's job.
- No ack possible (engine down): nothing to do.
- Two webviews alive: lock election ensures one banner.
- Banner clicked after the app restarted: id unknown, only the window shows.
- Payload `route` for a route not installed: window shows, no navigation.
- Duplicate id: ignored.

## 11. Acceptance criteria

- [ ] Given a valid request then one native notification is shown and acked `shown: true` within 1 s.
- [ ] Given permission denied then ack `shown:false, permission:'denied'` and no banner.
- [ ] Given a route with a URL scheme then the payload is rejected.
- [ ] Given a click then the window is focused and navigated to the known route.
- [ ] Given two webviews then only one shows the banner.

## 12. Test plan

- Vitest with a mock platform notification and a fake hub: validation table, ack shape, election, click routing.
- Contract test against the NOTIF012 JSON schema (imported from its generated schema file).
- Commands: `pnpm --filter @overmind/desktop test notify/native`.

## 13. Parallelization notes

After SHELL006, SHELL003, SHELL010. Parallel with SHELL022. Rust side proposed to SETUP010; NOTIF012 consumes `lib:tauri-notification-bridge`.

## 14. Open questions and assumptions

- OPEN (cross-area): `api:notifications.native-ack` is referenced by NOTIF012 but no route task owns it; NOTIF010 should add it, or the linker creates an owner.
- OPEN: Rust command and capability (proposal) for SETUP010.
- ASSUMPTION: the hub can deliver the topic `notification.native.requested`, which is not a domain event; ENGINE017 filtering by topic prefix must allow it for the local app principal.
