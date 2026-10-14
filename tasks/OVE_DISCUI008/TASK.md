---
id: OVE_DISCUI008
title: "Build the Owner-voice composer region for a Discussion (static with vote option)"
area: DISCUI
kind: ui
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI001, OVE_DS025, OVE_DS048, OVE_PAUSE012]
soft_depends_on: []
provides: ["ui:DiscussionComposerView"]
needs: ["ui:ChatComposer", "ui:SegmentedControl", "ui:PausedReason"]
owns: ["apps/desktop/src/features/discussions/composer/view/**", "apps/desktop/src/locales/en/discussions-008.json", "apps/desktop/src/locales/pl/discussions-008.json"]
reads: []
design: design.png
design_source: "Dyskusja#disc/composer (crop 332,796,798,104)"
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6"]
adr_refs: [23, 15, 6]
---

# OVE_DISCUI008: Build the Owner-voice composer region for a Discussion (static with vote option)

## 1. Summary

Composes the composer at the bottom of the Discussion view from `ui:ChatComposer tone='discussion'` (placeholder `Twój głos w Dyskusji rozstrzyga…`) with a small mode switch `Komentarz | Głos` and an option selector for the deciding vote. Static, with disabled and Telegram-hint states.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. DISC009: the Owner can post a `comment` (authoritative input for the next turns) or a `vote` with `optionKey` (the deciding vote); a binding vote needs the desktop, a Telegram vote is only a preference. This composer is the desktop one.

## 3. Scope (in)

- `DiscussionComposerView`.
- Mode switch and option list UI.
- States.

## 4. Out of scope

- Posting and confirmation logic (DISCUI013).

## 5. Detailed requirements

1. Props: `{ value; onChange; onSend; mode:'comment'|'vote'; onModeChange; options:{key;label}[]; selectedOptionKey?; onOptionChange; sending; disabledReason?; voteDisabledReason? }`.
2. Layout: composer area padding 12 24 20; above the composer a row with `SegmentedControl` `Komentarz` / `Głos rozstrzygający` (EN `Comment` / `Deciding vote`) and, in vote mode, a `Select` or segmented list of options (max 8) with their labels; in vote mode the send button label is `Oddaj głos` (EN `Cast vote`).
3. Placeholder `Twój głos w Dyskusji rozstrzyga…` (EN `Your voice decides in this Discussion…`); vote mode placeholder `Uzasadnienie (opcjonalnie)…`.
4. Vote mode needs a selected option; send disabled with the reason `Wybierz opcję`.
5. No quick actions. Region `data-region='disc/composer'`.
6. `disabledReason` (pause, finished Discussion `Dyskusja zakończona`, offline) replaces the placeholder (kit).
7. Hint line (muted) under the composer in vote mode: `Głos rozstrzygający wymaga potwierdzenia na tym komputerze.` (DISCUI013 shows the confirm dialog).

## 6. Design notes

`design.png` shows the composer with the placeholder `Twój głos w Dyskusji rozstrzyga…` and the send button (magenta gradient with glow). The mode switch and option list are derived from DS rules (segmented control + select) because the mock has only the comment composer.

## 7. Reuse

- `ui:ChatComposer tone='discussion'` (OVE_DS048), `ui:SegmentedControl` (OVE_DS025), `ui:Select` (OVE_DS030).

## 8. Architecture and code placement

`features/discussions/composer/view/`. **i18n namespace:** this task writes its strings into its own namespace `discussions-008` (files `locales/en|pl/discussions-008.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-008`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control.

## 10. Errors and edge cases

- No options in the Discussion (open question): vote mode hidden.
- Text over 2000 chars: kit counter and block (server limit 2000).

## 11. Acceptance criteria

- [ ] `Default` story (comment mode) matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] Vote mode requires an option.

## 12. Test plan

- Storybook `Comment`, `Vote`, `VoteNoOption`, `Disabled`, `Sending`, `Pseudolocale`; Testing Library.
- Command: `pnpm --filter @overmind/desktop test features/discussions/composer/view`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: max text length 2000 (DISC014 validation).
- Missing kit variant: none; mode switch composed from kit primitives.
