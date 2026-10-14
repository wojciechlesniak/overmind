---
id: OVE_WFRT009
title: Define loop, join, gate and branch event schemas (one file per event)
area: WFRT
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_WFRT006]
soft_depends_on: [OVE_WFRT001]
provides: ["event:run.loop.iterated", "event:run.loop.exhausted", "event:run.join.resolved", "event:run.gate.evaluated", "event:run.branch.paused", "event:run.branch.resumed"]
needs: ["lib:define-event", "contract:EventEnvelope"]
owns: ["packages/contracts/src/events/run.loop.*.event.ts", "packages/contracts/src/events/run.join.*.event.ts", "packages/contracts/src/events/run.gate.*.event.ts", "packages/contracts/src/events/run.branch.*.event.ts"]
reads: ["packages/contracts/src/events/define-event.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 15, 19]
---

# OVE_WFRT009: Define loop, join, gate and branch event schemas (one file per event)

## 1. Summary

Six persisted events for control-flow facts that are not plain node status changes: a Loop iteration started or exhausted, a Join resolved (with policy and member outcomes), a Quality Gate evaluated (with the evidence used), and a branch paused or resumed (Chief-initiated Discussion pause).

## 2. Context

The mock shows "iteracja 2 z 5" and "limit 90 min · 5 iteracji". Join policy all/any/quorum (SPEC 7) needs an auditable record of which branches counted. A Quality Gate decision must be reproducible from recorded evidence (SPEC 7, 15). ADR 0015 / SPEC 6: Chief may pause a Run or only a branch for a Discussion.

## 3. Scope (in)

Six event files.

## 4. Out of scope

Logic of the nodes (WFRT021, 023, 027), pause handling (WFRT042).

## 5. Detailed requirements

Common: persisted, workspace scope, schemaVersion 1, strict. All have `runId`, `nodeKey`, `scope`.

1. `run.loop.iterated`: `iteration: int >= 1` (the iteration being entered), `limit: int`, `elapsedMs` (loop-local), `costUsed`, `viaPort: 'enter'|'continue'`, `feedbackRef?` (token id carried to the body).
2. `run.loop.exhausted`: `iterationsDone`, `reason: 'max_iterations'|'max_duration'|'max_cost'`, `limits`, `exitPort: 'exhausted'`, `escalationRequested: boolean`.
3. `run.join.resolved`: `policy: 'all'|'any'|'quorum'`, `quorum?: int`, `members: [{edgeId, state: 'delivered'|'failed'|'skipped'|'timed_out'}]`, `outcome: 'satisfied'|'unsatisfied'|'timed_out'`, `partialFailure: 'fail'|'continue'|'cancel_others'`, `emittedTokenId?`.
4. `run.gate.evaluated`: `gateKey`, `result: 'pass'|'fail'|'inconclusive'`, `conditionHash`, `evidence: [{name, value (number|boolean|string<=100), trust: 'tool_output'|'review_verdict'|'agent_claim', artifactId?, checksum?}]`, `unmet: [{name, expected, actual?}]`, `reportArtifactId`, `iteration?`. `inconclusive` = required evidence missing; routes like fail.
5. `run.branch.paused`: `branchId`, `nodeKeys: NodeKey[]`, `reason: {kind: 'chief_discussion', discussionId?}`, `by: actor`. Audit true.
6. `run.branch.resumed`: `branchId`, `by`, `outcome: 'owner_decided'|'chief_decided'|'discussion_concluded'|'cancelled'`. Audit true.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineEvent`; `RunLimits` (WFRT003); evidence names come from the gate config (WFRT026/027).

## 8. Architecture and code placement

`packages/contracts/src/events/<type>.event.ts`; generated barrel.

## 9. Security and safety

Gate events list the evidence trust level explicitly so that an `agent_claim` can never be mistaken for proof when auditing. Values are bounded and short; reports live in Artifacts. Pause events are audited with actor.

## 10. Errors and edge cases

Quorum greater than member count is rejected by schema refinement (`quorum <= members.length`). `inconclusive` must have non-empty `unmet`.

## 11. Acceptance criteria

- [ ] Six files with examples, registry and safety tests pass.
- [ ] superRefine rules enforced and tested.

## 12. Test plan

`control-events.contract.test.ts`; command `pnpm vitest run packages/contracts/src/events/run.loop packages/contracts/src/events/run.join packages/contracts/src/events/run.gate packages/contracts/src/events/run.branch`.

## 13. Parallelization notes

Parallel with WFRT007/008.

## 14. Open questions and assumptions

- ASSUMPTION: `branchId` is the `executionKey` of the Parallel node's out-port edge that starts the branch (stable and replayable).

