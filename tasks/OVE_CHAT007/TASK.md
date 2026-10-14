---
id: OVE_CHAT007
title: Define the inbound channel ingestion contract with replay and forgery protection
area: CHAT
kind: security
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT005, OVE_CHAT006, OVE_SEC008]
soft_depends_on: []
provides: ["usecase:IngestChannelMessage", "contract:InboundChannelMessage"]
needs: ["lib:telegram-security-suite"]
owns: ["packages/application/src/chat/ingest-channel-message.usecase.ts", "packages/contracts/src/chat/inbound.ts"]
reads: ["packages/application/src/chat/send-owner-message.usecase.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16.13", "SPECIFICATION 16.10"]
adr_refs: [6, 10, 23]
---

# OVE_CHAT007: Define the inbound channel ingestion contract with replay and forgery protection

## 1. Summary

The one use case that an external channel adapter (Telegram) calls when the Owner writes: it takes an already authenticated and paired message, enforces dedupe and ordering by the channel's own message reference, applies the Telegram privilege level and hands the message to `SendOwnerMessage`.

## 2. Context

ADR 0006 and 0010: one bot, one pairing, messages from anyone else are ignored (TG verifies the paired chat and user id before calling this use case). Telegram redelivers updates after reconnects; long polling can replay (`update_id`). SPEC 5 proposes deduplication of `update_id`, rate limiting and an audit log. This task is the CHAT-side half; TG does pairing and Telegram API handling.

## 3. Scope (in)

- `IngestChannelMessage(input: InboundChannelMessage, caller: ChannelCaller)`.
- Contract `InboundChannelMessage`: `{ channel: 'telegram', channelMessageRef: string<=64 (update id), receivedAt, text: string<=4000, replyToChannelRef?, chatKind: 'private' }`.
- Dedupe, ordering, rate limit, privilege level, audit.

## 4. Out of scope

- Pairing, bot token, long polling, message formatting: TG. Approvals via Telegram buttons: TG + PERM. Voice or files: later (SPEC 16).

## 5. Detailed requirements

1. `ChannelCaller` is produced only by a registered `ChannelAdapter` composition path after the TG pairing check; the use case verifies `caller.pairedOwner === true` and `caller.channel === input.channel`, otherwise `chat.channel_not_allowed` (audit true).
2. Dedupe: `channelMessageRef` is unique; a repeat returns success with `deduplicated: true` (no second dispatch). A ref older than the last processed ref by more than 1000 (replay of an old update) is dropped with a `warn` and an audit entry `chat.replay_suspected`.
3. Only `chatKind: 'private'` is accepted; group or channel messages are ignored (ADR 0010, one Owner).
4. Privilege level: the message is passed to `SendOwnerMessage` with `trust: 'owner_remote'`; this task asserts the dispatch carries it. Telegram text can never contain structured intents: the use case does not parse commands such as `/approve` here (TG callback queries go through TG's own authenticated path and PERM, run-scoped only).
5. Rate limit 20 per minute per paired chat; over-limit messages are not processed and the adapter is told `rateLimited` so it can send a short notice.
6. Text over 4000 characters is rejected with `chat.message_too_large` (the adapter tells the user).
7. The text is treated as untrusted-structure: control characters removed by CHAT003; forwarded messages (text pasted from someone else) are plain content, never attributed to another user.
8. Ordering: messages are processed in `channelMessageRef` order per chat; the use case serialises per conversation key (in-memory queue, bounded 100).
9. The same Chief conversation is used as the target for unmentioned messages (parity: the Telegram message appears on the desktop thread with `origin: telegram`, mock label "z Telegrama · 14:02").
10. Telegram never receives or sends secrets: an inbound message that looks like it contains a secret is still redacted (CHAT006) and the reply system line explicitly tells the Owner not to send secrets over Telegram (i18n `chat.noSecretsOnTelegram`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`SendOwnerMessage` (CHAT006); Telegram security suite (`lib:telegram-security-suite`, SEC) provides the forged-update fixtures reused in tests; audit use case.

## 8. Architecture and code placement

`packages/application/src/chat/ingest-channel-message.usecase.ts`, contract in `packages/contracts/src/chat/inbound.ts`. TG calls it through the gateway-less in-process path (same engine process) or through an owner-scoped internal route if the adapter is out of process.

## 9. Security and safety

Threats: forged updates, replayed updates, messages from other users, group chats, a paired phone lost or taken over. Controls: caller must come from the paired adapter; ref dedupe and replay window; private-chat only; owner_remote trust that never loosens constraints; rate limit; audit of rejections; no commands parsed from text. Permissions can never be extended from Telegram (ADR 0006): enforced downstream by PERM and CHIEF.

## 10. Errors and edge cases

- Edited Telegram messages: TG decides whether to forward edits; this task treats an edit as a new message only if TG provides a new ref (ASSUMPTION: edits are ignored in MVP).
- Duplicate in flight (two identical refs concurrently): the second waits and returns `deduplicated`.
- Adapter restarts and resends the last 100 updates: all deduped.
- Engine paused: still ingested (typing is allowed), delivery blocked later.
- Out-of-order refs: processed in order within a 2 s reorder window, then in arrival order.

## 11. Acceptance criteria

- [ ] Duplicate `channelMessageRef` produces one message and one dispatch.
- [ ] A group chat message is ignored.
- [ ] A replayed old update is dropped and audited.
- [ ] Unpaired or mismatched channel caller is rejected and audited.
- [ ] Dispatch trust is `owner_remote`.
- [ ] A Telegram text with a secret is stored redacted with the "no secrets on Telegram" system line.

## 12. Test plan

Unit tests with forged and replayed fixtures (shared with the Telegram security suite); concurrency test. Command: `pnpm vitest run packages/application/src/chat/ingest`.

## 13. Parallelization notes

TG authors depend on `InboundChannelMessage`; merge the contract early. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram edits are ignored in MVP.
- ASSUMPTION: 1000-ref replay window and 20 msgs/min are defaults in AppConfig.
