---
id: OVE_TRAY002
title: "Create the tray window entry: TrayApp bootstrap with its own providers and live icon sync"
area: TRAY
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_SHELL004, OVE_SHELL005, OVE_SHELL006, OVE_SHELL007, OVE_SHELL008, OVE_SHELL010, OVE_TRAY001]
soft_depends_on: ["OVE_SHELL003"]
provides: ["lib:tray-app", "lib:tray-content-slot", "lib:use-tray-visibility"]
needs: ["lib:feature-manifest", "lib:i18n-provider", "lib:api-client-provider", "lib:event-hub", "lib:theme-provider"]
owns: ["apps/desktop/src/features/tray/TrayApp.tsx", "apps/desktop/src/features/tray/TrayProviders.tsx", "apps/desktop/src/features/tray/use-tray-visibility.ts", "apps/desktop/src/features/tray/use-tray-icon-sync.ts", "apps/desktop/src/features/tray/use-tray-keys.ts", "apps/desktop/src/features/tray/tray-content-slot.ts", "apps/desktop/src/features/tray/feature.manifest.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9, 18]
---

# OVE_TRAY002: Create the tray window entry: TrayApp bootstrap with its own providers and live icon sync

## 1. Summary

Implements `TrayApp`, the React root rendered when the webview is loaded with `?window=tray`: a minimal provider stack (theme, platform, i18n, API client, event hub, query cache) independent of the router and the shell frame, the hidden-but-alive behaviour, show/hide hooks, and the always-on subscription that keeps the menu-bar icon status in sync.

## 2. Context

SHELL010 renders `TrayApp` lazily for `?window=tray`. The tray webview is a separate window with its own JS context (OVE_TRAY001), so it cannot share React state or the QueryClient with the main window; it creates its own `ApiClientProvider`, event hub and cache with the same implementations (SHELL004 assumption). It must stay light: no router, no feature manifests, no i18n lazy namespaces except `tray` and `common`. It also hosts duties that must run even when the main window is hidden: icon status updates and the election of the native notification handler (SHELL023).

## 3. Scope (in)

- `apps/desktop/src/features/tray/TrayApp.tsx` default export `TrayApp` (lazy import target of SHELL010).
- `TrayProviders`: `ThemeProvider`, `PlatformProvider`, `I18nProvider` (namespaces `common`, `tray`, `shell-engine` eager), `ApiClientProvider`, `QueryProvider`, `EventHubProvider`, `ToastProvider` is NOT included (no toasts in the popover), engine gate slot variant for the tray (TRAY009).
- `useTrayVisibility()`: `visible` from the Tauri window events (`tauri://focus`, `tauri://blur`) via the platform Tray interface; the content refreshes when it becomes visible.
- `useTrayIconSync(model)` (always active, also while hidden): calls `Tray.setStatus` when the derived status changes.
- Entry registration for the manifest-less feature (the tray has no nav item): `feature.manifest.ts` declares namespaces only (`tray`) and no routes.

## 4. Out of scope

- The menu content (TRAY005/006), actions (TRAY008), states (TRAY009).
- Rust window creation (SETUP010 per TRAY001 proposal) and icon assets (TRAY007).
- The main window shell.

## 5. Detailed requirements

1. **Bootstrap.** `TrayApp` renders `<TrayProviders><TrayEngineGate><TrayMenuContainer/></TrayEngineGate></TrayProviders>`; `TrayMenuContainer` is provided by TRAY006 and wired by TRAY005/008 (this task mounts a placeholder that renders `null` until they land, via a registered slot `registerTrayContent`).
2. **Document.** `html`/`body` transparent-safe, `overflow: hidden`, fixed 380x560 root (`width: 380px; height: 560px`), background `bg-app`; no scrollbars on the document; the card scrolls internally (TRAY009). Font loading identical to the main window; no flash of unstyled content (the window is shown only after `document.fonts.ready` + first paint: the app calls `Tray.markReady()` and Rust shows the window only if ready).
3. **Visibility.** Subscribes to window focus/blur through `Tray.onVisibilityChange(cb)` (TRAY007 adds it to the interface by proposal). While hidden: event hub stays connected (cheap), queries are not refetched on each event (invalidate only marks stale); on becoming visible one refetch of `tray.summary` if stale. This avoids rendering work while invisible.
4. **Icon sync.** `useTrayIconSync` derives `{ status, tooltip }` from the tray view model (TRAY005): engine down or error -> `error`; paused -> `paused`; pending approvals > 0 -> `waiting`; any agent working -> `working`; else `idle`. Priority order: error > paused > waiting > working > idle. `tooltip` e.g. 'Overmind · pracuje · 3 z 3 Agentów' (same text as the popover header status, plain). Debounced 300 ms; no call when unchanged.
5. **Isolation from main.** The tray never reads `localStorage` keys of the main window (different origin per window is not guaranteed; the app treats them as separate); the Workspace selection is irrelevant to the tray (it shows all Workspaces).
6. **Engine independence.** The tray works when the main window is hidden or closed (resident app, SHELL008).
7. **Keyboard.** `Esc` anywhere in the popover -> `Tray.hide()`. Handled by `useTrayKeys()` here (the only global key handler in the tray).
8. **Dev and web runtime.** In `pnpm dev` the tray is reachable at `/?window=tray` in a normal browser tab at 380x560 for development; `Tray` calls are no-ops via the web implementation.
9. **Memory.** The tray QueryClient `gcTime` 60 s, no devtools; Strict-mode double mount safe.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- Providers from SHELL004/005/006/007/008, `usePlatform().tray` (ARCH012/TRAY007), feature manifest conventions (ARCH009), `registerTrayContent` slot defined here.

## 8. Architecture and code placement

`apps/desktop/src/features/tray/{TrayApp.tsx,TrayProviders.tsx,use-tray-visibility.ts,use-tray-icon-sync.ts,use-tray-keys.ts,tray-content-slot.ts,feature.manifest.ts}` and locale files `apps/desktop/src/locales/{en,pl}/tray.json` (owned by TRAY006, empty skeleton not created here). UI feature layer; imports shared providers from `app/`.

## 9. Security and safety

- Same isolation rules as the main window: no token in JS, no Node APIs, strict CSP.
- The tray must not expose any action that can be abused if the popover is shown by a hostile focus steal: no approvals, no deletions, only pause (safe direction), open app, chat entry point (opens main window), quit app (confirmed).
- `useTrayIconSync` passes only enum and a plain tooltip; Rust validates the enum.

## 10. Errors and edge cases

- Window shown before the engine is connected: TRAY009 states handle it (skeleton then gate).
- Event hub reconnecting: icon status becomes `error` only after the engine gate says unavailable (not on every blip).
- The main window triggers `?window=tray` by mistake (URL param in main): strict allowlist from SHELL010 handles; main stays main.
- Two tray windows (should not happen): single-instance label in Rust.
- Locale change in settings: the tray reloads its locale from the engine config event (`config.changed`).

## 11. Acceptance criteria

- [ ] Given `?window=tray` then `TrayApp` renders at 380x560 without router or shell frame.
- [ ] Given engine events while hidden then the icon status updates within 1 s.
- [ ] Given the window becomes visible after being stale then one refetch happens.
- [ ] Given `Esc` then `Tray.hide()` is called.
- [ ] Given a status change burst then at most one `setStatus` per 300 ms.

## 12. Test plan

- Vitest + Testing Library with a fake `Tray` platform object, fake event source, fake summary: icon priority table, visibility refetch, debounce.
- Storybook decorators for `TrayProviders` used by TRAY006 stories.
- Commands: `pnpm --filter @overmind/desktop test features/tray`.

## 13. Parallelization notes

After SHELL004/005/006/008, SHELL010 and TRAY001. TRAY005/006 plug into the slot defined here. Hotspot: `tray.json` is owned by TRAY006 only.

## 14. Open questions and assumptions

- ASSUMPTION: the provider components are importable from `app/providers/*` by `features/tray` (they are app-level, not feature-level; ARCH002 allows `features -> app providers` through the public barrel).
- OPEN: `Tray.onVisibilityChange` and `Tray.markReady` are additions to the ARCH012 interface; proposal in TRAY007.
