---
id: OVE_DATA012
title: Implement Workspace deletion with the cascade participant extension point
area: DATA
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DATA002, OVE_DATA005, OVE_DATA006, OVE_DATA011, OVE_PERM031]
soft_depends_on: []
provides: ["usecase:PreviewWorkspaceDeletion", "usecase:DeleteWorkspace", "port:WorkspaceCascadeParticipant", "api:workspaces.delete_preview", "api:workspaces.delete", "table:pending_cleanups", "port:WorkspaceCascadeRegistry"]
needs: ["port:UnitOfWork", "port:LocalApprovalGate", "port:EventStore", "port:Clock"]
owns: ["packages/application/src/ports/WorkspaceCascadeParticipant.ts", "packages/application/src/data/workspace-delete/**", "packages/gateway/src/routes/data/workspaces-delete*.route.ts", "apps/engine/src/composition/modules/data-workspace-delete.module.ts", "packages/adapters/sqlite/src/workspace/cascade-runner.ts", "packages/adapters/sqlite/src/events/cascade-events.ts", "packages/adapters/sqlite/migrations/V202610130021__OVE_DATA012__create_pending_cleanups.sql"]
reads: ["packages/application/src/ports/WorkspaceRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 11"]
adr_refs: [8, 28]
---

# OVE_DATA012: Workspace deletion with a cascade extension point

## 1. Summary

Deleting a Workspace removes its Decisions, Board, Agent Memory of that Workspace and its private Agents, Skills and Workflows after a Local Approval with a warning. Each area plugs in its own deletion through a multi-provider port.

## 2. Context

ADR 0008 allows this one exception to append-only: the Owner may delete a whole Workspace. Public Agents, Skills and Workflows survive; only private ones owned by this Workspace go (ADR 0028). Event rows are removed through the guarded path of DATA005 and the hash chain re-anchored (DATA006).

## 3. Scope (in)

- `WorkspaceCascadeParticipant` multi-token port and the runner.
- `PreviewWorkspaceDeletion`, `DeleteWorkspace`, routes.
- Event-log purge with chain tombstone; pending external cleanups table.

## 4. Out of scope

- Participants of other areas (DEC, BOARD, MEM, AGENT, SKILL, WFRT, CHAT, PERM, DATA Artifact): each ships its own. Old backups still contain the data (BACKUP documents it).

## 5. Detailed requirements

1. Port (`multiToken`): `id` (unique), `order` (events 900, Workspace row 1000 are internal), `preview(workspaceId) -> Result<Record<string, number>>`, `deleteFor(tx, workspaceId) -> Result<{deleted:number}>` (must not touch other Workspaces), optional `describeExternal(workspaceId)` for post-commit cleanups (files, volumes).
2. `PreviewWorkspaceDeletion`: Owner-only, read-only; returns `WorkspaceDeletionPreview` (DATA009); refuses with `data.workspace_has_active_runs` (listing Run ids) while any Run is running or waiting.
3. `DeleteWorkspace { id, confirmName, expectedVersion }`: (a) `confirmName` equals the name exactly; (b) `LocalApprovalGate.require({ action: 'workspace.delete', target: id })` returns a grant bound to the id; (c) one transaction: `markDeleting`, participants in `order`, purge events (sets `event_log_admin.allow_delete`, deletes, appends `chain.reanchored` tombstone and `workspace.deleted` with name and counts, resets flag), `hardDelete`; (d) after commit run external cleanups best effort; failures stay in `pending_cleanups` and retry at next start.
4. All-or-nothing: any participant error rolls back everything; the `deleting` mark is inside the transaction so a crash leaves the Workspace active. This named transaction uses `timeoutMs: 60000`.
5. Table `pending_cleanups(id TEXT PK, workspace_id TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`; ref is an id or relative path, no absolute host paths.
6. Completeness test: tables marked `-- workspace-scoped: yes` in migrations must each be covered by a registered participant (declared in the participant via `tables: string[]`); otherwise CI fails ("data would survive deletion"). Duplicate participant ids abort startup.
7. Routes (Owner scope only, never Telegram or Agent): `GET /v1/workspaces/{id}/deletion-preview`, `POST /v1/workspaces/{id}/delete` (`idempotency: key-required`).
8. `workspace.deleted` (`audit: true`) remains as the only trace (name, counts, time); the warning text key `workspace.delete.warning` says so.
9. Cross-Workspace links such as `supersedesId` keep ids only; the UI shows "deleted Workspace".

## 6. Design notes

N/A, functionality only (the confirmation dialog is WSPACE).

## 7. Reuse

`multiToken` (ARCH006), `LocalApprovalGate` (PERM), `UnitOfWork`, `EventLogPurger` narrow interface from `cascade-events.ts`, `Clock`.

## 8. Architecture and code placement

Port and use cases in application; SQLite pieces touching `event_log` internals only in `cascade-events.ts`, exposed to the runner via a narrow interface (ISP) and never to participants.

## 9. Security and safety

Destructive: typed name plus Local Approval bound to action and target (single use, SR-34), Owner desktop only (SR-25). Fail closed if the gate is unavailable. Purge is scoped by `workspace_id` (two-Workspace test). Credential volumes of CLIs are per CLI, not Workspace-bound, and are not removed.

## 10. Errors and edge cases

- Active Runs: refuse, list ids.
- Participant fails: rollback, error names participant id only.
- Concurrent Agent write: writer mutex serialises; after `markDeleting` the Workspace counts as missing.
- Last Workspace deleted: allowed, onboarding returns.
- Crash after commit: cleanups resume.

## 11. Acceptance criteria

- [ ] Three fake participants: only that Workspace's data disappears, a second Workspace is untouched.
- [ ] Wrong `confirmName` yields `validation.invalid_input`; missing grant yields `perm.local_approval_required`.
- [ ] A failing participant rolls everything back and the Workspace stays `active`.
- [ ] `verifyChain` passes after deletion; `workspace.deleted` remains.
- [ ] Completeness test fails for an uncovered workspace-scoped table.

## 12. Test plan

Runner unit tests, SQLite integration with two Workspaces, chain verify, crash test. Commands: `pnpm vitest run packages/adapters/sqlite/src/workspace packages/application/src/data/workspace-delete`.

## 13. Parallelization notes

Areas add participants in their own module files; nobody edits this task's files.

## 14. Open questions and assumptions

- ASSUMPTION: refuse while Runs are active instead of auto-cancelling.
- ASSUMPTION: typed-name confirmation in addition to Local Approval.
