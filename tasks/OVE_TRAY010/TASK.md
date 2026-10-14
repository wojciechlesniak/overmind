---
id: OVE_TRAY010
title: "Test the tray end to end: view model, windows, actions and visual match"
area: TRAY
kind: test
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS104, OVE_SETUP012, OVE_TEST004, OVE_TEST005, OVE_TRAY005, OVE_TRAY006, OVE_TRAY007, OVE_TRAY008, OVE_TRAY009]
soft_depends_on: []
provides: ["lib:tray-e2e-suite"]
needs: ["lib:playwright-harness", "lib:mock-gateway", "lib:visual-regression", "ui:a11yAudit", "lib:tauri-tray"]
owns: ["apps/desktop/e2e/tray/**", "apps/desktop/src/features/tray/__tests__/**", "docs/qa/tray-manual-checklist.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5]
---

# OVE_TRAY010: Test the tray end to end: view model, windows, actions and visual match

## 1. Summary

Adds the cross-cutting tests of the TRAY area: view-model contract against the mock fixture, the tray window at 380x560 with the mock platform, every action's effect, state matrix, visual regression with the mock crops and an accessibility pass.

## 2. Context

Each TRAY task carries its own unit tests. The assembled popover, its two-window behaviour (tray webview vs main webview) and the safety properties (Global Pause always reachable; no approving controls) need a dedicated suite. The real Tauri windows cannot run in CI; the mock platform and two browser contexts simulate the two windows. A manual macOS checklist covers what automation cannot (positioning, blur, menu-bar icon).

## 3. Scope (in)

- Playwright specs `apps/desktop/e2e/tray/*.spec.ts` using two pages (tray `?window=tray` and main) connected by the mock platform bus.
- Storybook visual and interaction tests for `Tray/Mock` and `Tray/States` (baselines vs `design.png` crops).
- Contract-style test that `TraySummary` fixtures produce the mock texts exactly in PL and EN.
- Manual checklist `docs/qa/tray-manual-checklist.md` for macOS.
- Axe pass for all states.

## 4. Out of scope

- Unit tests inside TRAY002..009.
- Rust behaviour (SETUP010 tests).
- Real engine integration (covered by PAUSE016 and ENGINE tests).

## 5. Detailed requirements

1. **Specs.** (1) mock content: pixel match with `design.png` regions header/agents/actions; (2) data refresh: emit `agent.state.changed` and `approval.requested` through the fake gateway, assert rows and pending row update and the icon status call (`working`, `waiting`); (3) Global Pause: pause from the popover, assert pause route called once with an idempotency key, header 'wstrzymane', resume needs the inline confirmation; (4) per-Workspace pause/resume items; (5) actions: open app, Chief (main page receives `app:navigate` with `routeId: 'chief'` and navigates), Approvals, close window; (6) quit panel: both choices, shutdown header present; (7) engine down: error state, emergency pause works; (8) overflow: 12 rows scroll, footer visible; (9) keyboard: arrows, Esc, Enter; (10) security: no element with approve/reject roles in the popover; no external links.
2. **Manual macOS checklist (documented, run before release):** icon states in light and dark menu bar; popover placement on external display; hide on blur; ⌘O; hide-on-close keeps the tray; quit flows; VoiceOver reading; Spaces and full-screen apps.
3. **Visual tolerance** per TEST005; the clipped bottom row of the mock is masked in the comparison for the whole-mock baseline.
4. **State matrix** from TRAY009 as stories with snapshots.
5. **Perf guard.** Time from `visible` to first meaningful paint with cached data < 100 ms (mock platform; soft budget).
6. **Determinism.** Fake clock and fake gateway; no network.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- TEST004 Playwright harness and fake gateway, TEST005 visual tools, mock `Tray` platform (TRAY007), fixtures `buildTraySummary` (TRAY003).

## 8. Architecture and code placement

`apps/desktop/e2e/tray/**`, `apps/desktop/src/features/tray/__tests__/**`, `docs/qa/tray-manual-checklist.md`. Test layer only.

## 9. Security and safety

- Asserts the safety properties as tests: Global Pause reachable in every state, resume needs confirmation, the popover has no approve or reject controls and no external link, only enumerated commands are issued by the mock platform.
- Fixtures contain no real paths or secrets.

## 10. Errors and edge cases

- Mock platform bus not available: tests fail with a clear message.
- Font loading flake: wait for `document.fonts.ready`.
- Two-page tests need distinct fake client ids; each test creates its own gateway.
- Timing around the 150 ms toggle debounce: use fake timers.

## 11. Acceptance criteria

- [ ] Given CI then all tray specs pass in under 3 minutes.
- [ ] Given the baselines then diffs are within tolerance.
- [ ] Given the security spec then no approving control is found.
- [ ] Given the manual checklist then it is complete and linked from the release checklist (SETUP014 doc).

## 12. Test plan

- The tests are the deliverable; run the suite 5 times in CI to prove stability.
- Commands: `pnpm --filter @overmind/desktop e2e tray`; `pnpm --filter @overmind/desktop storybook:test tray`.

## 13. Parallelization notes

Last of TRAY; needs TRAY005..009. Can start with the Mock story tests early.

## 14. Open questions and assumptions

- ASSUMPTION: TEST004 supports two pages connected to one fake gateway.
- OPEN: whether TEST area owns the macOS manual checklist template.
