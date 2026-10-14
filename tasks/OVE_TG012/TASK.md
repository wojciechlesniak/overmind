---
id: OVE_TG012
title: "Expose Telegram connection routes: bot token, pairing code, status, unpair, rotate"
area: TG
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_ENGINE011, OVE_ENGINE016, OVE_ENGINE017, OVE_ENGINE019, OVE_TG002, OVE_TG003, OVE_TG004, OVE_TG005]
soft_depends_on: []
provides: ["api:telegram.status", "api:telegram.connect", "api:telegram.pairing-code", "api:telegram.unpair", "api:telegram.rotate-token", "lib:api-client-telegram", "usecase:ConnectTelegramBot"]
needs: ["port:Keychain", "lib:gateway-principal", "lib:gateway-push", "lib:api-client", "port:AuditSink", "contract:SecretRef"]
owns: ["packages/application/src/telegram/connect/**", "apps/engine/src/gateway/routes/telegram.routes.ts", "packages/api-client/src/telegram/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 14"]
adr_refs: [6, 10]
---

# OVE_TG012: Expose Telegram connection routes: bot token, pairing code, status, unpair, rotate

## 1. Summary

The desktop-only API behind the Connections card and wizard step 4: validate and store the bot token in the Keychain, create a pairing code, read channel status, unpair, rotate the token.

## 2. Context

Connections card: bot '@overmind_wojtek_bot', account '@wojtek · inni są ignorowani', buttons 'Nowy kod parowania' and 'Rozłącz'. Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. T1 and T9: only the desktop creates codes and unpairs; the token is never returned.

## 3. Scope (in)

- Use case `ConnectTelegramBot` (validate with `getMe`, store `SecretRef('telegram.bot-token')`).
- Routes under `/v1/telegram/*` with push topic `telegram.status`.
- api-client functions.
- Rotate token and remove bot.

## 4. Out of scope

- UI for the card and wizard: ONB/CONNUI. Pairing domain: TG003. Poller start/stop: TG013 reacts to events.

## 5. Detailed requirements

1. **Routes:** `GET /v1/telegram/status` returns `TelegramChannelStatus` plus `PairingState`; `POST /v1/telegram/connect {token}` validates and stores; `POST /v1/telegram/pairing-code` returns `PairingCodeView` (shown once); `DELETE /v1/telegram/pairing` unpairs; `POST /v1/telegram/token {token}` rotates; `DELETE /v1/telegram/bot` removes token and pairing.
2. **Principal rule:** every mutating route requires the `desktop` principal; a request originating from the Telegram channel principal or an agent principal is refused with `permission.denied` (a test per route).
3. **Connect:** validate through `TelegramBotValidator`; on success write the token to the Keychain, save `BotInfo`, emit `telegram.channel.status.changed`; the response contains `botUsername` only. On `token_invalid` nothing is stored. The request body is never logged (redaction key `token`).
4. **Rotate:** validates the new token first; if the bot id differs from the stored one, the pairing is cleared and the Owner must pair again; same bot keeps pairing.
5. **Code:** creating a code replaces any active code; the plain code is returned once and never again by `status`.
6. **Unpair:** clears pairing and callbacks (via TG015 sanitiser function), emits events, sends a farewell message best-effort before clearing.
7. Push topic `telegram.status` forwards status events to the desktop client.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Gateway route module pattern (GW tasks), api-client generator, `ConnectTelegramBot` is new, other use cases from TG003.

## 8. Architecture and code placement

Use case in `packages/application/src/telegram/connect/`; route file registers with the gateway module list; api-client under `packages/api-client/src/telegram/`. No Telegram HTTP code here (goes through the validator port).

## 9. Security and safety

- T9: token write-only; no route returns it; error messages never echo it.
- T1: only the desktop principal can create codes or unpair.
- Rate limit on `connect` (5 per minute) to prevent token oracle misuse.
- Audit entries for connect, rotate, unpair, code creation (no code value).

## 10. Errors and edge cases

- Keychain locked: `telegram.keychain_locked` with retry hint.
- Token valid but bot already polled elsewhere: connect succeeds, status becomes `error: conflict`.
- Connect while paired to the same bot: idempotent.
- Network offline: `telegram.network`, nothing stored.

## 11. Acceptance criteria

- [ ] Token is stored only in the Keychain and appears in no response, log or event.
- [ ] Every mutating route rejects non-desktop principals.
- [ ] Rotating to another bot clears pairing.
- [ ] Status route never includes chat id, user id or code.
- [ ] Push topic delivers status changes.

## 12. Test plan

Integration with fake Keychain and fake Telegram API: `telegram-routes.test.ts`, `connect-token-safety.test.ts`, `principal-rules.test.ts`. Command: `pnpm vitest run apps/engine/src/gateway/routes/telegram.routes.test.ts packages/application/src/telegram/connect`.

## 13. Parallelization notes

Parallel with TG011 and TG013; ONB/CONNUI consume the api-client.

## 14. Open questions and assumptions

- OPEN: allow several bots? DEFAULT no (ADR 0010, one Owner, one bot).
