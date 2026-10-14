---
id: OVE_CHAT014
title: Add chat lifecycle participants for cascade, shutdown and recovery
area: CHAT
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_CHAT004, OVE_CHAT005, OVE_CHAT008, OVE_CHAT009, OVE_DATA012, OVE_ENGINE004, OVE_ENGINE005]
soft_depends_on: []
provides: ["participant:chat-cascade", "participant:chat-shutdown", "participant:chat-recovery"]
needs: ["port:WorkspaceCascadeParticipant", "port:ShutdownParticipant", "port:RecoveryParticipant", "port:ConversationRepository", "port:ChatMessageRepository", "service:ReplyStreamer", "service:ChannelFanout", "service:ChatAgentDeliverer", "port:Clock"]
owns: ["packages/adapters/sqlite/src/chat/cascade.ts", "apps/engine/src/composition/modules/chat-lifecycle.module.ts"]
reads: ["packages/application/src/chat/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 16", "SPECIFICATION 9"]
adr_refs: [23, 6, 5]
---

# OVE_CHAT014: Add chat lifecycle participants for cascade, shutdown and recovery

## 1. Summary

Lifecycle participants for chat: delete a Workspace's agent conversations, flush the outbox on shutdown, close streaming messages, and recover interrupted deliveries without re-typing into a CLI.

## 2. Context

SPEC 10 requires deleting a Workspace's data; ENGINE004/005 require each area to plug in. Chat has non-idempotent effects (typing into a CLI, Telegram send) that crash recovery must not repeat.

## 3. Scope (in)

- `chat-cascade`, `chat-shutdown`, `chat-recovery`, composition module.

## 4. Out of scope

- Chief conversation (global, never deleted by Workspace delete). Agent-to-agent messages: AGENT017.

## 5. Detailed requirements

1. `chat-cascade` (id `chat`): removes conversations with `workspace_id`, their messages, FTS rows, read state and delivery attempts; the Chief conversation is untouched except messages that mention the Workspace by id are left (text is not rewritten) (ASSUMPTION); preview returns counts.
2. Discussion mirror messages for the Workspace are removed with the conversation; the Discussion itself belongs to its own area.
3. `chat-shutdown`: `stop_accepting` rejects new sends with `engine.shutting_down`; `quiesce` lets `ReplyStreamer` finish or close streams as `interrupted` with the partial text retained; `checkpoint` flushes `ChannelFanout` outbox rows and the unread counters.
4. `chat-recovery`: streaming messages left `streaming` are closed as `interrupted` (partial text kept, marked); delivery attempts left `sending` become `delivery_unknown` with a system message to the Owner in that conversation (no automatic retry); Telegram outbound rows left `sending` follow the same rule using `channelMessageRef` idempotency where the Channel supports lookup.
5. Gapless `seq` is verified after recovery for each touched conversation; a gap is repaired by a tombstone system message, never renumbering.
6. Queued (not yet attempted) deliveries resume through the normal gate.
7. All participants are time-bounded and idempotent.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Patterns from DATA012, ENGINE004/005.

## 8. Architecture and code placement

Adapter code under sqlite chat folder; wiring in `chat-lifecycle.module.ts`.

## 9. Security and safety

Never re-send a prompt to a CLI after an uncertain delivery; Owner sees the uncertainty. Cascade removes private conversation text completely and updates FTS.

## 10. Errors and edge cases

- Telegram API down during shutdown: outbox kept for next start.
- Recovery with a deleted conversation: skip.
- Streaming message with no deltas: closed empty and removed.

## 11. Acceptance criteria

- [ ] Cascade deletes only the Workspace's conversations and FTS rows.
- [ ] Streaming messages repaired.
- [ ] Uncertain delivery is never retried automatically.
- [ ] `seq` stays gapless.

## 12. Test plan

Cascade tests (DATA012 harness), kill-point recovery tests. Command: `pnpm vitest run packages/adapters/sqlite/src/chat apps/engine/src/composition/modules`.

## 13. Parallelization notes

Parallel with AGENT017. Needs the multi-port files from ENGINE004/005/DATA012.

## 14. Open questions and assumptions

- ASSUMPTION: Chief conversation messages are retained after Workspace deletion.
- OPEN: should Telegram be notified when a Workspace is deleted? Not in MVP.
