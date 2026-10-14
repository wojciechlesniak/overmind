---
id: OVE_BOX019
title: Implement the fail-closed IsolationGate that every agent command path must pass
area: BOX
kind: security
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_BOX004, OVE_BOX018, OVE_ENGINE016, OVE_PAUSE001]
soft_depends_on: [OVE_BOX016]
provides: ["usecase:RequireIsolation", "lib:isolation-gate", "port:IsolationStatus"]
needs: ["port:Sandbox", "port:PauseState", "port:Clock", "port:AuditSink", "port:EventBus"]
owns:
  - packages/application/src/sandbox/**
  - packages/application/src/ports/IsolationStatus.ts
reads: ["docs/security/requirements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 18"]
adr_refs: [4, 20]
---

# OVE_BOX019: Implement the fail-closed IsolationGate that every agent command path must pass

## 1. Summary

Provide one application-level use case, `RequireIsolation`, that every code path starting or commanding an Agent must call first. It returns a granted `IsolationTicket` only when the sandbox is healthy, the startup sweep is complete, the Environment is verified and Global Pause is off; otherwise the action is blocked, logged and surfaced. There is no unsandboxed fallback.

## 2. Context

ADR 0004 and 0020: when isolation cannot be provided the action is blocked. SR-03 and SR-05. Scattered `if (sandboxOk)` checks are fragile, so the rule is centralised: PROV (`RunAgentCommand`, session start), WFRT (Agent nodes), CHIEF (dynamic agents) and AGENT (direct chats) consume this use case rather than inspecting health themselves. Health data comes from BOX004; sweep state from BOX016; pause state from PAUSE.

## 3. Scope (in)

- `IsolationStatus` port (read model) and `RequireIsolation` use case with typed block reasons.
- Tickets: short-lived proof object that Sandbox-facing code can demand.
- Blocked-action audit and one deduplicated notification per distinct reason.

## 4. Out of scope

- Computing health (BOX004), sweeping (BOX016), pause logic (PAUSE), UI banners (SHELL/ONB). Per-command permission checks (PERM).

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface IsolationStatus {
     snapshot(): Promise<Result<IsolationSnapshot>>;   // { overall, reasons: BlockReason[], checkedAt, sweepCompleted, kind }
     subscribe(cb): Unsubscribe;                       // emits on change
   }
   BlockReason = 'runtime_missing'|'os_unsupported'|'kernel_missing'|'system_not_running'|'version_unsupported'|'image_not_ready'|'herdr_tampered'|'sweep_pending'|'sandbox_kind_none'|'verification_failed'|'paused'|'unknown_error'
   ```
2. **Use case:** `RequireIsolation.execute({ workspaceId, agentId, purpose: 'start_session'|'send_command'|'exec'|'login' , envId? })` returns `Result<IsolationTicket, AppError>`; `IsolationTicket = { id, issuedAt, expiresAt (issuedAt + 60 s), purpose, envId? }` with a private brand so only this use case can create one. Checks in order: sandbox `kind !== 'none'`; health `overall === 'ready'` (cached max 5 minutes, fresh check if older); `sweepCompleted`; if `envId` is given then registry state `running` and verified; Global Pause off for purposes other than `login`. Any failure: `Err(box.isolation_unavailable)` whose `details.reasons` lists block reasons.
3. **Enforcement helper:** `assertTicket(ticket, expectedPurpose)` used by thin wrappers in `Sandbox` consumers (PROV's terminal start and command send call it); an expired or wrong-purpose ticket is rejected. Tickets are not persisted and not serialised across processes.
4. **No bypass:** there is no config flag, environment variable or "I understand the risk" parameter that skips the gate in production builds. ADR 0004's "conscious higher-risk mode" is explicitly NOT implemented in the MVP (recorded as later / not planned). A test-only `FakeSandbox` path is composed in `createTestEngine` and cannot be selected in a release build (build assertion shared with TEST006/TEST009 bundle checks).
5. **Blocked-action handling:** each denial writes an audit event `sandbox.isolation_blocked` (purpose, reasons, ids; via BOX018 emitter extension `blocked()` added in this task's request to BOX018 as a proposal if missing) and publishes a status change event for UIs; notifications to the Owner are deduplicated per reason set (at most one per 30 minutes) through the NOTIF use case with key `sandbox.isolation.unavailable`.
6. **Pause interplay:** `paused` is a block reason for starting or commanding Agents; `login` purpose is exempt (the Owner must be able to fix a broken login while paused) but still requires isolation.
7. **Status stream:** `subscribe` emits when `overall` or reasons change (from health recheck, sweep completion, pause events); ONB/SHELL status items read it via the gateway (ENGINE route `api:sandbox.status` is a separate small task owned by ENGINE or CONNUI; this task provides the port only).
8. **Time-boxed degraded:** `degraded` health is not ready. The only degraded states are remediable ones (kernel/system start) and block agent execution until fixed.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Sandbox.health()` and BOX004 cache, `PauseState` (PAUSE), `AuditSink`, `Notifier` use case (NOTIF), `Result`/errors. Consumers must not re-implement the checks.

## 8. Architecture and code placement

`packages/application/src/sandbox/{require-isolation.usecase.ts,isolation-ticket.ts,block-reason.ts,isolation-status.service.ts}` and `packages/application/src/ports/IsolationStatus.ts`. Application layer, no I/O; the adapter side only implements the data sources. Branding uses a module-private symbol.

## 9. Security and safety

This is the guard rail behind SR-05 and the answer to "what happens when isolation is unavailable". Abuse and failure modes: a caller forgetting the gate (mitigated by requiring tickets at the lowest levels: `startAgentSession` and `sendAgentCommand` in PROV demand one; contract tests in PROV assert it), a stale cached `ready` after `container` was killed (5-minute cap plus invalidate on lifecycle errors, plus ticket TTL 60 s), forged tickets (brand + opaque id checked against an in-memory issued set), prompt-injected instructions to "disable isolation" (no such switch exists; Owner Rules cannot weaken it). Every deny is audited; absence of the audit sink does not allow the action.

## 10. Errors and edge cases

- Health check itself throws: result `unknown_error`, blocked.
- Sweep never completes (container CLI broken): gate stays closed; reason shown to the Owner.
- Ticket requested for an Environment that was destroyed meanwhile: denied.
- Many simultaneous requests: one shared health refresh (single flight).
- Clock rollback: tickets compare using monotonic time.
- Pause turned on after a ticket was issued: the ticket is still valid for 60 s; consumers re-check pause on send (PROV008) so the window cannot lead to a new command after Pause is confirmed.

## 11. Acceptance criteria

- [ ] Table tests for every combination of health, sweep, pause, kind and env state produce the documented grant or reasons.
- [ ] No configuration key or env var can disable the gate in a production composition (test enumerates config schema).
- [ ] Tickets expire after 60 s and are rejected for the wrong purpose.
- [ ] Every denial yields one audit event and at most one notification per 30 minutes per reason set.
- [ ] Concurrent callers trigger one health refresh.
- [ ] `login` purpose works while paused but not when isolation is broken.

## 12. Test plan

Unit tests with fakes (FakeSandbox, FakeClock, in-memory audit); property test: random state vectors never grant when any blocking condition holds. Contract assertions provided to PROV/WFRT tests: `expectRequiresTicket(fn)` helper exported in `packages/testing` proposal. Commands: `pnpm vitest run packages/application/src/sandbox`.

## 13. Parallelization notes

Merge early after BOX004; PROV008, PROV009 and WFRT agent nodes depend on it. No hotspots.

## 14. Open questions and assumptions

- ASSUMPTION: `PauseState` exposes `isPaused()` and a change event; PAUSE area provides it.
- Open: whether Owner-initiated "run without isolation" should exist later (ADR 0004 mentions a conscious higher-risk mode). Not in MVP; if added it needs its own ADR and Local Approval.
