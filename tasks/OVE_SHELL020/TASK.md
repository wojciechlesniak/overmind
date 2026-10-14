---
id: OVE_SHELL020
title: "Implement the engine-down gate: starting screen, offline banner, retry and start"
area: SHELL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS010, OVE_DS021, OVE_DS032, OVE_DS037, OVE_DS040, OVE_ENGINE008, OVE_ENGINE009, OVE_SETUP010, OVE_SHELL003, OVE_SHELL004, OVE_SHELL010, OVE_SHELL019]
soft_depends_on: []
provides: ["lib:engine-status-gate", "lib:use-engine-read-only"]
needs: ["lib:ensure-running", "lib:service-manager-launchd", "lib:tauri-capabilities", "ui:EmptyState", "ui:ProgressBar", "ui:InfoNote", "ui:CalloutAmber", "ui:LogoTile", "ui:Toast"]
owns: ["apps/desktop/src/app/engine/engine-status-gate.tsx", "apps/desktop/src/app/engine/connecting-splash.tsx", "apps/desktop/src/app/engine/engine-starting.tsx", "apps/desktop/src/app/engine/engine-down.tsx", "apps/desktop/src/app/engine/engine-lost-banner.tsx", "apps/desktop/src/app/engine/use-engine-retry.ts", "apps/desktop/src/app/engine/use-engine-read-only.ts", "apps/desktop/src/app/engine/register-gate.ts", "tasks/_proposals/OVE_SHELL020-ensure-engine-command.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5]
---

# OVE_SHELL020: Implement the engine-down gate: starting screen, offline banner, retry and start

## 1. Summary

Fills the `EngineGateSlot` of SHELL010: a bare screen while the engine is connecting, starting or recovering; a full-screen 'engine is not running' state with Retry and 'Start engine'; and a non-blocking banner when the connection drops after the app was ready. The start action asks the Tauri shell to run ensure-running, which uses the launchd ServiceManager.

## 2. Context

ADR 0005: the engine is a separate process that outlives the window; the window is only a client. Engine states from SHELL004: `connecting`, `starting` (with recovery progress), `ready`, `incompatible`, `unavailable`. SETUP010 runs `ensure_engine_running()` when the app starts and on focus; ENGINE009 implements `ensure-running` (start, adopt or replace) using ENGINE008's LaunchAgent. The UI needs to explain what is happening and let the Owner retry or start the engine without a terminal. The Tray window has its own variant (TRAY006); this task is for the main window.

## 3. Scope (in)

- `EngineStatusGate` component registered into `EngineGateSlot` (wraps all routes, including the wizard).
- Screens: `ConnectingSplash` (shown only if connecting lasts > 400 ms), `EngineStarting` (progress), `EngineDown` (full screen), and `EngineLostBanner` (overlay banner above the shell frame).
- Actions: 'Spróbuj ponownie' (`connection.retry()`), 'Uruchom silnik' (`platform.desktopShell.ensureEngine()`), 'Uruchom połączenie ponownie' for the `auth` detail.
- Automatic retry with backoff 1, 2, 4, 8, then every 10 s while the window is visible.
- Read-only mode while the banner is shown: a context `useEngineReadOnly()` that mutation hooks consult (SHELL005 exposes a hook point).

## 4. Out of scope

- Version mismatch (SHELL021; the gate delegates `incompatible` to it).
- The Rust command and the ensure-running implementation (SETUP010, ENGINE009; proposal text in this task).
- Tray window gate (TRAY006).

## 5. Detailed requirements

1. **Gate logic.** `useConnection()` (SHELL004): `ready` -> render children; `incompatible` -> render `<VersionMismatchScreen/>` (SHELL021); `connecting|starting|unavailable` before the first `ready` -> bare screens (no rail, no top bar, they need data); after the first `ready`, `unavailable` renders children plus `EngineLostBanner` so the Owner keeps context.
2. **ConnectingSplash.** Delay 400 ms to avoid a flash on a healthy start; then logo tile (`ui:LogoTile`) with `engine.connecting`. Role `status`.
3. **EngineStarting.** Title `engine.starting`; when `detail.recovery` exists show a determinate `ui:ProgressBar` with `engine.recovering` ('Przywracanie Runów 3 z 7'); otherwise indeterminate. The screen never shows engine logs.
4. **EngineDown.** `ui:EmptyState` icon 'plug-off', title `engine.down.title`, body `engine.down.body`, buttons: primary 'Uruchom silnik' (`ensureEngine()`; spinner and `aria-busy` up to 15 s, matching the ensure-running budget), secondary 'Spróbuj ponownie'. After 3 failed attempts show `ui:InfoNote` with a diagnostic line 'Kod: {{code}} · Odniesienie: {{ref}}' (error code and correlation id only) and a 'Skopiuj diagnostykę' button that copies the same two values plus app version. The ensure-running JSON result is mapped: `started|already_running` -> retry connection; `failed` -> show `error` code; `rate_limited` -> 'Poczekaj chwilę' with a 10 s cooldown.
5. **Auth detail.** When `detail === 'auth'` (repeated 401s) the body is `engine.down.auth` and the primary button is 'Uruchom połączenie ponownie' which calls `ensureEngine()` (the shell re-reads the token).
6. **EngineLostBanner.** Rendered with `ui:InfoNote` (amber tone via `ui:CalloutAmber`, DS040) pinned at the top of the content area: `engine.banner.lost` + 'Spróbuj teraz' button + `engine.banner.readOnly`. `role="alert"` once, then `status`. While shown: mutation hooks reject with `internal.engine_unavailable` and buttons wired through `useGatewayMutation` show the disabled state with the reason tooltip; reads keep the last data (stale styling from SHELL018 applies to the bar).
7. **Recovery.** When state returns to `ready` the banner is replaced by a 3 s `ui:Toast` 'Połączono z silnikiem', all queries are invalidated once (`queryClient.invalidateQueries()` debounced) and the event hub resyncs (SHELL006).
8. **Backoff.** Implemented as a small hook `useEngineRetry()` with injectable clock; pauses while `document.hidden` (resumes on visibility) and during the cooldown.
9. **Proposal to SETUP010.** File `tasks/_proposals/OVE_SHELL020-ensure-engine-command.md` (owned here) asks for a Rust command `ensure_engine() -> { status: 'started'|'already_running'|'failed'|'rate_limited', code?: string }` that wraps `ensure_engine_running()` (SETUP010 req. 7) and adds `core:allow-ensure-engine` to the `main` capability, reusing ENGINE009's rate limit (10 s).
10. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

No mock exists for this screen (design: none). It is composed only from ui-kit components (`ui:EmptyState`, `ui:Button`, `ui:Card`, `ui:InfoNote`) on the `bg-app` surface with the product tokens; the implementer must not invent new visual styles. DESIGN GAP recorded in section 14.

## 7. Reuse

- `useConnection` (SHELL004), `EngineGateSlot` and route frame (SHELL010), `usePlatform().desktopShell.ensureEngine` (SHELL003 amendment), `ui:EmptyState`, `ui:ProgressBar`, `ui:InfoNote`, `ui:CalloutAmber`, `ui:LogoTile`, `ui:Toast`, strings from `shell-engine` (SHELL019).

## 8. Architecture and code placement

`apps/desktop/src/app/engine/{engine-status-gate.tsx,connecting-splash.tsx,engine-starting.tsx,engine-down.tsx,engine-lost-banner.tsx,use-engine-retry.ts,use-engine-read-only.ts,register-gate.ts}` and `tasks/_proposals/OVE_SHELL020-ensure-engine-command.md`. UI layer; only talks to the shell through the platform provider.

## 9. Security and safety

- The webview never starts processes: it calls one typed Rust command that only runs the bundled ensure-running (no arguments from the UI).
- Rate limit on 'Uruchom silnik' in UI (disabled during the 15 s window and cooldown) in addition to the Rust-side stamp, so a double click cannot start two engines (ensure-running is also race safe, ENGINE009).
- Diagnostics copy contains only code, reference and version; no paths, no tokens.
- While read-only, mutations are blocked client-side AND would fail server-side anyway; the block is a UX guard, not a security control.

## 10. Errors and edge cases

- Engine starts slowly (> 15 s): `EngineDown` appears with a hint 'Uruchamianie trwa dłużej niż zwykle'; the poll continues.
- Engine crashes and is restarted by launchd KeepAlive: the banner appears and recovers by itself.
- Window hidden: backoff pauses; on focus an immediate retry (and the shell's own ensure-on-focus).
- `ensureEngine` unsupported (web dev): the button is hidden and the text explains `pnpm dev`.
- State flaps (ready/unavailable): banner debounced 800 ms to avoid flicker.
- Wizard route while engine is down: the gate still renders (wizard needs the engine).

## 11. Acceptance criteria

- [ ] Given the engine down at start then the full-screen state with Retry and Start appears; pressing Start calls `ensureEngine` once and shows progress.
- [ ] Given the connection lost after ready then the banner appears, mutations are disabled with a reason, and recovery shows a toast and refreshes data.
- [ ] Given recovery progress 3/7 then the determinate progress and text show.
- [ ] Given 3 failures then the diagnostic block with code and reference appears and copies correctly.
- [ ] Given the `auth` detail then the dedicated text and button are shown.

## 12. Test plan

- Vitest with a fake connection state machine and fake clock: gate table, backoff, debounce, cooldown.
- Storybook stories for each screen; axe.
- Playwright (TEST004): stop the fake gateway, assert banner, restart, assert recovery.
- Commands: `pnpm --filter @overmind/desktop test engine`.

## 13. Parallelization notes

After SHELL004, SHELL010, SHELL019. Parallel with SHELL021 and SHELL022. The Rust command is a separate request to SETUP010.

## 14. Open questions and assumptions

- DESIGN GAP: all engine states are derived from DS rules; no mock.
- OPEN: the Rust command `ensure_engine` must be added to SETUP010 (proposal included).
- OPEN: should the app offer 'Zatrzymaj silnik' here? No (stopping is a Settings/Tray decision, SETUI).
