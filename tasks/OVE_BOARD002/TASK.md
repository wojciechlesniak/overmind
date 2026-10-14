---
id: OVE_BOARD002
title: "Implement the Task aggregate, state machine and invariants in the domain layer"
area: BOARD
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_BOARD001]
soft_depends_on: ["OVE_ARCH003"]
provides: ["lib:board-domain", "lib:task-state-machine"]
needs: ["contract:Task", "contract:Lane", "contract:TaskTimelineEntry", "lib:result", "lib:error-catalogue", "port:Clock"]
owns: ["packages/domain/src/board/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 16]
---

# OVE_BOARD002: Implement the Task aggregate, state machine and invariants in the domain layer

## 1. Summary

Implement pure domain logic for Tasks and Lanes: the allowed status transitions, lane-move rules, WIP calculation, progress category mapping, acceptance-criteria handling, and construction of immutable timeline entries. No I/O: all persistence and authorisation orchestration live in the application layer (BOARD005-BOARD010).

## 2. Context

Clean Architecture (CONVENTIONS 6): rules that must hold regardless of who calls (Owner, Chief, Workflow engine) belong in `domain`. ADR 0011: the Board is the source of truth, so its invariants must be enforced in one place and tested exhaustively. ADR 0016: no Task without docRef. SPEC 6: Tasks move through Lanes as Nodes execute; QA failing sends work back (Pętla jakości), so backward moves are legitimate. Timeline immutability supports ADR 0008-style traceability (who moved what and why).

## 3. Scope (in)

- Functions/types in `packages/domain/src/board/`: `createTask`, `moveTask`, `assignTask`, `changeStatus`, `reportProgress`, `setCriteria`, `deferTask`, `unblockTask`, `lanePolicy`, `computeWip`, `categoryOf`, `buildTimelineEntry`.
- Transition tables as data (`transitions.ts`) so adding a status is a table change (OCP).
- Domain errors returned as `Result<_, AppError>` using `board.*` codes.

## 4. Out of scope

- Authorisation of who may call which operation: OVE_BOARD008 (domain only knows `actor.kind` for timeline entries).
- docRef existence checks (I/O): OVE_BOARD006.
- Persistence: OVE_BOARD004. Events: published by use cases, not by domain.

## 5. Detailed requirements

1. **Pure and immutable.** Every function takes the current `Task` (and `Lane`s as needed) and returns `Result<{ task: Task; entry: TaskTimelineEntryDraft }, AppError>`; inputs are never mutated; `version` is incremented by the repository, not here. `now` and ids are injected (`Clock` value passed as `at: IsoDateTime`, ids as parameters).
2. **Status transition table** (`from -> allowed to`):
   - `queued -> working | blocked | deferred | cancelled`
   - `working -> in_review | awaiting_approval | blocked | queued | deferred | cancelled | done` (`done` only when the target lane has `category: 'done'`)
   - `awaiting_approval -> working | blocked | cancelled`
   - `in_review -> working (changes requested) | done | blocked | cancelled`
   - `blocked -> queued | working | cancelled`
   - `deferred -> queued | cancelled` (unblock/restore)
   - `done -> working` only through an explicit `reopen` (recorded as `kind: 'status_changed'` with reason, actor must be owner or chief) ; `cancelled` is terminal.
   Any other pair returns `board.invalid_transition` with `details: { from, to }`.
3. **Lane move rules.** A move changes `laneId` and resets status per target lane category: `todo -> queued`, `doing -> queued` (the Node sets `working` when it starts), `review -> queued` unless the caller passes an explicit allowed status, `done -> done`. Moving to an archived lane, a lane of another board, or the same lane returns an error (`board.lane_not_found`, `board.workspace_mismatch`, `board.invalid_transition`). Backward moves (target position < source position) are allowed and recorded with `reason` (required, 1..200 chars) so the loop "Quality Gate fails -> back to Build" is explainable.
4. **WIP.** `computeWip(lane, tasksInLane)` counts tasks with status not in (`done`, `cancelled`, `deferred`). `wouldExceedWip(lane, count)` is true when `wipLimit != null && count + 1 > wipLimit`. WIP is advisory at the domain level; enforcement policy (hard for system moves, override for Owner/Chief) is in OVE_BOARD008.
5. **Assignment.** `assignTask(task, agentId | null)`: unassign allowed in `queued`, `blocked`, `deferred`; assigning to a different agent while `working` requires `reason`. The domain does not know whether the Agent exists or is visible in the Workspace (application checks via `AgentDirectory`).
6. **Progress.** `reportProgress(task, {done,total,label?})`: `0 <= done <= total`, `total >= 1`; progress may decrease (re-run of tests) but each change creates a `progress` timeline entry only if the ratio changed by >= 5 percentage points or the label changed (avoid timeline spam); the ephemeral event is always emitted by the caller.
7. **Acceptance criteria.** `setCriteria` validates count <= 20, ids unique, `met` may be set to `true` only with an `evidenceRef` (ArtifactRef) present; criteria text edits create a `criteria_updated` entry listing ids changed. A Task cannot be moved to a `done` lane while any criterion has `met !== true` unless the caller passes `waiveCriteria: { reason }` (Owner or Chief only; entry kind `criteria_updated` records the waiver).
8. **Timeline.** `buildTimelineEntry(kind, ...)` produces a draft with `summary` generated from a fixed template per kind (English default text key `board:timeline.<kind>` plus safe params: lane names, status names, counts; never free text from Agents except the `reason` field, which is truncated to 200 chars and control-character stripped). Entries have no setters; the module exports no function that edits an existing entry (static test: grep for `update`/`delete` on timeline in domain exports).
9. **Deferral.** `deferTask(task, {reason, until?})` allowed from `queued|working|blocked`; sets status `deferred`; `until` is informational (a later job may un-defer; not in MVP).
10. **Invariant checker.** `assertTaskInvariants(task, lane)` used in tests and by the repository contract suite: `docRef` present, `laneId` belongs to the same board, `done` status implies done-category lane, `blocked/deferred` imply `statusReason`.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`Result`, `AppError`, `board.*` errors (OVE_ARCH003, OVE_BOARD001); `IsoDateTime` helpers. Table-driven transition data lives only in `transitions.ts` and is reused by the UI via a generated read-only export? NO: the UI never re-implements the table; the gateway exposes allowed next lanes in `TaskDetail` (OVE_BOARD011).

## 8. Architecture and code placement

`packages/domain/src/board/{task.ts,lane.ts,transitions.ts,wip.ts,progress.ts,criteria.ts,timeline.ts,invariants.ts,index.ts}`. Imports only `contracts`. No classes with hidden state; functions plus plain data (KISS). New statuses or lane categories are added by extending the tables, not by editing branching code (OCP).

## 9. Security and safety

The domain is the last line against inconsistent state: a card cannot jump to `done` without a done lane, cannot move across Workspaces, cannot lose history. Untrusted strings (`reason`, `title`) are length-capped and control-character stripped here so downstream renderers and prompt builders never see terminal escape or bidi tricks from a compromised Agent that reports progress; full sanitisation for prompts remains SEC004. Fail closed: unknown status or category values return an error, never a default transition. No secrets are handled.

## 10. Errors and edge cases

- Concurrent edits: the domain returns the new `Task`; the repository applies optimistic locking (`board.version_conflict`, OVE_BOARD004).
- Lane has `wipLimit` smaller than the current count (limit lowered later): `wipExceeded` is true, existing tasks stay; only new entries are refused.
- Reopening a `done` Task whose lane category is `done`: it moves back to the previous `doing` lane or the provided lane; reopen without a target lane returns `board.invalid_transition`.
- Progress with `total` 0: rejected; `done` > `total`: rejected.
- Timeline `summary` template missing for a new kind: a build-time test enumerates all kinds and fails.

## 11. Acceptance criteria

- [ ] Every (from, to) pair in the table is covered by a test; every other pair returns `board.invalid_transition` (generated exhaustive matrix).
- [ ] Moving to a `done` lane requires all criteria met or an explicit waiver by owner/chief.
- [ ] Backward move without `reason` is rejected; with reason it records a `moved` entry with both lane ids.
- [ ] `computeWip` ignores done, cancelled and deferred tasks.
- [ ] Progress timeline spam rule works (4 pp change creates no entry, 5 pp does).
- [ ] No exported function mutates its input or an existing timeline entry (frozen-input test).
- [ ] Property test: any random valid sequence of operations keeps `assertTaskInvariants` true.

## 12. Test plan

- `packages/domain/src/board/*.test.ts`: transition matrix (generated from the table), lane move, WIP, criteria, progress, timeline templates.
- Property test (fast-check if approved in OVE_SETUP008; else a seeded generator in `packages/testing/src/helpers`).
- Commands: `pnpm vitest run packages/domain/src/board`.

## 13. Parallelization notes

Runs in parallel with OVE_BOARD003 after BOARD001. Hotspot: `transitions.ts` is changed only by this task; other tasks needing a new transition file a proposal.

## 14. Open questions and assumptions

- ASSUMPTION: `in_review -> working` models "changes requested"; the loop to an earlier lane is a move, not a status change.
- ASSUMPTION: the 5 percentage point threshold for progress timeline entries; tune after UI feedback.
- Open: whether `reopen` of a `done` Task is allowed for Chief without Owner. Default: yes for Chief and Owner, recorded in the timeline.
