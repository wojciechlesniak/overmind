---
id: OVE_TG001
title: "Define the Telegram contracts: pairing, channel status, config, errors, events and ports"
area: TG
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH003", "OVE_ARCH007", "OVE_ARCH010", "OVE_ARCH012"]
soft_depends_on: ["OVE_ARCH008", "OVE_SEC008"]
provides: ["contract:TelegramPairing", "contract:TelegramChannelStatus", "contract:TelegramConfig", "port:TelegramPairingRepository", "port:TelegramStateStore", "port:TelegramCallbackStore", "port:TelegramBotValidator", "lib:telegram-errors"]
needs: ["contract:EntityId", "contract:SecretRef", "port:Keychain"]
owns: ["packages/contracts/src/telegram/**", "packages/contracts/src/errors/telegram.errors.ts", "packages/application/src/ports/TelegramPairingRepository.ts", "packages/application/src/ports/TelegramStateStore.ts", "packages/application/src/ports/TelegramCallbackStore.ts", "packages/application/src/ports/TelegramBotValidator.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [6, 10, 23]
---

# OVE_TG001: Define the Telegram contracts: pairing, channel status, config, errors, events and ports

## 1. Summary

Defines everything other Telegram tasks share: the `TelegramPairing` entity, the channel status state machine exposed to the top bar, the fixed configuration, error codes, events and the four ports (pairing repository, state store, callback store, bot validator).

## 2. Context

ADR 0006: Telegram is a second Channel to the same Chief with lesser rights, one bot, one Owner, paired by a one-time code from the desktop. SPEC 5: long polling, no public webhook, `update_id` deduplication, rate limiting, audit log. Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. The top bar shows 'Telegram połączony' (ChannelPill); the Connections card shows bot '@overmind_wojtek_bot', account '@wojtek · inni są ignorowani', permissions 'czaty, status, Zgody na Run', buttons 'Nowy kod parowania' and 'Rozłącz'.

## 3. Scope (in)

- Zod schemas and types for pairing, pairing code view, channel status and config.
- Error codes `telegram.*`.
- Events `telegram.channel.status.changed`, `telegram.pairing.changed`.
- Four port interfaces with tokens.

## 4. Out of scope

- Implementations: OVE_TG002 (API), TG003 (pairing logic), TG004 (SQLite), TG005 (status machine). Routes: TG012.

## 5. Detailed requirements

1. **Pairing entity** (single row; one Owner, ADR 0010):
   ```ts
   TelegramPairing = { chatId: string, userId: string,            // decimal strings, Telegram ids exceed 32 bits
     username?: string,                                             // for display only ('@wojtek'), capped 64 chars
     displayName?: string, pairedAt: IsoDateTime }
   PairingCodeView = { code: string /* 'ABCDE-FGHJK', shown once */, deepLink: string /* https://t.me/<bot>?start=<code without hyphen> */, expiresAt: IsoDateTime }
   PairingState = { status: 'unpaired' | 'pending_code' | 'paired', codeExpiresAt?: IsoDateTime, pairing?: Pick<TelegramPairing,'username'|'displayName'|'pairedAt'> }
   ```
   `chatId` and `userId` never leave the engine through any read model.
2. **Channel status** (`TelegramChannelStatus`, what the top bar and Connections card read):
   `state: 'not_configured' | 'unpaired' | 'connecting' | 'connected' | 'degraded' | 'disconnected' | 'error' | 'locked'`, `botUsername?: string`, `pairedUsername?: string`, `since: IsoDateTime`, `detail?: 'token_revoked'|'keychain_locked'|'network'|'rate_limited'|'conflict'|'user_blocked_bot'`, `lastOkAt?: IsoDateTime`.
   Mapping to `ui:ChannelPill` (OVE_DS042): connected -> `connected` 'Telegram połączony'; connecting -> `connecting` 'Telegram łączy…'; unpaired and not_configured -> `disconnected` 'Telegram niesparowany' / 'Telegram wyłączony'; disconnected and degraded -> `disconnected` 'Telegram offline' / 'Telegram: problem'; error and locked -> `error` 'Telegram wymaga uwagi'. The mapping is a pure function exported here (`toChannelPill(status)`), copy in i18n keys `telegram:status.*`.
3. **Config** (`TelegramConfig`, internal, not user editable): `apiBaseUrl` (default `https://api.telegram.org`; any other value only when `OVERMIND_DEV=1`, otherwise config load fails closed), `pollTimeoutSec` 30, `pollLimit` 100, `allowedUpdates: ['message','callback_query']` (constant), `pairingCodeLength` 10, `pairingTtlMinutes` 10, `pairingMaxWrongAttempts` 5, `pairingLockoutMinutes` 15, `staleUpdateMinutes` 10, `inboundPerMinute` 20, `inboundQueueMax` 50, `unpairedPerMinute` 5, `outboundPerChatPerSec` 1, `messageMaxChars` 3500, `maxMessageParts` 4, `callbackTtlHours` 24. Defaults live in one file; limits referenced by T-rules are quoted there.
4. **Errors** (`defineErrors('telegram', ...)`): `token_invalid` (400), `token_revoked` (401), `keychain_locked` (503, retryable), `network` (502, retryable), `rate_limited` (429, retryable, `details.retryAfterSec`), `conflict_other_poller` (409), `not_paired` (409), `already_paired` (409), `pairing_code_invalid` (400, never says whether expired or wrong), `pairing_locked` (429), `user_blocked_bot` (403), `message_too_long` (500, internal), `unsafe_outbound` (500, internal, from `assertTelegramSafe`), `secret_in_inbound` (422). Message keys `errors:telegram.<code>` with EN and PL added by the first UI consumer (ONB/CONNUI).
5. **Events:** `telegram.channel.status.changed` (`{ status: TelegramChannelStatus }`, not persisted, `visibleTo: ['owner']`) and `telegram.pairing.changed` (`{ state: PairingState }`, audit true).
6. **Ports** (one file each, tokens `port:<Name>`):
   - `TelegramPairingRepository`: `get()`, `save(pairing)`, `clear()`, `createCode({hash, salt, expiresAt})` (replaces any active code), `getActiveCode()`, `consumeCode(hash, now)` (atomic single use), `registerWrongAttempt(now)` returns `{ attempts, lockedUntil? }`, `lockout(now)`.
   - `TelegramStateStore`: `getOffset()`, `setOffset(n)`, `recentUpdateIds()`, `rememberUpdateId(id)` (bounded window 1000), `incrementCounter(name, hourBucket)` for foreign-sender counters (no content), `getBotInfo()`/`setBotInfo()`.
   - `TelegramCallbackStore`: `issue({ action, approvalId, runId, workspaceId, chatId, messageId?, expiresAt })` returns an opaque id, `attachMessage(id, messageId)`, `claim(id, chatId, now)` (atomic, single use, returns the record or `telegram`-typed reason `unknown|used|expired|wrong_chat`), `release(id)`, `invalidateForApproval(approvalId)`, `deleteByWorkspace(workspaceId)`.
   - `TelegramBotValidator`: `validate(token: Secret): Promise<Result<{ botId: string; username: string }>>` (implemented with `getMe`).
7. All ids in contracts are strings; zod `strict`; no schema contains a token or secret field (a test enumerates keys against a deny-regex).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Result`, `AppError`, `defineErrors` (ARCH003), `defineEvent` (ARCH010), `SecretRef`, `Secret` and `Keychain` (ARCH012), `EntityId` (ARCH007).

## 8. Architecture and code placement

`packages/contracts/src/telegram/{pairing.ts,status.ts,config.ts,index.ts}`, errors and events in their own files, ports under `packages/application/src/ports/`. Foundation dependencies only; every other TG task depends on this one.

## 9. Security and safety

- Chat id and user id are identifiers of the Owner's phone account; they are stored only in the local database, never logged (the logger redacts keys `chatId`, `userId`) and never returned by read models.
- The bot token is a `Secret` everywhere and referenced by `SecretRef('telegram.bot-token')`; no schema has a token field.
- `pairing_code_invalid` deliberately does not reveal whether a code existed, expired or was wrong (no oracle).
- Config load fails closed on a non-default `apiBaseUrl` outside dev mode (T9).

## 10. Errors and edge cases

- Ids larger than 2^53: strings avoid precision loss.
- Username missing (Telegram users may have none): UI shows `displayName`.
- Config tampering via environment in release builds: ignored, defaults used and a warning logged.
- `default` status after install: `not_configured`.

## 11. Acceptance criteria

- [ ] All schemas exist, are strict and have fixture tests; no field can hold a token.
- [ ] `toChannelPill` maps every state (table test).
- [ ] Config defaults equal the values in SEC008 (T1, T3, T8, T11, T14) via a test that reads both lists.
- [ ] Port interfaces compile with stubs; tokens are unique.
- [ ] Events pass the event registry test; the error catalogue test passes.
- [ ] Non-default `apiBaseUrl` without `OVERMIND_DEV=1` fails config validation.

## 12. Test plan

Unit: `pairing-schema.test.ts`, `status-mapping.test.ts`, `config.test.ts`, `no-secret-fields.test.ts`. Command: `pnpm vitest run packages/contracts/src/telegram`.

## 13. Parallelization notes

First task of the area; TG002, TG003, TG004, TG005 start in parallel after it merges. New files only.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram ids are stored as strings (TEXT) in SQLite.
- OPEN: should `connecting` show for the first poll only? DEFAULT yes (until the first successful `getUpdates`).
