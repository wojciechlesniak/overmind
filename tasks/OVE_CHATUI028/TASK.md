---
id: OVE_CHATUI028
title: "Wire the Agent chat data: open conversation, Agent header, state and facts"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGENT010, OVE_CHATUI004, OVE_CHATUI006, OVE_CHATUI026, OVE_PROV002, OVE_SHELL011, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:agent-chat-data"]
needs: ["api:agents.get", "lib:api-client-agents", "api:agents.states", "api:connections.status", "lib:active-workspace", "lib:shell-navigation"]
owns: ["apps/desktop/src/features/chat/agent/data/**", "apps/desktop/src/locales/en/chat-028.json", "apps/desktop/src/locales/pl/chat-028.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 9"]
adr_refs: [23, 26, 28]
---

# OVE_CHATUI028: Wire the Agent chat data: open conversation, Agent header, state and facts

## 1. Summary

Provides `useAgentChat(agentId)`: resolves or creates the Agent's conversation in the active Workspace, loads the Agent profile summary (name, role, CLI, model, visibility, lifecycle), tracks Agent State and facts, and exposes everything the Agent chat view needs as view models.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. `POST /v1/chat/conversations/agent {agentId, workspaceId}` opens or creates the conversation (first open posts the binding notice). One conversation per `(agentId, workspaceId)`: the same persistent public Agent has separate chats per Workspace (Agent Memory also per Workspace, ADR 0014/0028). Facts: task and worktree and isolation come from the Agent State view and Run summary (`AgentStateView.taskId/runId`, session info from PROV); herdr state is a hint.

## 3. Scope (in)

- `useAgentChat`.
- Subtitle and state mapping.
- Facts assembly.
- Not-found and not-visible handling.

## 4. Out of scope

- Terminal stream (CHATUI029), controls (CHATUI030), composer (CHATUI031).

## 5. Detailed requirements

1. `useAgentChat(agentId)` returns `{ status:'loading'|'ready'|'notFound'|'archived'|'error'; conversationId?; agent?: {id,name,role,hue,initials,kindLabelKey,provider,model,visibility}; state?: {value,label,reason?,paused}; facts?: { herdrState; task?; worktree?; isolation:{ok:boolean; labelKey} }; }`.
2. Open: call `openAgentConversation` once per `(agentId, workspaceId)` per mount (guard with a ref; React StrictMode double-invoke safe via an in-flight map). Result `chat.agent_not_in_workspace` or 404 -> `notFound`.
3. Profile: `GET /v1/agents/{id}` (current config inlined); archived Agent -> `archived` (history readable, composer disabled with the reason `Agent zarchiwizowany`).
4. State: `useAgentStates` entry for the Agent; `state.paused` from the view; label via CHATUI002.
5. Facts: `herdrState` = the Agent State's `herdr_hint` evidence if present (word + `wg herdr`); `task` from `taskId` (label `T-31 · koszyk` from Board task summary); `worktree` from the session info of the Agent (`api:agents.terminal` snapshot `meta.worktree`, CHATUI029); `isolation.ok` only when the engine reports an active isolated environment for the session, otherwise `ok:false` with `izolacja niepotwierdzona` (never default to OK).
6. Telegram parity: mentions from Telegram land in this conversation (server); nothing special here.
7. Visibility: for a private Agent of another Workspace the engine answers not found; the view shows `notFound` without revealing existence.
8. Subscribes to `agent.state.changed` for this Agent and `agent.config_changed` (refresh profile).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Hooks (OVE_CHATUI004), sync (OVE_CHATUI006), mappers (OVE_CHATUI002), `useResource` (OVE_CHATUI003).

## 8. Architecture and code placement

`features/chat/agent/data/`: hooks only, no JSX. **i18n namespace:** this task writes its strings into its own namespace `chat-028` (files `locales/en|pl/chat-028.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-028`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Fail closed on isolation: unknown means not OK. Agent identity comes from the route id validated against the engine, never from message text.

## 10. Errors and edge cases

- Agent archived mid-session: state flips to `archived`.
- Open call fails: `error` with retry.
- Agent in another Workspace: `notFound`.
- No session yet: facts show `—` and state `bezczynny`.

## 11. Acceptance criteria

- [ ] Opening an Agent chat for the first time creates the conversation and shows the binding notice.
- [ ] Facts never show isolation OK without engine confirmation.
- [ ] Archived Agents are read-only.
- [ ] Not-visible Agents show not-found.

## 12. Test plan

- Vitest with fake api-client for each status; StrictMode double mount test; Playwright `busy-day` (CHATUI035).
- Command: `pnpm --filter @overmind/desktop test features/chat/agent/data`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Gap: session facts (worktree, isolation status) have no named API; assumed to come with `api:agents.terminal` metadata (`meta: {worktree, isolation:{ok}, sessionState}`), requested in the gap list.
