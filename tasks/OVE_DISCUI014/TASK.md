---
id: OVE_DISCUI014
title: "Wire the result panel: positions, outcome approval, reject and Tasks preview"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI004, OVE_DISCUI009, OVE_DS036, OVE_DS037, OVE_PAUSE012, OVE_SHELL027]
soft_depends_on: []
provides: ["ui:DiscussionResultPanel"]
needs: ["lib:use-pause-guard", "ui:ConfirmDialog", "ui:Toast", "lib:shell-navigation", "lib:local-approval-flow"]
owns: ["apps/desktop/src/features/discussions/result/wiring/**", "apps/desktop/src/locales/en/discussions-014.json", "apps/desktop/src/locales/pl/discussions-014.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10"]
adr_refs: [8, 15, 16, 3]
---

# OVE_DISCUI014: Wire the result panel: positions, outcome approval, reject and Tasks preview

## 1. Summary

Connects `DiscussionResultPanelView` to the detail: live stances, the draft Decision with its Tasks, document chips linking to the document viewer, and the actions Approve outcome and Conclude now, with approval bound to the displayed revision and content hash.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. The outcome is a proposed Decision plus follow-up Tasks. After approval the Decision is written to the Docs and the Tasks reach the Board (DISC outcome flow). `POST .../outcome/approve {revision, contentHash}` returns `422 disc.outcome_invalid` when the draft changed after the Owner saw it. The approval is a Local Approval from the desktop (it writes a Decision and creates Tasks).

## 3. Scope (in)

- Container for the panel.
- Approval and rejection flows.
- Stale draft handling.
- Document chip navigation.

## 4. Out of scope

- Resolution display of deadlocks (DISCUI015).
- Export (DISCUI016).

## 5. Detailed requirements

1. Positions from `toPositions`; counts update live with stance changes.
2. Draft section appears when `outcomeDraft` exists; the Tasks list shows title and document chips from the structured `docRef` field; chips navigate to the document viewer through `navigate({ to:'docs.view', params:{ path, anchor } })`.
3. `Zatwierdź wynik` is shown only when `availableActions` has `approve_outcome`; click opens a confirmation dialog summarising `1 Decyzja i N Zadań trafią do Tablicy` with the list of Tasks; confirmation calls `approveOutcome({revision, contentHash})` using the values of the draft shown in the dialog (the dialog stores them when opened and compares to the current draft before sending).
4. If the draft changed while the dialog was open (new `revision`), the dialog switches to `Wynik się zmienił, sprawdź ponownie` with the new content and no send.
5. Local Approval: the desktop approval is confirmed through the shared Local Approval flow (`lib:local-approval-flow`, same as CHATUI014) where the engine requires `localProof`; the proof is bound to the action hash of the approval.
6. `Odrzuć` (reject) asks for a short reason (<=500) and calls `rejectOutcome`; the Discussion returns to `running` or `deadlocked` as the server decides.
7. `Zakończ teraz` shares the header control (DISCUI011) and is not duplicated here; the panel only shows the button states from the kit.
8. After approval the panel shows `Zatwierdzone` with links `Zobacz Decyzję` and `Zobacz Tablicę`; the draft stays visible read only.
9. Global Pause: approval blocked with the standard reason (writes Docs and creates Tasks); Reject remains allowed.
10. Tiebreak note text comes from the mapper; it is informational.

## 6. Design notes

N/A beyond DISCUI009 (same visual).

## 7. Reuse

- `DiscussionResultPanelView` (OVE_DISCUI009), mutations (OVE_DISCUI003), Local Approval flow (OVE_CHATUI014 provides `lib:chat-local-approval`; the generic flow is owned by PERM).

## 8. Architecture and code placement

`features/discussions/result/wiring/`: container, `useOutcomeApproval` state machine (`idle | confirming | stale | sending | approved | error`). **i18n namespace:** this task writes its strings into its own namespace `discussions-014` (files `locales/en|pl/discussions-014.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-014`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). Approval is bound to `revision` and `contentHash` of what the Owner saw (anti bait and switch). The UI never fetches the hash at click time. Task titles and rationale are untrusted text and rendered as plain text.

## 10. Errors and edge cases

- `422 disc.outcome_invalid`: stale state, refetch and show the new draft.
- `409 disc.invalid_state`: refetch.
- `422 disc.outcome_required`: no draft yet; button hidden.
- Local proof expired: the shared flow re-asks once.

## 11. Acceptance criteria

- [ ] The approval request carries the revision and hash shown in the dialog.
- [ ] A changed draft cannot be approved without a new look.
- [ ] Pause blocks approval but not reject.
- [ ] Document chips navigate to the right anchor.
- [ ] The approved state is shown after reload.

## 12. Test plan

- Vitest with state machine tables; Playwright scenarios `disc-outcome` and `disc-outcome-stale` (DISCUI018).
- Command: `pnpm --filter @overmind/desktop test features/discussions/result/wiring`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: whether outcome approval needs `localProof` is decided by PERM/DISC; the flow handles both cases.
- ASSUMPTION: `docs.view` navigation target exists (DOCUI area).
