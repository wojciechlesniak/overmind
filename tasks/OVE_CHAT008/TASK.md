---
id: OVE_CHAT008
title: Deliver Owner messages to the Agent CLI session with a safe delivery gate
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT010, OVE_ARCH007, OVE_CHAT006, OVE_NOTIF004, OVE_PERM010, OVE_PROV009, OVE_PROV027, OVE_SEC004]
soft_depends_on: [OVE_CHAT010]
provides: ["service:ChatAgentDeliverer", "contract:DeliveryDecision"]
needs: ["port:AgentSessionGateway", "lib:prompt-assembly", "usecase:StartAgentSession", "port:PauseStateReader", "port:Clock", "usecase:Notify"]
owns: ["packages/application/src/chat/delivery/**", "packages/contracts/src/chat/delivery.ts", "packages/adapters/sqlite/migrations/V202610141200__OVE_CHAT008__delivery_attempts.sql", "packages/adapters/sqlite/src/chat-delivery/**"]
reads: ["packages/application/src/chat/send-owner-message.usecase.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 16.2"]
adr_refs: [26, 22, 23, 21]
---

# OVE_CHAT008: Deliver Owner messages to the Agent CLI session with a safe delivery gate

## 1. Summary

Takes a routed Owner message for an Agent and types it into that Agent's CLI session through the PROV port, but only when it is safe: never into a blocked terminal, never during Global Pause, never twice. Every attempt is recorded before it is made, and the Owner sees the delivery status in the thread.

## 2. Context

Prototype and ADR 0026: `agent.prompt` works only for named, herdr-managed agents; the "do not send to a blocked agent" gate must live in Overmind's adapter layer; a sent command is non-idempotent and must not be retried blindly after a timeout; the CLI may show a login error or a choice dialog that herdr calls `done`. A direct command is binding (ADR 0023) and reaches Chief via `OVE_CHAT010`. The Agent thread mock shows the Agent's reply and chips; terminal state is a hint.

## 3. Scope (in)

- `ChatAgentDeliverer` service reacting to `chat.owner_message.routed` for Agent targets.
- Delivery decision table (`DeliveryDecision`), attempt table, status notices (`delivery_notice` parts).
- Starting the session on demand through PROV when the Agent has none.

## 4. Out of scope

- Command gate against Owner Rules and relay to Chief: `OVE_CHAT010`. Reply streaming: `OVE_CHAT009`. Session launch details and herdr: PROV.

## 5. Detailed requirements

1. Decision inputs: Agent State (`OVE_AGENT010`), Pause state, session presence, whether the Agent has an active Run, trust of the message. Output `DeliveryDecision = { action: 'send' | 'queue' | 'refuse', reason: 'ok' | 'paused' | 'waiting_approval' | 'needs_login' | 'cli_choice_dialog' | 'working_queue' | 'no_session' | 'agent_archived' }`.
2. Table: `idle` or `finished_unread` -> send; `working` -> queue (delivered when idle; ASSUMPTION: the Owner can press "Interrupt" in the UI which is a separate control, PROV); `waiting_approval` or `cli_choice_dialog` -> queue with notice "waiting for your approval; the message will be sent after" and NEVER typed; `needs_login` -> queue with a `needs_login` notice and a notification asking the Owner to log in (ADR 0022); paused -> queue; `no_session` -> start a session through `StartAgentSession` (PROV, under the Workspace sandbox) and queue until idle; archived -> refuse.
3. Attempt record: before calling `AgentSessionGateway.sendPrompt`, insert `delivery_attempts(id, message_id, agent_id, attempted_at, outcome NULL)`; after the call, set outcome `sent | rejected | timeout | error`. If an attempt row exists without outcome at startup, the outcome is `unknown` and the message is marked `undelivered` with a notice "Delivery status unknown; not resent automatically" (non-idempotent, herdr docs). A `timeout` outcome is never retried automatically (SPEC 9).
4. Prompt: built with `PromptAssembler`: trusted instructions contain the Agent's role context reminder and the rule "The following is a direct instruction from the Owner" only when `trust === 'owner'` (desktop); for Telegram (`owner_remote`) the instruction says it came via Telegram and cannot loosen limits. The Owner's text is NOT fenced as untrusted data (it is the Owner's instruction, SEC004 trust level `owner`/`owner_remote`), but anything quoted from files or tool output is. Text is passed as bracketed paste, Enter sent separately by the adapter.
5. The Owner Rules relevant to the Workspace are part of the trusted instructions (names and text), so even a mis-gated message meets them in the prompt (defence in depth; the primary check is CHAT010).
6. After a successful `sent`, status becomes `delivered` and `deliveredAt` is set; a `delivery_notice(queued|blocked|needs_login|failed)` part is attached to the message while the message is not delivered, and removed (message updated) on delivery. Statuses are visible in the thread as small system lines, never as errors thrown to the Owner.
7. Queue: per Agent FIFO, max 10 queued messages; the 11th is refused with `chat.delivery_blocked` reason `queue_full`. Queued messages are delivered one at a time; the next is sent only after the Agent returns to idle after processing.
8. Recovery on engine start: scan messages with `status = 'pending'` and no attempt row (never typed) and re-run the decision; messages with an attempt row but no outcome become `unknown`.
9. The service never types anything into a terminal itself; only `AgentSessionGateway.sendPrompt` does, and that port enforces its own block gate too (belt and braces: if the port refuses with `prov.agent_blocked`, the message is queued, not failed).
10. Global Pause: new messages are stored and queued; resume triggers delivery in order.

## 6. Design notes

N/A, functionality only. (Notice copy keys: `chat.delivery.queued`, `chat.delivery.waitingApproval`, `chat.delivery.needsLogin`, `chat.delivery.unknown`.)

## 7. Reuse

`AgentSessionGateway` and `StartAgentSession` (PROV), `PromptAssembler` (SEC004), Agent State (AGENT010), `Notify` (NOTIF), `Result`.

## 8. Architecture and code placement

`packages/application/src/chat/delivery/{deliverer.ts,decide.ts,queue.ts}`, pure `decide` function separately tested; attempt repository `packages/adapters/sqlite/src/chat-delivery/` with its own migration; module `chat-delivery.module.ts`.

## 9. Security and safety

The danger is typing into the wrong place: a permission dialog, a choice dialog or a login prompt could interpret typed text as an answer (for example "1" or "yes"). Hence the state gate, the double gate in PROV, no automatic retries and the attempt-before-send record. Trust labels differ for Telegram. Owner Rules are in the prompt as defence in depth. Secrets were redacted upstream. Audit entries are written for every refused or unknown delivery.

## 10. Errors and edge cases

- Agent State flips to blocked between decision and send: PROV refuses; message stays queued.
- CLI login expired: notice and notification; message waits.
- Engine crash between attempt row and send: unknown outcome, no resend.
- Agent deleted while queued: messages marked `failed` with reason `agent_archived`.
- Owner sends a second message while the first is queued: both queue in order.

## 11. Acceptance criteria

- [ ] With fake CLI `permission-prompt` active, a message is never typed and stays queued with the waiting notice (no `typed_into_dialog` effect).
- [ ] With `login-required`, a notification is raised and the message waits.
- [ ] A timeout outcome is not retried and the message shows the unknown-status notice.
- [ ] After a simulated crash mid-send no message is typed twice.
- [ ] Idle Agent receives the message exactly once, status becomes delivered.
- [ ] 11th queued message is refused with `queue_full`.
- [ ] Paused system queues, resume delivers in order.

## 12. Test plan

Pure decision table tests; scenario tests with `fake-claude`/`fake-codex` scenarios `permission-prompt`, `choice-dialog`, `login-required`, `stalled`, `happy-path`, `crash` and fake herdr (TEST006, TEST009); crash-recovery test. Command: `pnpm vitest run packages/application/src/chat/delivery`.

## 13. Parallelization notes

Needs AGENT010 and PROV's `AgentSessionGateway` contract (stub). Parallel with CHAT009, CHAT011. Hotspot: shares `AgentSessionGateway` usage with AGENT012; port owned by PROV.

## 14. Open questions and assumptions

- ASSUMPTION: messages to a `working` Agent queue (not injected mid-work); an explicit Interrupt control exists in the terminal sidebar mock ("Przerwij").
- ASSUMPTION: queue limit 10 per Agent.
