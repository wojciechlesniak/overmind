---
id: OVE_TEST012
title: Build the fake Telegram Bot API server for adapter and security tests
area: TEST
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST001, OVE_TEST002]
soft_depends_on: [OVE_ARCH015]
provides: ["lib:fake-telegram-api", "bin:fake-telegram-api"]
needs: []
owns: ["tools/fake-telegram/**", "packages/testing/src/fake-telegram/**", "docs/testing/fake-telegram.md"]
reads: ["docs/security/telegram-rules.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16"]
adr_refs: [6, 10, 23]
---

# OVE_TEST012: Build the fake Telegram Bot API server for adapter and security tests

## 1. Summary

A local HTTP server that speaks the subset of the Telegram Bot API Overmind uses (`getMe`, `getUpdates` with long polling, `sendMessage`, `editMessageText`, `answerCallbackQuery`, `deleteMessage`, `setMyCommands`, `leaveChat`) with scriptable users, chats, updates and failures. It lets the Telegram adapter, pairing flow, approval buttons and security suite (SEC008) run offline and deterministically.

## 2. Context

ADR 0006/0010: one paired Owner chat; long polling without webhook; updates deduplicated by `update_id`; approvals via inline buttons apply to the current Run only; the bot token is a secret. The adapter must never contact `api.telegram.org` in tests. The adapter takes the API base URL from configuration (default `https://api.telegram.org`, tests use `http://127.0.0.1:<port>` through a test-only override that is rejected in release builds).

## 3. Scope (in)

- HTTP server (`tools/fake-telegram/server.mjs`, zero dependencies) reproducing request/response shapes of the listed methods (`ok`, `result`, `error_code`, `description`, `parameters.retry_after`).
- World model: bot (id, username, token), users, private/group/supergroup/channel chats, message store, callback queries.
- Scripting/control API and TypeScript controller `packages/testing/src/fake-telegram/`.
- Fault and hostile-input injection library used by SEC008.

## 4. Out of scope

- The adapter (TG). Real Telegram behaviours beyond the subset (media, inline mode, webhooks, payments). The security rules and tests (SEC008).

## 5. Detailed requirements

1. **Routing and auth:** `POST|GET /bot<token>/<method>`; unknown token -> `401 Unauthorized` JSON as Telegram does; token compared to the configured fake token (format `<digits>:<35 chars>` with the fake marker `ovmfake`); requests accept JSON body and form encoding; responses `{ "ok": true, "result": ... }`.
2. **`getUpdates`:** supports `offset`, `limit` (1..100), `timeout` (long polling up to 50 s, scaled by `FAKE_TELEGRAM_TIME_SCALE`), `allowed_updates`; returns updates with increasing `update_id`; confirms (drops) updates below `offset`; exactly the Telegram semantics (re-delivery of unconfirmed updates, a second concurrent `getUpdates` returns `409 Conflict: terminated by other getUpdates request`). Updates not matching `allowed_updates` are filtered.
3. **Send/edit/delete:** `sendMessage` validates `chat_id`, `text` (<= 4096 chars else `400 Bad Request: message is too long`), `parse_mode` (`MarkdownV2`, `HTML`, none; invalid escapes produce `400 can't parse entities` exactly when the real API would for the common cases), `reply_markup.inline_keyboard` (callback_data <= 64 bytes else `BUTTON_DATA_INVALID`), `disable_web_page_preview`; stores the message and exposes it to tests; `editMessageText`, `deleteMessage` (48 h rule using fake clock), `answerCallbackQuery` (must be called within the scripted window to avoid "query is too old"), `setMyCommands`, `leaveChat`, `getMe`, `getChat`.
4. **World model and scripting (control API on `/__control/*` with a per-run token header and in-process JS API):** `addUser({ id, firstName, username, isBot })`, `addChat({ id, type, title })`, `userSends({ chat, from, text, entities?, forwardFrom?, replyTo?, edit? })`, `userEditsMessage`, `userPressesButton({ chat, from, messageId, callbackData })`, `userSendsMedia`, `userJoinsChat/botAddedToGroup` (`my_chat_member`), `channelPost`, `userForwards`, `setUpdateIdStart`, `duplicateUpdate(updateId)`, `reorderUpdates`, `injectRawUpdate(json)` (hostile shapes), `messagesSentByBot({ chat })`, `lastBotMessage()`, `callbackAnswers()`, `requests()` (log with token redacted), `advanceTime(ms)`.
5. **Fault injection:** `rateLimit({ method, retryAfter, times })` (429 with `parameters.retry_after`), `serverError(method, 502, times)`, `networkDrop(method)` (closes socket), `slowResponse(method, ms)`, `revokeToken()` (subsequent calls `401`/`404`), `flood({ from, count })` (many updates quickly), `largePayload`, `malformedJson`, `redirect(to)` (302 to another host, for the redirect-not-followed test), `tlsRequired` flag (reject plain HTTP to simulate a configured-https requirement for the adapter's URL validation tests).
6. **Hostile update library** (`packages/testing/src/fake-telegram/hostile.ts`) used by SEC008: forged sender (Owner id in another chat and vice versa), group/channel/supergroup variants, forwarded messages (`forward_origin`), messages with bidi/zero-width/very long text, message edited after approval, callback data tampering, update_id replay/reorder, `via_bot`, messages from other bots, commands with `@botname` suffix variants, unicode-lookalike commands (`/ѕtatus`), entities that mimic buttons.
7. **Determinism:** ids and timestamps from a fake clock the controller advances; no randomness without `FAKE_TELEGRAM_SEED`.
8. **Fidelity notes:** each simplification is documented with a link to Telegram docs section; a table in the doc lists "behaviours reproduced" vs "not reproduced" so tests do not over-trust the fake.
9. **Network containment:** the server binds `127.0.0.1` on an ephemeral port, prints it, and refuses non-loopback `Host`. The controller offers `urlFor(token)` for the adapter config.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Token and secret fixtures from the corpus (SEC003, `ovmfake` marker); fake clock (TEST002) in-process; `expectNoSecrets` on request logs. The adapter tests (TG) and SEC008 are the consumers.

## 8. Architecture and code placement

`tools/fake-telegram/{server.mjs,methods/*.mjs,world.mjs,faults.mjs}` and `packages/testing/src/fake-telegram/{launch.ts,control.ts,hostile.ts}`. One file per API method (OCP). Tool-only, excluded from release bundles.

## 9. Security and safety

The fake must never reach the internet and must never be configured with a real bot token (startup rejects tokens not carrying the fake marker). It models hostile inputs deliberately, so the control API is token-protected and loopback only. Logged requests have the token path segment redacted. The adapter's test-only base-URL override is compiled out of release builds (assertion in SEC008 acceptance).

## 10. Errors and edge cases

- Long-poll abort by client: handled without leaking pending timers.
- Two bots/tokens: supported via separate world instances (adapter multi-bot not needed in MVP).
- Huge message store: capped at 10 000 messages, oldest dropped.
- Unsupported methods: `404 Not Found` JSON like Telegram.
- Clock scaling: long-poll timeouts scale with `FAKE_TELEGRAM_TIME_SCALE` to keep tests fast.

## 11. Acceptance criteria

- [ ] All listed methods respond with Telegram-shaped JSON; error cases (too long, bad button data, bad token, conflict, 429 with retry_after) reproduced.
- [ ] `getUpdates` offset/confirmation semantics and concurrent-poll conflict behave as documented.
- [ ] World scripting API can express each hostile scenario of SEC008 (forged sender, group, forward, edit, replay, tampered callback, flood).
- [ ] Faults (rate limit, 5xx, drop, redirect, revoke) are injectable and tested.
- [ ] Server refuses real-looking tokens and non-loopback hosts.
- [ ] Request log redacts tokens (`expectNoSecrets` on logs).
- [ ] Docs list reproduced vs not-reproduced behaviours.

## 12. Test plan

Raw-HTTP self-tests for every method and fault (`tools/fake-telegram/test/*.test.mjs`), controller unit tests, a toy "echo bot" using plain `fetch` proving round trips. Commands: `pnpm vitest run tools/fake-telegram packages/testing/src/fake-telegram`.

## 13. Parallelization notes

TG and SEC008 depend on it; deliver `getMe/getUpdates/sendMessage/answerCallbackQuery` and the world API first, faults next. Methods are separate files; no hotspots.

## 14. Open questions and assumptions

- ASSUMPTION: the adapter reads `telegram.apiBaseUrl` from internal config only (not user-editable) and the override is allowed solely when `OVERMIND_DEV=1`.
- Open: voice/file messages are post-MVP (ADR 0024), so no media endpoints beyond receiving media-only updates for hostile input tests.
