---
id: OVE_NOTIF011
title: "Implement the macOS Notifier fallback with osascript (argv only)"
area: NOTIF
kind: infra
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH012, OVE_ARCH014, OVE_NOTIF007]
soft_depends_on: []
provides: ["lib:notifier-osascript", "lib:notifications-macos"]
needs: ["port:Notifier", "port:ProcessRunner", "port:Logger"]
owns: ["packages/adapters/notifications-macos/src/osascript/**", "packages/adapters/notifications-macos/package.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5, 9]
---

# OVE_NOTIF011: Implement the macOS Notifier fallback with osascript (argv only)

## 1. Summary

First half of `adapters/notifications-macos`: a `Notifier` that shows a banner and plays a named sound with `osascript`, working even when the desktop app is not running (the engine is a separate service). Arguments are passed as argv, never interpolated into the script.

## 2. Context

ADR 0005: the engine runs independent of the window, so notifications must be possible from the engine. A signed bundle identity is only available to the desktop app (OVE_NOTIF012 relays through it); `osascript` is the dependable fallback with known limits.

## 3. Scope (in)

- `OsascriptNotifier implements Notifier`.
- Escaping-free argument passing, sound allowlist, length caps.
- Contract test run (Linux with a fake runner; macOS-only smoke test marked).

## 4. Out of scope

- Relay through the desktop shell and composite selection: OVE_NOTIF012.

## 5. Detailed requirements

1. Run `osascript` through `ProcessRunner` with argv: `['-e','on run argv','-e','display notification (item 1 of argv) with title (item 2 of argv) sound name (item 3 of argv)','-e','end run','--', body, title, sound]` (`sound name` clause omitted for no sound). No string concatenation into AppleScript, no shell.
2. Inputs: `title` capped at 100 chars, `body` at 200, control and bidi characters stripped, sound must be in the `SoundId` allowlist (OVE_NOTIF008) else `default`.
3. `capabilities()` returns `{ sound: true, actions: false }`; `requestPermission()` returns `'unknown'` (not queryable); known limits are documented: attribution shows 'Script Editor', clicking does not open Overmind, appearance depends on that app's notification settings.
4. Errors: non-zero exit or timeout (5 s) -> `platform.notification_failed`; never throws; secrets never in error details (the body is not logged).
5. Rate limit: at most 1 call per second inside the adapter (queue of 10, rest dropped and counted).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `ProcessRunner` (ARCH014), `Notifier` contract suite (ARCH012/TEST003), `SoundId` (OVE_NOTIF008).

## 8. Architecture and code placement

`packages/adapters/notifications-macos/src/osascript/{osascript-notifier.ts,sanitise.ts}`. Platform code lives only in this adapter (ADR 0009).

## 9. Security and safety

- Argv-only invocation removes script injection from agent-influenced text.
- Title and body are already redacted by the dispatcher; the adapter additionally strips control characters and caps length.
- No logging of banner content.

## 10. Errors and edge cases

- `osascript` missing or blocked: `platform.notification_failed`.
- Do Not Disturb / Focus on: the OS suppresses silently; not detectable, in-app record remains.
- Body containing quotes and backslashes: passed verbatim as argv (test).
- Concurrent calls: serialised.

## 11. Acceptance criteria

- [ ] The Notifier contract suite passes with the fake runner.
- [ ] A body with quotes, newlines and backslashes arrives as a single argv element.
- [ ] An unknown sound falls back to `default`.
- [ ] Timeout maps to `platform.notification_failed`.
- [ ] The adapter imports no other adapter.

## 12. Test plan

Unit tests with a fake `ProcessRunner`: `osascript-notifier.test.ts`, `sanitise.test.ts`; contract suite; a macOS-only smoke test (skipped elsewhere). Command: `pnpm vitest run packages/adapters/notifications-macos`.

## 13. Parallelization notes

Parallel with OVE_NOTIF012 (different folder).

## 14. Open questions and assumptions

- OPEN: if the Owner dislikes the 'Script Editor' attribution, OVE_NOTIF012 becomes the primary path (it is already preferred when the app runs).
