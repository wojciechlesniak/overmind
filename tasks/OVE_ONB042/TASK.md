---
id: OVE_ONB042
title: "Test secret hygiene and Telegram rules in wizard step 4: token, pairing, permissions"
area: ONB
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ONB020, OVE_ONB021, OVE_ONB039, OVE_ONB041, OVE_TEST002, OVE_TEST004, OVE_TEST012, OVE_TG014]
soft_depends_on: ["OVE_ONB034", "OVE_TG012"]
provides: ["lib:onboarding-step4-security-suite"]
needs: ["lib:test-fake-gateway", "lib:fake-keychain", "lib:fake-telegram-api", "lib:telegram-e2e-suite"]
owns: ["apps/desktop/src/features/onboarding/__tests__/step4-security/**", "packages/application/src/onboarding/__tests__/step4-security/**"]
reads: ["apps/desktop/src/features/onboarding/steps/telegram/**", "packages/application/src/telegram/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 14", "SPECIFICATION 16.1"]
adr_refs: [3, 6]
---

# OVE_ONB042: Test secret hygiene and Telegram rules in wizard step 4: token, pairing, permissions

## 1. Summary

A dedicated test suite that proves the security promises of wizard step 4: the bot token goes to the Keychain and is never shown again or leaked into state, cache, logs, events or DOM; the pairing code is one-time, expiring and cleared; Telegram never extends permissions; and no secret can travel through Telegram.

## 2. Context

Step 4 is the first place in the product where the Owner pastes a secret. ADR 0006: Telegram is a second channel and never extends permissions permanently; approvals from it apply to the current Run only. SPEC 5 and the secrets policy (SEC003): secrets only in Keychain, referenced by id, redacted at logging. Existing tasks test their own units (ONB020, ONB021, TG012, TG014, TG017); this suite tests the cross-layer promises end to end with canary strings so a regression anywhere is caught. Steps 3-4 have no mock, so no visual tests; the visual review is a separate open question.

## 3. Scope (in)

- UI-layer tests with canary token and code values (DOM, React state snapshot, query cache, logger capture, storage, clipboard, error messages).
- Engine-slice tests: route -> use case -> fake Keychain and fake Bot API, checking responses, events, audit and logs.
- Negative tests for permission extension and secret relay through Telegram.

## 4. Out of scope

- Production code changes (fixes go to the owning task or a proposal).
- Telegram adapter internals (TG014, TG017); visual regression.

## 5. Detailed requirements

1. **Canary token.** Use `CANARY_TOKEN = '123456789:AAAA_canary_token_must_never_leak_1234567'` and `CANARY_CODE`. Assertion helper `expectNoSecret(sink)` scans a serialisable sink for the canary and any substring of 12+ characters of it.
2. **Token flow (UI).** After a successful connect: input element removed, DOM text has no canary, React Query cache dump has no canary, `console.*`/logger capture has no canary, `localStorage`/`sessionStorage`/IndexedDB spies untouched, the error toast text for `token_invalid` has no canary, the request body is redacted in the api-client debug log (`token` key), the 'Pokaż' reveal hides itself after 10 s (fake timers) and on blur.
3. **Never shown again.** Re-entering step 4 (Back/Next, resume after restart) shows the bot username only; no UI path or API response returns the token; `GET /v1/telegram/status` and `GET /v1/onboarding/summary` responses contain no canary.
4. **Engine side.** With fake Keychain: the token is stored under `telegram.bot-token` once; failed validation stores nothing; Keychain locked -> `telegram.keychain_locked` and nothing partial; no canary in audit rows, events, structured logs, error details or the SQLite fake dump.
5. **Pairing code.** One-time and expiring: using a code twice fails; after `expiresAt` it fails (fake clock); 5 wrong attempts lock for 15 minutes (TG003); the UI clears the code on unmount, success, expiry and step change (ONB041); a screenshot-like DOM snapshot after success contains no code; the code is not copied to the clipboard automatically.
6. **No permission extension.** Pairing and the `done` status change no Permission Policy, Allowed Directory, approval list or Owner Rule (snapshot the PERM fakes before and after); a Telegram principal calling `PUT /v1/onboarding/telegram-decision`, `telegram.connect` or `pairing-code` gets 403 and an audit `denied`; a decision cannot be set to `done` by a client.
7. **No secrets via Telegram.** A forged inbound Telegram message containing the canary token or a string shaped like a token before pairing is ignored; after pairing, a message with a token-like string is refused with the fixed refusal, is not stored or forwarded to the Chief, and is audit-logged as `secret_removed` without the value (TG007 behaviour; this suite asserts it from the onboarding scenario).
8. **Foreign sender.** Messages from an unpaired chat id while a code is active do not pair unless they contain the valid code; a valid code from a second chat after pairing is refused (`already_paired`).
9. **Prompt-injection text.** A bot username or display name containing markup or instruction text renders as plain text in the step and the summary.
10. Tests use only fakes; no network; deterministic with fake clock.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Fakes: `lib:fake-keychain` (SEC/ARCH012), `lib:fake-telegram-api` and repositories (TG004), fake gateway (TEST004), fake clock (TEST002), the Telegram e2e harness (TG014). No new test framework.

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/__tests__/step4-security/*.test.tsx` and `packages/application/src/onboarding/__tests__/step4-security/*.test.ts`; shared helper `expect-no-secret.ts` inside these folders (the suite owns it; TEST area may later promote it).

## 9. Security and safety

This task is the security evidence for step 4. Tests must not print canaries into CI logs beyond their fixed fake values; real tokens are never used or stored in fixtures; snapshots are forbidden for any object that could contain secrets (assert by predicate instead).

## 10. Errors and edge cases

- Token with whitespace/newline pasted: trimmed, still no leak.
- Token valid format but rejected: nothing stored, message generic.
- Paired chat sends a /status then a token: status answered, token refused.
- Engine restarts mid-pairing: code invalid, new code needed.
- Clock skew near expiry: expiry computed by the engine only.

## 11. Acceptance criteria

- [ ] Given a connect then no sink contains the canary (DOM, cache, logs, storage, audit, events, responses).
- [ ] Given a re-entry or restart then the token is not retrievable through any route.
- [ ] Given a used, expired or wrong code then pairing fails with the typed error; five wrong attempts lock.
- [ ] Given pairing then permission fakes are unchanged.
- [ ] Given a Telegram principal then the three desktop-only routes return 403.
- [ ] Given a token-like Telegram message then it is refused, not stored, and audited without the value.
- [ ] Given markup in bot names then it renders as text.

## 12. Test plan

Files: `token-never-leaks.test.tsx`, `token-engine-slice.test.ts`, `pairing-code-lifecycle.test.tsx`, `no-permission-extension.test.ts`, `no-secrets-via-telegram.test.ts`, `foreign-sender.test.ts`, `injection-text.test.tsx`. Commands: `pnpm --filter @overmind/desktop test features/onboarding/__tests__/step4-security` and `pnpm --filter @overmind/application test onboarding/__tests__/step4-security`. Wired into the CI security job (SETUP006).

## 13. Parallelization notes

Starts when ONB020/ONB021/ONB039/ONB041 are merged; parallel with ONB043. No shared-file edits.

## 14. Open questions and assumptions

- ASSUMPTION: the secret-refusal behaviour is owned by TG007; failures there become proposals, not fixes here.
- OPEN: whether CI may run these in a dedicated 'security' job; default yes.
