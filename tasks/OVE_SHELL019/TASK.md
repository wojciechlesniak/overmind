---
id: OVE_SHELL019
title: "Provide error boundaries and the crash screen for the root, routes and panels"
area: SHELL
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS031, OVE_DS032, OVE_PAUSE007, OVE_SHELL003, OVE_SHELL004, OVE_SHELL010]
soft_depends_on: []
provides: ["ui:AppErrorBoundary", "ui:CrashScreen", "ui:PanelBoundary", "lib:emergency-pause", "lib:report-crash"]
needs: ["ui:EmptyState", "ui:Button", "ui:Card", "lib:i18n-ui", "api:pause.global"]
owns: ["apps/desktop/src/app/errors/app-error-boundary.tsx", "apps/desktop/src/app/errors/crash-screen.tsx", "apps/desktop/src/app/errors/route-crash-card.tsx", "apps/desktop/src/app/errors/panel-boundary.tsx", "apps/desktop/src/app/errors/report-crash.ts", "apps/desktop/src/app/errors/emergency-pause.ts", "apps/desktop/src/app/errors/eager-i18n.ts", "apps/desktop/src/locales/en/shell-engine.json", "apps/desktop/src/locales/pl/shell-engine.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 10]
---

# OVE_SHELL019: Provide error boundaries and the crash screen for the root, routes and panels

## 1. Summary

Implements the three levels of React error boundaries (root, route, panel), the bare crash screen with 'Reload' and a copyable support reference, and the rule that a crash in one view never takes down the rail, top bar or the Global Pause control. Also owns the eager `shell-engine` i18n namespace that the crash, engine-down and version screens use.

## 2. Context

A white screen is unacceptable for an app that supervises autonomous agents: the Owner must always be able to pause everything and see what failed. SHELL010 mounts `ErrorBoundaryRoot` and `RouteErrorBoundary` slots; this task fills them. Strings for these screens must work even when a lazy namespace chunk failed to load, so `shell-engine` is bundled eagerly (SHELL007 requirement 6). Errors may carry content from CLIs or files; nothing from error messages is shown to the Owner except a code and a correlation id (SHELL004 `toUiError`).

## 3. Scope (in)

- `ErrorBoundaryRoot` (outermost, renders `CrashScreen` on the bare frame).
- `RouteErrorBoundary` (inside the shell frame: rail and top bar stay, the content area shows a route crash card).
- `PanelErrorBoundary` (for list/detail panels and widgets, offered to features as `<PanelBoundary label>`).
- `CrashScreen` and `RouteCrashCard` components with actions 'Odśwież okno' / 'Reload window', 'Wróć na start' / 'Go to start', and 'Skopiuj numer referencyjny' / 'Copy reference'.
- Crash reporting to the local desktop log only (error name, component stack hash, route id, app version); no content.
- `locales/{en,pl}/shell-engine.json` with the full key catalogue for SHELL019/020/021 (below).

## 4. Out of scope

- Engine-down gate (SHELL020) and version mismatch screen (SHELL021): they use this namespace but own their components.
- Sending crash reports anywhere off the machine (never; no telemetry in MVP, ADR 0010).
- Per-feature error states for failed queries (features use `ui:EmptyState` with `toUiError`).

## 5. Detailed requirements

1. **Boundary classes.** One generic `AppErrorBoundary` class component (React requires a class) parameterised by `level: 'root'|'route'|'panel'`, `fallback(error, reset)`, and `resetKeys` (route id / location key so navigating away clears a route crash). `componentDidCatch` calls `reportCrash(level, error, info)` and never rethrows.
2. **Root.** Renders `CrashScreen` with `ui:EmptyState` (icon 'alert', title `crash.title` 'Coś poszło nie tak' / 'Something went wrong', body `crash.body` 'Overmind napotkał błąd w oknie. Twoi Agenci i Runy działają dalej w silniku.' / 'Overmind hit an error in this window. Your Agents and Runs keep working in the engine.'), primary `crash.reload` (calls `window.location.reload()`), secondary `crash.copyRef` (copies the reference to the clipboard through `usePlatform().clipboard`). Root crash screen has NO dependency on i18n loading, API, router or workspace providers (uses the eager bundle through a direct `i18next` instance import in this file only).
3. **Always-available pause.** The root crash screen includes a small 'Global Pause' button (`ui:Button` variant `pause`) that calls `gateway_request` directly via the platform bridge helper `emergencyPause()` (idempotency key generated inline) so a crash never removes the ability to stop everything. It only pauses; resume stays in the normal UI. Result shown inline ('Wstrzymano' / 'Paused' or error code).
4. **Route.** `RouteCrashCard` inside the content area: title `route.title` 'Ten widok nie mógł się załadować', body `route.body` 'Reszta aplikacji działa. Spróbuj ponownie lub wróć na start.', actions 'Spróbuj ponownie' (reset boundary) and 'Wróć na start' (navigate '/'). Chunk load failures (`ChunkLoadError`, dynamic import TypeError) show the extra hint `route.chunk` 'Plik widoku nie wczytał się. Odśwież okno.' and the primary action becomes Reload.
5. **Panel.** `PanelErrorBoundary` shows a compact `ui:EmptyState size="sm"` 'Nie udało się wyświetlić panelu' with 'Spróbuj ponownie'. Features wrap risky panels (canvas, terminal, trace) with it.
6. **Reference.** `reference = crypto.randomUUID().slice(0,8).toUpperCase()` plus the same value written in the log line, so support can match them. The log line fields: `{ ref, level, route, errorName, stackHash (sha-256 of the top 5 frames' function names), appVersion, ts }`. Message text is NOT logged (may contain data).
7. **Dev behaviour.** In development the original error and component stack are shown in a collapsible `details` (not in production builds; `import.meta.env.DEV`).
8. **Reset on navigation.** `resetKeys=[location.key]` for route level; crash state is cleared on navigation; repeated crashes of the same route within 10 s show the 'Wróć na start' action first.
9. **`shell-engine` key catalogue (EN | PL), authored here for SHELL019/020/021:** `crash.title`, `crash.body`, `crash.reload` Reload window | Odśwież okno, `crash.copyRef`, `crash.copied` Copied | Skopiowano, `crash.pause` Global Pause | Global Pause, `route.title`, `route.body`, `route.retry`, `route.home`, `route.chunk`, `panel.title`; `engine.connecting` Connecting to the engine… | Łączenie z silnikiem…; `engine.starting` Engine is starting | Silnik się uruchamia; `engine.recovering` Restoring Runs {{done}} of {{total}} | Przywracanie Runów {{done}} z {{total}}; `engine.down.title` Engine is not running | Silnik nie działa; `engine.down.body` Overmind needs its engine to show anything. Your files are safe. | Overmind potrzebuje silnika, żeby cokolwiek pokazać. Twoje pliki są bezpieczne.; `engine.down.start` Start engine | Uruchom silnik; `engine.down.retry` Try again | Spróbuj ponownie; `engine.down.auth` Connection to the engine was refused. Restart the connection. | Silnik odrzucił połączenie. Uruchom połączenie ponownie.; `engine.banner.lost` Connection to the engine lost. Reconnecting… | Utracono połączenie z silnikiem. Łączę ponownie…; `engine.banner.retry`; `engine.banner.readOnly` Actions are disabled until the connection returns | Akcje są wyłączone do czasu powrotu połączenia; `version.title` Versions do not match | Wersje się nie zgadzają; `version.engineOlder`, `version.engineNewer`, `version.restart`, `version.update`, `version.versions` App {{app}} · engine {{engine}} · protocol {{protocol}}, `version.quit`, `version.copy`.
10. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design: none`. No mock exists for this screen (design: none). It is composed only from ui-kit components (`ui:EmptyState`, `ui:Button`, `ui:Card`, `ui:InfoNote`) on the `bg-app` surface with the product tokens; the implementer must not invent new visual styles. DESIGN GAP recorded in section 14. The only visual rule: centred content, max width 480 px, `EmptyState` icon 40 px in a muted tone; the Global Pause emergency button sits below the actions in a quiet row.

## 7. Reuse

- `ui:EmptyState`, `ui:Button` (variants primary, secondary, pause), `ui:Card`, `usePlatform().clipboard` (SHELL003), `toUiError` (SHELL004), `ErrorBoundaryRoot`/`RouteErrorBoundary` slots (SHELL010).
- No new component in ui-kit; panel compact variant uses `EmptyState` `size` prop (DS032).

## 8. Architecture and code placement

`apps/desktop/src/app/errors/{app-error-boundary.tsx,crash-screen.tsx,route-crash-card.tsx,panel-boundary.tsx,report-crash.ts,emergency-pause.ts,eager-i18n.ts}` and `apps/desktop/src/locales/{en,pl}/shell-engine.json`. UI infrastructure layer.

## 9. Security and safety

- No error message, stack or CLI text is shown to the Owner or logged by content; only a hash and names (prevents leaking secrets that were in a thrown string).
- `emergencyPause()` sends only the pause request with the standard idempotency key through the bridge (token injected by Rust); it never reads or exposes the token.
- The reference is random, not derived from data.
- In production no `details` with stack traces is rendered.

## 10. Errors and edge cases

- Error thrown inside an error boundary fallback: the root boundary's own fallback is minimal static markup (no hooks) to avoid loops.
- Boundary reset while the same error persists: second crash within 10 s changes the primary action as described, no infinite retry loop.
- `clipboard` unavailable: show the reference text selectable instead.
- Locale files fail to load: eager bundle keeps EN and PL strings; fall back to EN.
- Crash during first paint (before CSS): `base.css` is imported first so the screen is dark, never white.
- Engine unreachable when the emergency pause is pressed: show the error code and 'Silnik nie działa' text, no spinner loop.

## 11. Acceptance criteria

- [ ] Given a component throwing in a view then the route card appears, the rail and top bar stay, and navigating elsewhere clears it.
- [ ] Given a root-level throw then the crash screen shows the reference, 'Odśwież okno' and the emergency Global Pause, with no provider dependencies.
- [ ] Given a chunk load failure then Reload is the primary action.
- [ ] Given the log then it contains the reference, level and hash but not the error message text.
- [ ] Given PL locale then all strings are Polish; given broken namespace loading then EN eager strings render.

## 12. Test plan

- Vitest + Testing Library: boundary levels, reset keys, loop guard, log content (no message).
- Storybook stories: RootCrash, RouteCrash, ChunkCrash, PanelCrash; axe checks.
- Playwright (TEST004): inject a throwing test route; assert rail visible.
- Commands: `pnpm --filter @overmind/desktop test errors`.

## 13. Parallelization notes

After SHELL010 (slots). Parallel with SHELL020/021 (they only need the key catalogue, defined here up front). Hotspot: `shell-engine.json` is owned here only.

## 14. Open questions and assumptions

- DESIGN GAP: crash, route-crash and panel-crash screens have no mock.
- OPEN: should a root crash auto-reload once? Default: no (loops hide bugs).
- OPEN: `emergencyPause` bypasses the normal PAUSE module's confirm flow by design (pause is the safe direction); PAUSE area to confirm.
