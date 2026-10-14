---
id: OVE_DISCUI007
title: "Build the Discussion thread region: notice, moderator, participant, Owner, ruling (static)"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI002, OVE_DS016, OVE_DS018, OVE_DS032, OVE_DS040, OVE_DS047, OVE_DS083]
soft_depends_on: []
provides: ["ui:DiscussionThreadView"]
needs: ["ui:DiscussionMessage", "ui:StancePill", "ui:SkillChip", "ui:CalloutAmber", "ui:TypingIndicator", "ui:Avatar", "ui:Skeleton"]
owns: ["apps/desktop/src/features/discussions/thread/view/**", "apps/desktop/src/locales/en/discussions-007.json", "apps/desktop/src/locales/pl/discussions-007.json"]
reads: []
design: design.png
design_source: "Dyskusja#disc/thread (crop 332,246,798,550)"
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 8"]
adr_refs: [8, 15, 23]
---

# OVE_DISCUI007: Build the Discussion thread region: notice, moderator, participant, Owner, ruling (static)

## 1. Summary

Composes the message stream of the Discussion: the `Chief started this Discussion` notice, the moderator round summary, participant cards with stance pill and Skill chips (name and version), plus the variants the mock omits: Owner comment and vote, Chief ruling, system notices, skipped/timeout turns and typing rows.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace.

## 3. Scope (in)

- `DiscussionThreadView` and `ThreadItem` union.
- Fixtures: the Payments Discussion (moderator summary, PO `Przelewy24`, Developer `bez preferencji`, Security `oba OK z warunkiem`).
- Variant stories and states.

## 4. Out of scope

- Data, virtualisation and Markdown wiring (DISCUI012).
- Chief ruling content (DISCUI015 adds the arguments).

## 5. Detailed requirements

1. Props: `{ notice?: {text:string; icon?}; items: ThreadItem[]; typing: {participantId; name; hue}[]; status; onRetry() }` with `ThreadItem = { id; type:'message'; props: DiscussionMessageProps } | { id; type:'notice'; text } | { id; type:'divider'; label }`.
2. Container: `role='log'`, `aria-live='polite'`, `aria-relevant='additions'`, `aria-label` `Przebieg Dyskusji`, max-width 820, padding 22 24, gap 12 (DS083).
3. Notice: `CalloutAmber`-neutral with bell icon: `Chief rozpoczął tę Dyskusję sam, bo Dokumentacja nie mówi, czym płacą goście. To pytanie „co”, więc wynik zatwierdzasz Ty.` (text comes from `startedBy.reason` plus the i18n tail `discussions:notice.whatQuestion`; plain text).
4. Cards: participant (avatar 36, name 14/700, `runda 2` mono, stance pill, skill chips `skill: user-stories v2`), moderator (tinted Chief card), owner (right aligned violet card with `Ty` label and channel marker `z Telegrama` when `channel==='telegram'` and trust `owner_remote`), `chief_ruling` (moderator style with label `Rozstrzygnięcie Chief`), `system_notice` (centred muted line).
5. Turn problems: `skipped|timeout|invalid_output|dropped` render a single muted line `Security pominął turę` etc. with an icon, no body.
6. Typing row: kit `TypingIndicator` `Security pisze…`.
7. States: loading (3 skeleton cards), empty (`Dyskusja jeszcze się nie zaczęła`), error (Retry).
8. Region `data-region='disc/thread'`; the notice `disc/notice-chief-initiated`.

## 6. Design notes

`design.png` shows the notice (bell, two-line text with `czym` emphasised), the Chief moderator card `moderator · runda 2` with the round summary, and three participant cards: Product Owner (mint outlined pill `Przelewy24`, chip `skill: user-stories v2`), Developer (grey `bez preferencji`, `skill: TypeScript v4`), Security (amber `oba OK z warunkiem`, `skill: security-audit v1`). Geometry DS083. Not in the mock: Owner message, ruling, notices, skipped turn, typing, loading, empty, error.

## 7. Reuse

- `ui:DiscussionMessage`, `ui:StancePill`, `ui:SkillChip` (OVE_DS083, OVE_DS018), `ui:TypingIndicator` (OVE_DS047), `ui:CalloutAmber` (OVE_DS040).

## 8. Architecture and code placement

`features/discussions/thread/view/`: presentational; body slot receives a ReactNode so DISCUI012 injects the Markdown renderer. **i18n namespace:** this task writes its strings into its own namespace `discussions-007` (files `locales/en|pl/discussions-007.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-007`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control. Body content arrives as a ReactNode built by the safe renderer; this component never renders strings as HTML.

## 10. Errors and edge cases

- Very long message (8000 chars): collapsed by the wiring (Markdown component), card keeps layout.
- Unknown stance kind: neutral pill with the word.
- More than 3 skills: `+N` chip.

## 11. Acceptance criteria

- [ ] `Default` story matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] Owner, ruling, notice, skipped, typing, loading, empty, error stories exist.
- [ ] Telegram-origin owner comments are labelled.

## 12. Test plan

- Storybook states; Testing Library for log semantics; visual comparison.
- Command: `pnpm --filter @overmind/desktop test features/discussions/thread/view`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Missing kit variant: `DiscussionMessage` `owner` and ruling variants are defined in DS083 text only (not drawn); implement with the kit variants, no custom CSS.
