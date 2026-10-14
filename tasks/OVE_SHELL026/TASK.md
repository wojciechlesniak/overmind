---
id: OVE_SHELL026
title: "Test the shell end to end: accessibility, visual regression and Playwright flows"
area: SHELL
kind: test
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS104, OVE_SETUP012, OVE_SHELL011, OVE_SHELL012, OVE_SHELL013, OVE_SHELL014, OVE_SHELL016, OVE_SHELL017, OVE_SHELL018, OVE_SHELL019, OVE_SHELL020, OVE_SHELL021, OVE_SHELL022, OVE_SHELL024, OVE_SHELL025, OVE_TEST004, OVE_TEST005]
soft_depends_on: []
provides: ["lib:shell-e2e-suite"]
needs: ["lib:playwright-harness", "lib:mock-gateway", "lib:visual-regression", "ui:a11yAudit"]
owns: ["apps/desktop/e2e/shell/**", "apps/desktop/src/app/__tests__/shell-assembly/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [18]
---

# OVE_SHELL026: Test the shell end to end: accessibility, visual regression and Playwright flows

## 1. Summary

Adds the cross-cutting verification of the shell: axe checks of the assembled frame in every state, visual regression of the rail and top bar against the design crops, and Playwright flows for navigation, Workspace switching, Global Pause, engine loss and first-run redirect against the fake gateway.

## 2. Context

Individual SHELL tasks carry unit and story tests. What no single task covers is the assembly: frame, rail, tabs, top bar and slots working together, focus order, the 67 px bar at several widths, engine states, and the behaviour across route changes. TEST004 provides the Playwright harness and the fake gateway; TEST005 provides visual regression tooling; DS104/105 test ui-kit pages. This task owns only SHELL assembly tests.

## 3. Scope (in)

- Playwright specs under `apps/desktop/e2e/shell/` (navigation, switcher, pause, engine states, first-run, keyboard, notifications).
- Storybook interaction/visual tests for `Shell/Frame`, `TopBar/States`, rail and tabs states.
- Axe scans of the frame with each state and both locales (EN, PL) and the pseudo-locale.
- Visual baselines compared with `design.png` crops of SHELL012/013/014/016 within tolerance, plus the paused and error variants (baselines only).
- A bundle/regression check: no document scroll, bar height 67 at 1100/1280/1440.

## 4. Out of scope

- Unit tests inside each task.
- Feature view tests (other areas).
- Tray and onboarding e2e (TRAY008, ONB023).

## 5. Detailed requirements

1. **Flows (each a Playwright test with the fake gateway from TEST004):** (1) cold start with a healthy engine: shell renders, rail has 7 items, Pulpit active; (2) rail keyboard: Tab order skip link -> rail items -> top bar -> main; Enter activates; (3) sub-tabs: Workflow tabs remember the last tab; (4) Workspace switch via menu keeps scoped route; (5) Global Pause: pause, banner appears, resume; (6) engine lost: banner, read-only mutation tooltip, recovery toast; (7) engine down at start: full screen and 'Uruchom silnik'; (8) version mismatch screen for both reasons; (9) first-run: fresh state redirects to `/onboarding`, completed state does not; (10) toast on `approval.requested` and native notification mock; (11) shortcuts `Mod+,`, `Mod+1`; (12) crash route: throwing test route keeps rail and top bar.
2. **Accessibility.** axe on: frame ready, frame loading, top bar error, paused, engine screens, crash screens, onboarding frame. Zero violations; known false positives listed in `a11y-allow.json` with a reason each (reviewed).
3. **Visual.** Baseline names `shell-frame-1440`, `shell-topbar-1440`, `-1280`, `-1100`, `shell-rail-active-<slot>`. Tolerance per TEST005; the 117 px variant crops (`design-main.png`) are NOT baselines (E1).
4. **Performance guard.** Time to first shell paint with the fake gateway < 1.5 s in CI (soft budget: warning above, fail above 3 s); no more than one `shell.top-bar` request per event burst.
5. **Security checks.** The webview makes no network request except the bridge/ipc (CSP) in Tauri-like mode (asserted by Playwright request listener in the web runtime: only the configured gateway origin); no token in `localStorage` or DOM.
6. **i18n.** Pseudo-locale run: no element with a raw key text (`topbar.` prefix regex) in the DOM.
7. **Flakiness policy.** No fixed sleeps; use `expect.poll` with the event hub fake clock; each test is independent.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- TEST004 Playwright harness and fake gateway, TEST005 visual tools, `FakeEventSource` (SHELL006), Storybook test runner, `a11yAudit` helper (DS104).

## 8. Architecture and code placement

`apps/desktop/e2e/shell/**`, `apps/desktop/src/app/__tests__/shell-assembly/**`, `apps/desktop/e2e/shell/a11y-allow.json`. Test layer only; no production code.

## 9. Security and safety

- Tests run against the fake gateway with fake tokens only; fixtures contain no real paths or secrets.
- The suite asserts the security-relevant UI behaviours: the Global Pause always reachable (crash, error, engine loss), no token in the DOM, CSP-compatible requests.

## 10. Errors and edge cases

- Fake gateway not available: tests skip with a clear message locally, fail in CI.
- Font loading flake in visual tests: wait for `document.fonts.ready`.
- Reduced motion: tests set `prefers-reduced-motion: reduce` to stabilise snapshots.
- Parallel workers share no state; each test creates its own gateway instance.

## 11. Acceptance criteria

- [ ] Given CI then all flows pass in under 6 minutes and produce HTML reports.
- [ ] Given each state then axe reports no violation.
- [ ] Given the baselines then diffs are within tolerance; intentional changes require updating baselines in the PR.
- [ ] Given the pseudo-locale then no raw key is visible.
- [ ] Given a crash route then the Global Pause control remains clickable.

## 12. Test plan

- The tests are the deliverable; their own reliability is checked by running the suite 5 times in CI (no flaky failures) before merge.
- Commands: `pnpm --filter @overmind/desktop e2e shell`; `pnpm --filter @overmind/desktop storybook:test`.

## 13. Parallelization notes

Last of the SHELL wave; needs SHELL011..025 merged. Can be built incrementally per flow as dependencies land.

## 14. Open questions and assumptions

- OPEN: confirm tolerance values with TEST005 for the dark gradient surfaces.
- ASSUMPTION: the TEST004 harness exposes `startFakeGateway({ scenario })` with scenarios for engine down and incompatible.
