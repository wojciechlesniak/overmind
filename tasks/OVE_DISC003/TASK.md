---
id: OVE_DISC003
title: "Define Discussion ports, scripted fake agents, builders and repository contract suites"
area: DISC
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DISC001, OVE_DISC002, OVE_SEC004, OVE_TEST002, OVE_TEST003]
soft_depends_on: ["OVE_TEST003"]
provides: ["port:DiscussionRepository", "port:DiscussionMessageRepository", "port:DiscussionOutcomeRepository", "port:DiscussionReadModel", "port:DiscussionTurnRunner", "port:ChiefArbiter", "lib:fake-discussion-agents", "lib:discussion-builders", "lib:discussion-contract-suites"]
needs: ["port:UnitOfWork", "lib:test-utils", "lib:builders", "lib:contract-test-harness", "lib:fake-clock", "lib:prompt-assembly"]
owns: ["packages/application/src/ports/DiscussionRepository.ts", "packages/application/src/ports/DiscussionMessageRepository.ts", "packages/application/src/ports/DiscussionOutcomeRepository.ts", "packages/application/src/ports/DiscussionReadModel.ts", "packages/application/src/ports/DiscussionTurnRunner.ts", "packages/application/src/ports/ChiefArbiter.ts", "packages/testing/src/fakes/InMemoryDiscussionRepository.ts", "packages/testing/src/fakes/InMemoryDiscussionMessageRepository.ts", "packages/testing/src/fakes/InMemoryDiscussionOutcomeRepository.ts", "packages/testing/src/fakes/FakeDiscussionTurnRunner.ts", "packages/testing/src/fakes/FakeChiefArbiter.ts", "packages/testing/src/builders/discussion.builder.ts", "packages/testing/src/contracts/DiscussionRepository.contract.ts", "packages/testing/src/contracts/DiscussionMessageRepository.contract.ts", "packages/testing/src/contracts/DiscussionOutcomeRepository.contract.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [8, 15, 23]
---

# OVE_DISC003: Define Discussion ports, scripted fake agents, builders and repository contract suites

## 1. Summary

Define the application ports of the Discussion engine (repositories, read model, the participant turn runner, the Chief arbiter), build a scripted fake agent runner so whole Discussions can be tested deterministically with no model, add builders, and write repository contract suites run against both fakes and SQLite.

## 2. Context

The engine must be testable without `claude`/`codex` CLIs (herdr, isolation). A Discussion test needs agents that answer with chosen stances, time out, return invalid JSON, attempt prompt injection or flood. SEC004 requires deterministic model-free tests; TEST006 provides CLI simulators for providers, but DISC needs a higher-level fake at the `DiscussionTurnRunner` seam. Ports isolate DISC from AGENT/PROV (adapters implement `DiscussionTurnRunner` using the Agent runtime later).

## 3. Scope (in)

- Ports as listed, fakes, builders, contract suites, and a documented DSL for scripting fake agents.

## 4. Out of scope

- Real `DiscussionTurnRunner` adapter over herdr/providers: AGENT/PROV (capability `adapter:DiscussionTurnRunner`). Real `ChiefArbiter`: CHIEF. SQLite: OVE_DISC004.

## 5. Detailed requirements

1. **DiscussionRepository:** `create(d)`, `get(id)`, `getForWorkspace(wid, id)` (foreign id -> not found), `update(d, expectedVersion)` (optimistic lock, `disc.invalid_state` on terminal regression), `listByWorkspace(wid, { statuses?, cursor, limit })`, `findByNodeExecution(nodeExecutionId)` (idempotent start), `findOpenByRunBranch(runId, branchId)`, `listActive()` (recovery), `deleteAllForWorkspace(tx, workspaceId)` (only for the cascade participant, OVE_DISC016). `seq` per Workspace assigned in `create`.
2. **DiscussionMessageRepository:** `append(msg, tx?)` assigns gapless per-Discussion `seq`; `list(discussionId, { afterSeq, limit })`; `countByRound`; `latestStances(discussionId)`. NO update or delete methods (structural immutability).
3. **DiscussionOutcomeRepository:** `appendRevision(discussionId, revision)`, `latest(discussionId)`, `history(discussionId)`; approval and rejection are new revision rows (kind `approval`/`rejection`), earlier revisions retained.
4. **DiscussionReadModel:** `list(wid, { section: 'running' | 'finished' })` -> `DiscussionSummary[]`; `get(wid, id)` -> `{ discussion, messages page, stances, outcomeDraft?, runControl }` (SQL in OVE_DISC013).
5. **DiscussionTurnRunner (the seam to Agents):**
   ```ts
   interface DiscussionTurnRunner {
     runTurn(req: { workspaceId; discussionId; participantId: 'chief' | AgentId;
       turnKind: 'moderator' | 'participant' | 'ruling';
       prompt: AssembledPrompt;                 // only obtainable from the SEC004 PromptAssembler
       outputSchemaId: 'turn_output' | 'moderator_output' | 'chief_ruling';
       timeoutMs: number; limits: { maxOutputChars: number; maxTokens?: number };
       idempotencyKey: string }                 // 'dsc:<id>:r<n>:<participant>:<attempt>'
     ): Promise<Result<TurnResult>>;
     cancel(idempotencyKey: string): Promise<Result<void>>;
   }
   TurnResult = { rawText: string; usage: { inputTokens?; outputTokens?; costUnits?; modelRef: string }; finishedReason: 'stop' | 'length' | 'cancelled' }
   ```
   The runner returns raw text only; parsing is done by the engine with the strict `ProposalParser` (SEC004). The adapter MUST run the Agent in isolation under the Agent's own Effective Permissions (a Discussion turn grants nothing) and, ASSUMPTION, without tools ("discussion mode").
6. **ChiefArbiter:** `rule(req: { discussionId; workspaceId; question; options; arguments: Array<{ participantId; stance; summary }>; ownerRulesRef; docRefs; budgetRemaining }): Promise<Result<ChiefRuling>>`; `ChiefRuling = { selectedOptionKey?, alternativeProposal?, rationale, citedDocRefs: ProjectDocRef[], assertsWithinBudget, assertsConsistentWithDocs, assertsNoRuleViolation, escalate, escalateReason? }` (claims only; verified in OVE_DISC011).
7. **FakeDiscussionTurnRunner DSL:** `fake.script({ participantId, round, do: 'ok', stance, message, tasks? })`, `{ do: 'timeout' }`, `{ do: 'invalid_json', raw? }`, `{ do: 'inject', payload: <corpus id> }`, `{ do: 'flood', chars }`, `{ do: 'slow', ms }` (uses `FakeClock`), `{ do: 'cost', costUnits }`; default: deterministic canned reply with stance `no_preference`; records every request including prompt text (`fake.requests()`); `failNext(error)`; flood capped at 1 MB.
8. **FakeChiefArbiter:** scripted rulings including false claims (`assertsWithinBudget: true` with exhausted budget) for verification tests.
9. **Builders:** `aDiscussion({ participants, round })`, `aStance.option('przelewy24')`, `aTurnOutput()`, `anOutcomeDraft()`, schema validated; defaults reproduce the mock scenario "Płatności: Stripe czy Przelewy24?" (options `stripe`, `przelewy24`; Security `conditional`).
10. **Contract suites:** gapless message `seq` under concurrent appends; no mutating methods on the message port; optimistic lock; `findByNodeExecution` idempotency; foreign Workspace -> not found; outcome revisions append-only; `deleteAllForWorkspace` removes only its Workspace and requires a transaction handle.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

TEST002 `defineBuilder`/`FakeClock`; TEST003 harness; SEC004 `AssembledPrompt` and `lib:injection-corpus`. Do not duplicate TEST006 provider simulators.

## 8. Architecture and code placement

Ports in `packages/application/src/ports/` (one file each); fakes and builders in `packages/testing`; suites in `packages/testing/src/contracts/`; SQLite adapter (DISC004) runs the suites.

## 9. Security and safety

The turn-runner port makes the trust boundary explicit: trusted prompt in, untrusted raw text out. Accepting only `AssembledPrompt` makes hand-built prompts a type error. The message port has no mutation methods and fakes mirror that. Arbiter output is claims, never trusted.

## 10. Errors and edge cases

- `slow` with `FakeClock` never uses real timers.
- `cancel` twice: second is a no-op ok.
- Unscripted participant: default stance `no_preference`.

## 11. Acceptance criteria

- [ ] Ports compile; fakes pass all three contract suites.
- [ ] No mutating method on the message port or its fake (type test).
- [ ] The fake runner supports every DSL behaviour and records prompts.
- [ ] The payments scenario builder yields a valid Discussion with four participants.
- [ ] A scripted false budget claim is representable.

## 12. Test plan

- Contract suites on fakes, DSL unit tests, builder validation tests. Commands: `pnpm vitest run packages/testing`.

## 13. Parallelization notes

DISC004, DISC005 start after this. Hotspot: `packages/testing/package.json` via proposal.

## 14. Open questions and assumptions

- ASSUMPTION: Discussion turns are tool-free; reading files during a Discussion would be a later, permission-preserving extension.
- Open: streaming partial output for live typing; default no (UI shows `typing` presence only).
