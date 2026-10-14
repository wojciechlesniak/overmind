---
id: OVE_CHATUI018
title: "Build the Chief conversation column (header and thread) as a static composition"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI011, OVE_CHATUI013, OVE_CHATUI015, OVE_DS044, OVE_DS046, OVE_DS050]
soft_depends_on: []
provides: ["ui:ChiefConversationColumn"]
needs: ["ui:ChatHeader", "ui:MessageThread", "ui:PageLayout"]
owns: ["apps/desktop/src/features/chat/thread/column/**", "apps/desktop/src/locales/en/chat-018.json", "apps/desktop/src/locales/pl/chat-018.json"]
reads: []
design: design.png
design_source: "Chief#chief/conversation (crop 342,117,798,665)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23]
---

# OVE_CHATUI018: Build the Chief conversation column (header and thread) as a static composition

## 1. Summary

Composes the centre column of the Chief view: `ChatHeader` (Chief avatar, `Claude Code · Opus 5.5 · widzi 3 Workspace'y`, channel pill `desktop + Telegram`), the message thread through `MessageRenderer`, and the inline cards. It is props-driven and fixture-backed; wiring to data is CHATUI022.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace.

## 3. Scope (in)

- `ChiefConversationColumn` (header + `MessageThread` + slot for the composer area).
- Fixtures reproducing the full mock thread: day label, Telegram owner message, Chief text with summary table, relay row, pending Approval card.
- Empty conversation, loading history, error and offline states.
- `data-region` attributes.

## 4. Out of scope

- Data wiring and virtualisation (CHATUI022).
- Composer (CHATUI019, CHATUI023).

## 5. Detailed requirements

1. Props: `{ header: { name:'Chief'; subtitle:string; channelLabel:string }; messages: MessageView[]; unreadBoundarySeq?: number; status: 'ready'|'loading'|'error'|'empty'; error?: MessageRef; syncStatus: 'live'|'reconnecting'|'offline'; onRetry(); onReachTop(); composerSlot: ReactNode }`.
2. Layout: `data-region='chief/conversation'` column; header `chief/conversation-header` height 65; thread `chief/message-thread` with max-width 780 (centered), padding per DS046; the composer slot sits below (`chief/composer-area`).
3. Header subtitle comes from `chat:header.chief.subtitle` with params (`provider`, `model`, `workspaceCount`): `Claude Code · Opus 5.5 · widzi 3 Workspace'y` / EN `Claude Code · Opus 5.5 · sees 3 Workspaces`. The data is provided by the caller (from Chief config `api:chief.config`).
4. Channel pill from `chat:channel.desktopTelegram` shows `desktop + Telegram` when Telegram is connected, and `tylko desktop` (EN `desktop only`) when not (state from `channel.status.changed`); never claims Telegram while disconnected.
5. States: `loading` = 3 `ui:Skeleton` message lines; `empty` = kit `EmptyState` (`Napisz do Chiefa, aby zacząć.` / EN `Write to Chief to get started.`) with a hint about `@agent` mentions; `error` = EmptyState with Retry; `syncStatus='reconnecting'` = an `InfoNote`-style banner above the thread `Łączenie z silnikiem…`; `offline` = banner `Silnik niedostępny` and composer disabled reason passed down.
6. Messages are rendered with `MessageRenderer`; the thread uses `ui:MessageThread` with `aria-label` `chat:thread.aria` ('Rozmowa z Chiefem').
7. The pending Approval card in the fixture uses the default slot (CHATUI011 `CardSlots`) so this story is data-free.

## 6. Design notes

`design.png` shows header (avatar `C`, name `Chief`, mono subtitle, pill `desktop + Telegram`), the day label, owner bubble with `z Telegrama · 14:02`, Chief paragraph, summary table, relay row, and the amber approval card below. Geometry: DS046, DS050, DS055. Not in the mock: loading, empty, error, reconnecting and offline banners (derived with kit `InfoNote`/`EmptyState`).

## 7. Reuse

- `ui:ChatHeader` (OVE_DS050), `ui:MessageThread` (OVE_DS046), `MessageRenderer` (OVE_CHATUI011), card slots (OVE_CHATUI013, 015).

## 8. Architecture and code placement

`features/chat/thread/column/`: presentational composition. Shared by the Agent chat column? No: Agent chat has its own header and notice (CHATUI026); both reuse `MessageRenderer`. **i18n namespace:** this task writes its strings into its own namespace `chat-018` (files `locales/en|pl/chat-018.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-018`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control.

## 10. Errors and edge cases

- No messages and loading finished: empty state.
- History fails but live works: error banner above the existing messages, not a blank screen.
- Very wide viewport: the thread stays 780px wide.

## 11. Acceptance criteria

- [ ] The `Default` story matches `design.png` within tolerance.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] Banners for reconnecting and offline are worded, not colour-only.
- [ ] The column never scrolls the page, only the thread.

## 12. Test plan

- Storybook `Default`, `Loading`, `Empty`, `Error`, `Reconnecting`, `Offline`, `TelegramDisconnected`, `Pseudolocale`; Testing Library for banners; visual comparison.
- Command: `pnpm --filter @overmind/desktop test features/chat/thread/column`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the channel pill reflects Telegram connection state; the mock always shows `desktop + Telegram`.
