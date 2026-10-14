---
id: OVE_CHATUI030
title: "Wire the Agent controls: pause Agent and interrupt with confirmation"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_CHATUI027, OVE_CHATUI028, OVE_DS036, OVE_DS053, OVE_PAUSE012, OVE_PROV036]
soft_depends_on: []
provides: ["lib:agent-controls"]
needs: ["api:agents.control", "lib:api-client-agents", "ui:ConfirmDialog", "lib:use-pause-guard", "ui:AgentTerminalPanel"]
owns: ["apps/desktop/src/features/chat/agent/controls/**", "apps/desktop/src/locales/en/chat-030.json", "apps/desktop/src/locales/pl/chat-030.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12"]
adr_refs: [26, 5]
---

# OVE_CHATUI030: Wire the Agent controls: pause Agent and interrupt with confirmation

## 1. Summary

Implements the two buttons of the Agent chat panel: `Wstrzymaj Agenta` (pause this Agent) and `Przerwij` (interrupt the current turn) with a confirmation dialog for the destructive interrupt, loading and disabled states, and result feedback.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. PROV029: `interrupt(agentId)` is allowed only when the observation is `working` and sends the profile's interrupt key; never in `waiting_approval`. Pausing an Agent reduces activity (like Global Pause, a safe action). No gateway route exists for these two actions: this task consumes `api:agents.control` (`POST /v1/agents/{id}/pause|resume|interrupt`, Owner-only, idempotent), named in the gap list.

## 3. Scope (in)

- Hooks `useAgentControls(agentId)`.
- Confirm dialog for `Przerwij`.
- Resume affordance (the pause button becomes `Wznów Agenta`).
- Disabled reasons.

## 4. Out of scope

- Global Pause (PAUSE area) and Run cancel (RUNUI).

## 5. Detailed requirements

1. `pause`: `POST .../pause` with `Idempotency-Key`; no confirmation (safe); while paused the button label becomes `Wznów Agenta` and calls `.../resume`; resuming is blocked while Global or Workspace pause is active (`usePauseGuard`, reason shown).
2. `interrupt`: opens `ui:ConfirmDialog` (destructive tone) `Przerwać bieżące zadanie QA?` body `Agent przestanie pracować nad tym krokiem. Niezapisana praca może zostać utracona.` with buttons `Przerwij` (danger) and `Anuluj`; initial focus on `Anuluj`. On confirm: `POST .../interrupt` once; the dialog closes; the button shows loading until the Agent State leaves `working` or 5 s pass.
3. Disabled rules: `interrupt` disabled unless Agent State is `working` (tooltip `Agent nie pracuje`), because the engine refuses it in other states (never in `waiting_approval`: the Owner decides the Approval instead); `pause` disabled when the Agent has no session? No: pausing an idle Agent is allowed and prevents new work; disabled only for archived Agents.
4. Errors: `agent.not_running` -> toast `Agent nie pracuje`; `perm.owner_required` impossible on desktop; network error -> toast with retry; the control state always reflects the engine (no optimistic UI).
5. Results are announced politely (`aria-live` in the toast).
6. Both actions are audited by the engine; nothing is logged client-side.

## 6. Design notes

Visual is the kit panel (CHATUI027). Dialog is derived from DS036: destructive confirm, 2 buttons, danger button right.

## 7. Reuse

- `ui:ConfirmDialog` (OVE_DS036), `AgentTerminalPanel` controls specs (OVE_DS053), `usePauseGuard`, `useToast`.

## 8. Architecture and code placement

`features/chat/agent/controls/`: hook + dialog component. Keys `chat-agent:controls.*`. **i18n namespace:** this task writes its strings into its own namespace `chat-030` (files `locales/en|pl/chat-030.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-030`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Interrupt sends a key through PROV only in `working`; the UI cannot send arbitrary keys or text. Both actions require an explicit click and a dialog for the destructive one.

## 10. Errors and edge cases

- Double click on Przerwij: second ignored.
- State changes while the dialog is open (Agent became waiting): the confirm call is refused by the engine; the dialog shows `Stan Agenta się zmienił` and closes.
- Agent archived: both disabled with reason.

## 11. Acceptance criteria

- [ ] Interrupt always asks for confirmation and is never sent in other states.
- [ ] Pause toggles to Resume and reflects engine state.
- [ ] No optimistic state: the UI follows engine events.
- [ ] Resume is blocked under Global Pause with the paused reason.

## 12. Test plan

- Vitest hook tests with fake client; Testing Library for dialog focus and keyboard (Escape cancels); Playwright `agent-controls` scenario (CHATUI037).
- Command: `pnpm --filter @overmind/desktop test features/chat/agent/controls`.

## 13. Parallelization notes

Keys `chat-agent:controls.*` only. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Gap: `api:agents.control` routes (pause, resume, interrupt) are not in AGENT/PROV; requested in the gap list. PROV029 already implements interrupt at the gateway-port level.
- ASSUMPTION: Agent pause is per Agent and independent of Workspace pause.
