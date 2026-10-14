---
id: OVE_PAUSE016
title: "Add Playwright end-to-end tests for the paused UI against the real engine harness"
area: PAUSE
kind: test
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_PAUSE010, OVE_PAUSE011, OVE_PAUSE012, OVE_PAUSE013, OVE_PAUSE014, OVE_PAUSE015, OVE_SETUP012, OVE_TEST004]
soft_depends_on: []
provides: ["lib:pause-ui-e2e-suite"]
needs: ["lib:playwright-harness", "lib:mock-gateway"]
owns: ["apps/desktop/e2e/pause/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16"]
adr_refs: [5, 6]
---

# OVE_PAUSE016: Add Playwright end-to-end tests for the paused UI against the real engine harness

## 1. Summary

Playwright scenarios that exercise every pause UI surface together against the mock gateway (and, in the nightly job, against a real test engine): top bar button, banner, composers, approvals, tray model, Workspace card and settings panel.

## 2. Context

Each UI task has component tests. The whole point of Global Pause is that every surface agrees and that nothing starts while paused, so one cross-surface test per scenario is cheap insurance (SPEC 16.13: same state on every surface).

## 3. Scope (in)

- Scenarios in `apps/desktop/e2e/pause/*.spec.ts`.
- Mock-gateway fixtures for pause snapshots including `pausing`, Workspace scope and Telegram origin.

## 4. Out of scope

- Visual baselines (component level): the UI tasks. Engine behaviour: OVE_PAUSE009.

## 5. Detailed requirements

1. S1 pause from the top bar: click, toast, banner, composers disabled, card states, tray model status all switch from one gateway push.
2. S2 resume with confirmation: cancel keeps paused; confirm resumes; composers enabled; typed draft preserved.
3. S3 pause from Telegram (push with `via: telegram`): UI shows paused without interaction and the settings note says 'z Telegrama'.
4. S4 Workspace-only pause: only that Workspace's composer and card change; banner variant is the Workspace one.
5. S5 approvals while paused: approve disabled with hint, deny works.
6. S6 pausing phase: counts update; banner text changes; becomes 'Wszystko wstrzymane' at 0.
7. S7 engine unreachable: control disabled, no false paused state; recovers on reconnect with the initial snapshot.
8. S8 reload while paused: banner present immediately after the first snapshot.
9. S9 accessibility: axe on each state; focus order; the live region announces once.
10. Each scenario runs in under 10 s; selectors use roles and accessible names only.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Playwright harness and mock gateway (OVE_TEST004), the shared pause fixtures created here.

## 8. Architecture and code placement

`apps/desktop/e2e/pause/` with `fixtures/pause-snapshots.ts`; no production code.

## 9. Security and safety

- Tests use only mock data; no engine credentials in artifacts; traces redact tokens.

## 10. Errors and edge cases

- Animations disabled in test mode (reduced motion) to avoid flakiness.
- Time-dependent text (since) uses a fixed clock injected into the mock gateway.

## 11. Acceptance criteria

- [ ] S1 to S9 pass in CI on Linux Chromium.
- [ ] Failing any scenario blocks the PR for pause area tasks (CI job `e2e:pause`, fragment for SETUP006).
- [ ] No scenario uses sleeps over 100 ms.

## 12. Test plan

`pnpm --filter desktop e2e -- pause`.

## 13. Parallelization notes

Last UI task of the area.

## 14. Open questions and assumptions

- The nightly run against a real engine uses the harness of OVE_PAUSE009 once ENGINE provides a startable test engine.
