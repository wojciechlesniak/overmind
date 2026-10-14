---
id: OVE_PROV030
title: Implement the AgentTurnRunner adapter for workflow Agent nodes over the CLI providers
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT014, OVE_ARCH007, OVE_ARCH010, OVE_BOX019, OVE_ENGINE016, OVE_PAUSE001, OVE_PROV001, OVE_PROV009, OVE_PROV010, OVE_PROV015, OVE_PROV017, OVE_PROV025, OVE_PROV027, OVE_PROV029, OVE_WFRT019]
soft_depends_on: [OVE_PROV011, OVE_PROV016, OVE_PROV018]
provides: ["adapter:AgentTurnRunner"]
needs: ["port:AgentTurnRunner", "port:ModelProvider", "port:AgentSessionGateway", "usecase:StartAgentSession", "usecase:ResolveModelForAgent", "usecase:VerifyTurnOutcome", "usecase:RecordModelUsage", "event:agent.report.received", "usecase:RequireIsolation", "port:PauseState", "port:Clock", "port:IdGenerator", "port:EventBus", "port:AuditSink"]
owns:
  - packages/application/src/prov/turn-runner/**
reads: ["packages/application/src/ports/AgentTurnRunner.ts", "tasks/OVE_WFRT019/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 9", "SPECIFICATION 12"]
adr_refs: [2, 7, 22, 26, 27]
---

# OVE_PROV030: Implement the AgentTurnRunner adapter for workflow Agent nodes over the CLI providers

## 1. Summary

Implement the port that the workflow runtime defines for running one turn of an Agent (`AgentTurnRunner`, WFRT019): resolve the pinned model, make sure a session exists, deliver the assembled prompt through the guarded provider, and translate provider events, reports and verification verdicts into the turn events the runtime expects (`state`, `usage`, `artifact`, `completed`, `failed`, `limit_reached`). It never retries a non-idempotent turn on its own.

## 2. Context

WFRT019: `AgentTurnRunner.run(req): Promise<Result<AgentTurnHandle>>` with `req = { runId, executionKey, workspaceId, agentId, pinned: { agentVersion, skills, providerId, modelId }, prompt: AssembledPrompt (opaque), expectJson, timeoutMs, permissionsRef, idempotencyKey }` and `AgentTurnHandle = { turnId, events: AsyncIterable<AgentTurnEvent>, cancel() }` where `AgentTurnEvent = state(working|waiting_approval|login_required|idle) | usage(tokens, usd?) | artifact(artifactId, kind) | completed(finalText) | failed(code, retryable) | limit_reached(resetAt?)`. The node status mapping: `waiting_approval` becomes a waiting node, `login_required` and `limit_reached` use the configured fallback model or fail non-retryably (Escalation by WFRT). Sending is non-idempotent (Spec 12): replays must be safe.

## 3. Scope (in)

- `DefaultAgentTurnRunner` implementing the WFRT port.
- Mapping tables provider events and verdicts to turn events.
- Idempotency by `idempotencyKey`, timeouts and cancel.
- Usage recording and artifact events from Skill reports.

## 4. Out of scope

- Prompt assembly (SEC004 callers), output parsing and repair (WFRT019), retries and dead-letter (WFRT038), fallback decisions (PROV018/Chief), permissions (PERM), the session and provider internals.

## 5. Detailed requirements

1. **Start (`run`):** (a) validate the request (schema; prompt text <= 200 KiB; `timeoutMs` 10 s..3600 s); (b) Global Pause -> `Err(prov.paused)`; (c) `ResolveModelForAgent` in `runtime` mode with `ownerChoice` absent; the `pinned` model is used unless an active fallback record exists for the Agent/Run (source `fallback`), in which case the replayed Run still records both the pinned and the effective model on the turn (callers store them on the NodeExecution); errors `provider.needs_login`/`provider.limit_reached` are returned as the first events `login_required`/`limit_reached` rather than as a start error so the node handler sees the same event vocabulary; (d) `StartAgentSession` if no live session; (e) `permissionsRef` is only used to assert that the mount plan was applied (`PrepareRunMounts` ran inside StartAgentSession); the runner never reads or widens permissions.
2. **Idempotency:** a repeated `run` with the same `idempotencyKey` returns the same `turnId` and re-attaches to the existing event stream (in-memory index plus the delivery journal for the prompt send); it NEVER sends the prompt a second time. If the original delivery ended as `delivery_unknown` the repeat returns a handle whose stream is `failed('provider.delivery_unknown', retryable: false)`.
3. **Send:** through the provider (`ModelProvider.stream`) with `InvokeRequest { invocationId: turnId, agentId, runId, nodeExecutionId: executionKey, model, instruction: prompt.text, requires: [], workspaceId, timeoutMs, idempotent: false, outputSchema? }`; `expectJson` sets the verification expectation `json` (PROV015) and requires the provider capability `json`.
4. **Event mapping:** provider `state` -> `state` (`working`, `waiting_approval`, `needs_login` -> `login_required`, others -> `idle`); `output` -> not forwarded as turn events (text is kept for `completed`); `approval_needed` -> `state(waiting_approval)`; `limit_reached` -> `limit_reached(resetAt?)`; Skill reports with `artifacts` (`agent.report.received` kind `done`) -> `artifact(artifactId, kind)` after the artifact is registered by its owner (this task only forwards ids already created by AGENT014/ARTIFACT use cases; it never registers files itself); usage from the provider result -> `RecordModelUsage` and `usage(tokens)` event (tokens only if reported, no USD invented); final verdict from `VerifyTurnOutcome`: `verified|unverified` -> `completed(finalText)` (the `finalText` is the redacted reply text, bounded at 256 KiB; `unverified` still completes only for `reply|json` expectations), `contradicted(needs_login)` -> `failed('provider.needs_login', retryable: false)` preceded by `login_required`, `contradicted(limit_reached)` -> `limit_reached`, `failed(no_effect|no_reply|output_invalid)` -> `failed(code, retryable: false)`, `blocked(approval)` keeps waiting.
5. **Timeout:** at `timeoutMs` the runner emits `failed('provider.timeout', retryable: false)` and does NOT resend; the session is left as is (interrupt is a separate cancel).
6. **Cancel:** `handle.cancel()` calls `ModelProvider.cancel` (interrupt then stop after grace); the stream ends with `failed('provider.cancelled', retryable: false)`; idempotent.
7. **Retryability rule:** only `provider.unavailable` before any send (session could not start) is `retryable: true`; once the prompt was sent, nothing is retryable by this adapter (WFRT decides via its non-idempotent action policy and Escalation).
8. **Concurrency:** one turn per Agent at a time (second request returns a handle failing with `provider.busy`, retryable true, nothing sent); different Agents run in parallel within limiter slots (acquire happens in `StartAgentSession`).
9. **Audit:** `provider.turn_started`, `provider.turn_finished { turnId, outcome }` (ids, no text); the node execution trace in WFRT records `turnId` and the effective model.
10. **Backpressure:** event stream is an async iterator with a bounded buffer of 200 events (state events coalesced); a slow consumer never blocks the observer.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ModelProvider`/`CliModelProvider` (PROV010/011), `ResolveModelForAgent` (PROV025), `StartAgentSession` (PROV027), `VerifyTurnOutcome` (PROV015), `RecordModelUsage` (PROV017), the WFRT port and event types (WFRT019), `agent.report.received` (AGENT014). No new prompt logic.

## 8. Architecture and code placement

`packages/application/src/prov/turn-runner/{default-agent-turn-runner.ts,event-map.ts,turn-index.ts,verdict-map.ts}`; implements the port file owned by WFRT019 (not edited here). Application layer over ports; no adapter imports. Registered in the provider module (PROV026) under `AgentTurnRunnerToken`.

## 9. Security and safety

The prompt is treated as opaque assembled text (SEC004); this adapter adds no instructions, no permissions and no Owner Rules. Replies and screens are untrusted and only forwarded redacted and bounded. A prompt-injected output cannot make the runner send anything (it sends exactly one prompt per idempotency key). No automatic retry after the send (Spec 12). Pause, isolation and the guard are enforced below (PROV027, PROV008); the runner also checks Pause up front. Artifact ids are forwarded only if they were registered by the trusted report path (ids validated, never paths from the Agent). Fail closed on unknown provider or missing Connection.

## 10. Errors and edge cases

- Login expired before the send: events `login_required` then `failed(needs_login)`; no prompt sent.
- Limit reached during the turn: `limit_reached`; the runtime may pick the fallback for the next attempt (new idempotency key) and PROV018 provides the record.
- Engine restarts mid-turn: the turn index is lost; WFRT recovery re-requests with the same `idempotencyKey`; the delivery journal says `sent` (or `unknown`): the stream is rebuilt from the current session state without resending (verdict derived from verification), or fails non-retryably if the result cannot be established.
- Provider returns both a done report and a contradicting screen: `VerifyTurnOutcome` verdict wins.
- Agent archived mid-turn: provider error passthrough, turn fails non-retryably.
- Same Agent used by two nodes simultaneously: second turn `provider.busy`.

## 11. Acceptance criteria

- [ ] With `FakeModelProvider`/fakes: a normal turn yields `state(working)`, `usage`, `completed(finalText)` in order; `expectJson` with invalid JSON yields `failed('provider.output_invalid')`.
- [ ] Repeating `run` with the same key never triggers a second send (fake gateway records one send) and re-attaches to the stream.
- [ ] Timeout and cancel produce the documented failures with no resend; after `delivery_unknown` the repeat fails with `provider.delivery_unknown`, not retryable.
- [ ] `needs_login`, `limit_reached` and `waiting_approval` produce `login_required`, `limit_reached` and `state(waiting_approval)` events.
- [ ] Only pre-send start failures are `retryable: true`.
- [ ] No prompt or reply text in logs or audit.
- [ ] The adapter passes the `AgentTurnRunner` consumer-contract cases published by WFRT019/WFRT049 (`ScriptedAgentTurnRunner` parity test).

## 12. Test plan

Unit tests for event and verdict mapping tables; idempotency and recovery tests with a fake journal and gateway; integration with `fake-claude` + `FakeHerdr` (login_expired, rate_limit, choice_dialog, done_without_command); parity test against the WFRT scripted runner vocabulary. Commands: `pnpm vitest run packages/application/src/prov/turn-runner`.

## 13. Parallelization notes

Needs the provider and session tasks merged (or fakes). WFRT019 is the consumer; no edits to its port. Hotspot: none (own folder).

## 14. Open questions and assumptions

- ASSUMPTION: `artifact` events only forward artifacts the Skill reported and AGENT014/ARTIFACT registered; Quality Gates still use real evidence.
- Open: whether `usd` should ever be reported (no: subscription CLIs report no cost; left undefined).
