---
id: OVE_TG002
title: "Implement the Telegram Bot API client: long polling, TLS, no redirects, backoff signals"
area: TG
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_TEST012, OVE_TG001]
soft_depends_on: ["OVE_TEST012"]
provides: ["lib:telegram-bot-api-client", "lib:telegram-bot-validator"]
needs: ["port:Clock", "port:Logger", "lib:redaction", "lib:fake-telegram-api"]
owns: ["packages/adapters/telegram/src/api/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 20"]
adr_refs: [6]
---

# OVE_TG002: Implement the Telegram Bot API client: long polling, TLS, no redirects, backoff signals

## 1. Summary

A small, dependency-light client for exactly the Bot API methods Overmind uses (`getMe`, `getUpdates`, `sendMessage`, `editMessageText`, `answerCallbackQuery`, `deleteMessage`, `setMyCommands`, `leaveChat`), with strict base-URL, TLS and redirect rules, typed errors, `retry_after` handling and token-safe logging.

## 2. Context

The adapter talks to Telegram with long polling only (no public webhook, SPEC 5). Every call carries the bot token in the URL path, which makes URL logging a leak risk (T9). Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. The fake server (OVE_TEST012) reproduces the subset, so no test reaches the real network.

## 3. Scope (in)

- `BotApiClient` with the eight methods and zod-validated responses.
- Error mapping, `retry_after`, timeouts, abort.
- `TelegramBotValidator` implementation using `getMe`.
- Token-safe request logging.

## 4. Out of scope

- The polling loop: TG005. Message formatting: TG009. Authorisation of senders: TG006.

## 5. Detailed requirements

1. **Transport:** global `fetch` (Node 22) wrapped by an `HttpTransport` interface so tests inject the fake server; base URL from `TelegramConfig.apiBaseUrl`; HTTPS required (a plain `http:` base URL is accepted only for loopback hosts in dev mode, otherwise `telegram.token_invalid`-style startup refusal `config.invalid`); `redirect: 'manual'`: any 3xx is an error `telegram.network` (not followed); TLS verification never disabled; no proxy credentials logging.
2. **Methods** (all return `Result<T, AppError>`; request bodies JSON):
   - `getMe()`; `getUpdates({ offset, limit, timeout, allowed_updates })` with an `AbortSignal`; client-side timeout = `timeout + 10 s`.
   - `sendMessage({ chat_id, text, parse_mode: 'HTML', reply_markup?, link_preview_options: { is_disabled: true }, disable_web_page_preview: true, disable_notification? })`.
   - `editMessageText`, `answerCallbackQuery({ callback_query_id, text?, show_alert? })`, `deleteMessage`, `setMyCommands`, `leaveChat`.
3. **Response handling:** parse `{ ok, result | error_code, description, parameters.retry_after }` with zod (unknown fields ignored, required fields strict). Mapping: 401 and 404 on any method -> `telegram.token_revoked`; 409 on `getUpdates` -> `telegram.conflict_other_poller`; 429 -> `telegram.rate_limited` with `details.retryAfterSec`; 403 'bot was blocked by the user' -> `telegram.user_blocked_bot`; 400 'message is not modified' on edit -> success (idempotent); other 4xx -> `telegram.network`-class `internal` with the numeric code only; 5xx and network errors -> `telegram.network` (retryable).
4. **Log safety:** the URL is logged as `api.telegram.org/bot[REDACTED]/<method>`; request and response bodies are not logged (they contain Owner messages); error messages never include the token even if the runtime's error text does (the client scrubs `bot\d+:[A-Za-z0-9_-]{30,}` from any string before wrapping). `Secret` is unwrapped only inside `buildUrl`.
5. `getMe` response gives `BotInfo { id, username }`; `TelegramBotValidator.validate` returns it or `telegram.token_invalid`.
6. Request ids: each call receives a correlation id from the log context; the client adds no custom headers.
7. Concurrency: one in-flight `getUpdates` per client instance (second call rejected with a programming error `internal.invalid_state`), because Telegram answers a second poller with 409.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Secret`/`Keychain` types (ARCH012), `Logger` with redaction (ARCH004), `Clock` for timeouts (ARCH007), `lib:fake-telegram-api` in tests, `Result` helpers (ARCH003).

## 8. Architecture and code placement

`packages/adapters/telegram/src/api/{bot-api-client.ts,transport.ts,responses.ts,errors.ts,url.ts,validator.ts}`. The client has no knowledge of Overmind concepts (pairing, approvals): it is the lowest layer of the adapter. No Telegram SDK dependency is added (KISS, supply-chain: ~300 lines are cheaper than a framework; recorded in the PR justification).

## 9. Security and safety

- T9: token only in Keychain/memory, URL redacted, base URL fixed, TLS enforced, redirects not followed.
- Responses from Telegram are untrusted input and are zod-validated before use.
- Hostile response shapes (huge body, wrong types) are rejected with a size cap of 1 MB.
- The dev-only base URL override is compiled out of release builds (build flag) and also refused at runtime unless `OVERMIND_DEV=1`.

## 10. Errors and edge cases

- Network drop mid long poll: `telegram.network`, poller backs off.
- Telegram returns HTML (captive portal) with 200: zod fails, mapped to `telegram.network`.
- `retry_after` huge (3600): returned as is; the poller caps waits at 15 minutes and reports `degraded`.
- Abort during `getUpdates`: resolves with `internal.cancelled` without logging an error.
- Malformed JSON: `telegram.network` with no body content in the message.

## 11. Acceptance criteria

- [ ] Against the fake API every listed method works with Telegram-shaped responses.
- [ ] A 302 from the fake is not followed and maps to `telegram.network`.
- [ ] `http://` non-loopback base URL is refused at construction.
- [ ] 401 and 404 map to `telegram.token_revoked`; 409 to `conflict_other_poller`; 429 keeps `retry_after`.
- [ ] `expectNoSecrets` over all logs and error messages of a failure matrix passes (token never appears).
- [ ] Two concurrent `getUpdates` are rejected locally.

## 12. Test plan

Unit and integration with the fake API: `bot-api-client.test.ts`, `error-mapping.test.ts`, `redirect-and-tls.test.ts`, `log-safety.test.ts` (corpus from SEC003), `concurrent-poll.test.ts`. Command: `pnpm vitest run packages/adapters/telegram/src/api`.

## 13. Parallelization notes

Parallel with TG003 to TG005; TG005, TG009, TG010 depend on it. Fake API is a soft dependency (a minimal in-test stub is acceptable first).

## 14. Open questions and assumptions

- ASSUMPTION: no Telegram SDK; the eight methods are written directly.
- The fake must accept `link_preview_options` as well as `disable_web_page_preview`; add via proposal to TEST012 if missing.
