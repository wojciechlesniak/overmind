---
id: OVE_CHATUI011
title: "Render every chat message type with ui-kit components (owner, chief, agent, relay, result)"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI002, OVE_CHATUI008, OVE_CHATUI009, OVE_DS016, OVE_DS018, OVE_DS022, OVE_DS040, OVE_DS046, OVE_DS047]
soft_depends_on: []
provides: ["lib:chat-message-renderer"]
needs: ["ui:MessageBubble", "ui:MessageTable", "ui:DaySeparator", "ui:RelayNote", "ui:ResultChip", "ui:SkillUsedChip", "ui:BindingNotice", "ui:InfoNote", "ui:OriginLine", "ui:Avatar", "ui:TextLink", "ui:DocRefChip", "ui:EvidenceList", "ui:ArtifactChip"]
owns: ["apps/desktop/src/features/chat/thread/render/**", "apps/desktop/src/locales/en/chat-011.json", "apps/desktop/src/locales/pl/chat-011.json"]
reads: []
design: design.png
design_source: "Chief#chief/message-thread top (crop 351,190,780,380)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23, 6]
---

# OVE_CHATUI011: Render every chat message type with ui-kit components (owner, chief, agent, relay, result)

## 1. Summary

Implements `MessageRenderer`, the single mapping from a `MessageView` (and its parts) to kit components: owner bubble, Chief and Agent text (Markdown), system notice, relay note, result chip with Artifact chips, Skill-used chip with name and version, plan-update chip, binding notice, workspace summary table, delivery notice. Cards with decisions (approval, Owner Rule refusal, proposal) are delegated to their own adapters.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. `MessageType` is `owner|chief|agent|system|relay|result|approval_card|rule_refusal` and `parts` are `approval_ref, owner_rule_ref, plan_update, skill_used, workspace_summary, result_ref, relay_note, binding_notice, delivery_notice` (CHAT002). Unknown parts render nothing and the text still shows. Telegram-origin messages must always show their source (product rule, DS046 requirement 2).

## 3. Scope (in)

- `MessageRenderer` with a registry `type/part -> renderer`.
- Day separators and unread divider integration.
- Source and time labels.
- Part renderers listed in the summary except the three delegated cards.
- Storybook with fixtures for each type.

## 4. Out of scope

- Approval, refusal and proposal card behaviour (CHATUI013-016): this task only mounts the slots.
- Streaming visuals (CHATUI012).
- Virtualisation (CHATUI010).

## 5. Detailed requirements

1. Registry: `const messageRenderers: Record<MessageType, (ctx) => ReactNode>` and `partRenderers: Record<MessagePart['type'], (part, ctx) => ReactNode | null>`; adding a type is one entry (OCP). Unknown type: system-style plain text. Unknown part: `null`.
2. `owner`: `MessageBubble role='owner'` with `sourceLabel` = `z Telegrama · 14:02` when `origin==='telegram'` else `14:18`; text through `safeMessageText` and rendered pre-wrap (no Markdown for the Owner's own text: what the Owner typed is shown verbatim).
3. `chief`/`agent`: `MessageBubble role` with `author` (name, hue, initials), `showAvatar` true in Chief and Discussion contexts and in Agent chats only for the first message of a run of the same author (the mock shows the Agent avatar on the left of the first message of the group), body = `<Markdown source status>`; `variant='table'` for `workspace_summary` part: `MessageTable` rows `{ marker: tone from state (working magenta, ok mint, paused neutral, idle neutral), title: workspaceName, text: sentence }` with `aria-label` `chat:summary.aria`.
4. `relay` (type) and `relay_note` part: `RelayNote from=<agent name> to='Chief'` with the localised sentence; the arrow is the kit glyph.
5. `result` type: agent text + `ResultChip` for each `plan_update` part (`Chief zaktualizował plan · „<taskTitle>” → <toLane>` with link `Tablica` to `navigate({to:'board', task: taskId})`; `boardUrlPath` is app-relative and is validated: must start with `/` and not `//`, else the link is dropped and only the text stays) and `EvidenceList` of `ArtifactChip`s for `result_ref` parts (max 5; click opens the Artifact viewer only if the shell exposes `lib:shell-navigation` target `artifact`, else inert chip).
6. `skill_used` part: `SkillUsedChip name version label='użyto Skilla'` (name and version always both shown; version formatted `v2`); click navigates to the Skill detail (`navigate({to:'skills', skillId})`). Chips are de-duplicated per reply by `(skillId, version)` (CHAT009 requirement 7) and aligned under the agent text (inset 38).
7. `system` type: centred notice; `binding_notice` part renders `BindingNotice` with the i18n text `chat:binding.notice` (name interpolated: 'Your commands in this chat are binding. QA passes them to Chief immediately.'); it is pinned first in the thread by sequence (it is the first message) not by special sorting.
8. `delivery_notice` part (`queued|blocked|needs_login|failed`) renders a muted `InfoNote` under the Owner message it belongs to (`replyToId`), with words (`Queued, the Agent is busy`, `Not delivered: the Agent is waiting for an Approval`, `Not delivered: login required in the CLI`, `Delivery failed`) and a `Retry` button only for `failed` (CHATUI031 wires the action).
9. Slots: `approval_card` type renders `<ApprovalSlot message />`, `rule_refusal` renders `<RuleRefusalSlot message />`, `proposal_ref` part renders `<ProposalSlot />`; the slots are components provided via React context `CardSlots` so this task does not import CHATUI013-016 (no cycle). Default slots render a neutral `Card` with the snapshot title (fallback when a card task is not yet merged).
10. Truncated messages (`truncated:true`): note `chat:message.truncated` with a link to the `result_ref` part that holds the rest.
11. Redacted messages: marker note from CHATUI009.
12. Stable React keys: `clientMessageId ?? id`.
13. Every rendered message root gets `data-message-id`, `data-seq` and `data-type` for tests; no message text in attributes.

## 6. Design notes

`design.png` shows the Chief thread top: day label `dziś, 14:02`, the right-aligned violet owner bubble `Jak idą prace?` with `z Telegrama · 14:02`, the Chief text `Po jednym zdaniu na Workspace:` and the bordered summary table (three rows with magenta, mint and grey dots). Exact geometry and tokens are owned by DS046/DS047; this task owns only the mapping. Not in the mock: all error/empty variants (derived by the kit).

## 7. Reuse

- All message components of OVE_DS046 and OVE_DS047, `ui:EvidenceList`, `ui:ArtifactChip`, `ui:DocRefChip` (OVE_DS040).
- `Markdown` (OVE_CHATUI008), `safeMessageText` (OVE_CHATUI009), `MessageView` (OVE_CHATUI002).

## 8. Architecture and code placement

`features/chat/thread/render/`: presentational, props-driven (receives `MessageView`, callbacks, `ctx` with `t`, `navigate`, `agentDirectory`). No data fetching. The slot context makes later card tasks plug in without editing this folder (OCP, DIP). **i18n namespace:** this task writes its strings into its own namespace `chat-011` (files `locales/en|pl/chat-011.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-011`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Navigation targets come only from typed fields (`taskId`, `skillId`) mapped to routes in code, never from message text; `boardUrlPath` is validated app-relative. Skill names and versions are displayed as received from the engine (they come from the Skill registry, not from Agent text).

## 10. Errors and edge cases

- Part with a missing required field: skipped, text remains.
- `plan_update` for a Task the Owner cannot open (deleted): link shows the text without navigation after a 404 from the router (handled by the Board view).
- Agent author unknown (archived Agent): neutral hue, name from `authorName` snapshot field if present, else `Agent`.
- Very long summary row text wraps (kit).
- Telegram message with attachments (later): text only, the attachment is not rendered.

## 11. Acceptance criteria

- [ ] Each MessageType and part of CHAT002 has a story and a unit test.
- [ ] A Telegram-origin Owner message always shows `z Telegrama · <time>`.
- [ ] Skill chips always show name and version.
- [ ] Hostile text in any message cannot create elements outside the Markdown allow-list.
- [ ] The mock's thread top matches `design.png` within the visual tolerance in the Storybook visual test.
- [ ] Unknown message types and parts do not crash and still show text.

## 12. Test plan

- Vitest + Testing Library table test over a fixture of every type/part; DOM allow-list test with hostile text; link policy for `boardUrlPath`.
- Storybook stories `OwnerDesktop`, `OwnerTelegram`, `ChiefMarkdown`, `WorkspaceSummary`, `Relay`, `ResultWithPlanUpdate`, `SkillUsed`, `BindingNotice`, `DeliveryNotices`, `Truncated`, `Redacted`, `UnknownPart` (use `lib:ui-visual-test` for the crop comparison).
- Command: `pnpm --filter @overmind/desktop test features/chat/thread/render`.

## 13. Parallelization notes

Hot spot: the registry file `registry.ts`; additions should be made by adding a file per renderer and one line in the registry (owned here). Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the first Agent message of a group shows the avatar; following messages of the same author within 5 minutes do not (matches the mock where the second message has no avatar).
- Missing kit variant: `MessageBubble` has no `compact` mode for consecutive messages; use the default and note it for DS (OVE_DS046).
