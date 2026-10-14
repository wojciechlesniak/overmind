---
id: OVE_ONB043
title: "Test wizard steps 3-4 and completion end to end: scenarios, resume, Back and skip"
area: ONB
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ONB038, OVE_ONB039, OVE_ONB040, OVE_ONB041, OVE_TEST002, OVE_TEST004, OVE_TEST012]
soft_depends_on: ["OVE_ONB023", "OVE_ONB036"]
provides: ["lib:onboarding-step34-e2e-suite", "doc:onboarding-step34-scenarios"]
needs: ["lib:playwright-harness", "lib:test-fake-gateway", "lib:fake-telegram-api", "lib:fake-keychain"]
owns: ["apps/desktop/e2e/onboarding/steps34/**", "docs/onboarding/step34-scenarios.md"]
reads: ["apps/desktop/src/features/onboarding/**", "apps/desktop/e2e/onboarding/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [6, 10, 16, 28]
---

# OVE_ONB043: Test wizard steps 3-4 and completion end to end: scenarios, resume, Back and skip

## 1. Summary

Playwright scenarios against the mock gateway (TEST004) that walk wizard steps 3 and 4, the summary and entry to the Dashboard, including skipping Telegram, Back navigation, restart-resume and failure paths. They complement ONB023 (which covers the whole wizard happy path) by going deep on the parts without mocks.

## 2. Context

Steps 3 'Pierwszy Workspace' and 4 'Telegram (opcjonalnie)' have no design mock; their correctness is behavioural. The end-to-end tests are the only place where the host, the step modules, the cleanup rules, and the engine contracts meet. SPEC 16.1 acceptance: a first run reaches a working Dashboard with a Workspace. Telegram is optional and never blocks.

## 3. Scope (in)

- Scenario files and fixtures for the mock gateway (state progression, fake Telegram and Chief responses).
- `docs/onboarding/step34-scenarios.md` listing each scenario, its preconditions and expected results.

## 4. Out of scope

- Steps 1-2 scenarios and the full happy path (ONB023); security canary tests (ONB042); visual regression (no mocks exist; screenshots are saved as review artifacts only).

## 5. Detailed requirements

1. **S1 happy path with Telegram skipped:** start at step 3 (steps 1-2 done in fixture), rename the Workspace, leave isolation off, link a suggested documentation file, see the greeting preview change with the name, Next to step 4, press 'Pomiń na razie', summary shows 'Pominięto', 'Wejdź do Pulpitu' lands on the Dashboard with the Workspace current; `onboarding.completed` fired once.
2. **S2 isolation on:** toggle on shows the note; `workspaces.update` sent once with `isolated: true`; summary shows the 'izolowany' pill.
3. **S3 Telegram paired:** connect with a fake token (bot username shown, token field gone), create a pairing code, fake Bot API delivers the code message, status becomes paired, summary shows '@bot sparowany'. The code is not visible after pairing.
4. **S4 bot connected, not paired, Next:** allowed with the hint; summary 'Bot połączony, bez parowania'.
5. **S5 Back navigation:** 4 -> 3 keeps the saved name and link; token field typed then Back clears it; 3 -> 2 and forward again works; stepper click on a pending step is inert; forged URL to `/onboarding/telegram` before step 3 done redirects.
6. **S6 resume:** reload the page on step 3 (engine state in fixture) and on step 4 after skip (shows the skipped view and 'Jednak połącz'); after bot connected and reload the form is not shown again.
7. **S7 failures:** name conflict inline error; documentation outside the folder rejected with message; token invalid message; lockout countdown after five wrong pairing attempts; `not_ready_to_complete` returns to the missing step with the banner; engine offline overlay and recovery.
8. **S8 completion hand-off:** after enter, Chief conversation contains the greeting exactly once (fixture of the greeting poster), no Run is started, no Telegram message is sent at completion.
9. **S9 accessibility:** each screen has axe clean results; the wizard is fully keyboard operable (Tab order, Enter on forms, Escape does nothing destructive); focus lands on the title after each step change.
10. Flakiness rules: no sleeps; wait on roles and live regions; fake timers only through the harness clock.

## 6. Design notes

N/A, functionality only. Because no mock exists, screenshots of each screen are attached to the CI run for the pending design review (record in section 14).

## 7. Reuse

Playwright harness and mock gateway (TEST004), fixtures from ONB023 where possible (import, do not copy), fake Telegram API and Keychain (TG004, SEC), axe helper (TEST001).

## 8. Architecture and code placement

`apps/desktop/e2e/onboarding/steps34/{s1-happy-skip.spec.ts, s2-isolation.spec.ts, s3-paired.spec.ts, s4-unpaired.spec.ts, s5-back.spec.ts, s6-resume.spec.ts, s7-failures.spec.ts, s8-handoff.spec.ts, s9-a11y.spec.ts, fixtures/**}` and the scenarios doc.

## 9. Security and safety

- Only fake tokens and codes; the suite asserts that the fake token never appears in the page after connect (light check; deep check in ONB042).
- Tests run only against the mock gateway, never a real Telegram or Keychain.
- Failure scenarios confirm fail-closed behaviour (completion refused when a gate is not met).

## 10. Errors and edge cases

Covered by S5-S7: double click, Back during requests, expired code, lockout, deleted Workspace, missing documentation file, offline engine, repeated `complete`.

## 11. Acceptance criteria

- [ ] Given S1..S9 then all pass on CI in under 4 minutes total and are stable over 20 repeated runs.
- [ ] Given the completion then exactly one greeting message and one `onboarding.completed` event exist in the fixture.
- [ ] Given the skip then restart then the skipped view shows.
- [ ] Given every screen then axe reports no violations.
- [ ] Given the scenarios doc then every scenario in section 5 is listed.

## 12. Test plan

`pnpm --filter @overmind/desktop e2e onboarding/steps34`; repeat-each 20 in a nightly job; traces and screenshots on failure; scenarios doc reviewed with the Owner during the design review.

## 13. Parallelization notes

After the UI tasks land; parallel with ONB042. Fixtures folder is owned here; ONB023 owns its own folder, no overlap.

## 14. Open questions and assumptions

- OPEN (design): steps 3-4 and the summary need a design review; screenshots from this suite are the input.
- ASSUMPTION: the harness can simulate engine restarts by swapping fixture state.
- ASSUMPTION: the e2e path convention `apps/desktop/e2e/**` follows TEST004; adjust if it differs.
