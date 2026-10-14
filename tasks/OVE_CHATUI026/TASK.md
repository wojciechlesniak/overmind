---
id: OVE_CHATUI026
title: "Build the direct Agent chat header, binding notice and thread (static, with fixtures)"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI011, OVE_CHATUI015, OVE_DS018, OVE_DS046, OVE_DS047, OVE_DS050]
soft_depends_on: []
provides: ["ui:AgentChatColumn"]
needs: ["ui:ChatHeader", "ui:BindingNotice", "ui:MessageThread", "ui:StatusPill"]
owns: ["apps/desktop/src/features/chat/agent/column/**", "apps/desktop/src/locales/en/chat-026.json", "apps/desktop/src/locales/pl/chat-026.json"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/chat-header (crop 342,117,758,130)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23, 16]
---

# OVE_CHATUI026: Build the direct Agent chat header, binding notice and thread (static, with fixtures)

## 1. Summary

Composes the centre column of the direct Agent chat: the Agent header (avatar, `Agent stały · Codex CLI · gpt-5.5`, state pill `pracuje`, link `Profil Agenta`), the binding notice, and the thread with owner bubble, Agent text, plan-update chip, Owner Rule refusal card and Skill-used chip. Props-driven with fixtures.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. ADR 0023: the Owner may command an Agent directly; the command is binding but Owner Rules still win (ADR 0016) and the Agent informs Chief immediately. The header state pill shows the Agent State word (never colour only). The thread reuses `MessageRenderer` of CHATUI011.

## 3. Scope (in)

- `AgentChatColumn` composition.
- Header data type and fixtures (all Agent states: working, waiting for Approval, needs login, done, idle, paused).
- Binding notice placement.
- Empty (first message), loading, error and offline states.

## 4. Out of scope

- Data (CHATUI028), composer (CHATUI031), terminal panel (CHATUI027).

## 5. Detailed requirements

1. Props: `{ agent: { id, name, hue, initials, subtitle: string }; state: { value: KitAgentState; label: string }; messages: MessageView[]; status; syncStatus; onOpenProfile(): void; composerSlot: ReactNode; ...same banners as the Chief column }`.
2. Header via `ui:ChatHeader` with `profileLink {label:'Profil Agenta', onOpen}`; no channel pill in an Agent chat (Telegram `@agent` messages still arrive in the thread with their source label).
3. Subtitle text: `<kindLabel> · <provider> · <model>` with `kindLabel` `Agent stały`/`Agent dynamiczny` (EN `Persistent Agent`/`Dynamic Agent`) from the Agent's lifecycle; for a dynamic private Agent append the word `PRYWATNY` (visibility always a word, ADR 0028).
4. State pill words (`chat-agent:state.*`): `pracuje`, `czeka na Zgodę`, `wymaga zalogowania` (amber), `skończył`, `bezczynny`, `wstrzymany`; `needs login` also shows a link `Zaloguj w Połączeniach` navigating to Connections (the CLI login happens in the Owner's terminal; Overmind never sees credentials, ADR 0022).
5. Binding notice: the first row of the thread is the system message with the `binding_notice` part (rendered by CHATUI011) so it scrolls with history; this column does not add a second copy.
6. Thread semantics: `aria-label` `Rozmowa z <name>`; messages use `showAvatar` for the first message of an Agent run.
7. Regions: `data-region='agentchat/chat-header'`, `agentchat/thread` (thread), `agentchat/binding-notice` (set by the renderer), `agentchat/owner-rule-card` (set by the rule slot).

## 6. Design notes

`design.png` shows the header and the top of the thread: avatar `QA`, name `QA`, mono `Agent stały · Codex CLI · gpt-5.5`, pill `pracuje`, link `Profil Agenta`, lock notice `Twoje polecenia w tym czacie są wiążące. QA od razu przekazuje je Chiefowi.`, owner bubble `Pomiń testy wydajności w tej iteracji.` `14:18`, Agent reply `Zrobione...`, green chip `Chief zaktualizował plan · „Testy obciążeniowe” → Odłożone` + `Tablica`. Geometry DS046, DS047, DS050. Not in the mock: pill states other than working, empty chat, loading, error, offline, needs-login link.

## 7. Reuse

- `ui:ChatHeader`, `ui:BindingNotice`, `ui:StatusPill` (OVE_DS050, OVE_DS047, OVE_DS018), `MessageRenderer` (OVE_CHATUI011).

## 8. Architecture and code placement

`features/chat/agent/column/`. Owns `chat-agent.json` (namespace for everything under `features/chat/agent/**`; sibling agent tasks add keys under their own top-level objects: `terminal.*` (027, 029), `controls.*` (030), `composer.*` (031)). **i18n namespace:** this task writes its strings into its own namespace `chat-026` (files `locales/en|pl/chat-026.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-026`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control.

## 10. Errors and edge cases

- Agent archived: header shows `archiwalny`, composer disabled reason (wiring).
- Name or subtitle too long: ellipsis.
- `needs_login`: amber word and link, never idle.

## 11. Acceptance criteria

- [ ] `Default` story matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] All six pill states have stories with words.
- [ ] Dynamic private Agent shows the word PRYWATNY.

## 12. Test plan

- Storybook states; Testing Library for header link; visual comparison.
- Command: `pnpm --filter @overmind/desktop test features/chat/agent/column`.

## 13. Parallelization notes

Owns `chat-agent.json`; siblings write only under their prefixes. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Missing kit variant: `ChatHeader` has no `needs login` helper link slot; use the `actions` slot (DS050) and note it for DS.
