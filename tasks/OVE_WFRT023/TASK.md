---
id: OVE_WFRT023
title: Implement the Loop node with iteration, time and cost limits and onExhausted exit
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_WFRT005, OVE_WFRT013]
soft_depends_on: [OVE_WFRT009]
provides: ["node:loop"]
needs: ["lib:result", "port:Clock"]
owns: ["packages/contracts/src/workflow/nodes/loop.config.ts", "packages/domain/src/wfrt/nodes/loop/**", "packages/workflow-runtime/src/handlers/loop/**"]
reads: ["packages/domain/src/wfrt/validation/loop-bodies.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 15, 19]
---

# OVE_WFRT023: Implement the Loop node with iteration, time and cost limits and onExhausted exit

## 1. Summary

The only construct that allows a cycle. Loop counts iterations, enforces limits on iterations, elapsed time and cost, feeds the body with the previous report as feedback and exits through `exhausted` when a limit is hit. This is what makes "failed Quality Gate returns to the Developer; after 5 iterations Escalation" work.

## 2. Context

Mock: frame "Pętla jakości · Build → QA → Review · iteracja 2 z 5", label "limit 90 min · 5 iteracji", dashed return edge "nie spełnia → wróć do Developera z raportem". Validation (WFRT013) guarantees return edges only target `continue`. Scopes: each iteration has scope `<loopKey>:<n>` so nodes in the body get distinct NodeExecutions per iteration.

## 3. Scope (in)

Config, ports, counter state machine, scope push/pop contract with the scheduler, limit checks, events data, rules.

## 4. Out of scope

Cycle validation (WFRT013). Cost accounting source (WFRT039 supplies `usage` per scope). Escalation opening (End `escalated` / WFRT040). Scope handling in the scheduler itself (WFRT033 implements what is specified here).

## 5. Detailed requirements

1. Config: `{ limits: { maxIterations: int 1..50 (default 5), maxDurationMs: int 1000..86400000 (default 5400000), maxCost: { unit: 'tokens'|'usd', amount: number > 0 } (default { unit:'tokens', amount: 2000000 }) }, feedbackSchema?: PortSchema }`. All three limits are required in stored configs (the editor pre-fills defaults); the validator errors when absent (`cycle.loop_limits_missing`, WFRT013).
2. Ports: in `enter`, in `continue` (`multi: true`), out `body`, out `exhausted` (required). `body` payload schema: `{ iteration: integer, limit: integer, input: <enter schema>, feedback: <continue schema | null> }` derived from incoming edges; `exhausted` payload: `{ iterationsDone, reason: 'max_iterations'|'max_duration'|'max_cost', lastFeedback }`.
3. **Handler algorithm.** State `{ iteration: 0, firstEnterElapsed: 0, enterPayloadRef, lastContinueIter: 0 }`. On a token at `enter` (iteration 0) or `continue`:
   1. If the token is a `continue` whose iteration tag is not the current one (`<= lastContinueIter`), drop it (`token.dropped: duplicate_continue`): two body branches may both fail and send `continue`; only the first advances.
   2. Compute next = iteration + 1. Check limits in this order: `next > maxIterations` -> reason `max_iterations`; loop elapsed (monotonic, excludes paused time) `>= maxDurationMs` -> `max_duration`; cost used within this loop scope `>= maxCost.amount` -> `max_cost`.
   3. If a limit is hit: `complete` emitting on `exhausted` and recording `run.loop.exhausted`.
   4. Else `complete` emitting on `body` with scope pushed to `<loopKey>:<next>` and payload per above; record `run.loop.iterated`.
4. **Scope contract.** Tokens emitted on `body` carry scope `parent/<loopKey>:<next>`. Tokens crossing an edge from a body node to a node outside the body (the success path) have the loop scope popped; edges are annotated at plan time using `computeLoopBodies` (WFRT013) and the scheduler (WFRT033) applies it. Tokens to `continue` keep their iteration scope so step 3.1 can compare.
5. **Timers:** the duration limit is also enforced proactively: the handler returns `wait { kind: 'timer', dueAt }` semantics through a loop-level timeout watcher registered by the scheduler (WFRT039), so a stuck body cannot overrun the limit; on expiry the scheduler cancels body executions in the current iteration scope and sends a `timer_fired` signal causing the `exhausted` exit.
6. **Cost:** read from `ctx.loopUsage` (sum of `usage` over executions whose scope starts with this loop prefix since first enter). Usd is used only if the provider reported it; tokens otherwise (ASSUMPTION: CLI subscriptions report tokens, not money).
7. Nested Loops: each has its own counter state keyed by `executionKey` including parent scope; max depth 3 (WFRT013).
8. Rules (in addition to WFRT013): `loop.feedback_schema_missing` (warning: `continue` edges carry untyped payload), `loop.body_has_no_agent` (warning: loop with no work node).
9. Events data: `run.loop.iterated {iteration, limit, elapsedMs, costUsed, viaPort}` and `run.loop.exhausted {...}` as in WFRT009.

## 6. Design notes

N/A, functionality only. The label "iteracja 2 z 5" is rendered from `run.loop.iterated` data (WFED/RUNUI).

## 7. Reuse

`computeLoopBodies` (WFRT013), event shapes (WFRT009), `Clock`. Elapsed accounting is the shared monotonic accumulator of WFRT039; do not implement a second timer mechanism.

## 8. Architecture and code placement

Handler `packages/workflow-runtime/src/handlers/loop/{handler.ts,loop-state.ts}`; definition in domain with derived ports. No I/O.

## 9. Security and safety

This node is the safety valve against runaway loops and cost (SPEC 17: endless loops and exhausted subscription limits). Limits are mandatory and capped; enforcement lives in the runtime, not in UI. A hostile Agent cannot extend limits (config is pinned in the version). Feedback payload is untrusted data passed as a fenced input to the next Agent turn.

## 10. Errors and edge cases

`continue` arriving before `enter` (impossible by structure, defended): fail `wfrt.loop_state_invalid`. Run paused mid-iteration: elapsed excludes paused time. Limit raised by Escalation resolution (`raise_limit`, WFRT040): creates a new Run state patch event; the pinned Version is unchanged. Iteration counter after crash is rebuilt from `loop.iterated` events.

## 11. Acceptance criteria

- [ ] Iterations 1..5 pass `body`; the sixth `continue` leads to `exhausted` with reason `max_iterations`.
- [ ] Duration and cost limits trigger `exhausted` with FakeClock/fake usage.
- [ ] Duplicate `continue` tokens are dropped and logged as events.
- [ ] Nested loop counters are independent.
- [ ] Restart rebuilds the counter exactly.

## 12. Test plan

Unit: pure state machine table; handler tests with fake context; scope tests with the scheduler (WFRT033) once merged; golden fixture loop test (WFRT050). Command `pnpm vitest run packages/domain/src/wfrt/nodes/loop packages/workflow-runtime/src/handlers/loop`.

## 13. Parallelization notes

Parallel with WFRT033 on the scope contract (agree via requirement 4). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: default cost limit 2 000 000 tokens per loop; the Owner adjusts per Workflow.
- ASSUMPTION: `onExhausted` is the `exhausted` port (no separate config); escalation happens because the path leads to an `escalated` End.
