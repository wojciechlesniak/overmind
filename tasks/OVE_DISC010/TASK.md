---
id: OVE_DISC010
title: "Enforce Discussion budgets, timeouts, Global Pause and escalation on failure"
area: DISC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_CHIEF015, OVE_DATA002, OVE_DISC006, OVE_NOTIF004, OVE_PAUSE001, OVE_PAUSE005, OVE_PERM008, OVE_PERM020, OVE_PROV035]
soft_depends_on: ["OVE_DISC009"]
provides: ["usecase:discussion.enforce-limits", "usecase:discussion.on-pause-changed"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:BudgetService", "port:PauseGate", "event:pause.changed", "usecase:escalation.raise", "port:NotificationPublisher"]
owns: ["packages/application/src/discussion/limits/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 12, 16]
---

# OVE_DISC010: Enforce Discussion budgets, timeouts, Global Pause and escalation on failure

## 1. Summary

Make every Discussion bounded: per-turn and overall timeouts, turn and token/cost caps against the Budget service, behaviour under Global Pause, and what happens on failure (Escalation, branch kept paused, Owner notified). No Discussion may run, spend or wait forever.

## 2. Context

SPEC 6: the round limit exists; SPEC 12/16.14: Budgets, timeouts, Global Pause and parallelism limits are enforced by the engine; SPEC 11: exceeding the Budget is on the default consent list. ADR 0015: Chief may rule only within Budget. Models are CLI subscriptions in MVP, so cost is mostly time and usage percentage, not money; `costUnits` is optional.

## 3. Scope (in)

- `beforeTurn` limit checks hook, usage recording, timeout watchdog, pause/resume reactions, failure escalation, budget warnings at 80%.

## 4. Out of scope

- The `BudgetService` implementation (PROV/WFRT). Approval requests for exceeding budget: PERM. Chief ruling: DISC011.

## 5. Detailed requirements

1. **Limits** (from `DiscussionConfig`): `turnTimeoutMs` (default 180 s), `discussionTimeoutMs` (default 45 min), `maxTurnsTotal`, `budget.maxTokens`, `budget.maxCostUnits`, and the external `BudgetService.check({ workspaceId, runId? }, estimate)`. `beforeTurn` (hook registered into DISC006) evaluates domain `checkLimits` plus the service; any exceeded limit stops further turns BEFORE the model call.
2. **Reaction table:** `discussion_timeout` or `max_turns` -> status via the deadlock path if at least one full round exists (Chief ruling may use what exists), else `failed`; `tokens/cost/BudgetService exceeded` -> `failed` with `disc.budget_exceeded` and an Escalation `budget_exceeded` (SPEC 11: exceeding Budget needs the Owner's Approval; this task only raises the Escalation, never overrides). 80% usage emits `discussion.budget.warning` once.
3. **Turn timeout watchdog:** a timer through `JobScheduler` (uses `Clock`) calls `DiscussionTurnRunner.cancel(idempotencyKey)` at `turnTimeoutMs`; the turn is recorded `timeout`. Timers survive restart via persisted `pending_turn.startedAt` (DISC006 recovery).
4. **Usage accounting:** after each turn `BudgetService.record({ workspaceId, runId, discussionId, usage })`; usage persisted on the message; totals available to the read model.
5. **Global Pause:** subscriber on `pause.changed`: when paused, no new turn starts (the runner checks `PauseGate` before every step); the current turn is cancelled via the runner cancel only if the Pause policy says so (ASSUMPTION: let the in-flight turn finish, since turns are short, but do not start the next); status shown `paused` with `pausedBy: 'global'` in `run_control_json`; on resume the runner continues from persisted state. Discussions scheduled during Pause start after resume.
6. **Failure escalation:** on `failed` (participants too few, budget, repeated moderator failure, `security.prompt_too_large`) call `usecase:escalation.raise({ kind: 'discussion_failed', discussionId, reasonCode })`, notify the Owner, keep the branch paused (DISC008 does not auto-resume on `failed`), record a `system_notice` with a safe reason code.
7. **Parallel slots:** the runner claims one Agent slot per turn through the engine's concurrency limiter (default 3 installation-wide); when no slot is free the step returns `next: 'schedule_later'` with backoff (ASSUMPTION; the limiter port is `port:AgentSlotLimiter` from WFRT/PROV; if absent the step proceeds).
8. **Idempotent warnings and escalations:** each limit event is emitted once per Discussion (guard in `run_control_json.flags`).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DISC002 `checkLimits`; `BudgetService`, `PauseGate`, `JobScheduler`, `usecase:escalation.raise`; outbox.

## 8. Architecture and code placement

`packages/application/src/discussion/limits/{before-turn.ts,watchdog.ts,pause.subscriber.ts,failure.ts,usage.ts}`. Hooks registered via the DISC006 extension points.

## 9. Security and safety

Denial-of-wallet and denial-of-service controls: a looping Chief or compromised Agent cannot drive unbounded turns, tokens or wall-clock time. Limits are enforced by code from stored config, never from model output. Budget exceed is never auto-approved. Global Pause is honoured at every step boundary so no new model call starts while paused. Failure paths are fail-closed (branch stays paused, Owner informed) and audited.

## 10. Errors and edge cases

- Clock jumps (sleep/wake): timeouts compare monotonic persisted timestamps; after wake an overdue turn is recorded `timeout`, no replays.
- Budget service unavailable: fail closed, no new turns, `warn`, retry with backoff.
- Pause during moderator turn: the moderator turn completes, no next step.
- Pause then Owner cancels: allowed.
- Limits changed in config mid-run: not possible (config is immutable after start).

## 11. Acceptance criteria

- [ ] Exceeding `maxTurnsTotal`, wall-clock, tokens or Budget stops turns before the next model call with the specified status.
- [ ] A timed-out turn is cancelled and recorded; the Discussion continues.
- [ ] No turn starts while Global Pause is active; resume continues from persisted state.
- [ ] Budget exceed raises an Escalation and never overrides the Budget.
- [ ] Failure keeps the Run branch paused and notifies the Owner once.
- [ ] 80% warning emitted exactly once.

## 12. Test plan

- `before-turn.test.ts`, `watchdog.test.ts` (FakeClock), `pause.subscriber.test.ts`, `failure.test.ts`, scenario with `FakeDiscussionTurnRunner` `slow`/`cost` scripts. Commands: `pnpm vitest run packages/application/src/discussion/limits`.

## 13. Parallelization notes

Parallel with DISC007-009.

## 14. Open questions and assumptions

- ASSUMPTION: in-flight turn completes on Global Pause; only new steps are blocked.
- ASSUMPTION: slot limiter port name `port:AgentSlotLimiter`; confirm with WFRT/PROV.
