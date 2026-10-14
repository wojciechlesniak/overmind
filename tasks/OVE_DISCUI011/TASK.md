---
id: OVE_DISCUI011
title: "Wire the Discussion header and controls: pause, resume, conclude now, cancel"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI004, OVE_DISCUI006, OVE_DS036, OVE_DS037, OVE_PAUSE012, OVE_SHELL027]
soft_depends_on: []
provides: ["ui:DiscussionHeader"]
needs: ["lib:use-pause-guard", "ui:ConfirmDialog", "ui:Toast", "lib:shell-navigation"]
owns: ["apps/desktop/src/features/discussions/header/wiring/**", "apps/desktop/src/locales/en/discussions-011.json", "apps/desktop/src/locales/pl/discussions-011.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 15"]
adr_refs: [15, 5, 3]
---

# OVE_DISCUI011: Wire the Discussion header and controls: pause, resume, conclude now, cancel

## 1. Summary

Connects `DiscussionHeaderView` to live data and the control mutations: header text, live pill, round bar, Run state, the Chief-initiated notice, and the buttons Pause, Resume, Conclude now and Cancel, each shown only when the server's `availableActions` allows it, with confirmation for destructive ones.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. DISC014 control routes `POST .../pause|resume|conclude-now|cancel`; `409 disc.invalid_state` means the status changed. Pausing a Discussion pauses only that Discussion (not Global Pause). Global Pause blocks starting new model calls, so Resume is blocked by `usePauseGuard` while Pausing and viewing remain allowed.

## 3. Scope (in)

- Container for the header.
- Control buttons and dialogs.
- Chief-initiated notice wiring.
- Error and busy states.

## 4. Out of scope

- Result approval actions (DISCUI014).
- Owner comment and vote (DISCUI013).

## 5. Detailed requirements

1. Props from `useDiscussion` (`header`, `actions`); the container never computes which buttons exist: it renders exactly `availableActions` (`pause`, `resume`, `conclude_now`, `cancel`).
2. Pause: one click calls `control('pause')`, button shows busy until the status event or response; the kit swaps to `Wznów` when status is `paused`.
3. Resume: blocked with a tooltip `Globalna pauza jest włączona` while Global Pause is on (guard); otherwise calls `control('resume')`.
4. Conclude now (`Zakończ teraz`): opens `ConfirmDialog` explaining `Chief podsumuje dotychczasowe stanowiska. Bez zatwierdzenia nic się nie zmieni.`; the destructive-looking confirm is the secondary variant; calls `control('conclude_now')`; the result then needs approval in the result panel.
5. Cancel (`Anuluj Dyskusję`) lives in an overflow menu, uses a confirm dialog with focus on `Wróć`, and states `Anulowanie nie usuwa wiadomości`; calls `control('cancel')`.
6. Each click uses a fresh `Idempotency-Key`; double clicks are ignored while busy.
7. `409 disc.invalid_state`: toast `Stan Dyskusji się zmienił`, automatic refetch (DISCUI003).
8. Round bar: segments straight from `header.roundSegments`; a round change animates only when reduced motion is off.
9. Notice `Chief rozpoczął tę Dyskusję` (region `disc/notice-chief-initiated`) shows `startedBy.reason` as plain text, only when `startedBy.kind==='chief'`.
10. Status words (`na żywo`, `wstrzymana`, `czeka na Twoje zatwierdzenie`, `brak zgody`, `przekazana Tobie`) come from the status map, never from engine strings.

## 6. Design notes

N/A beyond DISCUI006 (same visual).

## 7. Reuse

- `DiscussionHeaderView` (OVE_DISCUI006), mutations (OVE_DISCUI003), `usePauseGuard` (PAUSE), `ConfirmDialog` (OVE_DS035).

## 8. Architecture and code placement

`features/discussions/header/wiring/`: container, `useDiscussionControls(discussionId)` hook with busy map. UI has no knowledge of rules; the server list is the single source. **i18n namespace:** this task writes its strings into its own namespace `discussions-011` (files `locales/en|pl/discussions-011.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-011`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). A control click is a request, the engine authorises it. The reason text of a Chief-initiated Discussion is untrusted and shown as a text node. Pausing is always available while the guard blocks only Resume.

## 10. Errors and edge cases

- `403`: toast with `Brak uprawnień`; no retry.
- Network error on control: button returns to idle, toast `Nie udało się. Spróbuj ponownie.`, same key reused on retry.
- Status becomes finished while a dialog is open: dialog closes with a toast.
- Global Pause on: Resume disabled, Pause and Cancel still work.

## 11. Acceptance criteria

- [ ] Only server-listed actions render.
- [ ] Resume is blocked under Global Pause with a reason, Pause is not.
- [ ] Each destructive action needs a confirmation with the correct default focus.
- [ ] Double clicks produce one request.
- [ ] Header text matches DISCUI006 for the mock Discussion.

## 12. Test plan

- Vitest with fake hooks, guard on and off; Playwright scenario `disc-running` and `disc-paused` (DISCUI018).
- Command: `pnpm --filter @overmind/desktop test features/discussions/header/wiring`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `cancel` is in an overflow menu because the mock shows only Pause; a kit overflow button variant is needed (see proposal in this task's PR if `ui:Menu` is absent).
