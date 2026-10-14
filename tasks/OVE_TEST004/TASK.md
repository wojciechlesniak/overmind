---
id: OVE_TEST004
title: Build the Playwright harness for the desktop UI against a mock gateway
area: TEST
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH008, OVE_ENGINE019, OVE_SETUP009, OVE_SETUP012, OVE_TEST001]
soft_depends_on: [OVE_ARCH011, OVE_TEST002]
provides: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:e2e-fixtures", "lib:test-fake-gateway", "lib:ui-test-harness"]
needs: ["lib:mock-gateway", "lib:api-client-transport"]
owns: ["apps/desktop/e2e/playwright.config.ts", "apps/desktop/e2e/harness/**", "apps/desktop/e2e/fixtures/**", "apps/desktop/e2e/smoke/**", "packages/testing/src/mock-gateway-control/**", "apps/desktop/src/shared/gateway/test-transport/**", "docs/testing/e2e.md"]
reads: ["apps/desktop/src/shared/platform/", "tasks/_design/VIEWS.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [5, 18]
---

# OVE_TEST004: Build the Playwright harness for the desktop UI against a mock gateway

## 1. Summary

Provide everything a UI task needs to write an end-to-end test without Tauri or the real engine: a Playwright setup that serves the Vite build in a browser, a programmable mock gateway (scenarios, fixtures, event pushes, failure injection), a test-only transport and platform mocks that bypass Tauri, and ergonomic helpers (page objects, locale and clock control, accessibility hooks).

## 2. Context

The desktop UI talks to the engine only through `api-client` over a `Transport` (ARCH001 section 6). Inside Tauri the transport is forwarded by the Rust shell; browsers cannot open Unix sockets, so tests need another route. `OVE_SETUP012` provides local dev scripts and a mock gateway; this task builds the test-facing layer: deterministic scenarios and control, not a second mock server. The design is rendered at 1440x900; visual comparison is TEST005, accessibility checks are TEST010.

## 3. Scope (in)

- Playwright configuration (projects, base URL, viewport, deviceScaleFactor, reduced motion, locale/timezone, trace policy).
- Test-only transport `HttpTestTransport` + selection seam in `apps/desktop/src/shared/gateway/` (compiled only in `e2e`/`dev` modes).
- Mock gateway control API and scenario DSL (`packages/testing/src/mock-gateway-control/`).
- Platform mocks wiring (`PlatformProvider` mock set from ARCH012: Tray, FileDialog, Clipboard, DesktopShell).
- Fixtures: `test` extended with `gateway`, `app`, `clock`, `locale`; page-object base class; sample smoke tests.
- Documentation `docs/testing/e2e.md`.

## 4. Out of scope

- The mock gateway server itself and dev scripts: `OVE_SETUP012`. Visual regression: `OVE_TEST005`. a11y checks: `OVE_TEST010`. Feature-specific page objects and flows: the UI feature tasks. Testing the real Tauri shell (WebDriver): later / not planned.

## 5. Detailed requirements

1. **Process model:** Playwright `webServer` starts (a) the mock gateway on a random free loopback port (printed to env `OVERMIND_MOCK_GATEWAY_URL`), (b) `vite preview` (or dev server) of `apps/desktop` built with `--mode e2e`, on a random port. Each test file gets a fresh gateway state (`POST /__control/reset`), each test its own scenario. Workers are parallel-safe: one mock gateway per worker (port per worker via `workerInfo.parallelIndex`).
2. **Bypassing Tauri:** in `e2e` mode the app selects `HttpTestTransport` (base URL from `window.__OVERMIND_E2E__ = { gatewayUrl, locale, now }` injected with `page.addInitScript` before load) instead of the Tauri IPC transport. The selection function `createTransport()` in `apps/desktop/src/shared/gateway/create-transport.ts` (owned by SHELL/ENGINE; this task adds the `test-transport/` folder and one guarded import line via proposal if not present) uses `import.meta.env.MODE === 'e2e'`. A build check (`pnpm build:desktop && node tools/testing/assert-no-test-code.mjs dist`) fails if the production bundle contains `HttpTestTransport`, `__OVERMIND_E2E__` or `/__control` strings. Platform interfaces use mock implementations (`platform/mock/*`): Tray records `setStatus/setMenu` calls (exposed through `window.__e2e.platform.calls`), FileDialog returns scripted paths (`app.platform.nextFilePick('/Users/test/Projects/demo')`), Clipboard in-memory, `openExternal` records URLs and never navigates.
3. **Mock gateway control API** (HTTP on the same server, path prefix `/__control`, loopback only, disabled in release mode), typed client `gatewayControl` exposed in tests:
   - `reset()`; `useScenario(name | ScenarioDefinition)`; `seed(entity, data[])` (validated against contract zod schemas; invalid fixtures fail fast); `respond(routeId, handler | static, { times?, delayMs?, status? })` to override a route; `fail(routeId, errorCode, { times })` returns an `ErrorResponse` with a registered code (ARCH003); `pushEvent(envelope)` / `pushEvents([...])` to the subscription stream (ARCH010 envelope, validated); `dropConnection()` to test reconnect/`afterEventId`; `setLatency(ms)`; `calls(routeId?)` returns recorded requests (bodies redacted) for assertions; `expectCalled(routeId, matcher)`; `time.set/advance` for server-controlled timestamps.
   - The mock validates every request body against the route's zod schema (from ARCH008 `routes.ts` generated table) and every response it serves; a UI sending an invalid request fails the test with the validation error. Unknown routes return 404 `gateway.not_found` and fail the test run (strict mode default).
   - Scenarios: `scenarios/<name>.scenario.ts` files discovered by glob; built-in scenarios: `empty-install` (first run, no folder), `onboarded` (one Workspace, folder allowed, CLIs detected), `busy-day` (3 agents working, pending approvals), `paused`, `offline-engine`, `login-required`, `limit-exhausted`, `telegram-disconnected`. Feature tasks add scenarios in their feature folder (`apps/desktop/src/features/<feature>/e2e/*.scenario.ts`) discovered by the same glob.
4. **Fixtures (Playwright `test.extend`)**: `gateway` (control client), `app` (navigates to `/`, waits for `data-app-ready`, offers `goto(route)`, `rail(name)`, `topBar`), `locale` (`en`, `pl`, `en-XA`; default `en`), `clock` (installs Playwright `page.clock` with a fixed start `2026-10-13T09:00:00Z`, `clock.runFor/fastForward` helpers), `platform` (mock platform recorder), `consoleGuard` (fails on `console.error`, unhandled rejections, uncaught page errors and requests to non-allowlisted hosts; the app must make no external network requests: route handler aborts anything not to the app/mock origin and records it as failure).
5. **Determinism:** `reducedMotion: 'reduce'`, `animations: 'disabled'` in screenshots, `locale` and `timezoneId: 'UTC'`, fixed viewport 1440x900 (`deviceScaleFactor: 2` project `chromium-2x` for visual tests; 1 for functional), fonts loaded from the bundled files (no network), `Math.random` and `Date` controlled by `page.clock` + seeded `window.crypto.getRandomValues` shim in `e2e` mode; ids come from the mock gateway.
6. **Selectors policy:** tests use roles/labels (`getByRole`, `getByLabel`, `getByText` with i18n keys resolved through `t('ns:key')` helper `ui.text('board:lane.empty.title')` that reads the EN JSON so tests do not hard-code copy), `data-testid` only for non-semantic hooks (canvas nodes) following `<feature>-<element>` naming; no CSS or XPath selectors. A lint rule `testing/no-css-selectors-in-e2e` is added to TEST001's plugin via proposal.
7. **Page object base:** `class Page { constructor(app); region(slug)` (finds `[data-region="<slug>"]` using the region slugs of `tasks/_design/VIEWS.md`, needed by TEST005) `}`. UI tasks MUST put `data-region` attributes on the regions they implement (documented in e2e.md).
8. **Event stream emulation:** the mock supports the subscription protocol of ARCH010 (`afterEventId`, heartbeat, `events.resync_required`) so reconnect logic is testable.
9. **Smoke tests shipped** (`apps/desktop/e2e/smoke/*.spec.ts`): app boots in `onboarded` scenario and shows the shell; boots in `empty-install` and redirects to the wizard; engine offline scenario shows the offline state; language switch EN->PL->`en-XA` re-renders; no console errors; no external network requests; mock rejects an invalid request (harness self-test); event push updates a counter.
10. **CI:** `pnpm e2e` runs headless Chromium (Playwright pinned container image for stable rendering, TEST005), sharded, retries 0 on `main` and 1 on PRs with flaky reporting (TEST008), HTML report + traces on failure uploaded as artifacts, trace `retain-on-failure`, video off. Job fragment `apps/desktop/e2e/ci-job.yml` for SETUP006.
11. **Tauri-only behaviours** (tray clicks, native dialogs, window events) are tested through the mock platform recorders; their real behaviour is covered by Rust/Tauri tests in SETUP010/TRAY and manual smoke checks documented in e2e.md ("what e2e does not cover").

## 6. Design notes

N/A, functionality only (reference to `tasks/_design/VIEWS.md` region slugs for `data-region`).

## 7. Reuse

Mock gateway server (SETUP012), generated route table and schemas (ARCH008), envelope and subscription semantics (ARCH010), platform interfaces and mock set (ARCH012), i18n helpers (ARCH011, pseudo-locale), builders (TEST002) for seed data, error codes (ARCH003). UI feature tasks reuse `test`, `gatewayControl`, scenario discovery; they do not start their own servers.

## 8. Architecture and code placement

- `apps/desktop/e2e/{playwright.config.ts,harness/,fixtures/,smoke/}` (test code, excluded from the production build).
- `packages/testing/src/mock-gateway-control/` (typed control client and scenario DSL, shared with component tests that want a fake `api-client`).
- `apps/desktop/src/shared/gateway/test-transport/` (guarded by mode; tree-shaken in production; verified by the bundle assertion).
- Dependency rule: app code never imports `packages/testing` (only e2e mode entry imports the test transport from its own folder).

## 9. Security and safety

The control API and test transport are dangerous in production (they bypass authentication), so: only bound to loopback, only started by the test runner, only compiled in `e2e` mode, guarded by a random per-run control token required in the `X-Control-Token` header, and absent from release bundles (CI assertion). The mock gateway must model real authorisation semantics for scopes at least minimally (agent-scope calls rejected) so UI tests do not rely on privileges the real app lacks. Tests use fake data only; no real paths (use `/Users/test/...`), no tokens. External requests are blocked, so a UI bug that leaks data to a URL fails the test. Rendering of hostile content (Markdown with `javascript:` links, HTML) is covered by dedicated e2e cases supplied by UI tasks using the injection corpus (SEC004).

## 10. Errors and edge cases

- Port collisions in parallel workers: random free ports with retry.
- Mock gateway crashes mid-test: harness fails the test with the gateway log tail.
- Long-lived event streams keeping the page busy: `app.settled()` waits for network idle excluding the stream.
- Fonts not yet loaded at screenshot time: `document.fonts.ready` awaited in `app.ready()`.
- Scenario referencing a route that has no schema: harness errors listing the route id.
- Time zone/locale leaks between tests: set per context, not global.
- Tests run against `vite dev` accidentally: harness asserts `import.meta.env.MODE === 'e2e'` via a `data-mode` attribute on `<html>`.

## 11. Acceptance criteria

- [ ] `pnpm e2e` runs the smoke suite headless with the Vite build, mock gateway and no Tauri.
- [ ] Invalid request bodies sent by the UI fail the test with a zod message; unknown routes fail the run.
- [ ] `gateway.pushEvent` updates the UI live; `dropConnection` triggers reconnect using `afterEventId`.
- [ ] Scenarios `empty-install`, `onboarded`, `busy-day`, `paused`, `offline-engine`, `login-required`, `limit-exhausted`, `telegram-disconnected` exist and are valid against contracts.
- [ ] Console errors, page errors and external network requests fail tests (and a negative self-test proves it).
- [ ] Production bundle assertion passes (no test transport, no control strings) and fails on a planted marker (self-test).
- [ ] Locale fixture switches `en`, `pl`, `en-XA`; `ui.text()` resolves copy from EN JSON.
- [ ] `docs/testing/e2e.md` documents writing a test, adding a scenario, `data-region` convention, what e2e does not cover.

## 12. Test plan

Harness self-tests in `apps/desktop/e2e/harness/*.selftest.spec.ts`; unit tests for the control client and scenario DSL (`packages/testing/src/mock-gateway-control/*.test.ts`); the bundle assertion script test with fixture dist folders. Commands: `pnpm e2e --project=chromium`, `pnpm vitest run packages/testing/src/mock-gateway-control`, `pnpm build:desktop && pnpm test:no-test-code`.

## 13. Parallelization notes

Coordinate with SETUP012 (mock gateway server ownership) and SHELL (transport seam). Scenario files and page objects are per feature, so UI tasks add files without editing the harness. Hotspot: `playwright.config.ts` (owned here; additions via proposal) and the `createTransport` seam (one-line change by SHELL/ENGINE).

## 14. Open questions and assumptions

- ASSUMPTION: SETUP012's mock gateway exposes an extensible HTTP/NDJSON server; if it is minimal, this task extends it through `mock-gateway-control` rather than forking it.
- ASSUMPTION: engine transport for the browser test mode is HTTP + NDJSON/SSE for events, mirroring the real framing chosen by ENGINE; if ENGINE chooses WebSocket framing the test transport follows.
- Open: running a subset of e2e against the real engine binary on macOS CI (smoke) — later.
