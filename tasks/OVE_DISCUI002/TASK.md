---
id: OVE_DISCUI002
title: "Map Discussion contracts to ui-kit props with pure view-model functions"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISC001, OVE_DISCUI001, OVE_DS040, OVE_DS083]
soft_depends_on: []
provides: ["lib:discussion-view-models"]
needs: ["contract:Discussion", "contract:DiscussionMessage", "contract:Stance", "contract:DiscussionOutcome", "contract:DiscussionSummary", "ui:DiscussionList", "ui:DiscussionMessage", "ui:StancePill", "ui:RoundBar", "ui:DiscussionResultPanel", "ui:UiDomainTypes"]
owns: ["apps/desktop/src/features/discussions/model/**", "apps/desktop/src/locales/en/discussions-002.json", "apps/desktop/src/locales/pl/discussions-002.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 8"]
adr_refs: [8, 15]
---

# OVE_DISCUI002: Map Discussion contracts to ui-kit props with pure view-model functions

## 1. Summary

Pure functions that turn Discussion contracts into the props of the Discussion kit components: list rows with meta text, header and round segments, message cards with stance and Skill chips, positions and counts for the result panel, and resolution labels. No React, no I/O.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. DISC001 shapes: `DiscussionSummary { id, seq, title, status, startedBy:'node'|'chief', currentRound, maxRounds, rounds, decisionCount, taskCount, resolution?, endedAt? }`, `Stance { kind:'option'|'no_preference'|'conditional'|'abstain', optionKey?, label, conditions[] }`, `DiscussionMessage { kind:'moderator_brief'|'participant_turn'|'moderator_summary'|'owner_comment'|'owner_vote'|'chief_ruling'|'system_notice', author, text, stance?, skillsUsed[{name, version,...}], trust, channel?, status:'ok'|'skipped'|'timeout'|'invalid_output'|'dropped', redaction{count}, round, seq }`, detail read model with `header.roundSegments`, `availableActions`, `stances[]`, `outcomeDraft`, `banner`.

## 3. Scope (in)

- `toDiscussionRow`, `toHeaderProps`, `toMessageProps`, `toPositions`, `toResultPanelProps`, `resolutionLabel`.
- Stance to pill mapping.
- Skill chip list with version formatting.

## 4. Out of scope

- Rendering and wiring (later tasks).

## 5. Detailed requirements

1. `toDiscussionRow(summary, ctx): DiscussionRowData`: live rows `meta = 'runda 2 z 4 · rozpoczął Chief'` (`startedBy:'chief'` -> `rozpoczął Chief`, `'node'` -> `z Workflow`); finished rows `meta` = counts `4 rundy · 3 Decyzje · 5 Zadań` via plural keys, or `rozstrzygnął Chief · 1 Decyzja` when `resolution==='chief_decided'`, `Twój głos · 1 Decyzja` for owner_vote, etc. Statuses `running|paused|awaiting_outcome_approval|deadlocked|scheduled` are live; `concluded|cancelled|failed|escalated` finished (escalated stays in the live group with the word `przekazana Tobie`, since it waits for the Owner).
2. `mapStance(stance): { kind:'agree'|'no-preference'|'conditional'|'disagree'; label }`: `option` -> `agree` with the engine `label` (for example `Przelewy24`), `no_preference` -> `no-preference`, `conditional` -> `conditional`, `abstain` -> `no-preference` with the word `wstrzymał się`; the pill always shows the word from `stance.label`, never only colour. A stance `disagree` kind does not exist in the contract: it is used only if a future `object` kind appears (exhaustive switch with `never`).
3. `toMessageProps(message, ctx)`: variant `moderator` for `moderator_brief|moderator_summary|chief_ruling`, `owner` for `owner_comment|owner_vote`, `participant` for `participant_turn`, notice for `system_notice`. `round` label `runda 2` (word + number). `skills` = `skillsUsed` mapped to `{ name: 'user-stories v2' }` (name and version together, version rendered `v2`; max 3 shown + `+N`; the full list in the tooltip). Status `skipped|timeout|invalid_output|dropped` map to a muted note (`pominął turę`, `przekroczył czas`, `niepoprawna odpowiedź`, `wypadł z Dyskusji`) instead of a body; the text of an `invalid_output` is never shown.
4. `redaction.count > 0` adds a marker flag so the card shows `discussions:message.redacted`.
5. `toHeaderProps(detail)`: `round {current,total,label}`, `RoundBar` segments from `header.roundSegments` (`done|current|todo`), `runState` text from `runControlText` (`Run #14 wstrzymany w gałęzi „Płatności”, reszta pracuje`), notice when `startedBy.kind==='chief'` using `startedBy.reason` (plain text, <=300), live pill when status live.
6. `toPositions(stances)`: latest stance per participant, order by participant order; counts per stance kind for the chips (`za 1`, `bez preferencji 1`, `warunkowo 1`).
7. `toResultPanelProps(detail)`: draft from `outcomeDraft` (`eyebrow` `DECYZJA (PROPOZYCJA)`, selected option title, rationale, tasks with `docRef` -> `{path, anchor}` parsed from the structured `docRef` field only), `tiebreakNote` shown when status is `deadlocked|escalated` or the rule note when Chief may decide (`question==='how'`) else `Brak zgody: o wyniku decydujesz Ty.`.
8. `availableActions` is taken from the server list as is; the mapper never recomputes rules (DISC013 requirement 3).
9. All functions pure and total: unknown enum values fall back to a neutral display and a `warn` field.

## 6. Design notes

N/A, functionality only. Value sources: VIEWS section 8 copy (`runda 2 z 4 · rozpoczął Chief`, `4 rundy · 3 Decyzje · 5 Zadań`, `rozstrzygnął Chief · 1 Decyzja`).

## 7. Reuse

- `hueForAgentId`, `ApprovalKind`-style state maps (OVE_DS040), kit prop types (OVE_DS083, OVE_DS084), `DocRefChip` data shape.

## 8. Architecture and code placement

`features/discussions/model/`: pure. Registry per message kind (OCP). No React imports. **i18n namespace:** this task writes its strings into its own namespace `discussions-002` (files `locales/en|pl/discussions-002.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-002`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). `invalid_output` text is never displayed (it may contain smuggled instructions or keys that the strict parser rejected). `docRef` is read from the structured field, never parsed out of text.

## 10. Errors and edge cases

- Unknown message kind: neutral card with the text.
- Participant missing in the directory: name from message `author.displayName`.
- Skill with no version (should not happen): shows name with `v?` and a warn.
- Stance label empty: mapped word of the kind.

## 11. Acceptance criteria

- [ ] Every status, message kind, message status and stance kind maps (exhaustive switches fail compile on additions).
- [ ] Skill chips always carry name and version.
- [ ] `invalid_output` bodies never reach props.
- [ ] Finished-row meta matches the mock wording in PL.
- [ ] Pure: no React or api-client import.

## 12. Test plan

- Vitest table tests for each mapper with fixtures from the Payments Discussion of the mock; PL plural tables for rounds, Decisions, Tasks, participants.
- Command: `pnpm --filter @overmind/desktop test features/discussions/model`.

## 13. Parallelization notes

Pure folder. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `abstain` shows as `bez preferencji` with a distinct word `wstrzymał się` (no kit variant).
