---
id: OVE_CHATUI029
title: "Stream the read-only terminal preview: subscribe, sanitise, redact, ring buffer, reconnect"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_CHATUI003, OVE_CHATUI009, OVE_DS052, OVE_PROV036]
soft_depends_on: []
provides: ["lib:agent-terminal-stream"]
needs: ["api:agents.terminal", "lib:api-client-agents", "ui:TerminalPane", "lib:sanitizeTerminalText"]
owns: ["apps/desktop/src/features/chat/agent/terminal/**", "apps/desktop/src/locales/en/chat-029.json", "apps/desktop/src/locales/pl/chat-029.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15"]
adr_refs: [26, 22, 20]
---

# OVE_CHATUI029: Stream the read-only terminal preview: subscribe, sanitise, redact, ring buffer, reconnect

## 1. Summary

Implements `useTerminalStream` and `useTerminalExcerpt`: a bounded, read-only view of an Agent's terminal that is sanitised and redacted before display, survives reconnects, stops when the panel is hidden and never writes to the terminal.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. PROV005 offers `TerminalLayer` (`pane.read`, screen reads) and PROV029 the session gateway; no gateway route exposes terminal output yet. This task defines the capability the UI needs: `api:agents.terminal` = `GET /v1/agents/{id}/terminal?afterOffset=&lines=` returning `{ lines: {offset, text}[], nextOffset, meta:{state, worktree?, isolation:{ok}}, truncated }` plus push `agent.terminal.output` (ephemeral, `{agentId, chunk, offset}`) with Owner-only scope and server-side redaction. Terminal text is the riskiest untrusted input in the product (secrets, ANSI, login codes).

## 3. Scope (in)

- Hooks `useTerminalStream(agentId, {enabled})` and `useTerminalExcerpt(agentId, {lines})`.
- Ring buffer and offsets.
- Visibility and lifecycle rules (subscribe only when visible).
- Reconnect and resync.

## 4. Out of scope

- Server route and engine redaction (named gap: PROV/ENGINE owner).
- Panel view (CHATUI027) and wiring (CHATUI032).

## 5. Detailed requirements

1. Initial snapshot: request the last 200 lines; then subscribe to `agent.terminal.output`; chunks are appended by `offset`; a chunk with an offset below `nextOffset` is ignored (duplicate), above it triggers a snapshot refetch (gap).
2. Pipeline per chunk: `safeTerminalLines` (sanitise ANSI/controls/bidi, then SEC003 redaction, line cap 2000 chars); the result type is `SafeTerminalLines`; the kit `TerminalPane` receives it with `redact` unset (already done) and `maxLines=500`.
3. Ring buffer: at most 500 lines kept; excerpt hook keeps the last 4 non-empty lines.
4. Throttle: chunks coalesced to one state update per 250 ms (terminal output can be thousands of lines per second); a flood above 2000 lines/s collapses into one muted line `… N lines skipped` (counted) so the UI never freezes.
5. Visibility: subscribe only while the panel is mounted and the window is visible (`visibilitychange`); on hide, unsubscribe after 10 s; on show, fetch the snapshot again.
6. `follow` mode: the kit pane follows the bottom unless the user scrolled up.
7. Meta: `state` (`working|blocked|idle|done|unknown`) is shown only as the herdr hint; `isolation.ok` and `worktree` flow to the facts (CHATUI028).
8. Unavailable: when the engine returns `agent.terminal_unavailable` (no session) or the Agent is not running, expose `status:'unavailable'` and no lines; keep the last lines for 30 s with a muted `Sesja zakończona` marker, then clear.
9. No write path: this module exports no function that sends keys or text; a lint test (`no-restricted-imports`) forbids importing send/key functions of api-client in `features/chat/agent/terminal/**`.
10. Memory: buffer cleared on unmount and on Agent switch; no persistence to storage.

## 6. Design notes

N/A, functionality only (visual in CHATUI027).

## 7. Reuse

- `safeTerminalLines` (OVE_CHATUI009), `useEventSubscription` (OVE_CHATUI003), `TerminalPane` (OVE_DS052).

## 8. Architecture and code placement

`features/chat/agent/terminal/`: `ring-buffer.ts` (pure), `useTerminalStream.ts`, `useTerminalExcerpt.ts`. Depends on the api-client agents module for `terminalSnapshot(agentId, query)` and the subscription helper. **i18n namespace:** this task writes its strings into its own namespace `chat-029` (files `locales/en|pl/chat-029.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-029`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Defence in depth for secrets: the server redacts at the source and the UI redacts again; both before any rendering or copying. The login URL of a CLI may carry a one-time code: query values are redacted; the kit pane never navigates and `onOpenLink` is not wired in this panel. Read-only by construction (no input path, lint-enforced). A flood or a malicious CLI that prints escape sequences, huge lines or bidi characters cannot freeze or confuse the UI (caps, throttle, neutralised characters). The panel states that terminal state is a hint.

## 10. Errors and edge cases

- Chunk with invalid UTF-8: replaced characters.
- Snapshot fails: `unavailable` with retry.
- Agent switched quickly: old subscription cancelled; no cross-agent lines (agentId check per chunk).
- Offset reset (session restarted): server sends a `reset` flag; buffer cleared with a muted `Sesja uruchomiona ponownie` line.
- Output flood: summarised line.

## 11. Acceptance criteria

- [ ] A secret printed by the CLI never reaches the DOM (SEC003 corpus test through the full pipeline).
- [ ] Output floods do not drop below 30 fps (synthetic flood test with generous threshold).
- [ ] The module offers no way to write to the terminal.
- [ ] Hiding the window stops the subscription within 10 s.
- [ ] Switching Agents never shows another Agent's lines.

## 12. Test plan

- Vitest: ring buffer, offsets, gap refetch, throttle, flood summary, secret corpus, agent switch, reset flag, no-write lint test.
- Playwright `terminal-stream` scenario using `gateway.pushEvent` (CHATUI037).
- Command: `pnpm --filter @overmind/desktop test features/chat/agent/terminal`.

## 13. Parallelization notes

No hotspot. CHATUI024 depends on `useTerminalExcerpt`. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Gap: `api:agents.terminal` (REST snapshot + `agent.terminal.output` ephemeral event, Owner scope) is not provided by PROV/ENGINE tasks. Needs an owner (suggest PROV029 + a new gateway route task) with server-side redaction.
- ASSUMPTION: maximum 200 lines per snapshot and 64 KB per chunk.
