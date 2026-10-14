---
id: OVE_BOARD009
title: "Implement defer, block and unblock of Tasks with reasons and the deferred counter"
area: BOARD
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_BOARD008, OVE_DATA002, OVE_PERM008, OVE_PERM013, OVE_PERM020]
soft_depends_on: []
provides: ["usecase:board.defer-task", "usecase:board.block-task", "usecase:board.unblock-task"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "event:approval.resolved"]
owns: ["packages/application/src/board/defer-block/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11]
---

# OVE_BOARD009: Implement defer, block and unblock of Tasks with reasons and the deferred counter

## 1. Summary

Add the use cases for postponing a Task (`Odłożone`), blocking it with a reason (for example waiting for an Approval, an Access Request or a missing answer from the Owner) and releasing it again, including automatic unblocking when the blocking Approval is resolved.

## 2. Context

The Board mock has a header chip `Odłożone · 1` and a filter `Zablokowane`; a card in QA shows `czeka na Zgodę`. ADR 0021/SPEC 11: actions on the default consent list wait for an Owner decision; the engine marks the affected Task as waiting so the Owner sees why work stopped. Deferral is an Owner/Chief scheduling decision, not an error.

## 3. Scope (in)

- `deferTask`, `blockTask`, `unblockTask` use cases (status + reason + timeline + events).
- Subscriber that sets `awaiting_approval` when an ApprovalRequest/AccessRequest linked to a Task is raised and restores the previous status when it is resolved.
- Counting rules for the deferred chip (read model in BOARD011 uses them).

## 4. Out of scope

- Creating Approvals and Access Requests: PERM. UI chips and filters: BOARDUI. Scheduled automatic wake of deferred Tasks (`until` handling): later / not planned.

## 5. Detailed requirements

1. `deferTask(taskId, { reason: 1..300, until?: IsoDate }, actor)`: owner or chief only; from `queued|working|blocked`; sets `deferred`; a Task that is `working` is not interrupted by this use case: it publishes `task.deferred` and the Run engine (WFRT) reacts to the event by cancelling the Node at the next safe point (ASSUMPTION); the lane stays unchanged (card remains visible in its lane but counted in `deferredCount`, not in lane counts, matching the mock where `Odłożone · 1` is separate).
2. `blockTask(taskId, { reason, blockerRef?: { kind: 'approval'|'access_request'|'question'|'external', id? } }, actor)`: owner, chief, system. `reason` safe-truncated. Status `blocked`; `blockerRef` stored in timeline payload and in `statusReason`.
3. `unblockTask(taskId, { reason? }, actor)`: owner, chief, system; returns to the status recorded before the block (`payload.previousStatus`, default `queued`).
4. **Approval linkage subscriber** (`approval-linkage.subscriber.ts`): on `approval.requested` / `access_request.created` events that carry `taskId` (the engine tags requests from Task-bound Nodes), set `awaiting_approval` (system actor), remember the previous status; on `approval.resolved` with any decision restore it (or, for a denied Approval, set `blocked` with reason `approval_denied` and leave the decision to Chief). The subscriber is idempotent by event id and tolerant to duplicates.
5. A deferred or blocked Task is excluded from WIP counts (BOARD002) and from automatic assignment by Chief.
6. Timeline entries: `deferred`, `status_changed`, `unblocked` with the reason; events `task.deferred`, `task.status_changed`.
7. The agent actor may not defer, block or unblock (it may append a `note` that it is blocked via `noteBlocked` in BOARD008-style: NOT implemented here; its request arrives as an Access Request through PERM, which triggers the linkage subscriber).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

BOARD002 domain transitions and `deferTask`; BOARD008 `authz-matrix.ts` (extend by proposal if a new operation row is required: add rows via proposal, do not fork the matrix); `UnitOfWork`, outbox.

## 8. Architecture and code placement

`packages/application/src/board/defer-block/{defer-task.ts,block-task.ts,unblock-task.ts,approval-linkage.subscriber.ts}`; consumes events by capability (`event:approval.resolved` and related, PERM) through `EventBus`. No I/O.

## 9. Security and safety

A forged event must not unblock work: the subscriber trusts only bus events published by the engine (in-process, `actor.kind = 'system'` required in the envelope; events from the gateway push path are never input here). An Agent cannot unblock itself by claiming approval ("The Owner said yes", SEC004 corpus): approval state comes from PERM only. Denied approval never moves a Task forward.

## 10. Errors and edge cases

- Approval resolved for a Task that is already `done`/`cancelled`: ignored, logged `info`.
- Two approvals for one Task: the Task stays `awaiting_approval` until all linked ones resolve (counter in timeline payload).
- Defer of an already deferred Task: idempotent no-op (ok).
- `until` in the past: rejected `validation.invalid_input`.

## 11. Acceptance criteria

- [ ] Owner can defer, block, unblock; Agents cannot (denied and audited).
- [ ] Deferred Tasks are not in lane counts and appear in `deferredCount`.
- [ ] Approval requested -> `awaiting_approval`; resolved -> previous status restored; denied -> `blocked` with reason.
- [ ] Duplicate event delivery does not create duplicate timeline entries.
- [ ] Two linked approvals require both to resolve.

## 12. Test plan

- `defer-task.test.ts`, `block-task.test.ts`, `unblock-task.test.ts`, `approval-linkage.subscriber.test.ts` (fake bus, duplicate and out-of-order events).
- Commands: `pnpm vitest run packages/application/src/board/defer-block`.

## 13. Parallelization notes

Independent of BOARD010-012 once BOARD008 is merged.

## 14. Open questions and assumptions

- ASSUMPTION: event names `approval.requested`, `approval.resolved`, `access_request.created` come from PERM and carry an optional `taskId`; the linker must confirm the exact names.
- Open: automatic wake-up of deferred Tasks at `until`. Default: informational only.
