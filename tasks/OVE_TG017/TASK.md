---
id: OVE_TG017
title: "Test Telegram resilience and log hygiene: restart, stale updates, limits and secrets"
area: TG
kind: test
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ENGINE018, OVE_TEST002, OVE_TEST012, OVE_TG014]
soft_depends_on: []
provides: ["lib:telegram-resilience-suite"]
needs: ["lib:fake-telegram-api", "lib:test-engine-harness", "lib:fake-keychain"]
owns: ["tests/integration/telegram-resilience/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 20"]
adr_refs: [6]
---

# OVE_TG017: Test Telegram resilience and log hygiene: restart, stale updates, limits and secrets

## 1. Summary

Second half of the SEC008 test list: restart and replay, stale updates, rate limits, 429 and 409 handling, and a secrets sweep.

## 2. Context

Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them.

## 3. Scope (in)

- Resilience scenarios.
- Log and storage hygiene sweep.

## 4. Out of scope

- Happy paths: TG014.

## 5. Detailed requirements

1. Resilience: restart replays no update twice; stale updates older than 10 minutes dropped with a notice; 429 `retry_after` honored; 409 shows `conflict`.
2. Log hygiene: `expectNoSecrets` over logs, audit, events, DB dump after the whole suite.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Harness from TG014.

## 8. Architecture and code placement

`tests/integration/telegram-resilience/*.test.ts`; no production code.

## 9. Security and safety

- Executable form of the remaining T-rules.

## 10. Errors and edge cases

- Fake Clock drives all time rules.

## 11. Acceptance criteria

- [ ] All scenarios pass in CI under 60 seconds.
- [ ] Remaining T-rules each map to a named test.

## 12. Test plan

Command: `pnpm vitest run tests/integration/telegram-resilience`.

## 13. Parallelization notes

After TG014.

## 14. Open questions and assumptions

- None.
