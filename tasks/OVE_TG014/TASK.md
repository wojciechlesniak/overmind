---
id: OVE_TG014
title: "Test the Telegram channel end to end: pairing, routing and approvals with the fake Bot API"
area: TG
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE018, OVE_TEST002, OVE_TEST012, OVE_TG013]
soft_depends_on: []
provides: ["lib:telegram-e2e-suite"]
needs: ["lib:fake-telegram-api", "lib:test-engine-harness", "lib:fake-keychain"]
owns: ["tests/integration/telegram/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 20"]
adr_refs: [6, 25]
---

# OVE_TG014: Test the Telegram channel end to end: pairing, routing and approvals with the fake Bot API

## 1. Summary

Integration suite that runs a real engine composition against the fake Telegram server and executes SEC008 test list T1-T14 plus the happy paths.

## 2. Context

Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. Tests must not touch the network.

## 3. Scope (in)

- Pairing happy path and abuse.
- Foreign sender traffic.
- Approvals via buttons.
- Secret refusal.

## 4. Out of scope

- Unit tests inside each task. Desktop UI tests: ONB.

## 5. Detailed requirements

1. Scenarios: pair via `/start <code>` and reject reuse, expired and wrong codes; lockout after 5 wrong attempts; foreign user is silent, counted, audited without content.
2. Approval flow: bubble appears, tap allow_run, one decision with scope run, bubble edited; replay no-op; desktop-decided conflict; paused refusal and deny.
3. Routing: no mention reaches Chief, `@agent` reaches that Agent, unknown agent answers help, commands `/status` and `/pause`; `/resume` is refused with an explanation.
4. Secret paste: refused, not stored, not logged, Owner told to use the desktop (documented difference from SEC008 test 11).
5. Each of T1-T14 covered here is mapped to a test name in a table in the suite README comment; the rest are in TG017.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Fake Telegram API, engine harness, `expectNoSecrets`.

## 8. Architecture and code placement

`tests/integration/telegram/*.test.ts` plus a `helpers.ts`; no production code.

## 9. Security and safety

- The suite is the executable form of SEC008; a failing rule blocks release.

## 10. Errors and edge cases

- Fake server must support `link_preview_options`; if not, propose to TEST012.
- Time-based rules use the fake Clock.

## 11. Acceptance criteria

- [ ] All scenarios pass in CI under 60 seconds.
- [ ] Every T-rule has at least one named test.
- [ ] No real network access (blocked by the harness).

## 12. Test plan

Command: `pnpm vitest run tests/integration/telegram`.

## 13. Parallelization notes

After TG013; independent of TG015.

## 14. Open questions and assumptions

- None.
