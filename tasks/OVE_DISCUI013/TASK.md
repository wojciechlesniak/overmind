---
id: OVE_DISCUI013
title: "Wire the Owner voice: comment and deciding vote from the desktop"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI007, OVE_DISCUI004, OVE_DISCUI008, OVE_DS036, OVE_PAUSE012]
soft_depends_on: []
provides: ["ui:DiscussionComposer"]
needs: ["lib:use-pause-guard", "lib:chat-send", "ui:ConfirmDialog"]
owns: ["apps/desktop/src/features/discussions/composer/wiring/**", "apps/desktop/src/locales/en/discussions-013.json", "apps/desktop/src/locales/pl/discussions-013.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 15"]
adr_refs: [15, 23, 6]
---

# OVE_DISCUI013: Wire the Owner voice: comment and deciding vote from the desktop

## 1. Summary

Connects `DiscussionComposerView` to `postOwnerMessage`: Owner comments with optimistic send and idempotency, the deciding vote with option selection and confirmation, and the correct disabled states (not open for input, paused, finished, awaiting approval).

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. DISC014: `POST .../owner-posts {kind:'comment'|'vote', text, optionKey?}`; `403 disc.owner_input_forbidden` when the status does not accept input; rate limit 10 per minute. A vote is binding only when cast from the desktop (trust `owner_local`); a message arriving through Telegram is a comment only (ADR 0006), so the Telegram path never offers a vote.

## 3. Scope (in)

- Container for the composer.
- Optimistic send and retry.
- Vote flow with confirmation.
- Disabled reasons.

## 4. Out of scope

- Result approval (DISCUI014).
- Telegram intake (CHAT/TG areas).

## 5. Detailed requirements

1. Mode `Komentarz`: Enter sends, Shift+Enter inserts a newline, text 1..2000 characters with a live counter near the limit; an optimistic Owner message appears in the thread through the shared pending-send mechanism (`useChatSend` from CHATUI007 adapted by a small port so DISCUI does not import chat internals); the `clientMessageId` is the `Idempotency-Key`.
2. Mode `Głos`: the Owner picks one of the options listed by the server in `detail.options` (never free text) and may add a reason (optional, <=500); pressing `Oddaj głos` opens `ConfirmDialog` `Twój głos rozstrzyga Dyskusję. Czy na pewno <option>?`; the vote is sent once; afterwards the composer is replaced with `Oddałeś głos: <option>`.
3. The vote mode is offered only when `availableActions` contains `owner_vote`; otherwise the switch shows only `Komentarz` (and a hint line `Głos jest możliwy po impasie`).
4. Disabled with a reason line when the status does not accept input: paused `Dyskusja jest wstrzymana`, finished `Dyskusja zakończona`, awaiting approval `Najpierw zatwierdź lub odrzuć wynik`.
5. Global Pause: comments and votes are blocked by `usePauseGuard` (they cause new model calls) with the standard reason.
6. Failures: a failed optimistic message shows `Nie wysłano` with Retry (same key) and Delete; `429` shows `Za dużo wiadomości, spróbuj za chwilę`; `403 disc.owner_input_forbidden` refreshes the detail.
7. `@` mention hint is not offered here: Discussion participants are fixed; the hint line says `Wiadomość trafi do wszystkich uczestników`.
8. Draft text is kept per Discussion in memory (not persisted) and cleared on success.
9. A Telegram-origin Owner comment is displayed by the thread (DISCUI012), not handled here.

## 6. Design notes

N/A beyond DISCUI008 (same visual).

## 7. Reuse

- `DiscussionComposerView` (OVE_DISCUI008), send mechanism (OVE_CHATUI007), `postOwnerMessage` (OVE_DISCUI003).

## 8. Architecture and code placement

`features/discussions/composer/wiring/`: container, `useOwnerPost` hook. The port to the chat send mechanism lives in this folder so a future change of either side touches one file. **i18n namespace:** this task writes its strings into its own namespace `discussions-013` (files `locales/en|pl/discussions-013.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-013`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). The vote option comes from the server list, so a forged option key is impossible from the UI and the engine validates it again. Vote and comment are never retried with a new key automatically. Text is sent as is; the engine redacts secrets (SEC003) and the UI shows the stored version.

## 10. Errors and edge cases

- Offline: composer disabled with `Brak połączenia z silnikiem`.
- Double Enter: one request.
- Vote after status changed: `409` toast and refetch.
- Text with only whitespace: send disabled.

## 11. Acceptance criteria

- [ ] Comment appears optimistically and is confirmed by seq.
- [ ] A vote needs confirmation and is sent exactly once.
- [ ] Vote mode never appears when the server does not offer it.
- [ ] Disabled states show the correct reason.
- [ ] Global Pause blocks both modes with a reason.

## 12. Test plan

- Vitest with fake mutations, guard on and off; Playwright scenarios `disc-deadlock`, `disc-paused` (DISCUI018).
- Command: `pnpm --filter @overmind/desktop test features/discussions/composer/wiring`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `detail.options` lists voteable options in the DISC014 detail model; if not, a proposal to DISC is needed.
