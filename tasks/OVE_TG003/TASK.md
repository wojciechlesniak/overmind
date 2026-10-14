---
id: OVE_TG003
title: "Implement pairing: one-time code, expiry, single use, lockout and unpair"
area: TG
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_ENGINE011, OVE_ENGINE016, OVE_SEC005, OVE_TG001]
soft_depends_on: []
provides: ["usecase:CreatePairingCode", "usecase:ConfirmPairing", "usecase:Unpair", "usecase:GetPairingState", "lib:telegram-pairing-domain"]
needs: ["port:SecureRandom", "port:Clock", "port:AuditSink", "port:EventBus", "lib:gateway-principal"]
owns: ["packages/domain/src/telegram/**", "packages/application/src/telegram/pairing/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16"]
adr_refs: [6, 10]
---

# OVE_TG003: Implement pairing: one-time code, expiry, single use, lockout and unpair

## 1. Summary

The pairing domain and use cases: generate a single-use code on the desktop, confirm it from the Telegram side, keep exactly one paired chat, rate-limit and lock out guessing, and unpair. Backs wizard step 4 'Telegram (optional)' (no mock, UI belongs to ONB).

## 2. Context

ADR 0006: 'the account is linked by Pairing with a one-time code from the desktop'. Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. T1: code of at least 40 bits, valid 10 minutes, bound to the installation, consumed on first valid use; one paired `chatId`+`userId`; pairing again requires unpair first; 5 wrong attempts lock pairing for 15 minutes (SEC008 section 10).

## 3. Scope (in)

- Pure domain: code generation helpers, normalisation, validity, lockout.
- Use cases `CreatePairingCode`, `ConfirmPairing`, `Unpair`, `GetPairingState`.
- Audit events and `telegram.pairing.changed`.

## 4. Out of scope

- Where `ConfirmPairing` is called from (the `/start <code>` message): OVE_TG006. Persistence: TG004. Routes: TG012.

## 5. Detailed requirements

1. **Code:** 10 characters from the alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 symbols, about 49.5 bits) drawn with `SecureRandom` by rejection sampling (no modulo bias); displayed as `XXXXX-XXXXX`; accepted case-insensitively with hyphens and spaces ignored; stored only as `SHA-256(salt || normalisedCode)` with a random 16-byte salt per code. The deep link uses the code without the hyphen (valid Telegram start parameter charset).
2. `CreatePairingCode`: principal MUST be Owner on `desktop` (Local Approval semantics: never remote, never Chief or agent); refuses with `telegram.already_paired` while a pairing exists (the Owner must unpair first, T1); replaces any earlier active code (only one active at a time); returns `PairingCodeView` once; the plain code is never stored or logged; audit `telegram.pairing.code_created` without the code.
3. `ConfirmPairing({ code, chatId, userId, chatType, username?, displayName?, now })`: precondition `chatType === 'private'` and `userId == chatId` (private chat ids equal user ids) else `telegram.pairing_code_invalid`; if locked out return `telegram.pairing_locked`; hash and `consumeCode` atomically (single use, not expired, exact match); on success save the pairing (`already_paired` if one exists), clear wrong attempts, audit `telegram.paired`, publish `telegram.pairing.changed`; on failure `registerWrongAttempt`; at the 5th wrong attempt set `lockedUntil = now + 15 min` and audit `telegram.pairing.locked`. The failure response is always the same `telegram.pairing_code_invalid` (no oracle).
4. Lockout is global (installation level), not per sender (an attacker can change accounts); wrong attempts expire after 15 minutes of inactivity; a valid code during lockout is rejected too.
5. `Unpair`: Owner on `desktop` only; clears the pairing and any active code, invalidates all callback ids (`TelegramCallbackStore` via an `onUnpair` hook list), audit `telegram.unpaired`, publish the change; the poller keeps running for pairing of a new account only if a new code is created.
6. `GetPairingState`: returns `PairingState` (never ids). A code past `expiresAt` reports `unpaired`.
7. A tiny `PairingPolicy` object holds TTL (10 min), length (10), attempts (5), lockout (15 min) from `TelegramConfig` so tests can shorten them.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `SecureRandom` (SEC005), `Clock`, `AuditSink` (PERM), `EventBus`, repositories (TG001 ports), SHA-256 from Node crypto through a `Hasher` port-free helper in domain tests (pure function using injected hash function, no I/O).

## 8. Architecture and code placement

Domain in `packages/domain/src/telegram/pairing/` (pure: alphabet, sampling with injected bytes, normalise, hash with injected hasher, lockout arithmetic); use cases in `packages/application/src/telegram/pairing/`. Depends on TG001 ports only.

## 9. Security and safety

- Single use is enforced by an atomic repository operation, not by in-memory state (T1, T4 spirit).
- No oracle: wrong, expired, used and locked codes look identical to the sender except the generic lock message during lockout.
- Only the desktop channel can create a code or unpair; a forged Telegram message can never create or replace a pairing.
- Codes never appear in logs, audit events or the UI after first display; the hash with salt protects a leaked database within the TTL.
- Pairing from a group chat or channel is impossible (`chatType` check).

## 10. Errors and edge cases

- Code created, app crashes, restart: the code remains valid until `expiresAt` (hash in DB).
- Two Telegram accounts send the valid code simultaneously: exactly one wins (atomic consume).
- Owner presses 'Nowy kod parowania' twice: second replaces the first; the first code no longer works.
- Clock goes backwards: expiry is evaluated against the injected Clock; a code is never valid beyond `expiresAt`.
- Unpair during an in-flight approval callback: callbacks invalidated; presses answer 'wygasło'.
- Bot token not configured: `CreatePairingCode` returns `telegram.not_configured`-class error via `token_invalid` (checked by TG012 before calling).

## 11. Acceptance criteria

- [ ] Given a fresh code, When the correct code arrives from a private chat, Then pairing is saved once and a second use fails.
- [ ] Given an expired code (fake clock +10 min), Then `telegram.pairing_code_invalid`.
- [ ] Given 5 wrong attempts, Then lockout for 15 minutes even for the correct code.
- [ ] Given a group chat, Then pairing is refused.
- [ ] Given already paired, Then `CreatePairingCode` returns `telegram.already_paired`.
- [ ] Given a Telegram principal calling `CreatePairingCode` or `Unpair`, Then it is refused.
- [ ] Sampling has no modulo bias (distribution test) and the code alphabet has no ambiguous characters.
- [ ] The plain code is absent from logs and audit (`expectNoSecrets` with the code as a pattern).

## 12. Test plan

Unit and property tests with fakes: `code.test.ts` (alphabet, entropy, normalisation), `create-pairing-code.test.ts`, `confirm-pairing.test.ts` (matrix), `lockout.test.ts`, `unpair.test.ts`, `concurrency.test.ts`. Command: `pnpm vitest run packages/domain/src/telegram packages/application/src/telegram/pairing`.

## 13. Parallelization notes

Parallel with TG002, TG004, TG005. TG006 and TG012 consume the use cases.

## 14. Open questions and assumptions

- ASSUMPTION: re-pairing needs only unpair plus a new code on the desktop (desktop presence is the Local Approval); SEC008 T1 wording 'requires Local Approval on desktop' is satisfied because both steps are desktop-only.
- The Owner's wizard flow (UI) is ONB later; the API is TG012.
