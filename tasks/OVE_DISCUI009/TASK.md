---
id: OVE_DISCUI009
title: "Build the result panel region: positions, draft Decision, Tasks, actions (static)"
area: DISCUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI002, OVE_DS013, OVE_DS040, OVE_DS083, OVE_DS084]
soft_depends_on: []
provides: ["ui:DiscussionResultPanelView"]
needs: ["ui:DiscussionResultPanel", "ui:PositionRow", "ui:StancePill", "ui:DocRefChip", "ui:InfoNote", "ui:Button"]
owns: ["apps/desktop/src/features/discussions/result/view/**", "apps/desktop/src/locales/en/discussions-009.json", "apps/desktop/src/locales/pl/discussions-009.json"]
reads: []
design: design.png
design_source: "Dyskusja#disc/positions-panel (crop 1130,117,310,783)"
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10"]
adr_refs: [8, 15, 16]
---

# OVE_DISCUI009: Build the result panel region: positions, draft Decision, Tasks, actions (static)

## 1. Summary

Composes the 310px right panel from the kit `DiscussionResultPanel`: stance counts and rows, the dashed violet draft Decision with `ZADANIA PO ZATWIERDZENIU` and document chips, the no-agreement note and the actions `Zatwierdź wynik` and `Zakończ teraz`, with approved, ended, busy and no-draft states.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. Nothing is created before approval where approval is required: the Board and Register show nothing until `Zatwierdź wynik` (DISC012 requirement 9); the draft is labelled as a proposal in words; every Task draft carries a Documentation reference (ADR 0016).

## 3. Scope (in)

- `DiscussionResultPanelView`.
- Fixtures for the Payments outcome.
- States: no draft, approved, ended, busy, disabled approve with reason, rejected drafts list, deadlock.

## 4. Out of scope

- Approval logic (DISCUI014), deadlock content (DISCUI015).

## 5. Detailed requirements

1. Props map to `DiscussionResultPanelProps` (DS084) plus `rejectedDrafts?: {title; reasonKey}[]` shown as a muted list `Odrzucone szkice (brak powiązania z Dokumentacją)` and `approveDisabledReason?`.
2. Copy: heading `Stanowiska`, counts as stance chips with numbers (`za 1`, `bez preferencji 1`, `warunkowo 1`), eyebrow `DECYZJA (PROPOZYCJA)`, `ZADANIA PO ZATWIERDZENIU`, tiebreak `Brak porozumienia po 4 rundach: Chief rozstrzyga w granicach Budżetu i Dokumentacji albo przekazuje Tobie.`, actions `Zatwierdź wynik`, `Zakończ teraz`; approved `zatwierdzono` + link `Zobacz Decyzję`; ended `zakończono bez wyniku`.
3. `Zatwierdź wynik` is disabled when there is no draft or while busy; reasons in text (`Brak szkicu wyniku`).
4. Regions `disc/positions-panel`, `disc/outcome-draft`, `disc/tiebreak-note`, `disc/outcome-actions`.
5. Doc chips are inert (`DocRefChip` without onOpen) or open the Documentation list when a callback is given (wiring).

## 6. Design notes

`design.png` shows the panel: heading `Stanowiska` with chips (`za`, `bez preferencji`, `oba, z warunkiem`), position rows with avatar + name + stance, the dashed violet draft card `DECYZJA (PROPOZYCJA)` `Przelewy24 z formularzem hostowanym`, `ZADANIA PO ZATWIERDZENIU` (three items with doc chips `spec.md#platnosci`, `reguly.md#R2`), the grey tiebreak note and the actions (violet `Zatwierdź wynik`, secondary `Zakończ teraz`). Geometry DS084. Not in the mock: approved, ended, busy, no draft, rejected drafts.

## 7. Reuse

- `ui:DiscussionResultPanel`, `ui:PositionRow` (OVE_DS084), `ui:DocRefChip` (OVE_DS040).

## 8. Architecture and code placement

`features/discussions/result/view/`. **i18n namespace:** this task writes its strings into its own namespace `discussions-009` (files `locales/en|pl/discussions-009.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-009`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control.

## 10. Errors and edge cases

- More than 6 Tasks: `+N` (kit).
- Task draft without docRef (should not occur): shown with the word `bez odnośnika` and flagged.
- Long Decision title wraps.

## 11. Acceptance criteria

- [ ] `Default` story matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] Approved, ended, busy, no-draft and rejected-drafts stories exist.

## 12. Test plan

- Storybook states; Testing Library for actions; visual comparison.
- Command: `pnpm --filter @overmind/desktop test features/discussions/result/view`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- None.
