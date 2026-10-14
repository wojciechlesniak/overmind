---
id: OVE_DISCUI015
title: "Show deadlock resolution: each side's arguments, Chief ruling and escalation"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI012, OVE_DISCUI014, OVE_DS013, OVE_DS040, OVE_DS057, OVE_DS084]
soft_depends_on: []
provides: ["ui:DiscussionDeadlockResolution"]
needs: ["ui:ChiefProposalCard", "ui:CalloutAmber", "ui:PositionRow", "ui:Button", "api:chief.escalation.get", "api:chief.escalation.decide"]
owns: ["apps/desktop/src/features/discussions/deadlock/**", "apps/desktop/src/locales/en/discussions-015.json", "apps/desktop/src/locales/pl/discussions-015.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 15"]
adr_refs: [15, 23]
---

# OVE_DISCUI015: Show deadlock resolution: each side's arguments, Chief ruling and escalation

## 1. Summary

Adds the deadlock states of a Discussion: the no-agreement summary with each side's arguments, the Chief ruling card when Chief may decide (Budget, Docs, Rules questions), and the Escalation to the Owner with the options to vote or decide. Composes kit callouts and cards; the mock shows only the no-agreement note.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. ADR 0015 and DISC013: on deadlock Chief rules by itself within Budget, Docs and Rules questions (`question==='how'`), and otherwise raises an Escalation to the Owner. The ruling is recorded as a `chief_ruling` message with the arguments considered. Status values: `deadlocked`, `escalated`, `awaiting_outcome_approval` (after a ruling the result still needs approval).

## 3. Scope (in)

- Deadlock summary block above the thread composer.
- Chief ruling card.
- Escalation block with options.
- Both sides' arguments.

## 4. Out of scope

- Escalation inbox (CHIEF/APPRUI).

## 5. Detailed requirements

1. The model comes from `detail.deadlock { question:'how'|'whether', sides:[{ optionKey, label, participants[], argumentsSummary, strength? }], ruling?:{ decidedBy:'chief'|'owner'|'owner_vote', optionKey, rationale } , escalationId? }` through a mapper added to `features/discussions/model/` by this task's own file `deadlock.ts` (no edit of DISCUI002 files).
2. Two columns, one per side: option label, participant chips with stance pills, a short `argumentsSummary` (plain text, <=600), and the strongest quote from each side linking to its message (scroll to message).
3. When `ruling.decidedBy==='chief'`: a `ChiefProposalCard`-style card `Chief rozstrzygnął: <option>` with rationale and the sentence `Wynik nadal wymaga Twojego zatwierdzenia` when the outcome is not approved yet.
4. When status is `escalated`: the amber callout `Impas: o wyniku decydujesz Ty` with two actions: `Oddaj głos` (switches the composer to vote mode, DISCUI013) and `Otwórz Eskalację` (navigates to the Escalation, `escalationId`).
5. When the Owner decided: `Zdecydowałeś Ty: <option>`; by vote: `Twój głos: <option>`; each with time.
6. Words for the resolution come from the shared `resolution.*` keys (DISCUI001).
7. `Reguły` questions (`question==='how'`, rules) never auto-resolve if they would change an Owner Rule: the server escalates; the UI shows the reason `Reguły może zmienić tylko Owner` when `deadlock.reason==='rules'`.
8. Nothing in this block executes anything by itself: all actions are buttons calling existing flows (vote, navigate).

## 6. Design notes

N/A, functionality only (states not in the mock). Reuse the amber callout used for `Brak zgody` in DISCUI009 and the card style from CHATUI016.

## 7. Reuse

- `CalloutAmber`, `PositionRow`, `StancePill` (kit), vote flow (OVE_DISCUI013), result panel (OVE_DISCUI014).

## 8. Architecture and code placement

`features/discussions/deadlock/`: `DeadlockResolution` component, `deadlock.ts` mapper. Pure view plus callbacks; wiring through props passed by the route (DISCUI017). **i18n namespace:** this task writes its strings into its own namespace `discussions-015` (files `locales/en|pl/discussions-015.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-015`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). Arguments are produced by Agents and the moderator: untrusted text shown as text nodes, clipped, never rendered as Markdown with links. A ruling by Chief is displayed as Chief's, derived from `ruling.decidedBy`, not from message text.

## 10. Errors and edge cases

- `deadlock` missing while status is `deadlocked`: show the plain note `Brak zgody` and the vote action only.
- Escalation already resolved elsewhere (Telegram): refetch shows `Zdecydowałeś Ty`.
- Single side only: show one column and a note.
- Participant removed: show name from the message author.

## 11. Acceptance criteria

- [ ] Both sides appear with their arguments and participants.
- [ ] A Chief ruling is labelled as Chief's and still needs approval.
- [ ] Escalated state offers vote and Escalation link.
- [ ] Rules deadlocks always escalate in the UI wording.
- [ ] No raw HTML or links from argument text.

## 12. Test plan

- Storybook and Vitest for each resolution kind; Playwright `disc-deadlock` (DISCUI018).
- Command: `pnpm --filter @overmind/desktop test features/discussions/deadlock`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: DISC013 exposes `detail.deadlock` with both sides' arguments; otherwise the Escalation text is used. GAP: confirm field names with DISC.
- ASSUMPTION: `api:chief.escalation.get` and `.decide` exist in CHIEF; the Owner decision is made in the Escalation flow, not duplicated here.
