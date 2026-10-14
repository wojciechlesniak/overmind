---
id: OVE_CHATUI033
title: "Mark Telegram-origin messages and show channel status in chat"
area: CHATUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_CHATUI006, OVE_CHATUI011, OVE_DS017, OVE_DS018, OVE_DS040, OVE_PROV002, OVE_TG005]
soft_depends_on: []
provides: ["lib:chat-channel-status"]
needs: ["api:connections.status", "event:channel.status.changed", "ui:OriginTag", "ui:OriginLine", "ui:Pill"]
owns: ["apps/desktop/src/features/chat/channel/**", "apps/desktop/src/locales/en/chat-033.json", "apps/desktop/src/locales/pl/chat-033.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16"]
adr_refs: [6]
---

# OVE_CHATUI033: Mark Telegram-origin messages and show channel status in chat

## 1. Summary

Makes the channel visible: every message that came from Telegram carries its source (`z Telegrama · 14:02`), the Chief header pill reflects the real Telegram connection state, and an approval decided from Telegram says so. The Owner always knows where a command came from.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. ADR 0006: Telegram is a second channel with fewer rights; approvals from Telegram apply only to the current Run; forged or replayed Telegram messages are rejected by TG (SEC008). Messages carry `origin: 'desktop'|'telegram'|'engine'`. Source must be always visible (DS046 requirement 2). `channel.status.changed` is pushed with chat events.

## 3. Scope (in)

- `useChannelStatus()` hook.
- `sourceLabel` rule shared by renderer and approval cards.
- Channel pill state.
- Origin line for decided approvals.

## 4. Out of scope

- Telegram adapter and pairing (TG, CONNUI).

## 5. Detailed requirements

1. `useChannelStatus()` returns `{ telegram: 'connected'|'disconnected'|'unpaired'|'error' }` from `api:connections.status` + `channel.status.changed`.
2. Pill label: connected -> `desktop + Telegram`; otherwise `tylko desktop` with the Telegram state in the tooltip.
3. `originLabel(message)`: Telegram -> `z Telegrama · 14:02`, desktop -> time only, engine -> none. A message with `origin:'telegram'` that lacks a timestamp shows `z Telegrama` (never hides origin).
4. Approval cards decided by `owner_telegram` show `Rozstrzygnięto w Telegramie · 14:19` and `tylko ten Run` (CHATUI013 uses this function).
5. Owner messages from Telegram are visually identical to desktop ones except the label (no impersonation styling).
6. A Telegram message is never treated as more trusted than a desktop one; nothing in the UI offers actions on Telegram-origin messages that require local confirmation.

## 6. Design notes

Visual elements: mono 11 meta line under the owner bubble (`z Telegrama · 14:02`, mock) and the pill `desktop + Telegram` (mock). Disconnected pill is derived (neutral `Pill meta` with `tylko desktop`).

## 7. Reuse

- `ui:OriginLine`, `ui:Pill` (OVE_DS040, OVE_DS017).

## 8. Architecture and code placement

`features/chat/channel/`: hook and pure label helpers used by CHATUI011, 013, 018. **i18n namespace:** this task writes its strings into its own namespace `chat-033` (files `locales/en|pl/chat-033.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-033`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Telegram content is untrusted data (SEC004, SEC008): origin is shown always; the label comes from the server field `origin` set from the authenticated channel, never from the text (a message that says `from desktop` is still labelled by its real origin).

## 10. Errors and edge cases

- Status unknown: shows `tylko desktop` with `status unknown` tooltip (not claiming connected).
- Message with unknown origin value: treated as engine/system, no label.

## 11. Acceptance criteria

- [ ] Every Telegram-origin message shows its source in every view (Chief thread, Agent chat).
- [ ] The pill never claims Telegram when it is disconnected.
- [ ] Decided-on-Telegram approvals show the channel and Run-only scope.

## 12. Test plan

- Vitest label tests (origin x timestamp present/absent); Storybook pill states; Playwright `telegram-disconnected` scenario.
- Command: `pnpm --filter @overmind/desktop test features/chat/channel`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `api:connections.status` includes the Telegram channel state; otherwise only the event is used.
