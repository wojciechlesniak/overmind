---
id: OVE_CHATUI019
title: "Build the Chief composer area: quick actions and @mention composer (static with fixtures)"
area: CHATUI
kind: ui
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI001, OVE_DS048, OVE_PAUSE012]
soft_depends_on: []
provides: ["ui:ChiefComposerArea"]
needs: ["ui:ChatComposer", "ui:QuickActions", "ui:PausedReason"]
owns: ["apps/desktop/src/features/chat/composer/view/**", "apps/desktop/src/locales/en/chat-019.json", "apps/desktop/src/locales/pl/chat-019.json"]
reads: []
design: design.png
design_source: "Chief#chief/composer-area (crop 342,782,798,118)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23, 6]
---

# OVE_CHATUI019: Build the Chief composer area: quick actions and @mention composer (static with fixtures)

## 1. Summary

Composes the bottom area of the Chief thread from `ui:ChatComposer`: the three quick actions, the multiline composer with the `@agent` hint placeholder and the glowing magenta send button, with all states (disabled by pause, sending, offline, char limit). Props-driven; wiring is CHATUI023.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. Quick actions in the mock: `Pokaż Tablicę`, `Zacznij Dyskusję`, `Podsumuj dzień`. Placeholder `Napisz do Chiefa… albo @qa`. The Agent chat composer has no quick actions and an agent-coloured send button without glow (CHATUI031).

## 3. Scope (in)

- `ChiefComposerArea` component with tone `chief`.
- Fixtures and stories for default, typing, disabled by pause, offline, sending, near char limit, mention menu open.
- Region attributes.

## 4. Out of scope

- Sending, drafts and mention data (CHATUI023).
- Quick action behaviour (CHATUI023).

## 5. Detailed requirements

1. Props: `{ value, onChange, onSend, onQuickAction, quickActions: QuickActionItem[], mentions: MentionOption[], sending: boolean, disabledReason?: string, maxLength?: number }` forwarded to `ui:ChatComposer tone='chief'` with labels from `chat:composer.*`: `placeholder.chief` 'Napisz do Chiefa… albo @qa' (EN 'Write to Chief… or @qa'; the `@qa` example is replaced at runtime by the first mention option label when available), `send` 'Wyślij' (EN 'Send'), `message` 'Wiadomość do Chiefa', `mentionList` 'Agenci', `noMatches` 'Brak pasujących Agentów'.
2. Region: `data-region='chief/composer-area'` wrapping quick actions (`chief/quick-actions`) and the composer (`chief/composer`).
3. Padding 12 24 20 and max width 780 as DS048 requirement 9.
4. The component adds no logic: draft clearing and sending belong to the wiring task.

## 6. Design notes

`design.png` shows quick action pills `Pokaż Tablicę`, `Zacznij Dyskusję`, `Podsumuj dzień`, the rounded composer with placeholder `Napisz do Chiefa… albo @qa` and the magenta send button. Not in the mock: focus, mention menu, disabled, sending, counter (all from DS048 section 6).

## 7. Reuse

- `ui:ChatComposer`, `ui:QuickActions` (OVE_DS048), `ui:PausedReason` (OVE_PAUSE012).

## 8. Architecture and code placement

`features/chat/composer/view/`: thin presentational wrapper plus stories and fixtures. **i18n namespace:** this task writes its strings into its own namespace `chat-019` (files `locales/en|pl/chat-019.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-019`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control. The mention menu is a convenience: routing is decided by the server (CHAT003), the UI never trusts it.

## 10. Errors and edge cases

- `disabledReason` set: placeholder replaced by the reason, text kept.
- Pasted text over max length: truncated by the kit with a counter.
- No mention options (no Agents): `@` shows `noMatches`.

## 11. Acceptance criteria

- [ ] `Default` story matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] Disabled state shows the reason as text.

## 12. Test plan

- Storybook states listed above; Testing Library: Enter/Shift+Enter/IME behaviour is covered by the kit, here only prop forwarding and labels.
- Command: `pnpm --filter @overmind/desktop test features/chat/composer/view`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- None beyond DS048 assumptions.
