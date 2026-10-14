---
id: OVE_CHAT005
title: Define the Channel port and the outbound fan-out of chat events
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_ARCH015, OVE_CHAT001, OVE_CHAT002, OVE_SHELL006]
soft_depends_on: [OVE_CHAT004]
provides: ["port:ChannelAdapter", "usecase:RegisterChannel", "service:ChannelFanout", "contract:ChannelCapabilities"]
needs: ["port:EventBus", "port:Translator", "lib:event-hub"]
owns: ["packages/application/src/ports/ChannelAdapter.ts", "packages/application/src/chat/channels/**"]
reads: ["packages/contracts/src/chat/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16.13"]
adr_refs: [6, 23, 10]
---

# OVE_CHAT005: Define the Channel port and the outbound fan-out of chat events

## 1. Summary

Desktop and Telegram are two Channels to the same Chief and Agents. This task defines the `ChannelAdapter` port that Telegram (TG area) implements, the capability declaration (what a channel may show and do), and the fan-out service that delivers new chat messages to every registered channel in a channel-appropriate form, from one source of truth.

## 2. Context

ADR 0006: Telegram is not a separate bot or a separate Chief; it has the same memory, tasks and Run status but fewer rights, and conversations are not end-to-end encrypted. ADR 0010: one Owner. The desktop receives push events through the gateway hub (ARCH010); Telegram receives text rendered by its adapter. Parity (criterion 13) means they derive from the same messages and the same state.

## 3. Scope (in)

- Port `ChannelAdapter` and `ChannelCapabilities`.
- `ChannelRegistry` (register/unregister at startup; one adapter per `Channel` value).
- `ChannelFanout` service subscribed to `chat.message.created/updated`: decides, per channel, whether and how to send (by capability, conversation and the Owner's channel preferences).
- Rules for what Telegram may receive (no secrets, no long outputs, no rule-change actions).

## 4. Out of scope

- The Telegram adapter itself, pairing, formatting: TG. The desktop push hub: ENGINE (the desktop is served by the hub, not by `ChannelAdapter`; see requirement 6). Inbound messages: `OVE_CHAT007`.

## 5. Detailed requirements

1. Port:
   ```ts
   interface ChannelAdapter {
     readonly channel: 'telegram';                       // only external channels implement it; desktop is served by the push hub
     capabilities(): ChannelCapabilities;
     deliver(msg: OutboundChatMessage, ctx: DeliveryContext): Promise<Result<DeliveryReceipt>>;
     update?(receipt: DeliveryReceipt, msg: OutboundChatMessage): Promise<Result<DeliveryReceipt>>;   // edit a streaming message if supported
     status(): ChannelStatus;                            // connected | degraded | disconnected | not_paired
   }
   ChannelCapabilities = { maxTextLength: number; supportsEdit: boolean; supportsCards: boolean; supportsButtons: boolean; e2eEncrypted: false; canApprovePermanently: false; canChangeRules: false; canViewTerminal: false }
   ```
   `e2eEncrypted`, `canApprovePermanently`, `canChangeRules` are literal `false` types for Telegram (ADR 0006); a desktop pseudo-capability set is exported with `true` values for tests and for UI gating.
2. `OutboundChatMessage` is built from a stored `ChatMessage` with `stripForChannel` (CHAT002), text truncated to `maxTextLength` with a "(continued on desktop)" marker (i18n key `chat.continuedOnDesktop`), secrets redacted again at this boundary (defence in depth), and conversation label (`@agent` prefix for messages from an Agent so the Owner sees who replied; Chief messages have none).
3. Fan-out rules: send to Telegram only (a) `chief`, `agent`, `result`, `approval_card`, `rule_refusal` messages whose conversation was last used by the Owner on Telegram within 24 h or which belong to the Chief conversation, (b) never `system` binding notices, never Discussion transcripts (only a "Discussion started" notification by NOTIF), never terminal output. ASSUMPTION documented in section 14.
4. Delivery is at-least-once with a per-channel outbox: pending deliveries are stored in `channel_outbox` (table owned here, migration `V202610141150__OVE_CHAT005__channel_outbox.sql`), retried with backoff (1 s, 5 s, 30 s, 5 min; max 6 attempts) then marked `failed` and surfaced as a `degraded` status. Deliveries are NOT retried when the adapter returns a non-retryable error (for example blocked bot).
5. Ordering: per conversation messages are delivered in `seq` order; a failed message blocks later ones of the same conversation until failed permanently.
6. Desktop: the fan-out does nothing for desktop; desktop clients subscribe to `chat.*` events at the hub and fetch messages by id (`OVE_CHAT013`). The same `ChatMessage` is thus the single source for both channels.
7. Parity helper: `ChannelParityProbe` returns for a conversation the last `seq` seen by desktop (read state) and the last `seq` delivered to Telegram, so a test (criterion 13) can assert both channels expose the same latest state.
8. A paired-channel status change publishes `channel.status.changed` (ephemeral) for the top bar "Telegram connected" item (SHELL).
9. Adapters are registered by composition modules (`ChannelAdapter` is a multi-token, ARCH006); no adapter is imported by this area.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`stripForChannel` (CHAT002), `Translator` (ARCH015) for fixed strings, redaction (ARCH004), event bus, multi-token (ARCH006), retry/backoff helper from ARCH007 if present.

## 8. Architecture and code placement

Port at `packages/application/src/ports/ChannelAdapter.ts`; service in `packages/application/src/chat/channels/{registry.ts,fanout.ts,outbox.ts,parity.ts}`; outbox SQLite adapter file `packages/adapters/sqlite/src/chat/channel-outbox.repository.ts` is part of CHAT004's folder, so this task writes it under `packages/adapters/sqlite/src/chat-channel/` (own folder) and its migration.

## 9. Security and safety

Telegram is a lower-trust, not end-to-end encrypted channel: nothing secret or Owner-only goes out; approvals shown there are summaries with ids (the decision flows back through TG's authenticated path, run-scoped only). `canApprovePermanently: false` and `canChangeRules: false` are enforced here by stripping and again by PERM/CHIEF (defence in depth). A forged or compromised adapter cannot read more than what the fan-out sends it. Outbound failures never block the engine.

## 10. Errors and edge cases

- Adapter not paired: messages are not queued (nothing to deliver), status `not_paired`.
- Telegram API errors (429): adapter returns retryable with `retryAfter`; the outbox honours it.
- Engine restart: outbox is replayed; `DeliveryReceipt` idempotency key prevents duplicates (adapter dedupes by `outboundId`).
- Very long Agent output: truncated for Telegram with the marker.
- Message edited while streaming and `supportsEdit` false: only the final text is delivered.

## 11. Acceptance criteria

- [ ] A Chief message is delivered to a fake Telegram adapter once, in `seq` order.
- [ ] A message containing a secret-like string reaches the adapter redacted.
- [ ] A `rule_refusal` message reaches Telegram without rule-change actions.
- [ ] Adapter failures trigger the documented backoff and mark degraded after 6 attempts.
- [ ] Restart replays pending outbox entries exactly once (fake adapter dedupes).
- [ ] `ChannelParityProbe` shows desktop and Telegram at the same latest `seq` after a conversation.

## 12. Test plan

Unit tests with a fake adapter and fake clock; outbox repository contract tests; restart simulation. Command: `pnpm vitest run packages/application/src/chat/channels packages/adapters/sqlite/src/chat-channel`.

## 13. Parallelization notes

TG authors implement the port against this task's contract (merge the port file early). Parallel with CHAT006. Hotspot: none; own folder for the outbox repository.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram receives Chief conversation messages always and Agent messages only for conversations the Owner used on Telegram in the last 24 h.
- ASSUMPTION: only external channels implement `ChannelAdapter`; desktop uses the push hub.
