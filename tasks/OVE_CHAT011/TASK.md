---
id: OVE_CHAT011
title: Build the conversation list read model with unread state and mark-as-read
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_AGENT010, OVE_CHAT004, OVE_CHAT006]
soft_depends_on: [OVE_AGENT010]
provides: ["usecase:ListConversations", "usecase:MarkConversationRead", "usecase:GetConversation", "usecase:OpenAgentConversation"]
needs: ["usecase:GetAgentStates", "usecase:ListDiscussions", "usecase:ListAgents"]
owns: ["packages/application/src/chat/list/**"]
reads: ["packages/domain/src/chat/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16.2", "SPECIFICATION 16.13"]
adr_refs: [23, 28]
---

# OVE_CHAT011: Build the conversation list read model with unread state and mark-as-read

## 1. Summary

Produce the left-hand list of `Chief.png`: the Chief row (with the line that summarises what needs the Owner), the section "Agents in this Workspace" with state, last line and unread badge, and the section "Live Discussions". Also own unread state and marking as read.

## 2. Context

Per styl-wizualny, Discussions and direct Agent chats both live in the Chief conversation list. Mock rows: Chief row with a one-line status ("Security waits for your Approval"); Agent rows (QA "working - e2e cart tests", Security "waiting for Approval" with unread badge 1, Developer "finished - 4 files", Product Owner "idle"); Discussion row ("Payments: Stripe or P24? round 2 of 4 - 3 participants"); the button "New Agent" is UI. The list is per Workspace (agents visible there), Chief and Discussions follow the Owner's active Workspace filter (Discussions of the active Workspace; ASSUMPTION).

## 3. Scope (in)

- `ListConversations({ workspaceId })` returning `{ chief: ConversationSummary, agents: ConversationSummary[], discussions: ConversationSummary[] }`.
- `GetConversation(id)`, `OpenAgentConversation(agentId, workspaceId)` (creates lazily, posts the binding notice once).
- `MarkConversationRead(conversationId, upToSeq)`; the `chat.conversation.read` event.
- Sort order and preview rules; the Chief row "attention line".

## 4. Out of scope

- Rendering: CHATUI. Agent state derivation: AGENT009/010. Discussion content: DISC.

## 5. Detailed requirements

1. Agents section lists Agents visible and active in the Workspace (public + private to it, not archived), including those with no conversation yet (the conversation is created on first open). Order: state priority (`waiting_approval`, `needs_login`, `working`, `finished_unread`, `idle`), then `lastMessageAt` descending, then name. The mock order is therefore a display of default data, not a fixed rule; the order rule is documented here so CHATUI does not invent another.
2. `agentState` in each summary comes from `GetAgentStates(workspaceId)` (same read model as other views, criterion 13).
3. `unreadCount` = number of non-Owner, non-system-notice messages with `seq > last_read_seq` (system `delivery_notice` and `binding_notice` do not count). The Chief row shows the sum of unread approval cards plus unread Chief messages. Badge text is a number only (UI adds the word unit per styl-wizualny).
4. Chief row attention line: computed server-side in one sentence from structured facts in priority order: (a) pending Approvals or Access Requests count ("Security waits for your Approval" for one with an Agent name, else "{n} items wait for you"), (b) Escalations, (c) Chief-initiated Discussion waiting for the Owner, (d) otherwise the last Chief message preview. The sentence is assembled from i18n templates and facts, never from model text.
5. Discussions section: Discussions in states `running` or `waiting_for_owner` of the active Workspace (from `ListDiscussions`), each as a summary with `title`, `round`, `rounds`, `participants` count; finished Discussions disappear from the list but stay reachable by search and the Run trace.
6. `MarkConversationRead(conversationId, upToSeq)` is monotonic and bounded by `last_message_seq`; the Owner's read marker is global across channels (reading on desktop clears the unread on Telegram counts too) because there is one Owner. Event `chat.conversation.read` is published for other open windows.
7. Opening an Agent conversation the first time posts the `binding_notice` message (via `PostSystemMessage`).
8. All queries are bounded: list returns at most 100 Agents per Workspace and 20 Discussions; each `lastMessagePreview` max 140 characters.
9. Performance: one list call performs at most 4 repository queries (conversations with summary join, read state, agent states, discussions), no N+1.
10. The use cases never return conversations of Agents or Workspaces outside the requested visible scope.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`unreadCount` and `preview` from CHAT003; `GetAgentStates` (AGENT010); `PostSystemMessage` (CHAT009); `ListDiscussions` (DISC).

## 8. Architecture and code placement

`packages/application/src/chat/list/{list-conversations.usecase.ts,mark-read.usecase.ts,open-agent-conversation.usecase.ts,attention-line.ts}`. The read-model query lives behind `ConversationRepository.listSummaries(workspaceId)` (add by proposal to CHAT004's port owner, or implement through two existing methods; default: use existing methods and accept 4 queries).

## 9. Security and safety

The list is a leak surface for private Agents and Discussions of other Workspaces; scope is a mandatory parameter and is filtered through the visibility rules. The attention line is assembled from structured facts and templates so that model or Agent text cannot place content into the Chief row. Read markers are Owner-only state.

## 10. Errors and edge cases

- Agent archived with unread messages: disappears from the list; its conversation stays searchable.
- Workspace has no Agents: empty section, Chief row still present.
- `upToSeq` above last: clamped.
- Read on two windows concurrently: monotonic max wins.
- Discussion mirror conversation missing: created lazily.

## 11. Acceptance criteria

- [ ] Fixture reproducing the mock (Chief + 6 Agents + 1 Discussion) returns the documented order and badges.
- [ ] Private Agents of another Workspace never appear.
- [ ] Marking read on desktop sets unread to zero for the Telegram-side counts as well.
- [ ] First open of an Agent conversation posts exactly one binding notice.
- [ ] Attention line shows the Approval sentence when an Approval is pending.
- [ ] At most 4 repository queries per list call (spy test).

## 12. Test plan

Unit tests with in-memory repositories; scope tests with two Workspaces; query-count test. Command: `pnpm vitest run packages/application/src/chat/list`.

## 13. Parallelization notes

Parallel with CHAT010 and CHAT012. CHATUI list task depends on its output shape. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Discussions listed are those of the active Workspace; a cross-Workspace Discussion view is not in the list.
- ASSUMPTION: one global read marker per conversation (single Owner).
