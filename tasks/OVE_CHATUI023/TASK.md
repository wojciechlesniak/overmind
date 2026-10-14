---
id: OVE_CHATUI023
title: "Wire the Chief composer: send, mentions, quick actions, pause guard and offline reasons"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_CHATUI004, OVE_CHATUI007, OVE_CHATUI019, OVE_PAUSE012, OVE_SHELL027]
soft_depends_on: []
provides: ["ui:ChiefComposer"]
needs: ["lib:use-pause-guard", "ui:PausedReason", "lib:shell-navigation", "api:agents.list", "lib:api-client-agents"]
owns: ["apps/desktop/src/features/chat/composer/wiring/**", "apps/desktop/src/locales/en/chat-023.json", "apps/desktop/src/locales/pl/chat-023.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 11"]
adr_refs: [23, 6]
---

# OVE_CHATUI023: Wire the Chief composer: send, mentions, quick actions, pause guard and offline reasons

## 1. Summary

Connects the Chief composer area to `useSendMessage`: draft per conversation, `@mention` options from the Agents of the Workspace, quick actions, disabling by Global Pause or offline engine with a visible reason, and error mapping for chat errors.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. Quick actions in the Chief view: `Pokaż Tablicę` (navigate to the Task Board), `Zacznij Dyskusję` (the Owner asks Chief to start a Discussion; Discussions are started by Chief or by Workflow Nodes, the Owner has no create route, DISC014), `Podsumuj dzień` (ask Chief for a daily summary). Sending is the normal `POST /v1/chat/messages`; the server routes by mention (CHAT003). Unknown or ambiguous mentions are errors.

## 3. Scope (in)

- Container component for the composer area.
- Mention options builder.
- Quick action handlers.
- Disabled reasons (pause, offline, queue full, engine not ready).
- Error presentation.

## 4. Out of scope

- Send pipeline internals (CHATUI007).
- Agent chat composer (CHATUI031).

## 5. Detailed requirements

1. Mention options: from the Workspace's visible Agents (`api:agents.list` with the Workspace scope): `{ id, label: handle, name, hue, initials }` where `handle` is the server's canonical mention handle (lowercase name without spaces; if the contract provides `mentionHandle` use it, else derive `name.toLowerCase().replace(/\s+/g,'')` and reject collisions by appending the short id: the server resolves `@name` and answers `ambiguous_mention` otherwise). Only Agents active in this Workspace are offered (private Agents of other Workspaces are never offered).
2. `onSend(text)`: `useSendMessage({kind:'chief'})`; value cleared only after acceptance (CHATUI007); focus stays in the composer.
3. Quick actions: `Pokaż Tablicę` -> `navigate({to:'board'})` (no message, allowed while paused); `Zacznij Dyskusję` -> inserts `Zacznij Dyskusję o: ` in the composer (draft, not sent) and focuses it, because the Owner must name the topic; `Podsumuj dzień` -> sends the owner message `Podsumuj dzień` through the normal pipeline (blocked while paused with the quick-action disabled state). Quick action labels and the sent texts are i18n keys (`chat:quick.board`, `chat:quick.discussion`, `chat:quick.summary`, text keys `chat:quick.summaryText`); no hard-coded Polish in code.
4. Disabled reasons by priority: engine `offline` -> `Silnik niedostępny`; Global/Workspace pause (`usePauseGuard`) -> its reason; send queue full -> `chat:send.queueFull`. The reason is passed as `disabledReason` (the kit keeps the typed text).
5. Errors: validation errors (`message_too_large`, `unknown_mention`, `ambiguous_mention`, `agent_not_in_workspace`, `empty_message`) render as an inline note under the composer (role=alert) with the mention shown (max 40 chars) and an `Edit` affordance when the text was moved back; rate limit shows a countdown; other errors raise a toast (`ui:useToast`) and keep the text.
6. Draft: `useDraft(conversationId)`; survives navigation inside the app.
7. Focus: `Cmd+K` or `/` focusing the composer is a SHELL command; not defined here.
8. A mention in the text of an Agent that is working or waiting is allowed (the server gates delivery; delivery notices appear in the thread, CHATUI031).

## 6. Design notes

N/A beyond CHATUI019. Inline error note uses `ui:InfoNote` in error tone (derived).

## 7. Reuse

- `ChiefComposerArea` (OVE_CHATUI019), `useSendMessage` (OVE_CHATUI007), `usePauseGuard`, `useToast` (OVE_DS037).

## 8. Architecture and code placement

`features/chat/composer/wiring/`: container, `useMentionOptions`, `quickActions.ts` (a registry array of `{id, labelKey, run}`: adding an action is one entry). **i18n namespace:** this task writes its strings into its own namespace `chat-023` (files `locales/en|pl/chat-023.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-023`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Quick actions are fixed typed ids, never text-derived. The mention list is a convenience; the server re-parses mentions and enforces Workspace scope (CHAT003, never trust the client). Pause is enforced by the engine too (the UI guard is defence in depth).

## 10. Errors and edge cases

- No Agents: `@` shows `noMatches`.
- Quick action while paused: disabled with reason, not hidden.
- Handle collision: appended id suffix; server ambiguity error still handled.
- Send during reconnect: queued by CHATUI007 with a note `Zostanie wysłane po połączeniu`.
- Failed send after edit: text restored.

## 11. Acceptance criteria

- [ ] `Podsumuj dzień` sends one message and the composer clears after acceptance.
- [ ] `Zacznij Dyskusję` does not send; it prepares the draft.
- [ ] Under Global Pause the composer and sending quick actions are disabled with the reason, `Pokaż Tablicę` still works.
- [ ] Only Agents of this Workspace appear in `@` suggestions.
- [ ] The typed text is never lost on failures.

## 12. Test plan

- Vitest + Testing Library with fakes; Playwright `paused` and `busy-day` scenarios; error table tests for all `chat.*` input errors.
- Command: `pnpm --filter @overmind/desktop test features/chat/composer/wiring`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Open for the Owner: should `Zacznij Dyskusję` open a small form (topic, participants) instead of prefilling text? Default: prefill, Chief asks follow-up questions.
