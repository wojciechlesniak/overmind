---
id: OVE_ENGINE016
title: Audit logging of mutating gateway calls and security denials
area: ENGINE
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_DATA002, OVE_DATA005, OVE_ENGINE011, OVE_ENGINE013]
soft_depends_on: []
provides: ["lib:gateway-audit", "port:AuditSink"]
needs: ["port:EventStore", "port:UnitOfWork", "lib:gateway-pipeline", "port:Clock", "port:Logger"]
owns: ["packages/gateway/src/audit/**", "packages/contracts/src/events/gateway.request-audited.event.ts", "packages/contracts/src/events/gateway.access-denied.event.ts"]
reads: ["packages/contracts/src/events"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 16"]
adr_refs: [3, 6]
---

# OVE_ENGINE016: Audit logging of mutating calls

## 1. Summary

Every mutating gateway call, every authorisation denial and every authentication failure pattern is recorded as an append-only audit event (not a log line), with who, what, result and request id, and with no secrets or request bodies.

## 2. Context

SR-17: security-relevant decisions write append-only audit events to the event store, not to logs. The AuditEvent entity and the audit table belong to PERM (SPEC 14 `AuditEvent(id, actor, action, target, result, timestamp)`); PERM also writes domain-level audit entries (approvals, policy changes) in the use cases. This task writes the gateway-level layer: who called which route and whether it was allowed. To avoid two audit tables, it writes through the `AuditSink` port (this task defines the port; PERM provides the implementation backed by its table; until PERM lands the fallback implementation appends `gateway.request_audited` events to `event_log`).

## 3. Scope (in)

- `AuditSink` port, middleware (begin/end), events, redaction of targets, fallback implementation.

## 4. Out of scope

- AuditEvent table and use-case-level audit (PERM). Reading/exporting audit (PERM/SETUI). Log shipping (never).

## 5. Detailed requirements

1. `AuditSink.record(entry: AuditEntry): Result<void>` where `AuditEntry = { at, requestId, actor: { kind, id?, channel?, agentId?, runId? }, action: routeId, target?: { type, id }, outcome: 'allowed'|'denied'|'error', status: int, errorCode?: string, durationMs, reason?: 'scope'|'unauthenticated'|'validation'|'policy' }`. No headers, no query values, no body, no response.
2. Which calls are audited: all routes with HTTP method other than GET/HEAD; routes flagged `audit: true` (including reads of sensitive data such as artifact content when requested by an agent); every denial (403/401 spikes aggregated, below); every `expandsPermissions` route attempt, allowed or not.
3. Authentication failures are aggregated, not one record each: one `gateway.access_denied` event per (connection, minute) with `count` and the last reason, to prevent log flooding by an attacker.
4. Write path: the audit entry is appended in the SAME transaction as the handler's state change when the handler uses a `UnitOfWork` (the pipeline exposes `ctx.audit.attach(tx)` and the use-case wrapper `withAudit`); for handlers without a transaction (reads, denials) the entry is appended in its own transaction after the response is decided, before the response is sent for denials (fail closed: if the audit write fails for a mutating call that already committed, respond with the result but log `error` and raise `system.audit_write_failed` finding; if it fails BEFORE the handler runs for an `expandsPermissions` route, the request is refused with 503).
5. Target extraction: `target` comes from the route's declared `auditTarget` path/param (for example `params.id`), never from free text; ids only.
6. Free-text fields (names, reasons) are not copied into audit entries; where meaningful (e.g. rename) the domain event already carries bounded text.
7. Redaction check in non-release: `expectEventSafe` over the serialised entry.
8. Volume control: GET routes are not audited; high-frequency mutating routes (for example progress reports from agents) declare `audit: 'sampled'` with rate 1/10 and always audit state-changing outcomes.
9. Query API: not here; PERM exposes `audit.list`.
10. Retention: same as event log (no deletion except Workspace cascade, which keeps `workspace.deleted`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EventStore.append`, `UnitOfWork`, `AuditSink` implemented by PERM later, pipeline slots `audit(begin)`/`audit(end)` (ENGINE011).

## 8. Architecture and code placement

Port `packages/application/src/ports/AuditSink.ts` (owned here), middleware and fallback sink in `packages/gateway/src/audit/` (fallback uses the EventStore). PERM's table-backed sink is a separate adapter.

## 9. Security and safety

Audit is evidence for the Owner about what agents and channels attempted. Entries are append-only, redaction-safe, free of secrets and bodies. Aggregation prevents audit-log flooding as a denial-of-service. Fail-closed for permission-expanding routes: no audit, no action.

## 10. Errors and edge cases

- Audit sink down (DB busy): retry once; mutating non-permission calls proceed with a finding.
- Request aborted by client: audited with outcome `error` status 499-like (internal code `gateway.client_aborted`).
- Duplicate replay (idempotent): audited with `reason: 'replay'`, not as a second action.

## 11. Acceptance criteria

- [ ] SEC005 test 18: each denial in tests 6, 8, 9, 10, 11 has a record with request id and no token.
- [ ] A mutating call and its audit entry commit together or not at all (use-case wrapper test).
- [ ] 1000 failed authentications produce a bounded number of events (aggregation).
- [ ] An `expandsPermissions` route with a failing audit sink returns 503 and changes nothing.
- [ ] Entries contain no body or header content (property test with hostile payloads).

## 12. Test plan

Unit tests for aggregation and entry building; integration with fault-injected sink; contract suite `AuditSink.contract.ts` for fallback and a fake. Commands: `pnpm vitest run packages/gateway/src/audit`.

## 13. Parallelization notes

PERM later swaps the sink via its module; no edits here. Flag: PERM must provide `port:AuditSink` implementation (cross-area).

## 14. Open questions and assumptions

- ASSUMPTION: gateway-level audit is separate from PERM's domain-level audit but stored through the same port.
- ASSUMPTION: sampled audit for chatty agent progress routes.
