---
id: OVE_PAUSE004
title: "Implement per-Workspace pause and resume use cases"
area: PAUSE
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA010, OVE_ENGINE011, OVE_ENGINE016, OVE_PAUSE001, OVE_PAUSE003]
soft_depends_on: []
provides: ["usecase:PauseWorkspace", "usecase:ResumeWorkspace"]
needs: ["port:AuditSink", "port:EventBus", "port:Clock", "port:WorkspaceRepository", "lib:gateway-principal"]
owns: ["packages/application/src/pause/workspace/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 12"]
adr_refs: [5]
---

# OVE_PAUSE004: Implement per-Workspace pause and resume use cases

## 1. Summary

Use cases `PauseWorkspace` and `ResumeWorkspace` for the individual pause shown in the mocks (tray items 'Wstrzymaj Aplikacja rezerwacji' / 'Wznow Research rynku', dashboard card 'wstrzymany przez Ciebie'). Only the Owner at the computer can use them.

## 2. Context

The Workspaces dashboard (Pulpit) shows a card variant 'paused by Owner' and the tray offers per-Workspace pause/resume. Per-Workspace pause stops dispatching new work and pauses Runs of that Workspace only; other Workspaces continue (SPEC 3, mocks). It uses the same `PauseState` entity with scope `workspace`.

## 3. Scope (in)

- Two use cases mirroring Global Pause semantics for one Workspace.
- Validation that the Workspace exists.
- Audit events `pause.workspace.paused` / `pause.workspace.resumed`.

## 4. Out of scope

- Gate and coordinator behaviour (OVE_PAUSE005/006). Routes (OVE_PAUSE007). UI (OVE_PAUSE013, OVE_PAUSE014).
- Deleting a Workspace clears its pause row: DATA/WSPACE call `PauseRepository.remove`; this task only documents the hook (`usecase:ClearWorkspacePause` is not needed, repository call is enough).

## 5. Detailed requirements

1. `PauseWorkspace.execute({ principal, workspaceId })` and `ResumeWorkspace.execute(...)` return `Result<{ snapshot: PauseSnapshot; changed: boolean }>`; same flow as OVE_PAUSE003 (authorise, load scope, `nextState`, save with `expectedVersion`, audit, `pause.changed` with `scope: {kind:'workspace', workspaceId}`).
2. **Authority** via `authorizePause(principal, scope, direction)` from OVE_PAUSE003 (`support/authorize.ts`): Owner on `desktop` or `tray` for both directions. Telegram cannot touch per-Workspace pause at all (no permission is widened, but the MVP gives Telegram only the global brake): `pause.forbidden_actor` with details `{ reason: 'desktop_only' }`. Chief and agents: `pause.forbidden_actor`.
3. `workspaceId` must exist (`port:WorkspaceRepository.exists`), otherwise `pause.workspace_not_found`. Isolated Workspaces can be paused like any other.
4. Pausing a Workspace while Global Pause is active succeeds (the scope is stored) so that resuming Global does not accidentally start that Workspace.
5. Resuming a Workspace while Global Pause is active succeeds and returns the snapshot, which still reports `phase: 'paused'`; the UI explains that Global Pause is still on.
6. Idempotent exactly like OVE_PAUSE003; keyed mutex per scope key (`ws:<id>`).
7. Event payload `pause.changed.scope` carries the Workspace id; consumers filter by scope (the Workspace dashboard updates one card).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `authorizePause`, the keyed mutex and the audit/event helpers from OVE_PAUSE003 (`packages/application/src/pause/support/`); `nextState`, `effectivePause` (OVE_PAUSE001). Do not copy them.

## 8. Architecture and code placement

`packages/application/src/pause/workspace/{pause-workspace.usecase.ts,resume-workspace.usecase.ts}`. Depends on `WorkspaceRepository` port only for existence.

## 9. Security and safety

- Same principal rules as global; per-Workspace pause is Desktop/Tray only so a compromised Telegram account cannot selectively keep one Workspace stopped or probe Workspace ids.
- Workspace ids from the request are validated as ULIDs before any lookup; unknown ids reveal nothing beyond `workspace_not_found`.
- Visibility rules (ADR 0028) do not change: pausing a private Workspace is visible only in the Owner's own UI anyway.

## 10. Errors and edge cases

- Workspace deleted while paused: row removed by the deleter; later snapshot no longer lists it.
- Pause and resume pressed alternately fast: each effective change bumps the version; the last one wins.
- Workspace has an Approval pending: it stays pending; approving it while paused is allowed only to deny (OVE_PAUSE012).

## 11. Acceptance criteria

- [ ] Given Workspace A running, When owner/tray pauses A, Then only A's scope is paused and Workspace B reports not paused.
- [ ] Given telegram principal, Then both operations return `pause.forbidden_actor` and nothing is stored.
- [ ] Given unknown workspaceId, Then `pause.workspace_not_found`.
- [ ] Given global paused, When A is resumed, Then success and snapshot phase remains paused.
- [ ] Repeated pause of A yields one audit event.

## 12. Test plan

Unit tests with fakes: `pause-workspace.usecase.test.ts`, `resume-workspace.usecase.test.ts`, `authorize.test.ts` (matrix). Commands: `pnpm vitest run packages/application/src/pause/workspace`.

## 13. Parallelization notes

Starts after OVE_PAUSE003 merges (shared `support/` helpers). Independent of PAUSE005 to PAUSE008.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram has no per-Workspace controls in the MVP (SPEC 5 lists chats, status and approvals only).
- OPEN: should pausing a Workspace also pause its Discussions? DEFAULT yes: a Discussion is a Run branch (SPEC 6).
