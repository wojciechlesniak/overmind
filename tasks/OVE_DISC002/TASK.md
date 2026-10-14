---
id: OVE_DISC002
title: "Implement the Discussion state machine, rounds, consensus and deadlock rules in the domain"
area: DISC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_DISC001]
soft_depends_on: []
provides: ["lib:discussion-domain", "lib:consensus"]
needs: ["contract:Discussion", "contract:Stance", "contract:DiscussionMessage", "lib:result", "lib:error-catalogue"]
owns: ["packages/domain/src/discussion/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 23]
---

# OVE_DISC002: Implement the Discussion state machine, rounds, consensus and deadlock rules in the domain

## 1. Summary

Implement the pure rules of a Discussion: allowed status transitions, round and turn scheduling, deterministic consensus computation from structured stances, deadlock detection at the round limit, effect of an Owner vote, dropping of failing participants, and outcome completeness checks. Everything that touches models, time or storage is elsewhere.

## 2. Context

SPEC 6: moderated rounds with a limit; no agreement after the limit leads to Chief's ruling or Escalation. The mock shows round progress (`Runda 2 z 4`) and stance chips. Consensus must never be derived by reading prose (SEC004), only from structured `Stance` values, because Agent text may be adversarial. The Owner's vote decides (ADR 0023).

## 3. Scope (in)

- Functions in `packages/domain/src/discussion/`: `transition`, `nextTurn`, `startRound`, `recordMessage`, `computeConsensus`, `isDeadlock`, `applyOwnerVote`, `dropParticipant`, `validateOutcomeCompleteness`, `selectOrder`.
- Transition table and consensus rules as data and pure functions.

## 4. Out of scope

- Running turns, timeouts, Budget: OVE_DISC006/010. Deadlock *resolution* (Chief ruling): OVE_DISC011. Persistence: OVE_DISC004.

## 5. Detailed requirements

1. **Transition table:** `scheduled -> running | cancelled`; `running -> paused | awaiting_outcome_approval | deadlocked | concluded | cancelled | failed | escalated`; `paused -> running | cancelled`; `deadlocked -> awaiting_outcome_approval | concluded | escalated | cancelled`; `awaiting_outcome_approval -> concluded (approved) | running (outcome rejected: new revision round) | escalated | cancelled`; `escalated -> concluded` only through the Owner's escalation decision (OVE_DISC011); `concluded`, `cancelled`, `failed` have no exits. Invalid pair: `disc.invalid_state` with `{from,to}`.
2. **Turn order:** `selectOrder(participants, round)`: moderator speaks first with the brief (round 1: agenda framing; later: summary of the previous round); then active non-observer participants in `order`, rotating the starting index by `(round - 1)` so the same Agent does not always speak first; observers never speak. Chief as participant (not moderator) speaks in its order position.
3. **Consensus** `computeConsensus(options, stances)` over each active participant's LATEST stance: `abstain` and `no_preference` are neutral and ignored; `option(k)` and `conditional(k)` support k; `conditional(null)` is compatible with all options and adds its conditions. Consensus exists iff (a) at least one non-neutral stance exists, (b) all supporting stances name the same option key (or all are `conditional(null)` with no option list), and (c) no participant's latest stance names a different option. Result `{ reached: boolean, optionKey?: string, conditions: string[] (union, deduplicated, max 10), dissenters: ParticipantId[], neutral: ParticipantId[] }`. With an empty `options` list (open question) consensus is reached only when everyone is `conditional(null)` or neutral and at least one condition set is identical after normalisation; otherwise it is not reached (open questions end in a moderator draft + Owner/Chief ruling by design).
4. **Round close:** a round is complete when every active non-observer participant has a message with status in (`ok`, `skipped`, `timeout`, `invalid_output`, `dropped`) for that round. A participant with 2 consecutive non-ok turns is dropped (`dropParticipant`, reason `unresponsive`); if fewer than 2 active participants remain, status moves to `failed` with `disc.participants_too_few`.
5. **Deadlock:** `isDeadlock(discussion)` is true when `currentRound === config.maxRounds`, the round is complete and consensus is not reached. Early conclusion: when consensus is reached after any complete round and `allowEarlyConclude`, transition to outcome drafting (`awaiting_outcome_approval` if approval is required, otherwise `concluded` after the outcome is stored).
6. **Owner vote** `applyOwnerVote(discussion, vote: { optionKey? , text?, decisionKind: 'choose_option'|'free_directive' })`: from `running|paused|deadlocked|awaiting_outcome_approval` it sets `outcome.resolution = 'owner_vote'`, `selectedOptionKey = vote.optionKey` (must be a valid option when options exist), cancels remaining turns of the current round, and moves to outcome drafting. The vote outranks Agent consensus and any Chief ruling: a later computed consensus never overwrites it (flag `ownerDecided = true` on the outcome revision). Owner comments (`owner_comment`) never change status; they are included in the next prompts.
7. **Outcome completeness:** `validateOutcomeCompleteness(outcome)`: at least one Decision draft or Task draft; every Task draft has a docRef; Decision drafts list alternatives including the selected option; each Decision draft's `participants` subset of discussion participants plus Owner; otherwise `disc.outcome_invalid` with a list of problems (max 20).
8. **Limits as pure checks:** `checkLimits(discussion, now, usage)` returns `{ exceeded?: 'discussion_timeout' | 'max_turns' | 'tokens' | 'cost' }`; the runner (DISC010) decides what to do.
9. **Immutability:** messages are append-only values; `recordMessage` returns a new Discussion value plus the message to persist; no function edits or removes a message.
10. **Counters for UI:** `summaryOf(discussion)` builds the `DiscussionSummary` including decision/task counts.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Contracts from DISC001, `Result`/errors. Shared helpers: none; this module is the only place where consensus is computed (UI, Telegram and Chief read the stored result, never recompute).

## 8. Architecture and code placement

`packages/domain/src/discussion/{transitions.ts,turn-order.ts,consensus.ts,round.ts,owner-vote.ts,outcome-rules.ts,limits.ts,summary.ts}`. Imports contracts only. Time is passed in as an argument.

## 9. Security and safety

Decision logic never depends on model prose: only `Stance.kind/optionKey` and counts. An Agent cannot declare consensus (`consensusClaim` is ignored) or end a Discussion; only the engine's computation and the Owner/Chief paths can. Owner vote precedence is encoded here and tested so a crafted Agent message cannot override it. Participant dropping bounds a malicious or looping Agent's influence and cost.

## 10. Errors and edge cases

- All participants neutral: consensus not reached (no supporters) unless the Owner decides.
- Participant changes stance in round 3 to align: only the latest stance counts (history is kept in messages).
- Participant dropped after stating a stance: their last stance still counts only if they were active at the round close (dropped participants are excluded from the evaluation).
- Observer-only discussions (no active non-observers): rejected at start.
- Owner vote for an unknown option key: `validation.invalid_input`.
- Two Owner votes: the later replaces the earlier while the outcome is not yet approved; both remain in the transcript.

## 11. Acceptance criteria

- [ ] Exhaustive transition matrix tests; invalid pairs rejected.
- [ ] Consensus cases: all same option; one dissenter; conditional(null) with option supporters; all neutral; empty options; unanimity with conditions merged and deduplicated.
- [ ] Deadlock is detected exactly at the last complete round; early conclusion before it.
- [ ] Owner vote beats consensus and Chief ruling; recorded as `owner_vote`.
- [ ] Two consecutive failed turns drop a participant; <2 active fails the Discussion.
- [ ] Outcome completeness rules produce a bounded list of problems.
- [ ] Property test: random message sequences never violate invariants (gapless seq, no edits).

## 12. Test plan

- `packages/domain/src/discussion/*.test.ts` with table-driven fixtures; property tests via seeded generators.
- Commands: `pnpm vitest run packages/domain/src/discussion`.

## 13. Parallelization notes

Parallel with DISC003 after DISC001. Hotspot: `transitions.ts` owned here.

## 14. Open questions and assumptions

- ASSUMPTION: consensus rule is unanimity among non-neutral stances (the only `consensusRule` value in MVP).
- ASSUMPTION: two consecutive non-ok turns drop a participant.
- Open: majority-based consensus as an alternative `consensusRule`; default none (additive later).
