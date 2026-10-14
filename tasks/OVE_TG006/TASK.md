---
id: OVE_TG006
title: "Authorise inbound senders, rate-limit and audit foreign traffic"
area: TG
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ENGINE016, OVE_TG003, OVE_TG005]
soft_depends_on: []
provides: ["lib:telegram-inbound-guard", "lib:telegram-rate-limiter"]
needs: ["port:Clock", "port:AuditSink", "port:Logger"]
owns: ["packages/adapters/telegram/src/guard/**", "packages/adapters/telegram/src/ratelimit/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16"]
adr_refs: [6, 10]
---

# OVE_TG006: Authorise inbound senders, rate-limit and audit foreign traffic

## 1. Summary

The gate every Telegram update passes before anything happens: only the paired private chat and user are accepted, everyone else is ignored silently (counted, never stored), unpaired senders may only try a pairing code under strict limits, and traffic is rate limited in both directions.

## 2. Context

ADR 0006 and 0010: one Owner; 'messages from anyone else are ignored'. Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. T2 (authorisation), T8 (rate limiting), T12 (audit without foreign content). The bot username is public, so strangers WILL message it and add it to groups.

## 3. Scope (in)

- `InboundGuard.classify(update)` returning `owner | pairing_attempt | ignored(reason)`.
- Handling of unpaired pairing attempts (`/start <code>` or a bare code) through `ConfirmPairing`.
- Inbound and outbound token-bucket limiters and queue.
- Counters and audit for ignored and dropped traffic; `leaveChat` for groups.

## 4. Out of scope

- Commands and routing of owner messages: TG007. Sending replies: later TG tasks. Poll loop: TG005.

## 5. Detailed requirements

1. **Classification order** (first match wins): (1) structure: update must contain `message` or `callback_query` (others ignored; hostile raw shapes with missing fields ignored, zod `safeParse` failure means `ignored('malformed')`); (2) `from.is_bot === true` or `via_bot` present -> ignored; (3) paired? `chat.type === 'private'` AND `String(chat.id) === pairing.chatId` AND `String(from.id) === pairing.userId` -> `owner`; for `callback_query` the same checks on `callback_query.from.id` and `callback_query.message.chat.id`; (4) not paired and `chat.type === 'private'` and the text is `/start <code>` or looks like a code (`^[A-Za-z2-9\- ]{10,13}$` after trim) -> `pairing_attempt`; (5) everything else (other chats, groups, supergroups, channels, forged combinations such as owner id in another chat or another id in the owner chat, `my_chat_member`) -> `ignored(reason)`.
2. **Silence:** ignored updates get NO reply, with exactly one exception: a `pairing_attempt` with a wrong code gets the generic reply 'Nieprawidłowy lub wygasły kod.' (max 5 handled per minute in total, T8), and during lockout no reply at all. The bot never reveals its purpose to strangers.
3. **Groups:** an update from a `group`/`supergroup`/`channel` chat (including `my_chat_member` if it ever arrives) triggers `leaveChat(chatId)` at most once per chat per hour (cache of 50 chat ids) and the counter `foreign_group`.
4. **Counters and audit (T12):** per hour bucket increment `foreign_private`, `foreign_group`, `forged_combo`, `pairing_wrong`, `rate_dropped`, `malformed` in `TelegramStateStore`; once per hour (if non-zero) write one audit event `telegram.foreign_updates` with the counts only. NEVER store text, ids, usernames or message content of foreign senders; ids are not even hashed.
5. **Inbound rate limit (T8):** paired chat: 20 updates per minute token bucket; excess is queued up to 50, beyond that dropped; on the first drop in a minute send one notice 'Zwolnij, za dużo wiadomości naraz.'. Unpaired senders: 5 handled per minute in total across all senders, then dropped silently.
6. **Outbound limiter:** `OutboundLimiter.schedule(chatId, fn)` enforces 1 message per second per chat and 30 per second globally with a FIFO queue (max 100 pending; overflow drops the oldest non-approval message and counts it); on `retry_after` from the API (TG002) the limiter pauses the chat for that duration. Approval bubbles are never dropped (priority queue).
7. The guard is a pure function over `(update, pairing, now)` for classification (unit-testable without I/O); rate limiters are small classes over the injected Clock.
8. Edited messages and other update types not in `allowed_updates` that arrive anyway (hostile injection, TEST012 `injectRawUpdate`) are `ignored('unsupported_type')`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `ConfirmPairing` (TG003), `TelegramStateStore` counters (TG004), `BotApiClient.leaveChat` (TG002), `AuditSink`, `Clock` (ARCH007), SEC008 hostile update fixtures in tests.

## 8. Architecture and code placement

`packages/adapters/telegram/src/guard/{classify.ts,pairing-attempt.ts,foreign-counters.ts}`, `packages/adapters/telegram/src/ratelimit/{token-bucket.ts,inbound-queue.ts,outbound-limiter.ts}`. The guard implements the `UpdateHandler` front stage: `guard -> router` (TG007) or `guard -> callbacks` (TG011).

## 9. Security and safety

- Compares BOTH chat id and user id and chat type (forged sender and forged chat combinations are ignored, T2).
- No reply to strangers prevents bot discovery and amplification; the single generic pairing reply is rate limited.
- Foreign content is never persisted, logged or audited; only counters.
- Rate limits bound the cost of flooding (T8) and keep the engine responsive.
- Fail closed: if the pairing cannot be read, all updates are ignored.

## 10. Errors and edge cases

- Owner has two devices: same user and private chat; fine.
- Owner changes Telegram account: new user id is a stranger until the Owner unpairs and pairs again on the desktop.
- Bot added to a group by someone else: ignored, `leaveChat` attempted, counted.
- User blocks the bot: sends fail (`user_blocked_bot`); the channel is marked `degraded` by TG005.
- Flood of 100 messages in a second from the Owner chat: 20 processed, up to 50 queued, rest dropped with one notice.
- Unicode lookalike chat ids or negative ids: compared as strings after `String()`.

## 11. Acceptance criteria

- [ ] Given a paired Owner, Then updates from the private chat are `owner`.
- [ ] Given owner id in another chat, and another id in the owner chat, Then both are ignored without reply.
- [ ] Given a group update, Then ignored, `leaveChat` called once, counter incremented, no content stored.
- [ ] Given unpaired and `/start <valid code>`, Then pairing is confirmed; wrong code gets the generic reply; after 5 wrong attempts no reply.
- [ ] Given 100 updates in a second, Then at most 20 processed immediately, 50 queued, one drop notice.
- [ ] Given Telegram 429 `retry_after`, Then outbound waits that long (fake clock).
- [ ] The audit event contains counts only (schema test).

## 12. Test plan

Unit tests: `classify.test.ts` (matrix incl. hostile fixtures), `pairing-attempt.test.ts`, `token-bucket.test.ts`, `inbound-queue.test.ts`, `outbound-limiter.test.ts`, `foreign-counters.test.ts`; the full security suite is OVE_SEC008. Command: `pnpm vitest run packages/adapters/telegram/src/guard packages/adapters/telegram/src/ratelimit`.

## 13. Parallelization notes

After TG003 and TG005. TG007 and TG011 sit behind it.

## 14. Open questions and assumptions

- ASSUMPTION: rate numbers are exactly SEC008 T8 defaults and live in `TelegramConfig`.
- ASSUMPTION: the bot leaves groups automatically (Telegram allows `leaveChat` for bots).
