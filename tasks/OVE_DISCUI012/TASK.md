---
id: OVE_DISCUI012
title: "Wire the Discussion thread: history, live messages, virtualisation, typing, marks"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: ["OVE_DISCUI004", "OVE_DISCUI007", "OVE_CHATUI010", "OVE_CHATUI008", "OVE_CHATUI009"]
soft_depends_on: []
provides: ["ui:DiscussionThread"]
needs: ["lib:chat-thread-virtualization", "lib:chat-markdown", "lib:chat-safe-text"]
owns: ["apps/desktop/src/features/discussions/thread/wiring/**", "apps/desktop/src/locales/en/discussions-012.json", "apps/desktop/src/locales/pl/discussions-012.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 12"]
adr_refs: [8, 15, 6]
---

# OVE_DISCUI012: Wire the Discussion thread: history, live messages, virtualisation, typing, marks

## 1. Summary

Connects `DiscussionThreadView` to the transcript: virtualised ascending list, stick-to-bottom with a jump pill, older history on scroll up, live new messages, participant typing rows, round dividers, Markdown bodies through the safe renderer, Telegram-origin marks and Skill chips with name and version.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. Messages are server-ordered by `seq`. The Chief moderator opens each round with a brief and closes it with a summary; participants answer in order; Owner comments and votes interleave. The kit guarantees only 200 rows, so the thread uses the shared virtualisation hook from CHATUI010.

## 3. Scope (in)

- Container for the thread.
- Virtualisation and scroll behaviour.
- Typing rows.
- Markdown bodies and link safety.
- Origin marks.

## 4. Out of scope

- Owner posting (DISCUI013).
- Deadlock display (DISCUI015).

## 5. Detailed requirements

1. Rows come from `useTranscript` mapped by `toMessageProps`; the container adds round divider rows (`Runda 2`) when `round` changes.
2. Virtualisation uses `useVirtualThread` from CHATUI010 with row height estimates per variant; mounted rows <= 80 for a 3000 message Discussion.
3. Stick to bottom only while the Owner is at the bottom; otherwise a `Nowe wiadomości` jump pill with count; keyboard accessible.
4. Scroll to top loads the previous page (DISCUI003), preserving position within 1 px.
5. Typing rows: for each participant in `typing` (DISCUI004) show the kit `TypingIndicator` with the participant name; at most 3 rows at once, `+N` after that; never announced to screen readers.
6. Bodies render through `ChatMarkdown` (CHATUI008): no raw HTML, links through `TextLink` safe rules, code blocks without execution; text longer than 8000 characters is clipped with `Pokaż więcej`.
7. Messages with `channel:'telegram'` show the origin mark `z Telegrama` (shared word); the trust field `owner_remote` never changes how the message looks beyond that mark.
8. Messages whose status is `skipped`, `timeout`, `invalid_output`, `dropped` render the muted note from the mapper; their body is absent.
9. Skill chips show `name vN`; a `skillsUsed` entry that is a user-installed Skill from the internet shows the existing `from_owner` hint only if the contract provides it.
10. Live region: one polite announcement per new message `Nowa wiadomość od <name>` (debounced 1 s); typing and streaming are silent.
11. Redacted content: `redaction.count>0` shows the `[usunięto sekret]` marker produced by the engine; the UI never attempts to restore it.

## 6. Design notes

N/A beyond DISCUI007 (same visual).

## 7. Reuse

- `DiscussionThreadView` (OVE_DISCUI007), `useVirtualThread` (OVE_CHATUI010), `ChatMarkdown` (OVE_CHATUI008), safe text (OVE_CHATUI009), cache and sync (OVE_DISCUI003, 004).

## 8. Architecture and code placement

`features/discussions/thread/wiring/`: container, `useThreadRows`, `useStickToBottom` adapter from the shared virtual hook. No duplicate of chat virtualisation code. **i18n namespace:** this task writes its strings into its own namespace `discussions-012` (files `locales/en|pl/discussions-012.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-012`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). Markdown is the safe subset only; images, HTML and `javascript:` links never render. Another participant's text can contain instructions aimed at the Owner or Chief: it is shown as quoted content, never as a UI action.

## 10. Errors and edge cases

- Gap in seq: resync (DISCUI004).
- Transcript load fails: error state with Retry; already loaded rows stay.
- Very long single message: clipped.
- Unknown message kind: neutral card (DISCUI002).

## 11. Acceptance criteria

- [ ] A 3000 message Discussion mounts <= 80 rows and scrolls smoothly.
- [ ] Stick to bottom and the jump pill behave as specified.
- [ ] Prepending older messages does not shift visible content.
- [ ] Hostile Markdown renders as text only.
- [ ] Telegram-origin marks and Skill chips with versions appear.

## 12. Test plan

- Vitest + Testing Library with fake hooks; Playwright scenarios `disc-long-transcript`, `disc-hostile` (DISCUI018).
- Command: `pnpm --filter @overmind/desktop test features/discussions/thread/wiring`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: older pages are loaded by `afterSeq` arithmetic (see DISCUI003); if DISC014 adds `beforeSeq` switch to it.
