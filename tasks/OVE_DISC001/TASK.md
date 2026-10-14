---
id: OVE_DISC001
title: "Define Discussion contracts: messages, stances, outcome, events and errors"
area: DISC
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH008, OVE_ARCH010, OVE_BOARD001, OVE_DATA016, OVE_DEC001, OVE_PERM008]
soft_depends_on: []
provides: ["contract:Discussion", "contract:DiscussionConfig", "contract:DiscussionMessage", "contract:Stance", "contract:DiscussionOutcome", "contract:TurnOutput", "contract:DiscussionSummary", "event:discussion.started", "event:discussion.message.posted", "event:discussion.concluded", "event:discussion.outcome.approved", "event:discussion.escalated", "contract:DiscussionErrors"]
needs: ["lib:define-event", "contract:EventEnvelope", "contract:Actor", "contract:DecisionProposal", "contract:TaskDraft", "contract:ProjectDocRef"]
owns: ["packages/contracts/src/discussion/**", "packages/contracts/src/events/discussion.*.event.ts", "packages/contracts/src/errors/disc.errors.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [1, 15, 23, 28]
---

# OVE_DISC001: Define Discussion contracts: messages, stances, outcome, events and errors

## 1. Summary

Define, as zod schemas, everything the Discussion engine stores and exchanges: Discussion, participants, rounds, messages with stances and recorded Skill use, the structured per-turn output, the outcome (Decision drafts and Task drafts), the events and the `disc.*` error codes. All other DISC tasks, the gateway, api-client and the DISCUI view build on these.

## 2. Context

SPEC 6: a Discussion is a moderated conversation of Agents (Chief included) with an agenda and a round limit, where participants use their Skills; it usually ends with Tasks rather than another Skill. A Workflow Node starts it automatically; Chief may start one (the Run or branch is paused, the Owner notified, Chief waits). No agreement after the limit: Chief decides within Budget, Documentation and Rules, otherwise Escalation; the ruling goes to the Decision Register with each side's arguments (ADR 0015). The Owner can watch live and post; the Owner's vote decides (ADR 0023). Each Skill use records name and version (ADR 0008). Mock `Dyskusja.png`: left list `TRWAJĄ / ZAKOŃCZONE` with `runda 2 z 4 · rozpoczął Chief`, `4 rundy · 3 Decyzje · 5 Zadań`, `rozstrzygnął Chief · 1 Decyzja`; header with `na żywo` pill, agenda, `Runda 2 z 4` four-segment progress, `Run #14 wstrzymany w gałęzi „Płatności”, reszta pracuje`; transcript with moderator Chief, agents with a stance chip (`Przelewy24`, `bez preferencji`, `oba OK z warunkiem`) and a `skill: user-stories v2` chip; right panel `Stanowiska`, `Szkic wyniku` with proposed Decision and Tasks, buttons `Zatwierdź wynik`, `Zakończ teraz`, `Wstrzymaj`; Owner input `Twój głos w Dyskusji rozstrzyga…`. Glossary: Discussion (Dyskusja), Decision.

## 3. Scope (in)

- zod schemas (one file per entity) in `packages/contracts/src/discussion/`: `discussion.ts`, `participant.ts`, `config.ts`, `round.ts`, `message.ts`, `stance.ts`, `turn-output.ts`, `outcome.ts`, `summary.ts` (list item), `ids.ts`.
- Event definitions and error codes.

## 4. Out of scope

- State machine and rules: OVE_DISC002. Persistence: OVE_DISC004. Decision entity: DEC001 (imported as `DecisionProposal`). Task draft: BOARD001 (`TaskDraft`).

## 5. Detailed requirements

1. **Ids:** `DiscussionId = EntityId<'dsc'>`, `DiscussionMessageId = EntityId<'dmg'>`. `seq: int` per Workspace (human label `#n`), `message.seq` gapless per Discussion.
2. **Discussion** (strict): `{ id, seq, workspaceId, runId?, branchId?, nodeExecutionId?, title 1..140, agenda 1..2000, question: 'how' | 'what' (ADR 0016: a missing "what" always needs the Owner), options: Array<{ key: /^[a-z0-9_]{1,32}$/, label 1..60, summary?: <= 300 }> (0..8), startedBy: { kind: 'node' | 'chief', actor: Actor, reason?: <= 300 (why Chief started it, shown in the mock banner) }, participants: Participant[2..8], moderator: { kind: 'chief' } | { kind: 'agent', agentId }, config: DiscussionConfig, status, currentRound: int (0 before start), ownerApprovalRequired: boolean, outcome?: DiscussionOutcome, runControl?: { paused: boolean, branchId?: string }, createdAt, startedAt?, endedAt?, version }`.
3. **Participant:** `{ participantId: 'chief' | AgentId, displayName, initials (<= 3), avatarColorToken, role: 'participant' | 'observer', status: 'active' | 'dropped', droppedReason?, order: int }`. The Owner is not a participant; the Owner posts through Owner messages (below). Participants are validated for visibility in the Workspace at start (OVE_DISC007/008).
4. **DiscussionConfig:** `{ maxRounds: 1..10 (default 4, as in the mock), turnTimeoutMs: 10_000..600_000 (default 180_000), discussionTimeoutMs: 60_000..7_200_000 (default 2_700_000), maxMessageChars: 500..8000 (default 4000), maxTurnsTotal: int (default maxRounds * participants + maxRounds), budget: { maxTokens?: int, maxCostUnits?: number }, consensusRule: 'unanimous_non_neutral' (only value, enum for extension), moderation: { allowEarlyConclude: boolean (default true) } }`.
5. **Status:** `scheduled | running | paused | awaiting_outcome_approval | deadlocked | concluded | escalated | cancelled | failed`. `deadlocked` is transient (round limit hit without consensus, before Chief's ruling). Terminal: `concluded`, `cancelled`, `failed` (`escalated` exits only through the Owner decision of OVE_DISC011).
6. **Stance:** `{ kind: 'option' | 'no_preference' | 'conditional' | 'abstain', optionKey?: string (required for `option`, optional for `conditional`; must be one of `options[].key` when options exist), label: 1..60 (what the UI chip shows, e.g. `Przelewy24`, `bez preferencji`, `oba OK z warunkiem`), conditions: string[0..5] (each <= 200; required non-empty for `conditional`) }`.
7. **SkillUse:** `{ skillId, name, version: int | string, sourceKind: 'owner' | 'chief' | 'import', visibility: 'public' | 'private' }` recorded per message (ADR 0008, SPEC 8). `skillsUsed` in a message is the exact list the prompt assembly injected for that turn (OVE_DISC005).
8. **DiscussionMessage** (append-only): `{ id, discussionId, round: int (0 for pre-round notices), seq, kind: 'moderator_brief' | 'participant_turn' | 'moderator_summary' | 'owner_comment' | 'owner_vote' | 'chief_ruling' | 'system_notice', author: { kind: 'chief'|'agent'|'owner'|'system', participantId?, displayName }, text: string <= 8000 (already redacted), stance?: Stance, skillsUsed: SkillUse[], proposals?: { taskDraftKeys: string[], decisionDraftKeys: string[] }, trust: 'agent' | 'owner' | 'owner_remote' | 'system', channel?: 'desktop' | 'telegram', status: 'ok' | 'skipped' | 'timeout' | 'invalid_output' | 'dropped', usage?: { inputTokens, outputTokens, costUnits?, modelRef? }, redaction: { count: int, kinds: string[] }, contentHash: string, createdAt }`.
9. **TurnOutput** (what a participant Agent must return, parsed with the strict `ProposalParser` of SEC004, JSON only): `{ message: string 1..maxMessageChars, stance: Stance, proposedTasks?: TaskDraft[] (0..10), proposedDecisions?: DecisionProposal[] (0..3), clarificationRequest?: string <= 300 }`. Unknown keys rejected (an Agent cannot smuggle `permissions`).
10. **ModeratorOutput:** `{ roundSummary: string <= 2000, focusQuestions: string[0..5] (each <= 200), consensusClaim?: boolean (a claim only; the engine recomputes), outcomeDraft?: OutcomeDraft }`.
11. **DiscussionOutcome:** `{ summary <= 2000, selectedOptionKey?, resolution: 'consensus' | 'owner_vote' | 'owner_decided' | 'chief_decided' | 'escalated', conditions: string[0..10], decisionDrafts: DecisionProposal[0..5], taskDrafts: TaskDraft[0..50], status: 'draft' | 'awaiting_approval' | 'approved' | 'rejected', revision: int, approvedBy?: Actor, approvedAt?, contentHash }`. Invariant (refine): `status !== 'draft'` requires `decisionDrafts.length + taskDrafts.length >= 1` (outcome required, SPEC 6). Each `taskDrafts[].docRef` is mandatory (inherited).
12. **DiscussionSummary** (list item for the sidebar): `{ id, seq, title, status, startedBy: 'node'|'chief', currentRound, maxRounds, rounds: int, decisionCount, taskCount, resolution?, endedAt? }` rendered as `runda 2 z 4 · rozpoczął Chief` / `4 rundy · 3 Decyzje · 5 Zadań`.
13. **Events** (persisted, `scope: 'workspace'`, `visibleTo` owner and channel unless noted; payloads ids + counts, never message text except in `message.posted` which carries `{ messageId, round, seq, authorKind, textPreview <= 160 }` and the UI fetches the full message by id): `discussion.started`, `discussion.round.started`, `discussion.message.posted`, `discussion.turn.skipped`, `discussion.paused`, `discussion.resumed`, `discussion.deadlocked`, `discussion.outcome.proposed`, `discussion.outcome.approved`, `discussion.outcome.rejected`, `discussion.concluded` (carries `outcomeSummaryRef` and created Task/Decision ids; WFRT's Discussion Node waits on it), `discussion.escalated`, `discussion.cancelled`, `discussion.failed`, `discussion.budget.warning`; ephemeral (`persisted: false`): `discussion.typing {participantId}`.
14. **Error codes** (`disc.*`): `not_found` [404], `invalid_state` [409], `participants_invalid` [422], `participants_too_few` [422], `moderator_unavailable` [503, retryable], `round_limit_reached` [409], `turn_timeout` [504, retryable], `turn_output_invalid` [422], `budget_exceeded` [429], `owner_input_forbidden` [403, audit], `outcome_required` [422], `outcome_invalid` [422], `outcome_not_approved` [409], `skill_not_visible` [422, audit], `already_open` [409], `rate_limited` [429, retryable], `ruling_not_permitted` [409, audit], `agent_text_not_authoritative` (not an error: reserved name documented in SEC004 mapping; do NOT register).
15. All strict, bounded, NFC-normalised, control characters removed except `\n\t`; additive evolution only.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`defineEvent`, `defineErrors`, `EntityId`, `Actor`, `ProjectDocRef`; `DecisionProposal` (DEC001) and `TaskDraft` (BOARD001) imported, never redeclared. `Stance.label` strings are display text; machine logic uses `kind` and `optionKey` only.

## 8. Architecture and code placement

L0 `packages/contracts/src/discussion/*.ts` (one file per entity), events under `packages/contracts/src/events/discussion.<type>.event.ts`, errors under `packages/contracts/src/errors/disc.errors.ts`. No I/O; browser-safe for the desktop.

## 9. Security and safety

Contracts bound what a participant Agent can return: strict `TurnOutput` with size caps and no free-form capability fields (SEC004 R3); `Stance` is structured so consensus logic never parses prose; message `text` is stored already redacted (OVE_DISC013) and carries a `trust` label so later prompt assembly marks it correctly (agent output is untrusted for the next participant); Owner-authored kinds (`owner_comment`, `owner_vote`) can only be created from an authenticated owner caller (enforced in OVE_DISC009, represented by `trust: 'owner'` which no Agent-created record may carry: refine on `author.kind`). Events carry previews only so Telegram and notifications do not leak full transcripts.

## 10. Errors and edge cases

- `option` stance with a key not in `options`: rejected at turn parse (OVE_DISC006) via `Discussion`-aware refinement function exported here (`validateStanceAgainst(options)`).
- `agenda` empty: rejected. `options` empty is allowed (open question such as "what pays guests?"): consensus then uses `no_preference/conditional` semantics defined in DISC002.
- Participants listed twice: rejected.
- Outcome with zero drafts at status `awaiting_approval`: rejected by the refine.

## 11. Acceptance criteria

- [ ] All schemas exist, strict, with JSON Schema snapshots generated.
- [ ] Invalid fixtures: duplicate participants, 1 participant, 9 participants, `maxRounds: 11`, `conditional` without conditions, stance label 61 chars, agent-authored message with `trust: 'owner'`, outcome awaiting approval with no drafts.
- [ ] Events registered with names per ARCH010; `expectEventSafe` passes on samples; `message.posted` has no full text.
- [ ] Error codes registered with http, messageKey and audit flags as listed.
- [ ] `validateStanceAgainst` unit-tested.

## 12. Test plan

- `packages/contracts/src/discussion/*.test.ts` (table-driven valid/invalid), `events/discussion.*.event.test.ts`, registry scan test.
- Commands: `pnpm vitest run packages/contracts/src/discussion packages/contracts/src/events`.

## 13. Parallelization notes

Merge first within DISC. DEC001 and BOARD001 must already exist for the imports (capabilities); until merged use stubs in the test fixtures only. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: max 8 participants and `maxRounds <= 10`; mock shows 3 agents plus Chief, 4 rounds.
- ASSUMPTION: Chief-started Discussions have `ownerApprovalRequired: true` (see DISC008); node-started ones default to false unless `question: 'what'`.
- Open: conditional stance with `optionKey: null` meaning "either option works" (mock: Security `oba OK z warunkiem`). Default as specified.
