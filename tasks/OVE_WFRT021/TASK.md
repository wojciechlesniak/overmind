---
id: OVE_WFRT021
title: Implement the Join node with all/any/quorum policy, timeout and partial failure
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_WFRT005, OVE_WFRT020]
soft_depends_on: [OVE_WFRT009]
provides: ["node:join"]
needs: ["lib:result", "port:Clock"]
owns: ["packages/contracts/src/workflow/nodes/join.config.ts", "packages/domain/src/wfrt/nodes/join/**", "packages/workflow-runtime/src/handlers/join/**"]
reads: ["packages/domain/src/wfrt/nodes/types.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 19]
---

# OVE_WFRT021: Implement the Join node with all/any/quorum policy, timeout and partial failure

## 1. Summary

Join waits for tokens from its incoming edges according to a policy (`all`, `any` or `quorum n`), merges their payloads into one object, applies a timeout and decides what to do when some branches fail or are skipped.

## 2. Context

Mock: "join · wszyscy" (all). SPEC 7: "Join: policy all, any or quorum, timeout and behaviour on partial failure." A Join is the only node whose `in` port accepts several edges (WFRT011 `graph.implicit_merge`). Members are the incoming edges, fixed at publish time; tokens are grouped by scope so Joins inside Loop iterations stay separate.

## 3. Scope (in)

Config, derived output schema, state machine of a Join execution, timer use, validation rules, handler.

## 4. Out of scope

Scheduler skip propagation and member state notifications (WFRT033 tells the handler about `failed`/`skipped` members via `tokens_arrived`-style signals). Cancelling other branches (driver, WFRT036/042).

## 5. Detailed requirements

1. Config: `{ policy: 'all'|'any'|'quorum', quorum?: int >= 1 (required iff quorum, <= member count, checked statically), timeoutMs: int (default 3 600 000, min 1 000, max Run max duration), onPartialFailure: 'fail'|'continue'|'cancel_others' (default 'fail'), cancelRemainingOnSatisfied: boolean (default true for any, false otherwise) }`.
2. Ports: in `in` (`multi: true`, required), out `out`. Output schema derived by `ports(config, incoming)` (WFRT005): `{ type:'object', properties: { results: { type:'object', properties: { <memberKey>: <member schema> }, required: all-members-for-policy-all }, missing: array<string>, failed: array<string> } }` where `memberKey` is the source node key (or `node.port` if one node feeds twice).
3. **Member states:** `waiting`, `delivered` (token in scope), `failed` (source execution final failed or cancelled by error), `skipped` (source skipped, for example IF branch not taken), `timed_out`.
4. **Resolution rules (evaluated on every signal and timer):**
   - `all`: satisfied when no member is `waiting`, at least one is `delivered` and none is `failed`/`timed_out`. If every member is `skipped` the Join itself is skipped.
   - `any`: satisfied at the first `delivered`.
   - `quorum n`: satisfied when `delivered >= n`; unsatisfiable (can no longer reach n) as soon as `delivered + waiting < n`.
   - Unsatisfiable or timeout expiry or (for `all`) any `failed`: apply `onPartialFailure`: `fail` -> `fail` step `wfrt.join_unsatisfied` (retryable false), listing member states; `continue` -> `complete` with the results gathered and `missing`/`failed` filled (only allowed when at least one member delivered, else fail); `cancel_others` -> same as `fail` but the engine additionally cancels still-running members (intent flag `cancelMembers: true`).
   - When satisfied and `cancelRemainingOnSatisfied`, the engine cancels remaining members' executions in this scope with reason `join_any_satisfied`.
5. Timer: on first token the handler returns `wait { kind: 'timer', dueAt: firstArrival + timeoutMs }`; `dueAt` is persisted in `node.waiting`, re-armed after restart (WFRT043). Time source is the `Clock` port via context `now`. Elapsed is monotonic-based (WFRT001 §8).
6. Handler is a pure state machine: node-local state `{ members: Record<edgeId, state>, tokens: Record<edgeId, tokenId>, firstAt }`, updated on each `onSignal('tokens_arrived' | 'timer_fired' | member state change)`; emits `join.resolved` data via the step's `events` hint (`run.join.resolved` fields, WFRT009).
7. Token ordering: results merged by sorted member key so output is deterministic regardless of arrival order.
8. Rules: `join.quorum_range`, `join.timeout_range`, `join.single_input` (warning: only one incoming edge), `join.members_not_parallel` (warning: members do not originate from a common Parallel, only a hint), `join.policy_all_with_conditional` (warning: an `all` Join whose members include a branch behind an IF; skipped members are tolerated but flagged).

## 6. Design notes

N/A, functionality only. The canvas shows the Join as a small ring labelled "join · wszyscy" (WFED).

## 7. Reuse

`Clock` via context (WFRT005), event hint types (WFRT009), registry. Member list helper `incomingEdges(nodeKey)` from `DefinitionGraph` (WFRT010) via the run plan (WFRT033).

## 8. Architecture and code placement

Config in contracts; domain definition with derived ports; handler `packages/workflow-runtime/src/handlers/join/{handler.ts,join-state.ts}` (pure reducer functions for member states, unit-tested separately).

## 9. Security and safety

Policy `any` and `continue` can let work proceed with partial inputs; the validator warns and the Gate/Review downstream stays authoritative. Timeouts guarantee no Run hangs forever on a lost branch. Merged payloads keep the `untrusted` trust flag if any member was untrusted.

## 10. Errors and edge cases

Token arrives after Join resolved (late member in `any`): dropped with `run.token.dropped` (`scope_closed`). Duplicate token from the same member in a scope: ignored, first wins. Timer fires while the Run is paused: handled when resumed (the timer is re-evaluated against elapsed time that excludes paused time). Quorum 1 equals `any`.

## 11. Acceptance criteria

- [ ] Table-driven tests for all policies x member-state combinations pass (at least 40 rows).
- [ ] Timeout path and each `onPartialFailure` value tested with FakeClock.
- [ ] Output is identical for any arrival order.
- [ ] Late tokens are dropped and reported.
- [ ] Restart test: state rebuilt from events keeps `firstAt` and `dueAt`.

## 12. Test plan

Unit: pure state machine; handler with fake context; property test (random arrival orders, same result). Command `pnpm vitest run packages/domain/src/wfrt/nodes/join packages/workflow-runtime/src/handlers/join`.

## 13. Parallelization notes

Parallel with other nodes; depends on Parallel only for fixtures.

## 14. Open questions and assumptions

- ASSUMPTION: skipped members count as resolved-not-delivered for `all`; this keeps IF-gated Joins from deadlocking.

