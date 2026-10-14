---
id: OVE_CHIEF006
title: Implement the Chief turn runner with typed output and intent routing
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_CHAT006, OVE_CHAT009, OVE_CHIEF001, OVE_CHIEF003, OVE_CHIEF005, OVE_ENGINE004, OVE_ENGINE005, OVE_NOTIF004, OVE_PERM010, OVE_PERM020, OVE_PROV001, OVE_SEC004]
soft_depends_on: [OVE_CHIEF004]
provides: ["usecase:RunChiefTurn", "service:ChiefTurnWorker", "port:ChiefModel", "lib:chief-action-dispatcher", "participant:chief-turn-shutdown", "participant:chief-turn-recovery"]
needs: ["port:ModelProvider", "lib:prompt-assembly", "port:ConfigStore", "usecase:AppendAudit", "port:PauseStateReader", "usecase:Notify", "port:ShutdownParticipant", "port:RecoveryParticipant"]
owns: ["packages/application/src/chief/turn/**", "packages/application/src/ports/ChiefModel.ts", "packages/application/src/chief/dispatch/**"]
reads: ["packages/application/src/chief/context/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 5", "SPECIFICATION 9", "SPECIFICATION 16.4", "SPECIFICATION 16.13"]
adr_refs: [15, 16, 7, 12, 3]
---

# OVE_CHIEF006: Implement the Chief turn runner with typed output and intent routing

## 1. Summary

The loop that makes Chief answer: take a trigger (Owner message or an event such as an Agent report), build context and prompt (CHIEF005), call the Chief model, parse the output strictly into `ChiefAction[]` and dispatch each action to the use case that enforces authority. Simple questions are answered with a `reply` and start no Team or Run.

## 2. Context

SPEC 4: Chief answers simple questions itself "bez uruchamiania Zespołu". The Chief model is set in `ChiefConfig` (ADR 0007) and runs via a CLI (herdr) or Ollama through PROV. SEC004: model output may only produce typed proposals validated by zod; no text becomes permission (R3); Agent output consumed by Chief is data (R4). Replies are stored as chat messages (CHAT009), which gives desktop and Telegram the same state (criterion 13).

## 3. Scope (in)

- `RunChiefTurn(input: { trigger, conversationId?, ownerMessageId?, workspaceScope?, trust })`.
- `ChiefTurnWorker`: single serial queue of triggers; one model call at a time.
- `ChiefModel` port: `complete({ prompt, outputSchema, timeoutMs, maxOutputChars }): Promise<Result<{ text, usage, model }>>`.
- Strict parsing through `ProposalParser` (SEC004) and the dispatcher (`actionType -> handler`, handlers registered by CHIEF007-017 through a multi-token).
- Intent rule: only `reply`/`answer_status` actions mean no Run, Team, Task, session or Discussion is started.
- A `ShutdownParticipant` (phase `quiesce`: stop taking triggers, let the current turn finish or abandon it at the deadline) and a `RecoveryParticipant` (re-enqueue triggers whose turn trace has no `completed` marker, never re-dispatching actions that already have an outcome).

## 4. Out of scope

- Context building: CHIEF005. Handlers: CHIEF007-017. Fallback model switching: CHIEF018. Streaming rendering: CHAT009.

## 5. Detailed requirements

1. Triggers: `owner_message` (from `chat.owner_message.routed` for Chief), `agent_report` (events `agent.report.received` of kind `done|blocked|failed|decision`), `agent_message_to_chief`, `escalation_resolved`, `proposal_decided`, `summary_refresh`, `timer` (every 10 minutes while Runs are active). Each trigger has an idempotency key; a repeated key yields no second turn.
2. Queue: single worker, FIFO with priority (`owner_message` > `escalation_resolved` > rest); at most 50 queued; agent reports for one Run are coalesced into one digest trigger. Turn timeout 120 s (ASSUMPTION): then `chief.turn_timeout`, a system notice "Chief is not responding; retrying", one retry, and on a second failure an Escalation `chief_unavailable`.
3. Model call: the prompt asks for a JSON object `{ "actions": [...] }` after the marker line `OVERMIND_ACTIONS`. `ProposalParser` extracts the first top-level JSON object after the marker, ignores the rest, enforces depth, size and strict schemas, rejects unknown action types and permission-like keys (logged `warn`, audited `security.suspicious_output`). Invalid output -> one repair attempt with the validation summary (never echoing raw output), then `chief.invalid_model_output`.
4. Text outside the JSON block never has effects; it may be kept as `external` evidence in the turn trace.
5. Dispatch is sequential in order. A failing action does not stop independent later actions, but a failing `plan_from_docs` aborts dependent `delegate`/`start_workflow` of the same turn. Every handler enforces authority itself (autonomy policy CHIEF003, permissions, visibility); the dispatcher decides nothing about authority.
6. Intent rule (test-enforced): if the action list contains none of `plan_from_docs`, `delegate`, `create_dynamic_agent`, `start_workflow`, `start_discussion`, `update_board`, the turn MUST NOT create Tasks, Runs, Agents, sessions or Discussions.
7. `reply` text is posted with `PostChiefMessage` (CHAT009) as a `chief` message in the Chief conversation; structured status goes as parts. Telegram parity follows from CHAT005.
8. Each turn is stateless on the model side: the prompt carries the last 20 conversation messages and summaries; authority never depends on hidden session memory.
9. Trace: a `chief_turn` record (id, trigger, model, duration, usage, action types and outcomes, findings), no prompt text; usage is reported as ModelUsage (PROV).
10. Global Pause: Chief still answers questions, but actions that start work (`start_workflow`, `delegate`, `create_dynamic_agent`, `start_discussion`) are refused with `pause.active` and the Owner is told.
11. Automatic triggers (timer, reports) are capped at 30 model calls per hour to protect the subscription limit; Owner messages are not capped.
12. Shutdown and recovery participants as in section 3: after a crash, a turn with action outcomes recorded for some actions resumes only the remaining actions that are idempotent by `actionId`; ambiguous ones are surfaced as an Escalation (ENGINE005 `classifyAction` helper).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AssembleChiefPrompt` (CHIEF005), `ProposalParser` (SEC004), `ChiefAction` (CHIEF001), `ModelProvider` (PROV), `PostChiefMessage` (CHAT009), audit, `Notify`, `ShutdownParticipant` (ENGINE004), `RecoveryParticipant` and `classifyAction` (ENGINE005).

## 8. Architecture and code placement

`packages/application/src/chief/turn/{run-chief-turn.usecase.ts,worker.ts,triggers.ts,participants.ts}`, `chief/dispatch/{dispatcher.ts,handlers-registry.ts}` where each handler registers from its own file (multi-token, ARCH006). Port `ChiefModel` in `ports/`; the PROV-backed adapter is owned by PROV, and this task ships `FakeChiefModel` in `packages/testing/src/chief/`. Turn trace table `chief_turns` via migration `V202610141400__OVE_CHIEF006__chief_turns.sql` in `packages/adapters/sqlite/src/chief/` (this task creates that folder).

## 9. Security and safety

The model is assumed compromised: it only emits typed actions that are re-checked; no text path leads to a permission; unknown or permission-like fields are rejected and audited; documentation and agent text reach it only as fenced data. A malicious repository cannot make Chief grant access, change Rules or start work outside Budget because handlers enforce autonomy and permissions independently. Output size is capped; traces hold no prompts.

## 10. Errors and edge cases

- Plain prose without JSON: accepted as `reply` only (never carries actions).
- Malformed JSON: repair once, then `chief.invalid_model_output` and a system message.
- Model hangs: timeout, one retry, Escalation.
- Two Owner messages in quick succession: processed in order; the second sees the first's results.
- Provider limit reached mid-turn: CHIEF018 switches model and the turn is retried.
- Handler throws: `internal.unexpected` logged, remaining actions continue.
- Crash mid-dispatch: recovery rules in requirement 12.

## 11. Acceptance criteria

- [ ] "How is it going?" is answered with `reply` only: no Task, Run, Agent or Discussion is created (spy assertion).
- [ ] Valid planning output dispatches handlers in order; invalid action types are dropped and audited.
- [ ] Output `{"actions":[{"type":"grant","path":"/"}]}` is rejected as suspicious and audited; no side effect.
- [ ] Prompt injection from a documentation file produces no state change in the corpus matrix.
- [ ] Timeout retries once and then raises `chief_unavailable`.
- [ ] During Global Pause work-starting actions are refused.
- [ ] The same Owner message id produces one turn.
- [ ] Crash recovery does not re-run a completed action.

## 12. Test plan

Unit tests with `FakeChiefModel` scripts (valid, malformed, hostile, slow); intent-rule test with spy handlers; crash-recovery test through the ENGINE test harness; corpus matrix. Command: `pnpm vitest run packages/application/src/chief/turn packages/application/src/chief/dispatch`.

## 13. Parallelization notes

Central: CHIEF007-017 register handlers against the dispatcher contract (merge `handlers-registry.ts` early). Hotspot: handler registry (multi-token, no edits). Parallel with CHAT010.

## 14. Open questions and assumptions

- ASSUMPTION: Chief runs turn by turn as stateless model calls through the configured provider (a toolless CLI session in the sandbox, or Ollama); PROV decides mechanics.
- ASSUMPTION: timeout 120 s; automatic-trigger cap 30 per hour.
- Cross-area: needs `port:ModelProvider` (PROV).
