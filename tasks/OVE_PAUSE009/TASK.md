---
id: OVE_PAUSE009
title: "Add the backend vertical-slice tests for Global Pause and its Telegram rules"
area: PAUSE
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_PAUSE003, OVE_PAUSE004, OVE_PAUSE005, OVE_PAUSE006, OVE_PAUSE007, OVE_PAUSE008, OVE_TEST002, OVE_TEST012, OVE_TG013]
soft_depends_on: ["OVE_TEST012"]
provides: ["lib:pause-e2e-suite"]
needs: ["lib:composition-root", "lib:fake-clock", "lib:fake-telegram-api", "lib:telegram-adapter"]
owns: ["apps/engine/test/pause/**", "packages/testing/src/pause/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16"]
adr_refs: [3, 5, 6]
---

# OVE_PAUSE009: Add the backend vertical-slice tests for Global Pause and its Telegram rules

## 1. Summary

End-to-end tests at engine level (no UI) that prove SPEC criteria 7 and 14 for pause: instant effect on new work, safe-point draining, persistence across restart, authority rules (Telegram pauses but cannot resume), audit trail and idempotency.

## 2. Context

The individual tasks have unit tests with fakes. This task composes the real pause module, SQLite repository (temp file), gateway in-process transport and fake participants/fake Telegram API to catch integration defects, in particular ordering at boot and cross-channel behaviour.

## 3. Scope (in)

- Scenario suite `apps/engine/test/pause/*.e2e.test.ts`.
- A reusable `FakeWorkDispatcher` and `pausedWorld()` builder in `packages/testing/src/pause/` for WFRT/PROV/CHAT tests.

## 4. Out of scope

- Real workflow runtime and provider tests: WFRT, PROV.
- UI end-to-end (Playwright): OVE_PAUSE016.

## 5. Detailed requirements

1. Scenario 1 'instant effect': start 3 fake Runs, call `PUT /v1/pause/global`; assert `guard('start_run')` fails within the same tick, new Run creation returns `pause.paused`, the in-flight steps finish, then `pause.drain.updated` reaches `phase: 'paused'`.
2. Scenario 2 'no state lost': in-flight fake step completes during pause; its result is persisted; after resume the Run continues from the checkpoint; a fake non-idempotent action interrupted by the pause is not executed twice.
3. Scenario 3 'survives restart': pause, stop and recreate the engine from the same temp data dir; assert paused before the first dispatcher start; resume at desktop; assert running.
4. Scenario 4 'corrupt state fails closed': corrupt the `pause_state` row; the engine starts paused and a `system_attention` notification request is recorded.
5. Scenario 5 'authority': Telegram principal pauses (ok, audit `via: telegram`), Telegram resume gives `pause.resume_requires_desktop` and an audited denial; desktop resume succeeds; agent and Chief principals fail both ways.
6. Scenario 6 'idempotency and races': 20 concurrent `PUT global paused:true` from desktop and Telegram produce version 1 and one audit event.
7. Scenario 7 'workspace scope': pause Workspace A; B keeps dispatching; resume A; global pause overrides a resumed A.
8. Scenario 8 'telegram while paused' (uses the fake Telegram API when available): `/status` is answered, free text is answered with the paused notice and starts nothing, an Approval button press is rejected with the paused notice while Deny works.
9. Scenario 9 'what still works': backups (`RunBackupNow` fake) and notifications are delivered during pause.
10. All scenarios use the fake clock; no sleeps; the suite runs under 20 s.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Composition test harness (`composeEngine({ overrides })`, ARCH006/TEST002), `FakeClock`, `FakeAuditSink`, fake Telegram API (TEST012), `FakePauseParticipant` (OVE_PAUSE006), `PauseGate` contract.

## 8. Architecture and code placement

Tests live in `apps/engine/test/pause/`; shared helpers in `packages/testing/src/pause/` (new folder, owned here). Tests use public factories only (`composeEngine`, `createTelegramChannel`).

## 9. Security and safety

- The suite is the regression net for the safety properties 'pause cannot be silently lifted' and 'Telegram cannot resume'; mutation checks: a sabotaged gate that always returns ok must fail scenarios 1 and 3.
- Fake tokens only; no network.

## 10. Errors and edge cases

- Scenario timing relies on fake timers; flakiness is a defect.
- If the Telegram adapter is not merged yet, scenario 8 is skipped with an explicit marker `it.skip` and an issue link, never deleted.

## 11. Acceptance criteria

- [ ] All nine scenarios exist and pass.
- [ ] Sabotage variants (gate always ok; resume authority removed; boot loads nothing) each fail at least one scenario.
- [ ] The suite runs in CI under 20 seconds.
- [ ] `FakeWorkDispatcher` is documented and used by at least one other area's test (listed in the PR).

## 12. Test plan

`pnpm vitest run apps/engine/test/pause`. Mutation harness as in SEC005/SEC008 style (documented sabotage flags).

## 13. Parallelization notes

Final backend task of the area; runs after the others. The helpers folder is new and owned here, so no conflicts.

## 14. Open questions and assumptions

- Scenario 8 depends on the Telegram adapter (OVE_TG014); until then it is skipped explicitly.
