---
id: OVE_TG005
title: "Build the long-polling loop with dedupe, ordering, stale protection and the status machine"
area: TG
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_TEST012, OVE_TG001, OVE_TG002, OVE_TG004]
soft_depends_on: []
provides: ["lib:telegram-poller", "port:ChannelStatusReader", "event:telegram.channel.status.changed", "event:channel.status.changed"]
needs: ["port:Keychain", "port:Clock", "port:EventBus", "port:Logger", "lib:fake-telegram-api"]
owns: ["packages/adapters/telegram/src/poller/**", "packages/adapters/telegram/src/status/**", "packages/contracts/src/events/telegram.channel.status.changed.event.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 6]
---

# OVE_TG005: Build the long-polling loop with dedupe, ordering, stale protection and the status machine

## 1. Summary

The engine side of Telegram's inbound path: a supervised `getUpdates` loop that reads the bot token from the Keychain, persists the offset, deduplicates by `update_id`, keeps order, discards stale updates after sleep, backs off on failures and publishes the channel status the top bar shows.

## 2. Context

SPEC 5: long polling, no public webhook, `update_id` deduplication. ADR 0005: the Mac sleeps and the bot then does not answer; after wake Telegram delivers queued updates and old commands must not run blindly (T14). Status feeds the top bar 'Telegram połączony' (SPEC 16.13). Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them.

## 3. Scope (in)

- Poll loop supervisor with start/stop.
- Dedupe, ordering and persistence via `commitBatch`.
- Stale protection with one notice.
- Backoff and status state machine, `ChannelStatusReader`, event.
- Polling continues under Global Pause.

## 4. Out of scope

- What happens to an update (guard, routing): TG006, TG007. Sending replies: TG009 and later.

## 5. Detailed requirements

1. **Loop:** `while running`: read token (`Keychain.read(SecretRef('telegram.bot-token'))`; failure `keychain_locked` -> status `locked`, retry every 30 s, polling stopped; missing token -> `not_configured`); `getUpdates({ offset: highest+1, limit: 100, timeout: 30, allowed_updates: ['message','callback_query'] })`; for each update in ascending `update_id`: skip if `update_id <= storedOffsetMinusOne` or in the recent-id window (counter `replayed`), else hand to the `UpdateHandler` (TG006) sequentially; after the batch call `commitBatch({ offset, ids })`. Handler errors are caught and logged; the update still counts as processed (no poison-pill loop).
2. **Ordering:** updates of one batch are handled strictly in order and one at a time (a handler awaiting the gateway blocks later updates by design: commands are sequential); a slow handler is bounded by a 20 s timeout after which the update is dropped with an audit counter.
3. **Stale protection (T14):** an update whose `message.date` is older than `staleUpdateMinutes` (10) at handling time is not executed; instead, once per batch, one notice is sent: 'Pominąłem starsze wiadomości z czasu, gdy komputer spał.' (count only). `callback_query` updates are subject to the callback store expiry instead of a date.
4. **Backoff:** network or 5xx: delays 1, 2, 4, 8, 16, 32, 60 s with ±20% jitter (jitter from the injected random source), reset after a success; 429: wait `retry_after` (cap 15 min), status `degraded` with detail `rate_limited`; 409 conflict: status `degraded` detail `conflict`, wait 30 s, notify once (`channel_attention` through the status event); 401/404: stop polling, status `error` detail `token_revoked`, never retry until the token is replaced; abort on `stop()` is immediate.
5. **Status machine** (`TelegramChannelStatus`, TG001): `not_configured` (no token) -> `unpaired` (token, no pairing) -> `connecting` -> `connected` (first successful poll, no failure within the last 60 s) <-> `disconnected` (network failures for more than 20 s) / `degraded` (429, 409, blocked bot) ; `error` (revoked token) ; `locked` (Keychain). Every transition publishes `telegram.channel.status.changed` (debounced: a state must hold for 2 s before the event, except `error`/`locked` which are immediate). `ChannelStatusReader.current()` is a synchronous read of the last status.
6. **Global Pause:** polling and answering read-only commands continue while paused (T10); the gateway blocks work-starting actions.
7. **Metrics for support:** counters (not content) `updates_received`, `replayed`, `stale_dropped`, `handler_errors` in `telegram_state` hourly buckets.
8. `start()` is idempotent; `stop()` waits for the current handler up to 5 s; the engine's shutdown hook calls it.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `BotApiClient` (TG002), `TelegramStateStore` (TG001/004), `Keychain`, `Clock.sleep` with abort, `EventBus`, status mapping (TG001).

## 8. Architecture and code placement

`packages/adapters/telegram/src/poller/{poller.ts,backoff.ts,dedupe.ts,stale.ts}` and `packages/adapters/telegram/src/status/{status-machine.ts,channel-status-reader.ts}`. The poller takes an `UpdateHandler` interface so guard and routing plug in (DIP); it contains no business logic.

## 9. Security and safety

- T3 and T14 are enforced here: replayed, reordered and stale updates never reach commands.
- The token is read per (re)start from the Keychain and held only in the client; it is never logged or stored in state.
- Polling stops when the Keychain is locked or the token is revoked: no retry with a bad token (prevents Telegram flood bans).
- `allowed_updates` is a constant: edited messages, inline queries, channel posts and member events are never requested (SEC008 T3; hostile ones injected anyway are dropped by TG006).

## 10. Errors and edge cases

- Mac wakes after 30 minutes with 40 queued updates: all stale, none executed, one notice.
- Same update delivered twice in one batch: second is `replayed`.
- Engine restart mid-batch: offset not committed, updates re-delivered and deduped by the persisted window.
- Two engine instances (dev): 409 handling, no tight loop.
- `getUpdates` returns an empty list repeatedly: no sleep needed (long poll), CPU idle.
- Clock set backwards by the user: stale comparison uses `message.date` vs Clock with a ±2 minute tolerance.

## 11. Acceptance criteria

- [ ] Given the fake API with 3 updates, Then handler calls are ordered and offset equals last id + 1 after commit.
- [ ] Given a duplicate `update_id`, Then handled once.
- [ ] Given 30 min simulated sleep, Then stale updates are dropped with one notice.
- [ ] Given 429 with `retry_after: 7`, Then the next call waits 7 s (fake clock) and status is `degraded`.
- [ ] Given 401, Then polling stops and status is `error`.
- [ ] Given a locked Keychain, Then status `locked` and polling resumes after it unlocks.
- [ ] The status event is debounced and `ChannelStatusReader` reflects it.
- [ ] No token string appears in any log in the failure matrix.

## 12. Test plan

Unit and integration with the fake API and FakeClock: `poller.test.ts`, `dedupe.test.ts`, `stale.test.ts`, `backoff.test.ts`, `status-machine.test.ts` (table), `restart-recovery.test.ts`. Command: `pnpm vitest run packages/adapters/telegram/src/poller packages/adapters/telegram/src/status`.

## 13. Parallelization notes

After TG002 and TG004 (or against stubs). TG006 plugs into the `UpdateHandler` interface; NOTIF007 reads `ChannelStatusReader`.

## 14. Open questions and assumptions

- ASSUMPTION: 10 minutes staleness window (T14); `connecting` clears after the first successful poll.
- OPEN: should the stale notice be sent at all? DEFAULT yes, one per batch.
