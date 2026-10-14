---
id: OVE_CHATUI037
title: "Test the Agent chat: commands, refusal, terminal safety, controls, a11y and visuals"
area: CHATUI
kind: test
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_CHATUI032, OVE_CHATUI033, OVE_CHATUI035, OVE_DS105, OVE_TEST004, OVE_TEST005, OVE_TEST010]
soft_depends_on: []
provides: ["lib:agent-chat-e2e-suite"]
needs: ["lib:playwright-harness", "lib:visual-regression", "lib:a11y-harness", "lib:keyboard-test-helpers", "lib:visualPagesA"]
owns: ["apps/desktop/e2e/chat/agent/**", "apps/desktop/src/locales/en/chat-037.json", "apps/desktop/src/locales/pl/chat-037.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16"]
adr_refs: [23, 16, 26, 22]
---

# OVE_CHATUI037: Test the Agent chat: commands, refusal, terminal safety, controls, a11y and visuals

## 1. Summary

Adds the Playwright suites for the direct Agent chat: binding notice, owner command with relay and plan-update chip, Owner Rule refusal with both actions, delivery notices, Skill-used chips with versions, the read-only terminal (sanitised, redacted, no input), controls with confirmation, Agent states in the header, needs-login, and all a11y and visual checks.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. SPEC criterion 11: a command given directly to an Agent updates Chief's plan and the Board. Criterion 8/10: nothing here extends permissions. Terminal preview is untrusted CLI output.

## 3. Scope (in)

- Functional, security, a11y, visual and performance specs for `/chief/agent/:agentId`.

## 4. Out of scope

- Chief view suites (CHATUI036).

## 5. Detailed requirements

1. Functional: (1) first open creates the conversation and shows the binding notice once; (2) allowed command: optimistic bubble, Agent reply, `Chief zaktualizował plan · …` chip with link to the Board; (3) refused command: Owner Rule card R2 appears, the command is not delivered (`gateway.calls` shows no delivery), `Zmień Regułę` creates a draft and navigates, `Zostaw jak jest` collapses and persists after reload; (4) delivery notices: queued, blocked by waiting Approval (link scrolls to the card), needs login (link to Connections), failed with manual resend that creates a NEW message; (5) Skill chips show `użyto Skilla: e2e-playwright v2` (name and version); (6) header states: working, waiting for Approval, needs login, done, idle, paused with words; (7) controls: Pause toggles to Resume; Przerwij opens the dialog with focus on Cancel, confirms once, is disabled when not working; resume blocked under Global Pause.
2. Terminal safety: ANSI sequences, bidi characters and a floods of lines are neutralised; a token split across two chunks is redacted; the panel has no input element and no key reaches the engine (assert zero requests of type send/key); login URL query values are redacted and never clickable; switching Agents never shows the previous Agent's lines.
3. Telegram: a `@qa` message from Telegram shows in the chat with `z Telegrama`.
4. Isolation honesty: `isolation.ok=false` renders `izolacja niepotwierdzona` in error tone; unknown never renders OK.
5. A11y: axe in all states; keyboard order list -> thread -> composer -> terminal region -> controls; terminal is focusable for scrolling and not announced; dialog focus trap.
6. Visual: compare `agentchat/chat-header`, `agentchat/thread` (including refusal card), `agentchat/composer`, `agentchat/terminal-panel` and the full page with `Czat-Agent.png`.
7. `en-XA` and PL runs.

## 6. Design notes

N/A, functionality only (tests compare with `Czat-Agent.png` crops).

## 7. Reuse

- TEST004/005/010 helpers, scenarios (OVE_CHATUI035).

## 8. Architecture and code placement

`apps/desktop/e2e/chat/agent/*.spec.ts`. **i18n namespace:** this task writes its strings into its own namespace `chat-037` (files `locales/en|pl/chat-037.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-037`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Negative tests for: no terminal input path, no automatic retry of a failed delivery, no delivery of refused commands, no raw secret in the terminal DOM, interrupt only in `working`.

## 10. Errors and edge cases

- Timing of terminal throttle: use the clock fixture and explicit flush events.

## 11. Acceptance criteria

- [ ] All specs pass in CI.
- [ ] axe clean in every state.
- [ ] Visual diffs within tolerance.
- [ ] Security negative tests present and failing when the corresponding guard is removed.

## 12. Test plan

- `pnpm --filter @overmind/desktop test:e2e chat/agent`; `test:visual chat/agent`.

## 13. Parallelization notes

Test-only task. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- None.
