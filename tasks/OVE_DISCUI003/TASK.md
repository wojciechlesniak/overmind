---
id: OVE_DISCUI003
title: "Add Discussion data hooks and the transcript cache over the api-client"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI003, OVE_DISC014, OVE_DISCUI002, OVE_SHELL011]
soft_depends_on: []
provides: ["lib:discussion-data-hooks"]
needs: ["lib:api-client-discussion", "api:discussion.list", "api:discussion.get", "api:discussion.messages", "api:discussion.owner-post", "api:discussion.control", "api:discussion.outcome", "lib:ui-live-data", "lib:active-workspace"]
owns: ["apps/desktop/src/features/discussions/data/queries/**", "apps/desktop/src/features/discussions/model/cache/**", "apps/desktop/src/locales/en/discussions-003.json", "apps/desktop/src/locales/pl/discussions-003.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 12"]
adr_refs: [15, 23]
---

# OVE_DISCUI003: Add Discussion data hooks and the transcript cache over the api-client

## 1. Summary

Implements `useDiscussionList`, `useDiscussion`, `useTranscript` (ascending `seq` pages with a pure cache), and the mutations `postOwnerMessage`, `control` (pause, resume, conclude-now, cancel) and `outcome` (approve, reject). Everything returns view models and mapped errors.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. DISC014 routes: `GET /workspaces/:wid/discussions?section=running|finished&runId=&participantId=`, `GET .../:id` (detail incl. header, stances, outcomeDraft, `availableActions`), `GET .../:id/messages?afterSeq=&limit=` (ascending, <=100), `POST .../:id/owner-posts {kind:'comment'|'vote', text, optionKey?}` (Idempotency-Key honoured, text 1..2000, 10 posts/min), `POST .../:id/pause|resume|conclude-now|cancel`, `POST .../:id/outcome/approve {revision, contentHash}`, `POST .../:id/outcome/reject {reason}`, `GET .../:id/export?format=`. Stale approval hash -> `422 disc.outcome_invalid` with `details.currentRevision`; `409 disc.invalid_state` carries the current status.

## 3. Scope (in)

- Read hooks and mutation functions.
- Transcript cache reducer (append, dedupe by seq, gap detection).
- Error mapping to message refs.
- `useDiscussionList` split into running/finished.

## 4. Out of scope

- Live events (DISCUI004).
- Rendering and controls UI.

## 5. Detailed requirements

1. `useDiscussionList(workspaceId)` -> `{ live: DiscussionRowData[]; done: DiscussionRowData[]; status }` using two requests (`section=running`, `section=finished`) loaded in parallel; finished is loaded lazily when the Discussion route opens (the Chief list only needs running).
2. `useDiscussion(workspaceId, id)` -> `{ detail, header, positions, result, actions, status }` through the mappers; refetch by explicit `refetch` and by events (DISCUI004).
3. `useTranscript(workspaceId, id)`: loads the latest page (detail includes the last 50; the hook then requests older pages with `afterSeq` ascending from 0 only when the Owner scrolls up: the contract supports `afterSeq` only, so older history is loaded by requesting `afterSeq=max(0, firstSeq-101)&limit=100`, ASSUMPTION), merges into `TranscriptCache` (`byId`, `order` by seq, `firstSeq`, `lastSeq`, `needsResync`); duplicates ignored, gaps set `needsResync`.
4. Mutations return `Result` and never throw: `postOwnerMessage({kind, text, optionKey?})` generates a ULID `Idempotency-Key`, `control(action)` uses a key per click, `approveOutcome({revision, contentHash})` uses the `revision` and `contentHash` of the draft currently displayed (never fetched at click time).
5. Error mapping table for `disc.*` codes (`not_found`, `invalid_state`, `owner_input_forbidden`, `outcome_required`, `outcome_invalid`, `outcome_not_approved`, `budget_exceeded`, `rate_limited`, `already_open`, `moderator_unavailable`, `ruling_not_permitted`) to localised messages and actions (`refresh`, `retry`, `wait`); `invalid_state` and `outcome_invalid` trigger a `refetch` automatically.
6. Workspace switch aborts requests and resets caches.
7. `DiscussionSummary` lists are bounded (20 live per Workspace, server).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `useResource` (OVE_CHATUI003), mappers (OVE_DISCUI002), api-client discussion (OVE_DISC014).

## 8. Architecture and code placement

`features/discussions/data/queries/` (hooks) and `model/cache/` (pure reducer). One file per hook. **i18n namespace:** this task writes its strings into its own namespace `discussions-003` (files `locales/en|pl/discussions-003.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-003`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). The UI sends only fields of the strict request schemas (no `author`, `trust`, `workspaceId` in bodies, DISC014 requirement 3). Approval uses the revision and hash the Owner SAW, so a draft changed in between is rejected by the engine instead of being approved blind.

## 10. Errors and edge cases

- Discussion of another Workspace: `not_found`.
- Message page duplicates: ignored.
- `rate_limited` on owner post: countdown.
- Network failure on approve: retry with the same key; server dedupes.
- Status changes between click and request: `invalid_state` -> refetch -> UI reflects.

## 11. Acceptance criteria

- [ ] Approve sends the exact `revision` and `contentHash` displayed.
- [ ] Owner post uses an idempotency key and never double-posts on retry.
- [ ] Transcript cache is gapless or flagged.
- [ ] All `disc.*` errors used by the UI have a message.
- [ ] Workspace switch resets state.

## 12. Test plan

- Vitest with fake api-client: list, detail, transcript paging, cache reducer table tests, mutations with retry, error mapping completeness against the generated registry.
- Command: `pnpm --filter @overmind/desktop test features/discussions/data features/discussions/model/cache`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: older transcript pages are fetched with `afterSeq`; ask DISC014 owner to add `beforeSeq` (gap list).
