---
id: OVE_WSPACE016
title: Local Approval security and abuse-case tests for the UI layer
area: WSPACE
kind: test
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST002, OVE_TEST004, OVE_WSPACE014, OVE_WSPACE015]
soft_depends_on: []
provides: ["ci:ui-security-tests"]
needs: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:test-utilities"]
owns: ["apps/desktop/tests/local-approval/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [3, 6]
---

# OVE_WSPACE016: Local Approval security and abuse-case tests for the UI layer

## 1. Summary

Adds the abuse-case suite proving that the UI side of Local Approval cannot be bypassed or confused: wrong arguments, replay, expired proofs, other channels, leaks, unknown operations and rate limits.

## 2. Context

Local Approval (Zgoda lokalna, glossary) is an approval given only at the computer with Overmind, never remotely (ADR 0003, 0006, 0021; spec 11; acceptance criteria 9 and 10). Actions that WIDEN access or weaken protection need it: permanent folder grant, deleting a Workspace, lifting a consent requirement, relaxing isolation, changing the backup folder. Backend (PERM009): the Owner desktop session calls `POST /v1/local-confirmations` with `{ operation, args, ttlSeconds }` (route scope owner, `local:true`, desktop principal only, rate limit 10/min) and receives `{ confirmationId, expiresAt, actionHash }`; the widening call then carries `localProof: { confirmationId }` in its BODY; the engine recomputes `sha256(canonicalJson({operation,args,installationId}))` from the ACTUAL call arguments, so a proof is bound to exactly those arguments, expires after at most 60 s on the engine's monotonic clock and is single use. Operations registered by area: `access.grant_permanent`, `policy.widen`, `override.lift` (PERM), `workspace.delete`, `workspace.make_shared` (DATA), `owner_rule.lift_consent` (DATA), `backup.folder.change` (BACKUP). Telegram, Agents and Chief can never obtain a proof (PERM008): the UI cannot make it possible either, because the UI contains no way to mint or forward a proof for another channel. The backend suite is OVE_PERM030; this one covers the desktop client and its integration with a mock gateway that implements the PERM009 hash/expiry/single-use semantics exactly.

## 3. Scope (in)

- `tests/security/local-approval.security.test.ts`, mock-gateway behaviours (`local-confirmation` handler faithful to PERM009), e2e `local-approval.e2e.ts` through the first-folder flow.

## 4. Out of scope

- Backend tests (OVE_PERM030).

## 5. Detailed requirements

1. Abuse cases (each its own test): A1 args changed between mint and call (mismatch) -> engine refuses, UI shows mismatch and no state change; A2 replay: second widening call with the same proof -> `used`; A3 expiry: advance the fake clock 61 s -> `expired`, UI asks again with a NEW id; A4 proof from another session -> `session`; A5 unknown operation -> fails closed without a mint call; A6 caller tries two concurrent `run`s -> second fails busy; A7 rate limit: 11 mints in a minute -> UI shows the rate message; A8 describer hides an arg -> test fails (coverage test); A9 `confirmationId` and `localProof` never appear in logger/console/storage/DOM snapshots (spies + `document.body.innerHTML` scan); A10 no request body contains `principal`/`channel`/`local`; A11 the widening call is sent exactly once (no auto retry) even on network error; A12 Telegram-origin: simulated gateway rejects with `channel_not_permitted`, UI shows the message and offers nothing else.
2. Integration: for each registered operation of this backlog (`access.grant_permanent`/`policy.widen`, `workspace.delete`, `workspace.make_shared`, `override.lift`, `owner_rule.lift_consent`, `backup.folder.change`) a test starts the corresponding UI flow with the mock gateway and asserts that the widening call is impossible without a dialog confirmation (click-through helper).

## 6. Design notes

N/A, tests only.

## 7. Reuse

- OVE_TEST004 harness, fake clock of OVE_TEST002, OVE_WSPACE014/015.

## 8. Architecture and code placement

Test code only under `apps/desktop/tests/local-approval/`.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Fixtures contain synthetic ids; no real secrets.

## 10. Errors and edge cases

- Fake clock vs engine monotonic clock: mock gateway uses the same fake clock object.

## 11. Acceptance criteria

- [ ] All abuse cases A1..A12 and the per-operation integration tests pass in CI and run in the security job (`ci:ui-security-tests`).

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: as listed. Commands: `pnpm --filter @overmind/desktop test security`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/tests/local-approval/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the mock gateway implementation of the PERM009 semantics is provided here (a small module) until TEST004 offers one.
