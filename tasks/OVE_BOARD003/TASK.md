---
id: OVE_BOARD003
title: "Define board ports, in-memory fakes, builders and repository contract suites"
area: BOARD
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD001, OVE_BOARD002, OVE_DATA002, OVE_TEST002, OVE_TEST003]
soft_depends_on: ["OVE_TEST003"]
provides: ["port:BoardRepository", "port:TaskRepository", "port:TaskTimelineRepository", "port:BoardReadModel", "port:TaskSearch", "port:TaskBoardSync", "lib:board-fakes", "lib:board-builders", "lib:board-contract-suites", "port:BoardReader"]
needs: ["port:UnitOfWork", "lib:test-utils", "lib:builders", "lib:contract-test-harness", "lib:fake-clock"]
owns: ["packages/application/src/ports/BoardRepository.ts", "packages/application/src/ports/TaskRepository.ts", "packages/application/src/ports/TaskTimelineRepository.ts", "packages/application/src/ports/BoardReadModel.ts", "packages/application/src/ports/TaskSearch.ts", "packages/application/src/ports/TaskBoardSync.ts", "packages/testing/src/fakes/InMemoryBoardRepository.ts", "packages/testing/src/fakes/InMemoryTaskRepository.ts", "packages/testing/src/fakes/InMemoryTaskTimelineRepository.ts", "packages/testing/src/fakes/InMemoryBoardReadModel.ts", "packages/testing/src/builders/board.builder.ts", "packages/testing/src/builders/task.builder.ts", "packages/testing/src/contracts/BoardRepository.contract.ts", "packages/testing/src/contracts/TaskRepository.contract.ts", "packages/testing/src/contracts/TaskTimelineRepository.contract.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11]
---

# OVE_BOARD003: Define board ports, in-memory fakes, builders and repository contract suites

## 1. Summary

Define the application-layer ports for the Board (repositories, read model, search, and the P2 external-sync stub), implement in-memory fakes and deterministic builders, and write the shared contract-test suites that both the fakes and the SQLite adapter (OVE_BOARD004) must pass. Use cases and the gateway can then be built and tested without SQLite.

## 2. Context

OVE_ARCH006 fixes the ports-and-adapters convention (one port per file, DIP). OVE_TEST002 defines the fake and builder conventions and OVE_TEST003 the contract harness (`repository-contract.ts`). SPEC 6 says a later sync with GitHub Issues, Linear or Todoist may come, while the internal Board stays the source of truth (ADR 0011): that is expressed as a port with no implementation (`TaskBoardSync`) so the extension point exists but nothing is built.

## 3. Scope (in)

- Ports (interfaces only) as listed in `provides`.
- `InMemory*` fakes passing the same contract suites as SQLite, with failure injectors.
- Builders `aBoard()`, `aLane()`, `aTask()` validated against the zod schemas.
- Contract suites `BoardRepository.contract.ts`, `TaskRepository.contract.ts`, `TaskTimelineRepository.contract.ts`.

## 4. Out of scope

- SQLite implementation: OVE_BOARD004. Read-model SQL and FTS: OVE_BOARD011.
- Any implementation of `TaskBoardSync`: later / not planned (P2); only the interface and a `NoopTaskBoardSync` live here.

## 5. Detailed requirements

1. **BoardRepository**: `getByWorkspace(workspaceId): Promise<Result<Board | null>>`, `create(board): Promise<Result<Board>>` (unique per workspace), `listLanes(boardId, {includeArchived?}): Promise<Result<Lane[]>>`, `upsertLanes(boardId, lanes: LaneDraft[], expectedBoardVersion?)`, `setWorkflowRef(boardId, {workflowId, workflowVersionId, label})`. Lane identity is `(boardId, key)`.
2. **TaskRepository**: `create(draft): Result<Task>` (assigns `seq` atomically and rejects duplicate `(provenance.discussionId|planId, draftKey)` with `board.duplicate_draft`), `get(id)`, `getForWorkspace(workspaceId, id)` (returns not found when the task belongs to another Workspace: no existence oracle), `update(task, expectedVersion)` (optimistic, `board.version_conflict`), `listByLane(laneId, {limit, cursor, statuses?})`, `countsByLane(boardId)`, `countsByAssignee(boardId)`, `findByDraftKey(source, key)`, `deleteAllForWorkspace(tx, workspaceId)` (only for the cascade participant, OVE_BOARD015).
3. **TaskTimelineRepository**: `append(entry): Result<TaskTimelineEntry>` (assigns gapless per-task `seq`), `list(taskId, {afterSeq?, limit})`. There is NO `update` or `delete` method on the port (structural enforcement of immutability); Workspace deletion goes through `deleteAllForWorkspace(tx, workspaceId)`, which opens a transaction-scoped purge guard (OVE_BOARD004).
4. **UnitOfWork usage:** repositories accept an optional `tx` handle from `UnitOfWork` (DATA) so a use case can write Task + timeline entry + event row atomically (outbox rule, ARCH010 req 5).
5. **BoardReadModel** (read side, CQRS-lite): `getBoardView(workspaceId, filter): BoardView`, `getTaskDetail(workspaceId, taskId): TaskDetail`, `getProgress(workspaceIds[]): WorkspaceProgress[]`. **TaskSearch**: `search(workspaceId, query, {limit}) : TaskCard[]`. **TaskBoardSync** (P2 stub): `pushTask(task): Result<ExternalRef>`, `pullChanges(since): Result<ExternalChange[]>`, plus `NoopTaskBoardSync` returning `board.sync_not_configured`.
6. **Fakes** keep state in `Map`s, implement the same optimistic locking, `seq` counters and uniqueness constraints, support `failNext(method, errorCode)` and expose `snapshot()`. They MUST NOT offer a way to edit timeline rows (a test asserts the class has no such method).
7. **Builders** (`defineBuilder` from TEST002): deterministic ids and seq; `aTask({ lane: 'qa', docRef: 'spec.md#koszyk' })` sugar; `aDefaultBoard()` returns the five mock lanes (`todo`, `build`, `qa`, `review`, `done` with categories todo, doing, doing, review, done).
8. **Contract suites** (functions taking a factory `() => Impl`): seq gapless and unique per Workspace under 50 interleaved creates; duplicate draftKey rejected; optimistic lock; cross-workspace `getForWorkspace` returns not found; timeline append gapless, ordering stable, no mutation API; `countsByLane` matches `listByLane`; deleteAll removes only its Workspace and fails without a transaction handle; deterministic ordering (by lane position, then task `priority`, then `seq`).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

TEST002 `defineBuilder`, `FakeClock`, `FakeIdGenerator`; TEST003 `repository-contract.ts` helpers (pagination, optimistic-lock, tx rollback scenarios). Do not copy these helpers. Ports follow ARCH006 naming and file-per-port rule.

## 8. Architecture and code placement

Ports in `packages/application/src/ports/` (application layer, no I/O). Fakes and builders in `packages/testing` (depends only on application ports and contracts). Contract suites in `packages/testing/src/contracts/`. The SQLite adapter runs the same suites in its own test file (`packages/adapters/sqlite/src/board/*.contract.test.ts`, OVE_BOARD004).

## 9. Security and safety

Port design carries security: `getForWorkspace` removes cross-Workspace id probing; timeline has no mutation methods; purge needs an open transaction handle and is called only by the cascade participant (OVE_BOARD015), which the Workspace deletion runner of DATA012 invokes after Local Approval, so a bug in a use case cannot wipe history. Fakes must behave identically on these points or tests give false confidence.

## 10. Errors and edge cases

- Two concurrent creates racing for `seq`: both succeed with different seq (suite test).
- Duplicate draftKey: returns `board.duplicate_draft` carrying the existing Task id in `details.existingTaskId` (idempotent callers treat it as success).
- Large lanes: `listByLane` is cursor-paginated (default page 100, max 500).
- Repository asked for a Task of a deleted Workspace: not found.

## 11. Acceptance criteria

- [ ] All ports compile and are exported through the generated barrel; no implementation code in `application`.
- [ ] Fakes pass all contract suites; a deliberately broken fake (mutation test of one rule) makes the suite fail.
- [ ] Timeline port exposes no update/delete; `deleteAllForWorkspace` rejects without a transaction handle.
- [ ] Builders produce schema-valid objects; `aDefaultBoard()` matches the five-lane mock.
- [ ] `TaskBoardSync` has only the interface and `NoopTaskBoardSync`.

## 12. Test plan

- Contract suites run against the fakes in `packages/testing/src/fakes/*.test.ts`.
- Builder tests (schema validation, determinism).
- Commands: `pnpm vitest run packages/testing packages/application/src/ports`.

## 13. Parallelization notes

Can run in parallel with OVE_BOARD002 once BOARD001 is merged (ports reference contracts only; the domain is imported for the invariant checker in the suite, so start the suite last). Hotspot: `packages/testing/package.json` additions via proposal (TEST002 rule).

## 14. Open questions and assumptions

- ASSUMPTION: read-model ports (`BoardReadModel`, `TaskSearch`) live with the repositories to keep BOARD small; if BOARDUI later wants a different projection it adds a new port file.
- Open: whether the external sync port should be per provider (GitHub, Linear, Todoist) or generic. Default: generic `TaskBoardSync` with an `ExternalRef { system, id, url? }`.
