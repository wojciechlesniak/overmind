---
id: OVE_CHATUI027
title: "Build the Agent terminal side panel region (static: read-only terminal, facts, controls)"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI009, OVE_CHATUI026, OVE_DS040, OVE_DS044, OVE_DS051, OVE_DS052, OVE_DS053]
soft_depends_on: []
provides: ["ui:AgentTerminalPanelView"]
needs: ["ui:AgentTerminalPanel", "ui:AgentFactsBlock", "ui:TerminalPane", "ui:KeyValueList", "ui:SidePanel", "ui:InfoNote"]
owns: ["apps/desktop/src/features/chat/agent/terminal-view/**", "apps/desktop/src/locales/en/chat-027.json", "apps/desktop/src/locales/pl/chat-027.json"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/terminal-panel (crop 1100,117,340,783)"
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [26, 20]
---

# OVE_CHATUI027: Build the Agent terminal side panel region (static: read-only terminal, facts, controls)

## 1. Summary

Composes the 340px right panel of the Agent chat from the kit `AgentTerminalPanel`: title `Terminal Agenta` with `tylko podgląd`, the live-preview terminal, the four facts (`STAN wg herdr`, `ZADANIE`, `WORKTREE`, `IZOLACJA`), the hint footnote and the controls. Props-driven with fixtures; includes the not-running and isolation-failed states.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. ADR 0026: the herdr state is a hint, not proof, and always labelled `wg herdr`. The worktree is `qa/cart-e2e` style (branch name per Agent). Isolation `kontener · OK` must turn into an explicit error word if not confirmed (fail-closed visibility). The terminal is read-only: there is no input to the CLI from this panel; the Owner talks to the Agent through the composer.

## 3. Scope (in)

- `AgentTerminalPanelView` props mapping to the kit panel.
- Fixtures and stories for running, idle, waiting for Approval, needs login (login lines), not running, terminal unavailable, isolation failed, controls loading and disabled.
- Region attributes.

## 4. Out of scope

- Terminal data stream (CHATUI029).
- Control behaviour and confirm dialog (CHATUI030).

## 5. Detailed requirements

1. Props: `{ terminal: TerminalPaneProps; herdrState: {value; label}; task?: {id; label}; worktree?: string; isolation: {ok; label}; controls: { pause: ControlSpec; interrupt: ControlSpec }; terminalUnavailableText?: string }` (DS053).
2. Region `data-region='agentchat/terminal-panel'` with children `agentchat/terminal-output`, `agentchat/agent-facts-grid`, `agentchat/terminal-footnote`, `agentchat/agent-controls`.
3. Copy (`chat-agent:terminal.*`): title `Terminal Agenta` (EN `Agent terminal`), pill `tylko podgląd` (EN `read only`), facts `STAN wg herdr`/`ZADANIE`/`WORKTREE`/`IZOLACJA`, footnote `Stan z terminala to wskazówka. Zadanie idzie dalej dopiero po raporcie Skilla „overmind” i sprawdzeniu efektu.`, controls `Wstrzymaj Agenta`/`Przerwij`, unavailable `Terminal niedostępny`, isolation values `kontener · OK` / `izolacja niepotwierdzona` (error tone).
4. `needs login`: the terminal lines may include the CLI login URL; the panel shows them as text only (kit never navigates); a hint line `Zaloguj się w CLI, aby kontynuować` appears; Overmind never relays the login code (ADR 0022).
5. The terminal region is `role=log aria-live=off` (kit); keyboard users can focus it to scroll.
6. No input element exists in the panel (static test asserts there is no `input`, `textarea`, `[contenteditable]`).

## 6. Design notes

`design.png` shows the full right panel: header `Terminal Agenta` + `tylko podgląd`, the terminal with `$ npx playwright test cart/`, pass lines mint, fail lines red with reason, `… 38/52`; `STAN wg herdr` (pracuje), `ZADANIE T-31 · koszyk`, `WORKTREE qa/cart-e2e`, `IZOLACJA kontener · OK`; footnote; `Wstrzymaj Agenta` (secondary) and `Przerwij` (danger). Geometry DS053. Not in the mock: terminal unavailable, isolation failure, loading/disabled controls, confirm dialog.

## 7. Reuse

- `ui:AgentTerminalPanel`, `ui:AgentFactsBlock`, `ui:TerminalPane`, `ui:KeyValueList` (OVE_DS053, DS051, DS052), `SafeTerminalLines` type (OVE_CHATUI009).

## 8. Architecture and code placement

`features/chat/agent/terminal-view/`: presentational wrapper plus fixtures. **i18n namespace:** this task writes its strings into its own namespace `chat-027` (files `locales/en|pl/chat-027.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-027`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control. Terminal lines are typed `SafeTerminalLines`. The facts block shows isolation honestly: unknown is an error (ADR 0020 fail closed).

## 10. Errors and edge cases

- No worktree: fact value `—`.
- Terminal empty and Agent running: `Czekam na wyjście…` muted line.
- Very long worktree name: ellipsis with title.

## 11. Acceptance criteria

- [ ] `Default` story matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] No input element in the panel (test).
- [ ] Isolation not OK is shown in error tone with the word.

## 12. Test plan

- Storybook states listed; Testing Library no-input assertion; visual comparison.
- Command: `pnpm --filter @overmind/desktop test features/chat/agent/terminal-view`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- None.
