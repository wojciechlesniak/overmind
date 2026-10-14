---
id: OVE_ONB023
title: "Test the onboarding wizard end to end: backend slice, UI flows, security, visual"
area: ONB
kind: test
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ONB005, OVE_ONB007, OVE_ONB010, OVE_ONB013, OVE_ONB016, OVE_ONB017, OVE_ONB018, OVE_ONB019, OVE_ONB021, OVE_ONB022, OVE_SEC003, OVE_TEST002, OVE_TEST004, OVE_TEST005, OVE_TEST006, OVE_TEST009, OVE_TEST010, OVE_TEST012]
soft_depends_on: []
provides: ["lib:onboarding-e2e-suite", "doc:onboarding-scenarios"]
needs: ["lib:test-utils", "lib:playwright-harness", "lib:mock-gateway-control", "lib:visual-regression", "bin:fake-claude", "bin:fake-codex", "lib:fake-herdr", "lib:fake-telegram-api", "lib:a11y-harness", "lib:no-secrets-assert"]
owns: ["packages/application/src/onboarding/__tests__/**", "apps/desktop/e2e/onboarding/**", "docs/testing/onboarding-scenarios.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [3, 4, 10, 21]
---

# OVE_ONB023: Test the onboarding wizard end to end: backend slice, UI flows, security, visual

## 1. Summary

Adds the cross-cutting tests for the ONB area: a backend vertical slice on the real engine with fakes at the OS edge, Playwright flows of the whole wizard against the mock gateway, visual regression with the mock crops, security tests (no secret in logs or storage, local approval required, isolation gate) and the scenario catalogue for the mock gateway.

## 2. Context

Individual tasks have unit tests. The wizard crosses areas (PERM, BOX, PROV, TG, DATA) and windows; defects would sit at the seams: the proof sequence, resume after a crash, the gate rules, terminal pass-through, completion. SPEC criterion 1 says the wizard requires a folder and without it Agents have access to nothing; SPEC 11 says nothing runs without isolation. These must be proven by tests, not assumed.

## 3. Scope (in)

- Backend slice test `packages/application/src/onboarding/__tests__/wizard-slice.test.ts` using the engine composition with fakes for sandbox, providers and Telegram (TEST002/009/012): the full happy path, resume after a restart at each step, replacement of the folder, gate failures, completion.
- Playwright specs `apps/desktop/e2e/onboarding/*.spec.ts`: happy path, resume, folder rejections, isolation failure, container setup, login terminal, Telegram connect and pairing, skip, completion redirect, guard behaviour.
- Scenario catalogue for the mock gateway `docs/testing/onboarding-scenarios.md` and scenario files `apps/desktop/e2e/onboarding/scenarios/*.ts`.
- Security tests: sentinel secrets (login code, bot token, pairing code, path) never appear in logs, DOM after use, storage, events or audit; local proof required; agent/Telegram principals refused.
- Visual regression of the wizard against the mock crops (sidebar, step 1 content, step 2 checklist, terminal, footer).
- Accessibility pass (axe) for each step and state; keyboard-only run through the wizard.

## 4. Out of scope

- Unit tests inside each task.
- Real macOS isolation checks (TEST007 CI gate; this task only shares the probe list).
- Telegram security suite (SEC008/TG tests).

## 5. Detailed requirements

1. **Backend slice.** Steps: (1) fresh state -> `GET state` not_started; (2) `folders/suggest` on a temp tree; (3) validate and provision with a proof (fake `LocalApprovalGate`); (4) `checks/run` with fake sandbox all ready; (5) fake CLI login (fake-claude from TEST006) via the login routes with the fake terminal; (6) rename Workspace; (7) Telegram connect/pair with the fake Bot API; (8) `complete` -> completed state and event. Variants: engine restart after each step (state resumes), folder replaced after going back, isolation probe failing (no completion possible), CLI logged out before completion (`cli_login` missing), Telegram pending (`telegram_decision`).
2. **Security assertions.** (a) Provision without a proof fails with `perm.local_approval_required` and creates nothing; (b) proof reuse for another folder fails; (c) agent and Telegram tokens get 403 on all onboarding routes; (d) the login stream payload never reaches the logger/audit/event bus (spies); (e) sentinel login code typed into the input never appears anywhere; (f) bot token and pairing code sentinels absent from logs and storage; (g) denylisted folders (`~/.ssh`, `~`, system paths, symlink to `/etc`) are rejected; (h) with isolation failing, `complete` is refused.
3. **Playwright flows.** F1 happy path from fresh to dashboard; F2 quit and resume at step 2 (reload the page at each step); F3 Finder rejection reasons; F4 isolation failed banner and no bypass; F5 container missing and kernel setup with the confirm dialog; F6 Codex login terminal with a fake CLI printing a link, URL button opens through the mock platform, paste code, success; F7 URL not allowlisted (no button); F8 Telegram connect, pairing code shown, pairing event, success; F9 skip Telegram; F10 first-run guard redirects `/` to `/onboarding` and back after completion; F11 keyboard-only run; F12 PL and EN and pseudo-locale.
4. **Visual.** Baselines compared with `design.png` crops of ONB011/012/014/017/018 within TEST005 tolerance; the 943 px tall step 2 page is captured at 1440x900 with scroll and the sticky footer.
5. **Scenario catalogue.** `docs/testing/onboarding-scenarios.md` lists scenario names used by the mock gateway: `onboarding-fresh`, `onboarding-step1`, `checks-all-ready`, `checks-isolation-failed`, `checks-container-missing`, `checks-kernel-missing`, `checks-codex-waiting`, `checks-no-cli`, `login-codex`, `login-url-rejected`, `telegram-connect`, `telegram-pairing`, `telegram-locked`, `complete-missing-cli`.
6. **Performance guard.** Wizard step transitions under 200 ms with cached data; checks UI updates within 300 ms of events (fake clock).
7. **Flakiness policy.** Fake clock, no sleeps, isolated gateway per test; suite repeated 5 times in CI before merge.

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- TEST002 utilities, TEST004 Playwright harness and mock gateway, TEST005 visual tools, TEST006 fake CLIs, TEST009 fake herdr, TEST010 a11y helpers, TEST012 fake Telegram API, `no-secrets-assert` (SEC003).

## 8. Architecture and code placement

`packages/application/src/onboarding/__tests__/**`, `apps/desktop/e2e/onboarding/**`, `docs/testing/onboarding-scenarios.md`. Test layer only.

## 9. Security and safety

- The suite is the executable evidence for SPEC criterion 1 and the isolation requirement of SPEC 11 for the wizard.
- Fixtures contain no real credentials; sentinels are random strings generated per run.
- Tests run against fakes at the OS edge; no real login or network.

## 10. Errors and edge cases

- Fake sandbox scripting drift from the real adapters: contract tests for fakes exist in their areas.
- Playwright cannot run the real Tauri file dialog: the mock platform returns scripted paths.
- Slow CI: the slice test is under 60 s.
- Locale snapshots differ by font loading: wait for `document.fonts.ready`.

## 11. Acceptance criteria

- [ ] Given CI then the slice test and all Playwright flows pass.
- [ ] Given the security assertions then each fails when the protection is removed (mutation spot-checks documented).
- [ ] Given the visual baselines then diffs are within tolerance.
- [ ] Given the scenario catalogue then every scenario name used by tests exists in the mock gateway.
- [ ] Given 5 repeated CI runs then there are no flaky failures.

## 12. Test plan

- The tests are the deliverable; mutation spot-checks: temporarily disable the proof requirement, the isolation gate, the log exclusion, the URL classification, and confirm tests fail.
- Commands: `pnpm vitest run packages/application/src/onboarding/__tests__`; `pnpm --filter @overmind/desktop e2e onboarding`.

## 13. Parallelization notes

Last of ONB; needs ONB001..022. Can be built incrementally per flow as dependencies land.

## 14. Open questions and assumptions

- ASSUMPTION: TEST004's mock gateway supports named scenarios and an event emitter API.
- OPEN: whether the backend slice belongs in the TEST area; kept here because it uses ONB composition only.
