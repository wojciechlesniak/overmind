---
id: OVE_DISC006
title: "Run Discussion rounds: turn-taking protocol, moderation and crash-safe stepping"
area: DISC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DISC002, OVE_DISC003, OVE_DISC005, OVE_ENGINE029, OVE_PAUSE005, OVE_PERM008, OVE_PERM020, OVE_SEC004]
soft_depends_on: ["OVE_DISC004"]
provides: ["usecase:discussion.step", "usecase:discussion.recover", "lib:discussion-engine"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "lib:prompt-assembly", "port:JobScheduler", "port:PauseGate", "lib:redactor"]
owns: ["packages/application/src/discussion/engine/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 19, 23]
---

# OVE_DISC006: Run Discussion rounds: turn-taking protocol, moderation and crash-safe stepping

## 1. Summary

Implement the turn-taking engine: a resumable `step` function that advances a Discussion by exactly one action (moderator brief, one participant turn, round close, consensus check, round summary), parses output strictly, records messages, applies moderation rules and survives engine restarts without repeating a turn.

## 2. Context

SPEC 6: moderated rounds, agenda, round limit, Skills per participant. SPEC 12: the engine persists state and resumes after restart without repeating non-idempotent actions; a Discussion turn consumes model usage and must not be re-run blindly. ADR 0023: Owner can post live. SEC004: output is untrusted, parsed only through strict schemas. Parallel Agent slots are limited (default 3 per installation): turns run one at a time per Discussion (ASSUMPTION), so a Discussion uses one slot.

## 3. Scope (in)

- `step(discussionId)` state machine driver, `DiscussionRunner` job registration, recovery at startup, turn execution with parsing, retry-once on invalid output, moderator actions, consensus and round close, early conclusion.

## 4. Out of scope

- Starting Discussions: DISC007 (node), DISC008 (Chief). Owner input handling: DISC009. Budgets, timeouts, Pause: DISC010. Deadlock ruling: DISC011. Outcome finalisation: DISC012.

## 5. Detailed requirements

1. **Step contract:** `step(id): Result<StepOutcome>` where `StepOutcome = { advanced: 'brief'|'turn'|'round_closed'|'consensus'|'deadlock'|'awaiting_outcome'|'noop', next: 'schedule_now'|'wait_owner'|'stop' }`. A step performs ONE model call at most. The next action is derived only from persisted state (messages by round, participants, status): no in-memory loop state, so a crash between steps is harmless.
2. **Runner:** a job per Discussion on `JobScheduler` (key `discussion:<id>`, single-flight: a second concurrent runner for the same id is refused) repeatedly calling `step` while `next === 'schedule_now'`; yields between steps so other work progresses; stops on `paused`, terminal or awaiting states.
3. **Round flow:** `startRound(n)` (persist `discussion.round.started`); moderator brief turn (`moderator_brief`: round 1 framing, later `moderator_summary` of the previous round plus focus questions); each active non-observer participant in `selectOrder` once; when all done compute consensus (DISC002): reached -> `consensus` path (moderator outcome draft turn, then DISC012); not reached and `n < maxRounds` -> moderator summary then next round; `n === maxRounds` -> `deadlock` path (DISC011).
4. **Turn execution:** assemble prompt (DISC005), call `DiscussionTurnRunner.runTurn` with idempotency key `dsc:<id>:r<n>:<participant>:<attempt>`, parse with `ProposalParser` against `TurnOutput`/`ModeratorOutput` schemas, validate stance against options (`validateStanceAgainst`), cap text to `maxMessageChars`, redact (DISC013 function; until merged a local call to the shared redactor), persist the message with `skillsUsed`, usage and prompt provenance, publish `discussion.message.posted` (outbox). Proposed Task/Decision drafts inside the output are stored as proposals on the message (keys only) and in the working outcome draft; they create nothing yet.
5. **Failures:** `turn_timeout` or runner error -> message `status: 'timeout'` (no content) and the turn is not retried (cost safety); `invalid_output` -> ONE retry with a repair instruction that contains only the schema error summary (never the offending text) and attempt `2`; second failure -> `invalid_output` message. Two consecutive non-ok turns drop the participant (DISC002).
6. **Crash safety:** before calling the runner the engine records `pending_turn` (not a transcript message, so the transcript stays clean) in `discussions.run_control_json` ({ participantId, round, attempt, idempotencyKey, startedAt }) in the same transaction as `version++`. On recovery (`usecase:discussion.recover`, at startup, for `listActive()`): if `pending_turn` exists the engine asks the runner (`cancel(idempotencyKey)`) and records the turn as `timeout` with reason `engine_restart`; it NEVER re-sends the same prompt automatically (SPEC 12: no blind repeat of non-idempotent action; the Owner/Chief may re-run the round explicitly).
7. **Moderation rules (engine-enforced, not model-decided):** a participant speaks at most once per round; a turn longer than limits is truncated with a visible marker; if the moderator output claims consensus but computed consensus differs, the computed value wins and a `system_notice` records "moderator claim ignored"; `focusQuestions` are shown as data to the next speakers; the moderator cannot skip participants, change limits, add participants or end the Discussion (only the engine, Owner and Chief paths can).
8. **Moderator unavailable:** if the moderator turn fails twice, the engine uses a deterministic fallback brief (agenda plus last stances list generated by code) and continues, flagging `moderator_degraded` in a `system_notice`.
9. **Events:** `round.started`, `message.posted`, `turn.skipped`, ephemeral `typing` before a turn; all through the outbox.
10. **Concurrency with Owner input:** an Owner message arriving during a turn is appended after the current message (seq order) and included in the next prompt; an Owner vote (DISC009) sets a flag the engine checks before each step (`ownerDecided`) and stops the round.
11. **Idempotent steps:** `step` carries `expectedVersion`; version conflict means another actor changed state (Owner vote/pause): reload and decide again.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DISC002 domain functions for all decisions, DISC005 for prompts, SEC004 `ProposalParser`, `JobScheduler`, `PauseGate`, outbox/`UnitOfWork`. No second consensus or ordering implementation.

## 8. Architecture and code placement

`packages/application/src/discussion/engine/{step.ts,runner.ts,turn-executor.ts,round-flow.ts,recovery.ts,moderation.ts,output-parsing.ts}`. Depends on ports; registers the job via the composition root extension point.

## 9. Security and safety

The engine is where model output meets state: every output is parsed by a strict schema, truncated, redacted and stored as a message; nothing in an output can start a Run, change permissions, add participants or end the Discussion. Moderator claims are never authoritative. Crash recovery refuses to replay a prompt (no duplicated side effects or double spend). Participant turns have a per-turn timeout and cap on output size (DoS and cost). The single-flight runner prevents two engines driving one Discussion. Repair retry never echoes the offending text back (prevents reflection of injected payloads).

## 10. Errors and edge cases

- Engine restarts mid-turn: turn recorded as `timeout` (`engine_restart`), Discussion continues with the next participant.
- All participants drop: Discussion `failed` with `disc.participants_too_few`, Escalation raised by DISC010.
- Participant output valid JSON but stance option key unknown: treated as `invalid_output` (one repair).
- Output with extra key `permissions`: rejected, audited `security.suspicious_output` (SEC004).
- Observers only speak never; Chief as participant uses the same path.
- `maxRounds = 1`: one round, then consensus or deadlock.

## 11. Acceptance criteria

- [ ] A scripted 3-agent Discussion with consensus in round 2 ends after round 2 (no round 3) with the expected messages and `skillsUsed` recorded.
- [ ] Without consensus the engine stops at `deadlock` after `maxRounds` complete rounds.
- [ ] Invalid JSON gets exactly one repair attempt; the second failure is recorded without content.
- [ ] After a simulated crash mid-turn the engine never re-sends the prompt and records `engine_restart`.
- [ ] Moderator consensus claims that contradict computed consensus are ignored and noted.
- [ ] Injected output keys are rejected and audited; no state changes beyond the message.
- [ ] Single-flight: two concurrent runners cannot both advance a Discussion.

## 12. Test plan

- `step.test.ts` scenario table with `FakeDiscussionTurnRunner` and `FakeClock`; `recovery.test.ts` (kill points before/after runner call and before persistence); `output-parsing.test.ts` (corpus); `runner.single-flight.test.ts`.
- Commands: `pnpm vitest run packages/application/src/discussion/engine`.

## 13. Parallelization notes

Core of DISC; DISC007-012 build on it. Hotspot: `step.ts` owned here; other tasks add behaviours through exported hooks (`beforeStep`, `onDeadlock`) registered at composition, not by editing.

## 14. Open questions and assumptions

- ASSUMPTION: one turn at a time per Discussion; parallel position-taking in round 1 is a later option (`parallelPositions`).
- ASSUMPTION: no automatic retry after a timeout (cost and safety).
