---
id: OVE_PERM014
title: Implement the Approval flow use cases (request, decide, expire, consume)
area: PERM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT018, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_ENGINE029, OVE_PERM006, OVE_PERM008, OVE_PERM010, OVE_PERM013, OVE_PERM018, OVE_PERM020]
soft_depends_on: [OVE_PERM025, OVE_PERM029]
provides: ["usecase:RequestApproval", "usecase:DecideApproval", "usecase:ConsumeApproval", "usecase:ExpireApprovals", "usecase:ListApprovals", "port:ApprovalRepository", "port:ApprovalVerifier", "port:ApprovalRequestReader", "port:PendingApprovalsQuery", "usecase:ListPendingApprovals"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "usecase:RecordViolation", "usecase:GetRunSummary", "port:PauseStateReader", "port:Scheduler"]
owns: ["packages/application/src/perm/approval-flow/**", "packages/application/src/ports/ApprovalRepository.ts", "apps/engine/src/composition/modules/perm-approvals.module.ts"]
reads: ["packages/domain/src/perm/approval/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 16.9", "SPECIFICATION 16.10", "SPECIFICATION 16.14"]
adr_refs: [3, 6, 21, 22]
---

# OVE_PERM014: Implement the Approval flow use cases

## 1. Summary

The use cases that create an Approval request when an action needs consent, let the Owner decide it on the desktop or Telegram, expire stale ones, and let the executing component consume an approved Approval exactly once. Each step enforces the authority matrix, the action-hash binding and the audit trail.

## 2. Context

Triggers: `CheckAccess` returned `needs_approval` (default list, ADR 0021), a CLI permission dialog detected by PROV (ADR 0022: dialogs become Approvals with a diff preview), or the Budget engine (class `budget_overrun`). The Run waits in a `waiting` node state (WFRT) and resumes on `approval.decided`. A "waiting for approval" Agent is not blocked by a blind retry: commands are not sent to it (SPEC 9); the Approval answer is typed into the CLI by PROV after the decision.

## 3. Scope (in)

- `RequestApproval`, `DecideApproval`, `CancelApproval`, `ConsumeApproval`, `ExpireApprovals` (sweeper), `ListApprovals`, `GetApproval`.
- Port `ApprovalRepository`; the sweeper registration via the `Scheduler` port.
- De-duplication of identical pending requests.

## 4. Out of scope

State machine (PERM013), notification/sound/Telegram delivery (NOTIF, TG consume `approval.requested`), routes (PERM027), CLI answer injection (PROV), UI (APPRUI), Access Requests (PERM016).

## 5. Detailed requirements

1. **RequestApproval** `{ principal(agent|chief|system), runId, agentId, class, structured, nodeExecutionId? }`: verifies the Run is active and matches the agent (else `perm.not_found`); builds `summary` and `preview` from `structured` (engine-side, never from agent text); computes `actionHash`; **dedupes**: an existing `pending` approval with the same hash returns the same id; **limits**: max 20 pending per Run and 10 requests per minute per Run (error `perm.access_request_limit` with details `{ kind: 'approval' }`; one limit code serves both flows); persists with `expiresAt` per class; emits `approval.requested` with `notify.sound=true`; audit `perm.approval.requested`. If Global Pause is on, the request is still recorded but marked `blockedByPause: false`; see PERM029 for decision rules.
2. **DecideApproval** `{ principal, approvalId, decision: 'approve'|'deny', note? }`: `authorize(principal, 'approval.decide.'+decision)`; lazy expiry check; state machine transition; `by` derived from the principal channel (desktop → `owner_desktop`, Telegram → `owner_telegram`), **never from the body**; Telegram decisions are accepted only if the Approval's Run is still active; emits `approval.decided`; audit with `channel`. The body has no scope field: approvals are always `once`.
3. **ConsumeApproval** `{ approvalId, runId, agentId, actionHash }` called by the Tool Broker/PROV right before executing: loads in a transaction, `canConsume`, sets `consumed` atomically (compare-and-set on status) and returns `Ok`. A second call returns `perm.approval_not_pending`. If Effective Permissions changed meanwhile, the broker must call `CheckAccess` again **before** consuming (documented in the broker contract; the use case itself re-runs `CheckAccess` with a `skipApprovalStep` flag and refuses consumption if the capability layer now denies it).
4. **ExpireApprovals** runs every 30 s (Scheduler) and on engine start: marks overdue `pending`/`approved` as `expired`, emits `approval.expired`, audits. Idempotent. On engine restart pending approvals survive (persisted); they expire by time.
5. **Run end cleanup:** subscribes to `run.finished|cancelled|failed` and cancels the Run's `pending`/`approved` approvals.
6. **Idempotency keys:** `POST` routes use `Idempotency-Key` (route contract); `RequestApproval` dedupe by hash gives natural idempotency; `DecideApproval` is idempotent for the same decision by the same channel (second identical call returns the existing result), conflicting decision returns `perm.approval_not_pending`.
7. **Listing:** `ListApprovals({ status?, workspaceId?, runId?, limit<=100, cursor })`; Agents may list only their own Run's approvals (status and id only, no preview of others); Telegram gets a summarised form (no absolute paths).
8. **Ordering and fairness:** FIFO by `requestedAt`; the Owner can decide in any order.
9. **Notification contract:** the event carries `urgency:'high'` and `sound:true`; the notification/sound content is NOTIF's. Approval requests created while the desktop is unreachable and Telegram is paired also go to Telegram (TG subscribes to the same event). The first decision wins.
10. **Transactionality:** state change + audit event + outbox event in one `UnitOfWork`; if audit append fails the decision is rejected (`perm.audit_unavailable`), never applied silently.
11. **Fail closed when the Run is paused or the sandbox is unavailable:** see PERM029; recorded decision does not execute anything until resume.

## 6. Design notes

N/A, functionality only. Copy strings come from i18n keys `perm:approval.*`, owned by APPRUI/NOTIF/TG.

## 7. Reuse

State machine and hashing (PERM013), `authorize` (PERM008), `ACTION_CLASSES` (PERM006), `AppendAudit`/`RecordViolation`, `Scheduler` port (ARCH, ENGINE: `needs port:Scheduler`, flagged), `EventBus`, `UnitOfWork`.

## 8. Architecture and code placement

One use case per file in `packages/application/src/perm/approval-flow/`; port in `packages/application/src/ports/ApprovalRepository.ts` (`insert`, `getForUpdate`, `compareAndSetStatus`, `listPending`, `listExpiring(now)`); composition in `apps/engine/src/composition/modules/perm-approvals.module.ts`. Use cases depend on ports only.

## 9. Security and safety

Controls against the main abuses: forged channel (principal from transport), decision by Agent or Chief (authority matrix), replay (single use, hash binding), cross-Run use (hash includes Run and Agent), stale approvals (expiry and consume window), approval flooding (limits and dedupe), misleading descriptions (engine-built summary/preview; untrusted text flagged), time-of-check/time-of-use (consume re-checks capability), crash between decision and execution (state is persisted; approved but unconsumed approvals expire, nothing is auto-executed after restart: WFRT re-requests consumption through the normal path, and non-idempotent actions are not replayed, SR-18), Telegram decisions are `once` and Run-bound (SR-15). Audit includes channel, approval id, class, result, correlation id; never includes preview bodies (message text, payee details) beyond class and counts.

## 10. Errors and edge cases

- Decision on an unknown id or an id of another installation: `perm.not_found`.
- Telegram approves after the Owner already denied on desktop: `perm.approval_not_pending`; Telegram user sees "already decided".
- Run finished between decision and consumption: `consume` fails (`cancelled`).
- 21st pending approval in a Run: `perm.access_request_limit`; the Agent is told to wait.
- Agent crashes while waiting: approval cancelled on Run end event or expires.
- Two engines? Not supported (single installation, lock file).

## 11. Acceptance criteria

- [ ] Given an Agent principal, `DecideApproval` fails with `perm.owner_required` and writes a violation.
- [ ] Given Telegram approves, `decision.by==='owner_telegram'` and the Approval cannot be consumed by another Run or action.
- [ ] Given an approved Approval, a second `ConsumeApproval` fails; a changed `actionHash` fails and creates a violation.
- [ ] Pending approvals expire after `expiresAt` (FakeClock) and emit `approval.expired`; late decisions fail.
- [ ] Identical pending requests dedupe to one id; the 21st pending is refused.
- [ ] Audit append failure rolls back the decision.
- [ ] Run cancellation cancels pending approvals.

## 12. Test plan

Use case tests with fakes (PERM025 fakes) and `FakeClock`; concurrency tests (two deciders); crash-injection test (TEST011 harness) between decision and consume; authorisation matrix; limit tests. `pnpm vitest run packages/application/src/perm/approval-flow`.

## 13. Parallelization notes

Blocks PERM027 (routes) and PERM030. Parallel with PERM015/016. Hotspot: `perm-approvals.module.ts` owned here only.

## 14. Open questions and assumptions

- ASSUMPTION: approvals are one-shot; no "approve all pushes this Run" in MVP (would be a Run-scoped override; revisit with the Owner).
- Open: needs `port:Scheduler` (periodic timers) from ENGINE/ARCH; flagged. Fallback: `Clock.setInterval`-style timer from ARCH007.
