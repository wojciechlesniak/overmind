---
id: OVE_DISCUI005
title: "Build the Discussions list region (static with fixtures)"
area: DISCUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI002, OVE_DS032, OVE_DS044]
soft_depends_on: []
provides: ["ui:DiscussionListView"]
needs: ["ui:DiscussionList", "ui:SidePanel", "ui:Skeleton", "ui:EmptyState"]
owns: ["apps/desktop/src/features/discussions/list/view/**", "apps/desktop/src/locales/en/discussions-005.json", "apps/desktop/src/locales/pl/discussions-005.json"]
reads: []
design: design.png
design_source: "Dyskusja#disc/list (crop 72,117,260,783)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [15]
---

# OVE_DISCUI005: Build the Discussions list region (static with fixtures)

## 1. Summary

Composes the 260px Discussions list from the kit `DiscussionList`: heading `Dyskusje`, `TRWAJĄ` with the live selected row and `ZAKOŃCZONE` with finished rows, plus loading, empty and error states. Props and fixtures only.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. The Chief conversation list also shows live Discussions (CHATUI017); this list is the Discussion view's own sidebar with finished Discussions too.

## 3. Scope (in)

- `DiscussionListView`.
- Fixtures: live `Płatności: Stripe czy P24?` (`runda 2 z 4 · rozpoczął Chief`, selected), finished `Zakres MVP` (`4 rundy · 3 Decyzje · 5 Zadań`), `Model danych rezerwacji` (`2 rundy · 1 Decyzja · 2 Zadania`), `Styl makiet` (`rozstrzygnął Chief · 1 Decyzja`).
- States.

## 4. Out of scope

- Data wiring (DISCUI010).

## 5. Detailed requirements

1. Props: `{ live: DiscussionRowData[]; done: DiscussionRowData[]; selectedId?; loading?; error?: MessageRef; onSelect(id); onRetry() }` -> `ui:DiscussionList` with `liveHeading` `TRWAJĄ` (EN `RUNNING`), `doneHeading` `ZAKOŃCZONE` (EN `FINISHED`), heading `Dyskusje`.
2. Region `data-region='disc/list'`; empty sections hidden (kit); both empty: `EmptyState` `Brak Dyskusji. Chief zaczyna je sam, gdy trzeba coś ustalić.` (EN `No Discussions yet. Chief starts them when something must be settled.`).
3. Error: small EmptyState with Retry; loading skeleton rows (kit).
4. Status words in row meta for non-running live states: `wstrzymana`, `czeka na Twoje zatwierdzenie`, `brak zgody`, `przekazana Tobie` (amber), because colour alone must not convey it.

## 6. Design notes

`design.png` shows the 260px list: heading `Dyskusje`, label `TRWAJĄ`, selected live row (magenta dot, `Płatności: Stripe czy P24?`, mono meta), label `ZAKOŃCZONE`, finished row with grey dot and meta. Geometry DS083. Not in the mock: loading, empty, error, hover, focus, waiting-for-Owner statuses, long titles.

## 7. Reuse

- `ui:DiscussionList` (OVE_DS083), `ui:SidePanel` (OVE_DS044).

## 8. Architecture and code placement

`features/discussions/list/view/`: presentational. **i18n namespace:** this task writes its strings into its own namespace `discussions-005` (files `locales/en|pl/discussions-005.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-005`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control.

## 10. Errors and edge cases

- Very long title: ellipsis with title attribute.
- Selected id not present: nothing selected.

## 11. Acceptance criteria

- [ ] `Default` story matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] Non-running live statuses are worded.

## 12. Test plan

- Storybook `Default`, `Loading`, `Empty`, `Error`, `WaitingOwner`, `LongTitles`, `Pseudolocale`; Testing Library selection and keyboard; visual comparison.
- Command: `pnpm --filter @overmind/desktop test features/discussions/list/view`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- None.
