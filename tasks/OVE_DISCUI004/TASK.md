---
id: OVE_DISCUI004
title: "Sync Discussions live: subscribe by Discussion, fetch messages by seq, typing, resync"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI003, OVE_DISC001, OVE_DISC014, OVE_DISCUI003, OVE_ENGINE027]
soft_depends_on: []
provides: ["lib:discussion-live-sync"]
needs: ["lib:api-client-discussion", "event:discussion.message.posted", "event:discussion.started", "event:discussion.concluded", "event:discussion.outcome.approved", "event:discussion.escalated", "lib:api-client-events", "lib:ui-live-data"]
owns: ["apps/desktop/src/features/discussions/data/sync/**", "apps/desktop/src/locales/en/discussions-004.json", "apps/desktop/src/locales/pl/discussions-004.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 15"]
adr_refs: [5, 15]
---

# OVE_DISCUI004: Sync Discussions live: subscribe by Discussion, fetch messages by seq, typing, resync

## 1. Summary

Connects Discussion events to the transcript cache, the detail and the list: `subscribeDiscussion` with `afterEventId` resume, message bodies fetched by `afterSeq` when `discussion.message.posted` names a new seq, best-effort typing indicators, state events refreshing the detail, and the resync procedure.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. DISC014: events `discussion.*` and ephemeral `discussion.typing {participantId}` visible to the Owner; payloads carry ids and previews only (`message.posted {messageId, round, seq, authorKind, textPreview<=160}`), full messages are fetched by `afterSeq`. Reconnect replays persisted events after `afterEventId`; typing is best-effort. The engine continues the Discussion with the window closed (ADR 0005).

## 3. Scope (in)

- `useDiscussionSync(workspaceId, discussionId)`.
- `useDiscussionListSync(workspaceId)`.
- Typing state.
- Resync.

## 4. Out of scope

- Rendering.

## 5. Detailed requirements

1. Order: subscribe (buffer) -> load detail and latest messages -> flush buffer; no event lost between load and subscribe (same pattern as CHATUI006).
2. `discussion.message.posted` with `seq > lastSeq`: fetch `afterSeq=lastSeq` pages until contiguous; coalesce bursts (one fetch per 100 ms).
3. State events (`started`, `round.started`, `paused`, `resumed`, `deadlocked`, `outcome.proposed`, `outcome.approved`, `outcome.rejected`, `concluded`, `escalated`, `cancelled`, `failed`, `budget.warning`) trigger a detail refetch (debounced 200 ms) so header, actions and the result panel are server-driven; the client never derives state itself.
4. `discussion.typing {participantId}`: marks the participant as typing for 8 s (timer refreshed by repeated events, cleared on that participant's message); used by the thread typing row (DISCUI012).
5. `budget.warning`: shows a toast `Dyskusja zbliża się do limitu kosztu` (informational).
6. `onResync`: refetch detail and the latest page; keep stale content visible; then resume.
7. List sync: events of other Discussions update the list rows (`started`, `concluded`, `escalated`, `cancelled`) by refetching `section=running` (debounced 300 ms).
8. Unsubscribe on unmount; filter by `workspaceId` and `subjectId=discussionId` (hub generic filter).
9. Telegram interventions (owner comments via Telegram, trust `owner_remote`) arrive as messages with their `channel` marker (DISCUI012 renders it).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `useEventSubscription` (OVE_CHATUI003), hooks and cache (OVE_DISCUI003).

## 8. Architecture and code placement

`features/discussions/data/sync/`. **i18n namespace:** this task writes its strings into its own namespace `discussions-004` (files `locales/en|pl/discussions-004.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-004`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). Push frames are never used as message bodies: bodies are fetched from the authenticated API. Foreign Discussion ids are ignored.

## 10. Errors and edge cases

- Event for a Discussion deleted with its Workspace: navigate back.
- Gap after reconnect: refetch.
- Typing event after the message: ignored.
- Hub closes with `shutdown`: reconnecting status.

## 11. Acceptance criteria

- [ ] A new message appears without refresh.
- [ ] After `events.resync_required` the transcript and detail are correct.
- [ ] State changes (pause, deadlock, outcome proposed) update header and actions within one round trip.
- [ ] Typing indicator disappears on the participant's message or after 8 s.

## 12. Test plan

- Vitest with scripted fake hub: race, gap, coalescing, typing timers, resync, list sync.
- Command: `pnpm --filter @overmind/desktop test features/discussions/data/sync`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the hub supports `subjectId` filter (DISC014 requirement 4).
