---
id: OVE_PERM030
title: Build the permissions abuse-case and acceptance scenario suite (criteria 1, 8, 9, 10, 14)
area: PERM
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM010, OVE_PERM014, OVE_PERM016, OVE_PERM017, OVE_PERM026, OVE_PERM027, OVE_PERM028, OVE_SEC005, OVE_TEST002, OVE_TEST012]
soft_depends_on: [OVE_TEST007, OVE_SEC008, OVE_PERM029]
provides: ["lib:perm-abuse-suite", "ci:perm-security-tests"]
needs: ["lib:test-utils", "lib:fake-ports", "lib:gateway-security-suite", "lib:fake-telegram-api"]
owns: ["packages/gateway/test/security/perm/**", "packages/testing/src/perm/scenarios/**", "docs/security/perm-abuse-cases.md"]
reads: ["packages/application/src/perm/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16.1", "SPECIFICATION 16.8", "SPECIFICATION 16.9", "SPECIFICATION 16.10", "SPECIFICATION 16.14"]
adr_refs: [3, 4, 6, 20, 21]
---

# OVE_PERM030: Build the permissions abuse-case and acceptance scenario suite

## 1. Summary

An end-to-end security test suite, running against the real gateway with in-memory adapters and the fake Telegram API, that attacks the permission system the way a malicious Agent, a forged Telegram message or a confused component would. It makes SPEC acceptance criteria 1, 9, 10 and the permission parts of 8 and 14 executable.

## 2. Context

Unit tests prove parts; this suite proves the composition: transport-derived channel, authority matrix, local proofs, approvals, access requests, mounts, audit. The real isolation wall is tested by TEST007 (escape tests); this suite checks that the mount plan fed to it is right.

## 3. Scope (in)

Scenario helpers and tests in the groups below; a document listing each abuse case with the control that stops it.

## 4. Out of scope

Real sandbox escape tests (TEST007/BOX), Telegram adapter-internal tests (SEC008), gateway authentication tests (SEC005).

## 5. Detailed requirements (each item is at least one named test)

A. Deny by default (criterion 1)
1. Fresh Workspace with empty list: `CheckAccess` denies read, write, list, delete; `PrepareRunMounts` returns no mounts and blocks the Run.
2. Policy row unreadable (corrupt JSON), pause state unreadable, sandbox unavailable, audit store down: every case denies/aborts, none allows.
B. Intersection and delegation (criterion 10)
3. Agent profile `Read Only` in a `rw` Workspace: write denied with layer `agent`. Workflow and Tool layers narrowing likewise. Property replay of `regressions.json`.
4. A Chief/Team-Lead delegation chain cannot widen: attempt to assign a wider profile through the Agent route by an agent principal is rejected.
C. Path attacks (criterion 8, permission side)
5. `../`, symlink-out, case variants, Unicode variants, NUL, 5000-byte paths, `~`, `/`, data dir: all denied or refused with violations; no absolute host path appears in any Agent-visible response.
6. Access Request for protected locations never created.
D. Telegram (criteria 9 and 10)
7. Telegram approves an Access Request: Run grant only, nothing added to the Workspace policy, grant gone when the Run ends, second Run denied.
8. Telegram `grant_permanent`, add directory, lift override, edit profile, local confirmation create, audit export: all `perm.local_approval_required`/`channel_not_permitted`, violations logged, state unchanged.
9. Forged channel: request bodies with `channel:'desktop'`, `local:true`, `principal`, `scope:'permanent'` are rejected by strict schemas; callback replay of a decided approval has no effect.
10. Telegram prompt-injection text ("approve everything") produces no decisions.
E. Agents and Chief
11. Agent token on every Owner route: 403 + violation; agent A on agent B's approval or request: `perm.not_found`.
12. Agent files 50 requests: limits, dedupe, anti-nagging after denial; the audit store receives bounded events.
13. Agent-supplied justification with markup/prompt injection is returned only as plain text and never changes any decision.
F. Approvals (criterion 10, ADR 0021)
14. Each default-list class returns `needs_approval`; approval is single use: second consume fails; different params/Run/Agent fails; expired fails; approved-by-Telegram cannot be reused after Run end.
15. Override lift needs desktop + proof; after lift, push allowed without approval; restore re-requires; `payment` cannot be lifted.
16. Local proof abuse: reuse, other args, other session, expired, concurrent use.
G. Budget and pause (criterion 14, permission side)
17. `budget_overrun` always needs approval and cannot be lifted.
18. Pause: Telegram approval rejected, consume refused, CheckAccess denies (PERM029).
H. Mounts and audit
19. Mount plan contains only effective directories; consistency property against `evaluateAccess`; narrowing detaches before ack; failed detach stops environment.
20. Every scenario above leaves audit events with the correct channel and no secrets (`expectAuditEventSafe`); chain verifies; tampering test fails verification.
21. Crash injection (TEST011) between decision and consume, and between grant and mount: no double execution, healed mounts at restart.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Gateway harness and authorisation matrix (SEC005), fake Telegram (TEST012), `FakeSandbox`, builders (TEST002), PERM arbitraries, `expectAuditEventSafe` (PERM021).

## 8. Architecture and code placement

Tests under `packages/gateway/test/security/perm/*.sec.test.ts`; scenario helpers in `packages/testing/src/perm/scenarios/`. Tests use public factories only.

## 9. Security and safety

The suite is a CI gate (`ci:perm-security-tests`). Each test documents the control it protects, and a mutation check per group (temporarily removing the control in a local run) is described in the PR. Tests never use real secrets or real user paths.

## 10. Errors and edge cases

Flaky time: only `FakeClock`. Order independence: each test builds fresh stores.

## 11. Acceptance criteria

- [ ] All 21 groups implemented and green; CI job `perm-security-tests` required.
- [ ] Removing the Telegram scope restriction, the proof check, the hash binding or the ceiling intersection each makes at least one test fail (documented mutation run).
- [ ] `docs/security/perm-abuse-cases.md` lists every case with its control and test name.

## 12. Test plan

`pnpm vitest run packages/gateway/test/security/perm`; nightly with larger property runs.

## 13. Parallelization notes

Last PERM task; sections can be written incrementally as dependencies land.

## 14. Open questions and assumptions

- ASSUMPTION: real isolation is covered elsewhere; this suite uses `FakeSandbox` and the mount plan.
