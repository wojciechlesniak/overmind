---
id: OVE_NOTIF012
title: "Relay notifications through the desktop app and select the best Notifier"
area: NOTIF
kind: infra
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_ENGINE017, OVE_NOTIF011, OVE_SHELL023]
soft_depends_on: []
provides: ["lib:notifier-relay", "lib:notifier-composite", "api:notifications.native-ack"]
needs: ["port:Notifier", "lib:gateway-push", "lib:tauri-notification-bridge"]
owns: ["packages/adapters/notifications-macos/src/relay/**", "packages/adapters/notifications-macos/src/composite/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5, 9]
---

# OVE_NOTIF012: Relay notifications through the desktop app and select the best Notifier

## 1. Summary

Second half of `adapters/notifications-macos`: a `Notifier` that asks the running desktop app (Tauri shell, signed bundle, tray) to show the native notification with Overmind's identity, click-to-open and Time Sensitive level, plus a composite that falls back to `osascript` when the app is not running.

## 2. Context

The engine cannot create notifications with the app's identity. The Tauri shell can (notification plugin) and stays alive in the menu bar after the window closes ('Zamknij okno, pracuj dalej'). The shell listens to a gateway push topic and shows the notification; if no shell is connected, the composite uses OVE_NOTIF011.

## 3. Scope (in)

- `ShellRelayNotifier`: publishes `notification.native.requested` on the gateway push hub and waits for an ack.
- `CompositeNotifier`: relay first, then osascript.
- Message contract for the shell (documented here, implemented in `apps/desktop/src-tauri` by SETUP010/SHELL: capability `lib:tauri-notification-bridge`).

## 4. Out of scope

- The Tauri side listener: SETUP010/SHELL/TRAY (capability named in needs). Permission prompt UX: ONB/SETUI.

## 5. Detailed requirements

1. Push topic `notification.native.requested` payload `{ id, title, body, soundName?, urgency, route? }` (strict schema, same caps as OVE_NOTIF011), delivered only to the local app token subscribers (not to Telegram or agent principals).
2. The shell replies through `POST /v1/notifications/native-ack { id, shown: boolean, permission }`; the notifier waits up to 1.5 s. No ack or no subscriber: fall back to `OsascriptNotifier`.
3. `urgency: 'high'` maps to the macOS Time Sensitive interruption level for critical kinds so they pass Focus modes where the Owner allowed it; `normal` otherwise.
4. Click on the banner opens the app at `route` (an app-internal route validated against `^/[a-z0-9/_\-?=&#.]*$`, never a URL).
5. `capabilities()` of the composite: sound and actions as the active path reports; `requestPermission()` asks the shell and returns the real status when connected.
6. Both paths receive already redacted text; the relay adds nothing.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Notifier` (ARCH012), gateway push hub (ENGINE), `OsascriptNotifier` (OVE_NOTIF011), route validation helper from the gateway.

## 8. Architecture and code placement

`packages/adapters/notifications-macos/src/relay/` and `composite/`; the topic messages live in the adapter's own `messages.ts` and reach the Tauri side through generated JSON Schema.

## 9. Security and safety

- The ack route accepts only the local app token.
- `route` is validated; no `javascript:` or external URLs.
- The topic is subscribed only by the local shell; a misconfigured remote subscriber would see banner text, so the hub restricts it by principal.
- No actions that approve anything inside notifications.

## 10. Errors and edge cases

- App not running: fallback path, no error.
- Shell subscribed but permission denied: ack `{shown:false, permission:'denied'}`, adapter maps to `platform.notification_denied`; the composite does NOT fall back to osascript because the Owner denied banners.
- Two shells (dev): first ack wins.
- Ack arrives after timeout: ignored, banner may double (acceptable, deduped by id in the shell).

## 11. Acceptance criteria

- [ ] With a connected fake shell the notifier shows via relay and does not call osascript.
- [ ] Without subscribers it falls back within 1.5 s.
- [ ] Denied permission is not circumvented by the fallback.
- [ ] A `route` with a URL scheme is rejected.
- [ ] Critical kinds set `urgency: high`.

## 12. Test plan

Unit tests with a fake push hub and fake shell: `relay-notifier.test.ts`, `composite.test.ts`, `route-validation.test.ts`. Command: `pnpm vitest run packages/adapters/notifications-macos`.

## 13. Parallelization notes

Parallel with the Tauri-side work; the contract is the JSON schema of the topic.

## 14. Open questions and assumptions

- Needs the Tauri bridge capability `lib:tauri-notification-bridge` from SETUP010/SHELL; if nobody owns it the linker must create a task (flagged in the report).
