---
id: OVE_CHAT009
title: Stream Agent and Chief replies into the thread with cards and completion
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_CHAT004, OVE_CHAT005, OVE_CHAT008, OVE_PERM013, OVE_PERM014, OVE_PROV009, OVE_SEC004]
soft_depends_on: [OVE_AGENT014]
provides: ["service:ReplyStreamer", "event:chat.message.delta", "usecase:PostSystemMessage", "usecase:PostAgentResult"]
needs: ["port:AgentSessionGateway", "usecase:RequestApproval", "contract:ApprovalRequest", "lib:redaction", "lib:prompt-assembly"]
owns: ["packages/application/src/chat/reply/**", "packages/contracts/src/events/chat.message.delta.event.ts"]
reads: ["packages/application/src/chat/delivery/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 9", "SPECIFICATION 15"]
adr_refs: [22, 23, 27, 26]
---

# OVE_CHAT009: Stream Agent and Chief replies into the thread with cards and completion

## 1. Summary

Turns what an Agent or Chief produces into thread messages: a streaming reply that grows live, tool and Approval cards, a result card and a final complete message. It also exposes `PostSystemMessage` for other areas (binding notice, rule refusal, plan update chip, skill used chip).

## 2. Context

The Agent chat shows the Agent's reply text plus chips ("used Skill: e2e-playwright v2", "Chief updated plan"), a rule refusal card and, on the right, a read-only terminal sidebar (the sidebar is PROV/CHATUI; this task covers the thread). Replies come from three sources: structured reports (`OVE_AGENT014`), the reply text extracted from the CLI by the PROV adapter (`AgentSessionGateway.replies()` stream of normalised chunks) and Chief turns (`OVE_CHIEF006`). Desktop receives deltas live; Telegram gets the final text (no edits unless the channel supports them).

## 3. Scope (in)

- `ReplyStreamer`: consumes reply chunks per Agent conversation, creates a `streaming` message, appends text, finalises.
- Ephemeral event `chat.message.delta` (payload `{ conversationId, messageId, seq, appendedText, offset }`).
- `PostSystemMessage(kind, params)` and `PostAgentResult` helpers for other areas, producing `system`, `result`, `approval_card`, `rule_refusal`, `relay` messages with parts.
- Inline Approval and Access Request cards: on `approval.requested` and `access_request.created` events for an Agent, post an `approval_card` message into the Agent's conversation and into the Chief conversation (the mock shows the card in the Chief thread).

## 4. Out of scope

- Approval decisions and expiry: PERM. Reply extraction from terminal screens: PROV. Rendering: CHATUI. Chief's own text generation: CHIEF006.

## 5. Detailed requirements

1. Chunk contract (consumed from PROV): `ReplyChunk = { agentId, sessionId, kind: 'text' | 'tool_call' | 'tool_result' | 'final', text?, toolName?, offset: int }`. Tool calls and results are summarised as a single `system`-like line part `tool_line` ("ran tests", never raw output) with a link to the terminal panel, not stored in full (bounded 200 chars).
2. A reply begins on the first `text` chunk after an Owner message was delivered or after a report; it creates a message `status: 'streaming'`, author `agent`, and appends text. Deltas are published at most every 100 ms (coalesced); the stored text is flushed to the DB at most every 1 s and on finalise (crash loses at most 1 s; recovery marks stale streaming rows `failed` with the partial text kept, CHAT004 repair).
3. Finalise on `final` chunk, or when Agent State returns to idle with no further chunks for 3 s. Final text is redacted (ARCH004), truncated to 32 000 characters with the rest stored as an Artifact `result_ref` part, then status `complete` and event `chat.message.updated`.
4. Text from the CLI is untrusted content: it is shown to the Owner as text, never interpreted. Markdown is allowed in a restricted subset (rendering sanitised by CHATUI). Strings that look like Overmind control markers are not special in any way.
5. Approval cards: subscribe to `approval.requested`, `access_request.created`, and the matching decided events; on request create one `approval_card` message per target conversation with an `approval_ref` part (snapshot from PERM data) and update it (`chat.message.updated`) when decided/expired, replacing the snapshot status. Telegram receives the card via fan-out with stripped details.
6. `PostSystemMessage` kinds (typed, parameterised, no free text from callers except bounded params): `binding_notice`, `rule_refusal`, `plan_update`, `skill_used`, `relay_note`, `delivery_notice`, `secret_removed`, `agent_started`. Each kind maps to a message `type` and `parts`; localisation keys are stored (`textKey`, `params`) in `parts`, and `text` carries the English fallback.
7. `skill_used`: produced when a Skill usage record is created (`OVE_SKILL008`) for a Run with an Agent conversation: one chip per (skill, version) per reply, de-duplicated within the reply.
8. Backpressure: at most one streaming message per Agent conversation; a new reply while one streams finalises the old one first.
9. A message completes with `result` type when the Agent reports `done` with artifacts (`OVE_AGENT014`); the message holds `result_ref` parts only for Artifacts that passed path verification.
10. Streaming is only for desktop; for Telegram, the fan-out waits for `complete`.
11. Reply attribution: the message author is the Agent in whose session the text appeared; the engine sets `agentId` from the session mapping (Agent <-> terminal mapping held by PROV), never from text.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

CHAT002 builders, CHAT004 `updateStreaming`, fan-out CHAT005, redaction ARCH004, `AgentSessionGateway` reply stream (PROV), approval contracts (PERM).

## 8. Architecture and code placement

`packages/application/src/chat/reply/{reply-streamer.ts,coalescer.ts,approval-cards.ts,system-messages.ts}`; event file `chat.message.delta.event.ts`; module `chat-reply.module.ts`.

## 9. Security and safety

Terminal output is external content (SEC004 R7): it never drives actions; the streamer only displays and stores it, after redaction. Approval cards are display-only (no authority). Attribution is by engine session mapping so a prompt-injected reply cannot impersonate another Agent or Chief. Tool output is not stored in full (could contain secrets or large data). Size caps prevent memory blowups from a runaway CLI (1 MiB cap per reply, then truncation).

## 10. Errors and edge cases

- CLI prints ANSI sequences: stripped (SEC004 `sanitize`).
- Gateway stream disconnects mid-reply: message finalised as `failed` with the partial text and a notice.
- Duplicate `final` chunks: idempotent by offset.
- Two Agents reply at once: separate conversations, separate streams.
- Approval expired before the card was posted: card posted in `expired` state.
- Engine restart during a streaming reply: repair marks it failed; the Owner sees partial text plus "interrupted".

## 11. Acceptance criteria

- [ ] A fake chunk stream produces one streaming message, coalesced deltas, and one complete message with redacted text.
- [ ] A secret printed by the fake CLI (`noisy` scenario) is absent from storage and events.
- [ ] An `approval.requested` event creates exactly one card per target conversation and updates it on decision.
- [ ] `PostSystemMessage('rule_refusal')` yields a `rule_refusal` message with an `owner_rule_ref` part.
- [ ] Restart during streaming yields a `failed` message with partial text.
- [ ] Text claiming to be from another Agent is attributed to the session's Agent.

## 12. Test plan

Unit tests with a scripted chunk source; coalescing test with fake clock; recovery test; scenario test with `fake-claude happy-path` and `noisy` (TEST006). Command: `pnpm vitest run packages/application/src/chat/reply`.

## 13. Parallelization notes

After CHAT008. Parallel with CHAT010-012. Hotspot: `PostSystemMessage` is used by CHAT010 and CHIEF tasks; its kind table lives here (one file); others add kinds by proposal.

## 14. Open questions and assumptions

- ASSUMPTION: PROV exposes a normalised reply chunk stream; if only screen snapshots exist, PROV derives chunks from them.
- ASSUMPTION: delta coalescing 100 ms, flush 1 s, idle finalise 3 s.
