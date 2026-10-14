---
id: OVE_BOARD001
title: "Define Board, Lane, Task and timeline contracts, events and error codes"
area: BOARD
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH008, OVE_ARCH010, OVE_DATA016, OVE_PERM008]
soft_depends_on: []
provides: ["contract:Board", "contract:Lane", "contract:Task", "contract:TaskTimelineEntry", "contract:TaskCard", "contract:TaskDraft", "contract:BoardView", "contract:WorkspaceProgress", "event:task.created", "event:task.moved", "event:task.assigned", "event:task.status_changed", "event:task.deferred", "event:task.progress_reported", "event:board.lanes_changed", "contract:BoardErrors", "event:board.task.status_changed"]
needs: ["lib:define-event", "contract:EventEnvelope", "contract:ProjectDocRef", "contract:Actor"]
owns: ["packages/contracts/src/board/**", "packages/contracts/src/events/task.*.event.ts", "packages/contracts/src/events/board.lanes_changed.event.ts", "packages/contracts/src/errors/board.errors.ts"]
reads: ["docs/architecture/events.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 16, 28]
---

# OVE_BOARD001: Define Board, Lane, Task and timeline contracts, events and error codes

## 1. Summary

Define, as zod schemas (single source of truth), every data shape of the Task Board backend: `Board`, `Lane`, `Task`, `TaskTimelineEntry`, the read-model shapes (`TaskCard`, `BoardView`, `WorkspaceProgress`), the events and the `board.*` error codes. All other BOARD tasks, the gateway, the api-client and the later BOARDUI/WSPACE UI tasks consume these contracts.

## 2. Context

SPEC 6: every Workspace has exactly one Task Board (ADR 0011); the Workflow defines its Lanes (for example Build, QA, Review) and a Task moves through Lanes as Nodes execute. The Board is the source of truth for work (later sync with GitHub Issues, Linear or Todoist is only a port stub). SPEC 14 gives the core fields: `Board / Lane (id, workspaceId, lanes[] with assigned Agent or Team)` and `Task (id, boardId, laneId, docRef, assigneeAgentId, status, originDiscussionId)`. ADR 0016: a Task without a Project Documentation link is rejected or escalated. SPEC 16 criterion 4: Tasks on the Board each carry a docRef. The Owner-facing mock (`tasks/_design/views/Tablica.png`) shows lanes `Do zrobienia`, `Build`, `QA`, `Review`, `Gotowe`, cards `T-31` with a short state label (`pracuje`, `w kolejce`, `testy 38 z 52`, `czeka na Zgodę`, `ocenia`, `✓ Quality Gate`), a docRef chip (`spec.md#koszyk`), an assignee pill (or `nieprzypisane`), a thin progress bar, a deferred counter (`Odłożone · 1`) and a detail panel with origin (Discussion + Decision), a timeline (`Przebieg`) and evidence artifacts. This task fixes the data that makes that view possible. Glossary: Task (Zadanie), Task Board (Tablica Zadań), Lane (Tor).

## 3. Scope (in)

- zod schemas and inferred types in `packages/contracts/src/board/`, one file per entity: `board.ts`, `lane.ts`, `task.ts`, `task-timeline.ts`, `task-draft.ts` (`TaskDraft`, see below), `task-card.ts`, `board-view.ts`, `workspace-progress.ts`, `ids.ts`.
- Event definitions (one file per type) built with `defineEvent` (OVE_ARCH010).
- Error registrations `board.errors.ts` via `defineErrors('board', ...)` (OVE_ARCH003).
- Generated JSON Schema snapshots are produced by the pipeline of OVE_ARCH008 (nothing hand-written).

## 4. Out of scope

- Domain behaviour and state machine: OVE_BOARD002.
- Ports, fakes: OVE_BOARD003; SQL: OVE_BOARD004.
- Gateway request/response envelopes for routes: OVE_BOARD013 (they import the entity schemas defined here).
- `ProjectDocRef` entity itself: DATA (consumed here as `contract:ProjectDocRef`).

## 5. Detailed requirements

1. **Ids.** `BoardId = EntityId<'brd'>`, `LaneId = EntityId<'lan'>`, `TaskId = EntityId<'tsk'>`, `TimelineEntryId = EntityId<'tle'>` (ULID based, OVE_ARCH007). Tasks also have a human sequence `seq: int >= 1`, unique per Workspace, monotonically increasing, never reused (rendered as `T-31`). `seq` is assigned by the repository inside the creating transaction.
2. **Board** (strict): `{ id, workspaceId, workflowId?: WorkflowId, workflowVersionId?: WorkflowVersionId, laneSourceLabel?: string (e.g. 'Workflow "board" v3', shown in the header), createdAt, updatedAt }`. Exactly one Board per Workspace (unique `workspaceId`); created together with the Workspace (OVE_BOARD005).
3. **Lane** (strict): `{ id, boardId, key: string /^[a-z][a-z0-9_]{0,31}$/ (stable identity across Workflow Versions), name: string 1..40, position: int >= 0, category: 'todo' | 'doing' | 'review' | 'done' (drives progress aggregation, OVE_BOARD012), assignee: { kind: 'agent', agentId } | { kind: 'team', teamId } | null, wipLimit: int 1..99 | null, workflowNodeId?: string (the TOR node that owns the lane), archived: boolean, hint?: string (e.g. 'Chief rozdziela, gdy zwolni się slot') }`. Lane `category` is mandatory; the Workflow author (or the default board, OVE_BOARD005) sets it. Unique `(boardId, key)`.
4. **TaskStatus** enum: `queued` (waiting for a slot or for the next Node), `working`, `awaiting_approval` (blocked on an Approval or Access Request), `in_review`, `blocked` (generic block with reason), `deferred` (Owner/Chief postponed it; counted in the `Odłożone` chip), `done`, `cancelled`. The mock labels map as: `pracuje` = working, `w kolejce` = queued, `czeka na Zgodę` = awaiting_approval, `ocenia` = in_review, `✓ …` = done. Free-text card state labels (`testy 38 z 52`) are NOT a status: they are `progress` (below).
5. **Task** (strict): `{ id, seq, workspaceId, boardId, laneId, title: 1..140, description: string <= 8000 (Markdown, rendered sanitised, never executed), docRef: { path: string, anchor?: string <= 120, gitCommit?: string /^[0-9a-f]{7,40}$/, quote?: string <= 400 } (REQUIRED, see OVE_BOARD006), assigneeAgentId: AgentId | null, status: TaskStatus, statusReason?: string <= 300 (required for blocked, deferred), acceptanceCriteria: Array<{ id: string, text: string 1..300, met: boolean | null, evidenceRef?: ArtifactRef }> (max 20), progress?: { done: int >= 0, total: int >= 1, label?: string <= 40 } (e.g. 38 of 52 tests, set by Nodes/Agents via OVE_BOARD008), originDiscussionId: DiscussionId | null, provenance: Provenance, priority: 'normal' | 'high' (ASSUMPTION: two levels only), runId?: RunId (Run currently working on it), version: int (optimistic lock), createdAt, updatedAt, closedAt?: IsoDateTime }`. `Provenance = { origin: 'chief_plan' | 'discussion' | 'owner' | 'workflow_collect' | 'agent_proposal' | 'import', createdBy: Actor, discussionId?, decisionId?, planId?, sourceRunId?, draftKey?: string (idempotency, unique per (discussionId|planId, draftKey)), note?: string <= 300 }`. `agent_proposal` tasks are created only after Chief or Owner accepted them; the Agent never creates Tasks directly (OVE_BOARD006).
6. **TaskTimelineEntry** (append-only, immutable, ADR 0008 spirit): `{ id, taskId, workspaceId, seq: int (per task, gapless), at, actor: Actor, kind: 'created' | 'moved' | 'assigned' | 'status_changed' | 'progress' | 'criteria_updated' | 'evidence_added' | 'gate_result' | 'deferred' | 'unblocked' | 'directive' | 'note' | 'doc_ref_changed', fromLaneId?, toLaneId?, fromStatus?, toStatus?, summary: string <= 200 (already redacted, safe for UI and Telegram), payload: Record<string, JsonValue> (schema per kind, strict), runId?, nodeExecutionId?, eventId?: EntityId<'evt'> }`. The UI line `Quality Gate nie przeszedł · wróciło do Build · 12:52` is `gate_result` + `moved`.
7. **Read-model shapes.** `TaskCard = { id, seq, title, laneId, status, statusLabelKey: string (i18n key, e.g. 'board:status.working'), progress?, docRef: { path, anchor? }, assignee: { agentId, name, avatarInitials, avatarColorToken } | null, hasPendingApproval: boolean, blockedReason?: string, deferred: boolean }`; `BoardView = { board: { id, workspaceId, laneSourceLabel? }, lanes: Array<{ lane: Lane, count: int, wipLimit: int | null, wipExceeded: boolean, cards: TaskCard[], hiddenOlderCount: int }>, deferredCount: int, filter: BoardFilter, generatedAt }`; `BoardFilter = { scope: 'all' | 'my_approvals' | 'blocked', assigneeAgentId?, q?: string <= 200 }`; `WorkspaceProgress = { workspaceId, todo: int, doing: int, review: int, done: int, deferred: int, total: int (todo+doing+review+done), updatedAt }`.
8. **Events** (all persisted unless noted, `scope: 'workspace'`, `visibleTo: ['owner','agent','channel']` except where stated; payloads carry ids and short safe strings only, never descriptions or file content): `task.created {taskId, seq, laneId, title}`, `task.moved {taskId, fromLaneId, toLaneId, reason}`, `task.assigned {taskId, assigneeAgentId|null}`, `task.status_changed {taskId, from, to, reason?}`, `task.deferred {taskId, until?}`, `task.progress_reported {taskId, done, total}` (ephemeral, `persisted: false`), `board.lanes_changed {boardId, added[], renamed[], archived[]}`. Naming follows ARCH010.
9. **Error codes** (`board.<reason>`; http in brackets; `audit` where security-relevant): `board.doc_ref_required` [422], `board.doc_ref_unresolvable` [422], `board.doc_ref_outside_documentation` [403, audit], `board.task_not_found` [404], `board.lane_not_found` [404], `board.lane_not_empty` [409], `board.wip_limit_reached` [409, retryable], `board.invalid_transition` [409], `board.move_not_permitted` [403, audit], `board.version_conflict` [409, retryable], `board.workspace_mismatch` [403, audit], `board.duplicate_draft` [409], `board.criteria_limit` [422], `board.provenance_invalid` [422], `board.history_immutable` [409, audit], `board.creation_rate_limited` [429, retryable], `board.sync_not_configured` [501].
10. All schemas are `.strict()`; string fields trimmed, NFC normalised and length bounded; `title` and `description` reject control characters except `\n\t` (UI-injection hygiene, SEC004 sanitiser is reused at prompt time, not here). `docRef.path` is a relative POSIX path without `..` segments, backslashes or NUL, max 300 chars (validated structurally here, semantically in OVE_BOARD006).
11. **TaskDraft** (strict, used by Discussion outcomes and Chief plans, OVE_BOARD007): `{ draftKey: /^[a-z0-9_-]{1,64}$/, title: 1..140, description?: <= 8000, docRef: { path, anchor?, quote? } (required), acceptanceCriteria?: {text: 1..300}[] (<= 20), assigneeAgentId?: AgentId, laneKey?: string, priority?: 'normal'|'high' }`. It is the single definition of a proposed Task; `Task` creation input is derived from it.
12. Additive-only rule (OVE_ARCH008): new optional fields later; never rename. Schema snapshots committed by the pipeline.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`EntityId`, `IsoDateTime`, `JsonValue` (OVE_ARCH007/008 kernel), `defineEvent` (OVE_ARCH010), `defineErrors` (OVE_ARCH003), `ProjectDocRef` and `Actor` from their owning areas (capabilities `contract:ProjectDocRef`, `contract:Actor`). The Task `docRef` is a subset of `ProjectDocRef` (no workspaceId): import and `.pick()`, never redeclare path rules.

## 8. Architecture and code placement

Layer L0 `packages/contracts` (zod only, no I/O, browser-safe). One file per entity under `packages/contracts/src/board/`; barrels generated (OVE_ARCH009). Events one file per type under `packages/contracts/src/events/`. Errors in `packages/contracts/src/errors/board.errors.ts`. Nothing here imports `domain`. Consumers: domain (types), application (use cases), gateway, api-client, desktop (types only).

## 9. Security and safety

Contracts are the first validation barrier: strict objects reject unknown keys (no smuggled `permissions` field on a Task), string and array lengths are bounded (denial of storage), `description` is data and is never interpreted (rendering sanitised per SR-35; prompt use goes through SEC004). Event payloads exclude descriptions and paths beyond the docRef path so Telegram-visible events leak nothing sensitive (`summary` strings are redacted before they reach the schema). `Provenance.createdBy` is set by the server from the authenticated caller, never accepted from a request body (enforced in OVE_BOARD013). The history entries are immutable by contract: there is no update schema for `TaskTimelineEntry`.

## 10. Errors and edge cases

- `acceptanceCriteria` with 21 entries: `board.criteria_limit`.
- `progress.done > progress.total`: schema refine fails (`validation.invalid_input`).
- `status: blocked` or `deferred` without `statusReason`: schema refine fails.
- `docRef.path` containing `..`, absolute path, backslash, NUL, or longer than 300 chars: rejected.
- Unknown `provenance.origin`: rejected; clients on an older version receive unknown enum values only in read models and must render a generic label (additive enum rule).
- `Lane.category` missing in a stored lane (never expected): treated as `doing` by read models, logged `warn`.

## 11. Acceptance criteria

- [ ] All schemas exist, are strict, and infer the types listed above; JSON Schema snapshots are generated.
- [ ] A fixture Task without `docRef` fails validation with the `board.doc_ref_required` mapping available in the registry.
- [ ] Every event is registered with the naming rule of ARCH010 and has `expectEventSafe` passing on a sample payload.
- [ ] Every error code has http, severity, messageKey, defaultMessage and (where listed) `audit: true`; duplicate-code registry test passes.
- [ ] Refinements for `progress`, `statusReason`, path structure and criteria count are covered by tests.
- [ ] No runtime dependency other than zod and sibling contracts.

## 12. Test plan

- `packages/contracts/src/board/*.test.ts`: valid and invalid fixtures per entity (table-driven), `expectTypeOf` checks for inferred types.
- `packages/contracts/src/events/task.*.event.test.ts`: create/is round trip with `FakeClock`/`FakeIdGenerator`, `expectEventSafe`.
- Registry test for error codes (shared with ARCH003 scan).
- Commands: `pnpm vitest run packages/contracts/src/board packages/contracts/src/events`, `pnpm typecheck`.

## 13. Parallelization notes

Merge first within BOARD; BOARD002 and BOARD003 start from the merged schemas. DISC, DEC, MEM tasks reference `contract:Task` / `contract:TaskCard` only through capability names. Hotspot: none (generated barrels).

## 14. Open questions and assumptions

- ASSUMPTION: `priority` has two levels only (`normal`, `high`); the mock shows no priority.
- ASSUMPTION: assignee on a Lane may be an Agent or a Team (Teams are post-MVP; the `team` variant is in the schema but unused in the MVP).
- Open: whether Tasks may have sub-tasks or dependencies between Tasks. Default: no (not in SPEC 14); a flat Board.
