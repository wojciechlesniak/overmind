---
id: OVE_BOARD008
title: "Implement Task move, assign, status and progress use cases with authorisation and WIP"
area: BOARD
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_BOARD002, OVE_BOARD003, OVE_DATA002, OVE_DATA018, OVE_PAUSE005, OVE_PERM008, OVE_PERM020]
soft_depends_on: ["OVE_BOARD006"]
provides: ["usecase:board.move-task", "usecase:board.assign-task", "usecase:board.change-status", "usecase:board.report-progress", "usecase:board.add-evidence", "usecase:board.note-directive", "usecase:AssignTask", "usecase:UpdateTask"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:AgentDirectory", "port:ArtifactRepository", "port:PauseGate"]
owns: ["packages/application/src/board/task-ops/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 16, 23]
---

# OVE_BOARD008: Implement Task move, assign, status and progress use cases with authorisation and WIP

## 1. Summary

Implement the use cases that change an existing Task: move between Lanes, assign, change status, report progress, add evidence and record an Owner directive, with a clear authorisation matrix (who may move cards), WIP limit enforcement, optimistic locking and an append-only timeline entry for every change.

## 2. Context

SPEC 6: Tasks pass through Lanes as Nodes execute. The reviewer question in this task: "who may move cards" and "what if two things move the same card". Agents report progress and completion through the `overmind` Skill (ADR 0027) but their reports are declarations, not proof (SPEC 9, ADR 0026); the Workflow engine, Chief and Owner are the actors that change position. ADR 0023 + SPEC 16.11: when the Owner commands an Agent directly, the Agent informs Chief, who updates plan and Board; the timeline should show the directive. Mock: card chips (`pracuje`, `w kolejce`, `testy 38 z 52`) and the `PRZEBIEG` timeline in the detail panel.

## 3. Scope (in)

- Use cases: `moveTask`, `assignTask`, `changeStatus`, `reportProgress`, `addEvidence`, `noteDirective`.
- Authorisation matrix, WIP enforcement policy, optimistic locking, events and timeline.
- Global Pause behaviour for engine-driven moves.

## 4. Out of scope

- Defer/block/unblock (they have their own rules): OVE_BOARD009. Binding to Node executions: OVE_BOARD010. HTTP routes: OVE_BOARD013.
- Evidence artifact creation: DATA/WFRT (this task only links an existing `ArtifactRef`).

## 5. Detailed requirements

1. **Authorisation matrix** (checked first, from `actor.kind`; unknown kind denied):
   | Operation | owner | chief | system (Workflow engine via binding) | agent | channel(Telegram owner) |
   |---|---|---|---|---|---|
   | move to another lane | yes | yes | only through BOARD010 binding for the Run's own Task | no (may `requestMove` as a timeline `note`, no state change) | yes, forward or backward, desktop-equivalent (ASSUMPTION, no permission effect) |
   | assign / unassign | yes | yes | yes (binding) | no | yes |
   | change status | yes | yes | yes (limited to working, queued, in_review, awaiting_approval, done by gate) | only `reportProgress` and evidence on a Task assigned to itself | no |
   | report progress | yes | yes | yes | yes, own assigned Task only | no |
   | add evidence | yes | yes | yes | yes, own Task, existing artifact only | no |
   Denied attempts return `board.move_not_permitted` and write an audit event with actor, task id, operation (never the payload). An `agent` identity is derived from the authenticated agent session, never from request text.
2. **moveTask(input: { taskId, toLaneKey|toLaneId, reason: string 1..200, expectedVersion, overrideWip?: boolean })**: loads Task + lanes; domain `moveTask`; WIP check on the target lane: if `wouldExceedWip` then (a) owner/chief with `overrideWip: true` proceed and the timeline records `payload.wipOverride = true`; (b) system moves are not overridden: the Task stays in its lane with status `queued` and the use case returns `err(board.wip_limit_reached, { laneId, limit })` so BOARD010 can retry when a slot frees (this renders as "w kolejce"); (c) otherwise reject `board.wip_limit_reached`. Moves are recorded with `reason`; backward moves require `reason` to start with a machine-readable code when system (e.g. `quality_gate_failed`), displayed through i18n.
3. **assignTask(taskId, agentId|null, reason?)**: checks `AgentDirectory.isUsableIn`; assigning to an Agent whose lane assignee differs is allowed (the Lane assignee is a default, not a lock); records `assigned` entry; event `task.assigned`.
4. **changeStatus(taskId, to, reason?)**: domain table; `awaiting_approval` is set only by the system actor (approval engine) and cleared on decision; `done` only via a move to a done-category lane or by system after Quality Gate evidence (the use case requires `evidenceRefs.length >= 1` or `gateResultRef` from the system actor for `done` coming from `in_review`; Owner/Chief may mark done manually with `reason`). Agent reports "finished" are stored as `note` + `progress`, never as `done`.
5. **reportProgress(taskId, { done, total, label? })**: updates `progress`, emits ephemeral `task.progress_reported`; timeline entry only on the threshold rule of BOARD002. Rate limit: max 1 call per Task per second (coalesced); extra calls return ok without write.
6. **addEvidence(taskId, { artifactId, kind: 'test_report' | 'scan_report' | 'trace' | 'other', summary? })**: verifies via `ArtifactRepository` that the artifact exists in the same Workspace and returns its checksum; stores a reference in the `evidence_added` timeline payload (id, name, checksum) so the detail panel shows `unit-report.xml`, `e2e-trace.zip`. Evidence files are never read here.
7. **noteDirective(taskId|workspaceId, { messageId, targetAgentId, summary })**: invoked by AGENT/CHIEF when the Owner commanded an Agent directly (SPEC 16.11); appends a `directive` timeline entry on the affected Task(s) (`summary` truncated 200 chars, safe template) and returns; it changes no status or lane (Chief's replanning does that via the other use cases).
8. **Concurrency:** all operations take `expectedVersion`; mismatch -> `board.version_conflict` (retryable; callers reload). Each operation is one `UnitOfWork`: task update + timeline entry + event row; publish after commit.
9. **Global Pause:** system-initiated operations check `PauseGate.isPaused(workspaceId)`: when paused, engine-driven moves are refused with `pause.active` (so no card advances while paused); Owner and Chief manual operations remain allowed (Owner reorganising the Board during a pause is legitimate; Chief is also stopped by Pause upstream).
10. **Idempotency:** moving to the lane the Task is already in with the same `reason` and actor within 5 s returns ok without a new timeline entry (double-click / retry); otherwise same-lane move is `board.invalid_transition`.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Domain functions from BOARD002 for every state change; `UnitOfWork`/outbox, `AuditLog`, `PauseGate`, `AgentDirectory`, `ArtifactRepository`. The authorisation matrix is data (`authz-matrix.ts`) with a test; no scattered `if (actor.kind === ...)` checks elsewhere.

## 8. Architecture and code placement

`packages/application/src/board/task-ops/{authz-matrix.ts,move-task.ts,assign-task.ts,change-status.ts,report-progress.ts,add-evidence.ts,note-directive.ts,wip-policy.ts}`. Depends on ports; no I/O. Events defined in BOARD001 are only published, not redefined.

## 9. Security and safety

Core abuse case: a compromised or injected Agent tries to move its own card to Done, to move other Agents' cards, to spam progress, or to attach someone else's artifact as evidence. Mitigations: agents cannot move or change status; actor kind derives from the authenticated session; evidence must be an existing Artifact of the same Workspace; agent progress is rate limited and never `done`; every denial is audited; claims such as "tests passed" never change state without evidence the system actor attaches (SEC004 R4, SPEC 9). Telegram can reorganise cards but cannot change permissions or Rules (ADR 0006; no permission effect exists in this area). Owner directive notes are references only (message id), so quoted instructions cannot become Task data.

## 10. Errors and edge cases

- Task in a different Workspace than the caller context: `board.workspace_mismatch` (audited) or not found when probing.
- Target lane archived: `board.lane_not_found`.
- Two simultaneous moves: first wins, second `board.version_conflict`.
- Done Task moved: only through `reopen` flow (BOARD002), owner/chief.
- `reportProgress` with stale `total`: accepted (latest wins).
- Evidence artifact deleted afterwards: timeline keeps the reference; UI shows it as unavailable.
- Pause lifted: queued system moves are retried by BOARD010, not here.

## 11. Acceptance criteria

- [ ] Authorisation matrix test covers every operation x actor kind; denials audited.
- [ ] Agent attempts to move or mark done fail and leave the Task unchanged.
- [ ] WIP: system move into a full lane is refused and the Task stays queued; Owner override succeeds and is recorded.
- [ ] Every successful operation writes exactly one timeline entry (except coalesced progress) and one event row atomically.
- [ ] Concurrent move test yields exactly one winner.
- [ ] Evidence from another Workspace is rejected; valid evidence appears in the timeline payload.
- [ ] Moves by the system actor are refused while Global Pause is active.
- [ ] A directive note changes no lane or status.

## 12. Test plan

- `authz-matrix.test.ts` (generated table), `move-task.test.ts`, `assign-task.test.ts`, `change-status.test.ts`, `report-progress.test.ts`, `add-evidence.test.ts`, `note-directive.test.ts`, all on fakes with failure injection and `FakeClock`.
- Abuse tests listed in OVE_BOARD014 reuse these use cases.
- Commands: `pnpm vitest run packages/application/src/board/task-ops`.

## 13. Parallelization notes

Parallel to BOARD005/006/007. BOARD009 builds on the same folder structure but different files. Hotspot: `authz-matrix.ts` is owned here; other tasks add operations by proposal.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram (owner_remote) may move and assign cards but not change status or create Tasks.
- ASSUMPTION: Owner and Chief may move without `overrideWip` only when within the limit; override is explicit.
- Open: should an Agent be allowed to move its own card forward when the Workflow defines no Node for that lane? Default: no.
