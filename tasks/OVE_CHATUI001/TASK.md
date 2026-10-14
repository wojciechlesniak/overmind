---
id: OVE_CHATUI001
title: "Create the chat feature skeleton: manifest, region slugs and i18n namespaces"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_DS038, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:chat-feature-skeleton", "lib:chat-regions"]
needs: ["lib:feature-manifest", "lib:i18n-ui", "lib:shell-navigation", "ui:UiLabelsProvider"]
owns: ["apps/desktop/src/features/chat/feature.manifest.ts", "apps/desktop/src/features/chat/shared/**", "apps/desktop/src/locales/en/chat.json", "apps/desktop/src/locales/pl/chat.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 13"]
adr_refs: [23, 17]
---

# OVE_CHATUI001: Create the chat feature skeleton: manifest, region slugs and i18n namespaces

## 1. Summary

Creates the empty `features/chat` feature: the manifest that registers the Chief rail item and its routes, the constants for `data-region` slugs from VIEWS.md, the shared `chat` i18n namespace with the common keys (conversation states, errors, units) and a typed `chatKeys` helper. Later CHATUI tasks fill it with components and wiring.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. ARCH009 defines `defineFeature` and the glob collection done by SHELL; this task is the first and only one that touches the manifest, so route components can be added by other tasks as lazy modules without editing it again.

## 3. Scope (in)

- `feature.manifest.ts` (id `chat`, rail item `Chief`, routes `/chief` (Chief thread) and `/chief/agent/:agentId` (direct Agent chat), lazy element imports of `routes/ChiefRoute` and `routes/AgentChatRoute`, namespaces computed by `chatNamespaces()` from the glob of `locales/en/chat*.json`).
- `shared/regions.ts`: the `data-region` slugs used by tests and visual comparison (see requirement 3).
- `shared/labels.ts`: the `ui:UiLabels` bundle for chat components (accessible names for kit parts).
- `locales/{en,pl}/chat.json` with the common keys.
- Route placeholder components so the manifest resolves before the real routes exist (replaced wholesale by CHATUI025 and CHATUI032).

## 4. Out of scope

- Real route content (CHATUI025, CHATUI032).
- Other namespaces' strings: every other CHATUI task owns its own `chat-<NNN>.json` namespace file (rule in section 8 of each task).
- Rail icon and SHELL layout: SHELL area.

## 5. Detailed requirements

1. Manifest: `defineFeature({ id:'chat', titleKey:'chat:nav.title', namespaces: chatNamespaces() /* computed from import.meta.glob('../../locales/en/chat*.json'): `chat` plus one `chat-<NNN>` file per task */, routes:[{path:'/chief', element:()=>import('./routes/ChiefRoute')},{path:'/chief/agent/:agentId', element:()=>import('./routes/AgentChatRoute')}], nav:[{id:'chief', area:'rail', labelKey:'chat:nav.label', icon:'chat', order:20}], requiresCapabilities:['api:chat.conversations','api:chat.messages','api:chat.send'] })`. The rail order follows the mock (Workspaces 10, Chief 20, Workflow 30, Board 40, Decisions 50).
2. The Discussions feature (DISCUI) has its own route `/chief/discussion/:discussionId`; the Chief rail item is the active item for all three routes (use manifest `meta.activeNav = 'chief'`; if SHELL has no such field write the proposal and use the route prefix `/chief`).
3. `regions.ts` exports `export const CHAT_REGIONS = { conversationList:'chief/conversation-list', chiefRow:'chief/chief-row', conversation:'chief/conversation', conversationHeader:'chief/conversation-header', messageThread:'chief/message-thread', approvalCard:'chief/approval-card', composerArea:'chief/composer-area', workingNowPanel:'chief/working-now-panel', agentChatHeader:'agentchat/chat-header', bindingNotice:'agentchat/binding-notice', ownerRuleCard:'agentchat/owner-rule-card', terminalPanel:'agentchat/terminal-panel', agentFacts:'agentchat/agent-facts-grid', agentControls:'agentchat/agent-controls' } as const` and a `regionProps(slug)` helper returning `{ 'data-region': slug }`.
4. `labels.ts` exports `useChatUiLabels(): UiLabels` built from `chat:a11y.*` keys (message list name, composer, mention list, send, copy, jump to end, new messages).
5. `chat.json` common keys (EN source, PL translation as in the mocks): `nav.label` Chief / Chief, `nav.title` Chief and conversations / Chief i rozmowy, `state.working` working / pracuje, `state.waitingApproval` waiting for Approval / czeka na Zgodę, `state.done` finished / skończył, `state.idle` idle / bezczynny, `state.needsLogin` needs login / wymaga zalogowania, `state.waitingGate` waiting for Quality Gate / czeka na Quality Gate, `channel.desktopTelegram` desktop + Telegram / desktop + Telegram, `origin.telegram` from Telegram / z Telegrama, `count.unread_one|_other` (PL `_one|_few|_many|_other`), `empty.noConversation`, `error.load`, `error.send`, `offline.title`.
6. No component code in this task other than the two route placeholders (each renders `EmptyState` from the kit with the key `chat:placeholder`).
7. The skeleton MUST NOT import `@overmind/api-client` (no data access in the manifest or labels).

## 6. Design notes

N/A, functionality only (scaffolding). The slug list mirrors `tasks/_design/VIEWS.md` sections 4 and 5.

## 7. Reuse

- `defineFeature` and `collectFeatures` (OVE_ARCH009).
- `ui:EmptyState` for the placeholders (OVE_DS032).
- `ui:UiLabelsProvider` (OVE_DS038) for the labels bundle.
- `useT` typed helper (OVE_ARCH011).

## 8. Architecture and code placement

UI layer, `apps/desktop/src/features/chat/`. The manifest depends only on lazy imports of route modules; `shared/` has no dependency on data code so any CHATUI task may import it (no cycles). i18n rule for the whole area: `chat.json` (this task) holds only the shared words (state words, units, origin label, a11y names); every other CHATUI task writes its strings into its own namespace file `locales/<lang>/chat-<NNN>.json` so no two tasks edit one file. Folder map for the whole area (fixed here so tasks do not collide): `model/` pure mappers (CHATUI002, 005), `data/` hooks and live sync (004, 006, 007), `markdown/` (008), `safe/` (009), `thread/` (010-012, 018, 022), `approvals/` (013-016), `list/` (017, 021), `composer/` (019, 023), `panel/` (020, 024), `routes/` (025, 032), `agent/` (026-031), `e2e/` (035-037).

## 9. Security and safety

The manifest declares required capabilities so the shell can hide the feature if the engine does not offer chat routes (no half-working UI). No secrets or paths in i18n values. Nothing in the skeleton performs I/O.

## 10. Errors and edge cases

- Capability missing on the engine: shell hides the rail item; the route shows the placeholder error state (kit EmptyState) with `chat:error.load`.
- Duplicate feature id or route path: `collectFeatures` fails at build (ARCH009 test); do not work around it.
- Missing PL key: lint fails (`i18n:check`).

## 11. Acceptance criteria

- [ ] `pnpm gen` and `collectFeatures` accept the manifest (unique id and paths).
- [ ] The Chief rail item appears and routes `/chief` and `/chief/agent/:agentId` resolve to placeholders.
- [ ] `CHAT_REGIONS` contains every slug above and a unit test asserts each exists in `tasks/_design/VIEWS.md`.
- [ ] `pnpm i18n:check` passes with EN and PL for all keys, PL plural forms complete for `count.unread`.
- [ ] No import of `api-client` in this folder (lint boundary test).

## 12. Test plan

- Vitest: `regions.test.ts` reads VIEWS.md and checks slugs; `manifest.test.ts` runs zod validation; `labels.test.tsx` renders the bundle through `UiLabelsProvider`.
- Command: `pnpm --filter @overmind/desktop test features/chat/shared`.

## 13. Parallelization notes

Conflict hotspot: `feature.manifest.ts` and `locales/*/chat.json` (owned here only). Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the extra namespaces `chat-agent` and `chat-cards` are accepted by the i18n lint as sub-namespaces of the `chat` feature (prefix rule). If ARCH011 rejects them, merge them into `chat.json` and split keys by top-level object.
- ASSUMPTION: `lib:shell-navigation` (typed `navigate({to, params})`) is provided by the SHELL area; no router import in chat code.
