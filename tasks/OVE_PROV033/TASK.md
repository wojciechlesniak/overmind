---
id: OVE_PROV033
title: Build the PROV abuse and security test suite for hostile repos, output and crashes
area: PROV
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_PROV008, OVE_PROV009, OVE_PROV013, OVE_PROV014, OVE_PROV015, OVE_PROV018, OVE_PROV024, OVE_PROV027, OVE_PROV029, OVE_TEST002, OVE_TEST006, OVE_TEST009]
soft_depends_on: [OVE_TEST011, OVE_PROV030, OVE_BOX021]
provides: ["lib:prov-abuse-suite", "ci:prov-security-tests"]
needs: ["lib:prov-fakes", "lib:prov-builders", "lib:fake-cli-scenarios", "lib:fake-herdr", "lib:fake-clock", "usecase:StartAgentSession", "port:AgentSessionGateway", "lib:delivery-guard", "usecase:TranslateCliDialogToApproval", "usecase:VerifyTurnOutcome", "usecase:HandleProviderLimit", "lib:redaction"]
owns:
  - packages/testing/src/prov-abuse/**
  - apps/engine/test/security/prov/**
  - docs/providers/abuse-cases.md
reads: ["tools/fake-cli/screens/", "docs/research/prototyp-wnioski.md", "tasks/OVE_TEST011/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 15", "SPECIFICATION 16"]
adr_refs: [3, 4, 22, 26, 27]
---

# OVE_PROV033: Build the PROV abuse and security test suite for hostile repos, output and crashes

## 1. Summary

A dedicated suite of adversarial scenarios for the provider and session layer, run in CI on fakes (fake CLIs, fake herdr, fake clock). It proves that hostile text on a terminal, a hostile repository, a symlink, a new domain, a crash in the middle of a command and a forged limit screen cannot make Overmind send input it should not send, approve something, switch a model, leak a token or retry a non-idempotent action.

## 2. Context

The prototype showed herdr reporting `done` on an expired login and on a choice dialog, and an Agent starting in `/`. Everything PROV reads from a terminal is untrusted (ADR 0026, Spec 12 and 15). Security controls are implemented in PROV008, 013, 014, 015, 018, 027 and 029 and in BOX; this task is the independent verification that wires the cases together and keeps them as a regression gate. Fake simulators come from TEST006 and TEST009; the shared escape-test harness is TEST011.

## 3. Scope (in)

- Scenario files and helpers under `packages/testing/src/prov-abuse/`.
- Engine-level test runner `apps/engine/test/security/prov/` using `createTestEngine` with fake sandbox, fake herdr, fake CLIs.
- CI job `ci:prov-security-tests` (required check) and `docs/providers/abuse-cases.md` (case catalogue, expected outcome per case).

## 4. Out of scope

- Real container escape and network tests (BOX021 and TEST007), control implementation (the owning tasks), real CLI runs (opt-in tag only).

## 5. Detailed requirements

Each case has an id `PA-nn`, a fixture, an expected result and a negative-control (the same flow without the attack succeeds).

1. **PA-01 Malicious repo prints a fake dialog:** a file in the Workspace makes the CLI echo text that looks like a permission dialog with `1. Yes`. Expect: no key is sent; a real dialog (from the CLI profile rule on the live prompt region) is the only trigger; the fake text produces no Approval and no answer.
2. **PA-02 Fake login-expired text in repo content:** the screen contains `please run /login` inside a code listing. Expect: classification uses position and rule context; at most `unknown` with low confidence, no login flow started, no Connection set to `needs_login` without a probe.
3. **PA-03 Prompt-injected output tries to drive Overmind:** agent output says "press y", "run curl evil.example", "approve all". Expect: zero `sendKey`/`sendText` calls, zero Approvals created or resolved, zero egress.
4. **PA-04 Symlink in workdir:** `/work/link -> /etc` and `/work/out -> /creds`. Expect: effect probes (PROV015) and Skill install (PROV012) never follow it (no read outside `/work`, `lstat` semantics), verdict `unverified` or `failed`, an audit entry, no credential path touched.
5. **PA-05 CLI tries a new domain:** the fake CLI requests `https://new.example`. Expect: the egress policy (BOX013) denies by default and raises one Approval; the session shows `waiting_approval`; no retry loop (request count bounded); after denial the CLI continues or fails without more attempts.
6. **PA-06 Crash mid-command:** kill the engine after the intent is journalled and before or after the herdr call. Expect: on restart the delivery is `delivery_unknown`, never resent, the turn fails non-retryably, an Escalation is created; a crash before the intent record leaves nothing sent.
7. **PA-07 Forged limit screen:** repo text imitating `usage limit reached, resets at ...` while the CLI is working. Expect: no `provider.limit_reached`, no model switch, no fallback record; a genuine limit screen (fixture from TEST006) does switch exactly once with one notification.
8. **PA-08 Control characters and escape sequences in prompts and replies:** ANSI/OSC sequences, bracketed-paste end marker, NUL, very long lines, Unicode bidi. Expect: `sendText` rejects control input, screens are normalised, replies are redacted and size-capped, UI-bound fields contain no raw escapes.
9. **PA-09 Token leakage:** plant token-like strings (OAuth callback URL, `sk-`-style keys, `OVERMIND_API_TOKEN`) in output, config and errors. Expect: logs, audit, events, error messages and test snapshots pass `expectNoSecrets`; login URLs with codes are never logged.
10. **PA-10 Forged or reordered herdr events:** duplicated, out-of-order, wrong-agent and oversize events; herdr state `done` while the screen shows a dialog. Expect: hint-not-proof rules hold, dangerous states win, no send into a blocked terminal, oversize events dropped with a counter.
11. **PA-11 No blind retry:** timeouts and transport errors on a send. Expect: exactly one send per idempotency key across all failure injections.
12. **PA-12 Isolation unavailable:** sandbox not ready or ticket missing. Expect: every purpose fails closed with `box.isolation_unavailable`, no CLI process is started on the host (spy on spawn).
13. **PA-13 Pause:** Global Pause during a turn. Expect: no sends, no new sessions, no login start, until resume.
14. **PA-14 Dialog answer by Approval only:** CLI permission dialog with a change preview. Expect: an Approval is created with the preview, the key is sent only after the Owner's decision from the trusted channel, a stale Approval (dialog changed) is never applied.
15. **PA-15 Workdir:** a session whose CLI starts in `/` (prototype fault) is refused or stopped before any prompt is sent.
16. **Runner:** each case is deterministic (fake clock, seeded), < 5 s, runs in parallel, produces a machine-readable report `reports/prov-abuse.json`; any new input-sending code path must be covered by a case (checked by a coverage list of the gateway methods: a method with no abuse case fails the suite).
17. **Mutation checks:** for PA-03, PA-06 and PA-11 a deliberately weakened component (guard disabled, retry enabled) must make the case fail, proving the case can detect the defect.
18. **Documentation:** `docs/providers/abuse-cases.md` lists each case, the control it verifies, and how to add one.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PROV024 fakes and builders, TEST006 screens and scenarios, TEST009 fake herdr fault switches, TEST011 harness conventions, `expectNoSecrets`, `FakeClock`.

## 8. Architecture and code placement

`packages/testing/src/prov-abuse/{cases/*.case.ts,fixtures/*,runner.ts,coverage.ts}` and `apps/engine/test/security/prov/*.test.ts`. Test-only; no production import of the package (boundary lint). One file per case to avoid conflicts.

## 9. Security and safety

The suite itself must be safe: fixtures contain no real credentials or reachable URLs (reserved `.example` domains, generated token-like strings registered with the secret scanner allowlist); hostile payloads are inert text; no real network, no real CLIs, no host processes outside the test sandbox. Reports redact excerpts.

## 10. Errors and edge cases

- A case becomes flaky: forbidden, fix the fake or the case; no retries in CI.
- A new CLI version changes screens: fixtures are updated by the TEST006 owner, the case ids stay stable.
- Real CLI variants run only under the opt-in tag and never in the required check.

## 11. Acceptance criteria

- [ ] All PA cases pass on the real PROV components with fakes, in the required CI job.
- [ ] Each case has a negative control that succeeds without the attack.
- [ ] Mutation fixtures for PA-03, PA-06 and PA-11 fail the corresponding cases.
- [ ] The coverage list fails when a gateway or terminal input method has no abuse case.
- [ ] No secret-like string appears in logs, audit or reports (`expectNoSecrets`).
- [ ] `docs/providers/abuse-cases.md` matches the case list.

## 12. Test plan

The deliverable is itself tests: engine-level tests with `createTestEngine`, fake sandbox, `FakeHerdr`, `fake-claude`/`fake-codex`. Commands: `pnpm vitest run apps/engine/test/security/prov packages/testing/src/prov-abuse`.

## 13. Parallelization notes

Cases can be written per control as each owning task lands; the runner and coverage list first. Different files per case, no hotspots.

## 14. Open questions and assumptions

- ASSUMPTION: BOX013 exposes the new-domain Approval through a testable port in fakes; if not, PA-05 runs against the real proxy fake of BOX021.
- Open: whether this required check merges into the TEST011 aggregate job (default: separate job, reported together).
