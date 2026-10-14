---
id: OVE_CHATUI012
title: "Render streaming Agent and Chief replies with typing indicator and stop-safe states"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT009, OVE_CHATUI006, OVE_CHATUI011, OVE_DS046, OVE_DS047]
soft_depends_on: []
provides: ["lib:chat-streaming-view"]
needs: ["ui:TypingIndicator", "ui:MessageBubble", "event:chat.message.delta"]
owns: ["apps/desktop/src/features/chat/thread/streaming/**", "apps/desktop/src/locales/en/chat-012.json", "apps/desktop/src/locales/pl/chat-012.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 9"]
adr_refs: [23, 26]
---

# OVE_CHATUI012: Render streaming Agent and Chief replies with typing indicator and stop-safe states

## 1. Summary

Adds the streaming states the mock does not draw: a typing indicator when a reply is expected, live growing text with `streaming` status, the transition to `complete`, and the failed or interrupted reply (partial text kept) states.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHAT009: a reply is a message with `status:'streaming'` that grows by deltas (published at most every 100 ms, stored every 1 s); it finalises on `final` chunk or after 3 s of quiet; crash recovery marks stale streaming rows `failed` with partial text. Only one streaming message per Agent conversation. The Telegram channel receives only completed messages.

## 3. Scope (in)

- `StreamingMessage` wrapper around the renderer.
- Typing indicator logic (expected reply).
- Failed and interrupted reply presentation.
- Reduced-motion behaviour.

## 4. Out of scope

- Delta merging (CHATUI005).
- Interrupt control (CHATUI030).

## 5. Detailed requirements

1. Typing indicator: shown after the Owner's message is `sent` and a `delivery_notice` of `queued` or no notice yet, as long as the Agent State is `working` and no streaming message exists for that conversation; hidden at the first delta or after 90 s with no activity (then replaced by the muted note `chat:stream.noReply` 'No reply yet. The Agent may be busy.'). Never shown when the Agent is `waiting_approval` or `needs_login` (the state is shown elsewhere).
2. Streaming text: `Markdown status='streaming'`; the bubble gets `aria-busy='true'`; the live region announces only the first sentence boundary and the final message, not every token (the kit log is `aria-relevant=additions`; the streaming text node stays in one element).
3. Pinned scrolling follows the growth only while pinned (kit); if not pinned, show the kit jump control with the label `New messages`.
4. `complete`: remove busy state; if the message has `truncated`, show the note from CHATUI011.
5. `failed` with partial text: keep the text, add the muted error line `chat:stream.failed` ('The reply was interrupted. Partial text shown.') and a `Retry` only when the server marks the failure retryable (it does not today: no button in MVP).
6. Interrupted by the Owner (CHATUI030 `Przerwij`): the reply ends as `complete` or `failed` according to the server; the UI adds nothing of its own.
7. A second Owner message while streaming is allowed; the old reply finalises first (CHAT009 requirement 8); the UI shows both in order.
8. Reduced motion: no pulsing dots (kit handles), no smooth autoscroll.

## 6. Design notes

Not in the mock: typing indicator, streaming text, failed partial. Derived from DS047 `TypingIndicator` (three 6px dots, label `Chief pisze…`) and the `status` rules of DS046. Copy: `chat:stream.typing` ('{{name}} is typing…' / '{{name}} pisze…').

## 7. Reuse

- `ui:TypingIndicator`, `ui:MessageBubble` (OVE_DS046, OVE_DS047), renderer (OVE_CHATUI011), cache (OVE_CHATUI005).

## 8. Architecture and code placement

`features/chat/thread/streaming/`: one component and one hook (`useTypingState(agentState, messages)`) kept pure for tests. **i18n namespace:** this task writes its strings into its own namespace `chat-012` (files `locales/en|pl/chat-012.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-012`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Streaming text is untrusted; same pipeline as complete messages (Markdown subset, no HTML). The typing indicator is a UI hint only and never a proof the Agent works (Agent State is a hint, ADR 0026): it hides on `waiting_approval` and `needs_login` so the Owner does not wait for a reply that cannot come.

## 10. Errors and edge cases

- Delta arrives after unmount: ignored.
- Streaming message never finalises (engine crash): server recovery marks it `failed`; the UI shows partial text after the next sync.
- Two streaming messages (bug): the older is rendered as non-streaming.
- Slow engine: indicator times out at 90 s with the note.

## 11. Acceptance criteria

- [ ] Typing indicator appears after a delivered Owner message and disappears on the first delta.
- [ ] The indicator never shows in `waiting_approval` or `needs_login`.
- [ ] Screen reader gets the final message once, not per token (test with the live region spy).
- [ ] Failed partial text remains visible with the explanatory line.
- [ ] Reduced motion disables animations.

## 12. Test plan

- Vitest `useTypingState` table tests (states x timers with fake clock).
- Storybook stories `Typing`, `Streaming`, `FailedPartial`, `NoReplyTimeout`; axe; live region spy test.
- Command: `pnpm --filter @overmind/desktop test features/chat/thread/streaming`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: no Retry button for failed replies in MVP (the Owner can simply send a new message).
