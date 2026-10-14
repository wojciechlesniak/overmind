---
id: OVE_CHATUI031
title: "Wire the direct Agent composer: binding commands, delivery states, refusal and login hints"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT013, OVE_CHATUI007, OVE_CHATUI015, OVE_CHATUI028, OVE_DS040, OVE_DS047, OVE_DS048, OVE_PAUSE012, OVE_SHELL027]
soft_depends_on: []
provides: ["ui:AgentChatComposer"]
needs: ["ui:ChatComposer", "lib:use-pause-guard", "ui:PausedReason", "api:chat.send", "ui:BindingNotice", "ui:InfoNote", "lib:shell-navigation"]
owns: ["apps/desktop/src/features/chat/agent/composer/**", "apps/desktop/src/locales/en/chat-031.json", "apps/desktop/src/locales/pl/chat-031.json"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/composer (crop 342,796,758,104)"
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 9"]
adr_refs: [23, 16, 26]
---

# OVE_CHATUI031: Wire the direct Agent composer: binding commands, delivery states, refusal and login hints

## 1. Summary

Implements the composer and the command feedback of an Agent chat: send to this Agent (`Napisz do QA…`, agent-coloured send button without glow, no quick actions), the delivery states shown under the Owner's message (queued, blocked because the Agent waits for an Approval, login required, failed), the Owner Rule refusal flow and the chat-level composer reasons.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHAT008 delivery gate: a message is never typed into an Agent waiting for approval in its CLI (herdr `blocked`), not blind-retried after timeout; `delivery_notice {status: queued|blocked|needs_login|failed, reason?}` parts record it. CHAT010: the command is checked against Owner Rules before delivery; a refusal posts a `rule_refusal` message, the Agent never sees it, Chief is told. Allowed commands are relayed to Chief and may produce a `plan_update` chip.

## 3. Scope (in)

- Agent composer container (tone `agent`, hue of the Agent).
- Delivery notice rendering rules and actions.
- Composer disabled reasons for Agent states.
- The refusal/binding experience integration test.

## 4. Out of scope

- Send hook (CHATUI007), rule card (CHATUI015).

## 5. Detailed requirements

1. Composer: `ChatComposer tone='agent' agentHue` placeholder `Napisz do <name>…` (EN `Write to <name>…`), no quick actions, `mentions` omitted (the chat target is explicit; a typed `@other` is sent as-is and the server decides: `@other` in an Agent chat is treated as text, CHAT003).
2. Disabled reasons: Global/Workspace pause (guard), Agent archived (`Agent zarchiwizowany`), engine offline, queue full. NOT disabled when the Agent is `working`, `waiting_approval` or `needs_login`: the Owner may still write; the message is stored and the delivery notice explains.
3. Delivery notices (below the related Owner message, from `delivery_notice` parts, CHATUI011 renders text): `queued` -> `W kolejce: Agent skończy bieżący krok` (muted); `blocked` (reason `waiting_approval`) -> `Nie dostarczono: Agent czeka na Twoją Zgodę` with a link `Zobacz Zgodę` scrolling to or opening the Approval; `blocked` (reason `rule`) is replaced by the refusal card; `needs_login` -> `Nie dostarczono: wymagane logowanie w CLI` with link to Connections; `failed` -> `Nie dostarczono` with `Spróbuj ponownie` that re-sends the SAME text as a new message (new `clientMessageId`) only after the Owner clicks (never automatic: no blind retry, SPEC 9).
4. Binding notice and relay: after an allowed command the Agent's acknowledgement and the green `Chief zaktualizował plan` chip appear through normal messages; this task adds no extra logic except ensuring the thread scrolls to them when pinned.
5. Refusal flow test (integration): Owner sends a rule-conflicting command -> `rule_refusal` card appears (CHATUI015) -> composer remains enabled -> the Owner's command text is visible with the `blocked: rule` notice.
6. `Skill used` chips arrive as parts (CHATUI011).
7. Telegram: `@qa ...` messages from Telegram appear in this chat as Owner messages with `z Telegrama`; replies from the Agent appear here as well.

## 6. Design notes

`design.png` shows the Agent chat composer: placeholder `Napisz do QA…`, rounded composer, agent-coloured send button (pink gradient) with NO glow, no quick actions. Not in the mock: disabled, delivery notices (derived `InfoNote` below the bubble), send failure.

## 7. Reuse

- `ui:ChatComposer` (OVE_DS048), `useSendMessage` (OVE_CHATUI007), `usePauseGuard`, `ui:InfoNote` (OVE_DS040).

## 8. Architecture and code placement

`features/chat/agent/composer/`: container + `deliveryNoticeActions.ts` (map notice status -> actions; registry for OCP). Keys `chat-agent:composer.*`. **i18n namespace:** this task writes its strings into its own namespace `chat-031` (files `locales/en|pl/chat-031.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-031`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. The UI never decides whether a command is allowed (Owner Rules are checked by the engine, ADR 0016); it only presents outcomes. Retrying a failed delivery is a deliberate Owner action creating a new message, so a non-idempotent CLI action is never repeated blindly.

## 10. Errors and edge cases

- Agent waiting for Approval: message stored, notice shown, not typed into the CLI.
- Login expired: notice with link; no auto-retry.
- Delivery notice for an unknown status: generic `Nie dostarczono`.
- Message sent while paused: blocked by the guard before sending.

## 11. Acceptance criteria

- [ ] The composer matches `design.png` (agent tone, no glow, no quick actions).
- [ ] Each delivery status shows the specified words and actions.
- [ ] A failed delivery is never retried automatically.
- [ ] A refused command shows the refusal card and the composer stays usable.

## 12. Test plan

- Vitest for the notice registry; Playwright `direct-command` scenarios: allowed with plan update, refused by Rule, blocked by waiting Approval, needs login, failed + manual resend (CHATUI037).
- Command: `pnpm --filter @overmind/desktop test features/chat/agent/composer`.

## 13. Parallelization notes

Keys `chat-agent:composer.*` only. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `Spróbuj ponownie` for failed delivery creates a new Owner message (new key) rather than re-posting the old one.
