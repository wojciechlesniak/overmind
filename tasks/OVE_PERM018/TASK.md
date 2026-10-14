---
id: OVE_PERM018
title: Implement the violations log (RecordViolation with deduplication and flood control)
area: PERM
kind: security
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_PERM001, OVE_PERM019, OVE_PERM020]
soft_depends_on: [OVE_PERM020]
provides: ["usecase:RecordViolation", "contract:ViolationKind", "event:perm.violation.threshold_reached"]
needs: ["usecase:AppendAudit", "port:Clock", "port:EventBus", "port:Logger"]
owns: ["packages/application/src/perm/violations/**", "packages/contracts/src/audit/actions/violation.actions.ts", "packages/contracts/src/perm/violation-kind.ts", "packages/contracts/src/events/violation-threshold-reached.event.ts"]
reads: ["packages/contracts/src/audit/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 15", "SPECIFICATION 16.8", "SPECIFICATION 16.10"]
adr_refs: [3, 4]
---

# OVE_PERM018: Implement the violations log

## 1. Summary

Attempts to break the rules (reading outside Allowed Directories, forged channel, replayed approvals, a Telegram attempt to widen permissions) are logged, not just denied. `RecordViolation` writes them as audit events of category `violation`, deduplicates floods without losing the fact that they happened, and raises a threshold event so the Owner learns about suspicious behaviour.

## 2. Context

ADR 0003: "violation attempts are logged". SPEC 11/15. Violations are security evidence, so they go to the append-only audit store (SR-17), not only to logs. A malicious or confused Agent can generate thousands of denied calls; the audit store must stay useful and bounded.

## 3. Scope (in)

- `RecordViolation(input)` use case and the `ViolationKind` catalogue.
- Deduplication window, per-Run and global flood control, suppression summary events.
- Threshold event for NOTIF (quiet notification, no sound by default) and Activity.
- Audit action registrations for violations.

## 4. Out of scope

The audit store and chain (PERM019, PERM020), querying/UI (PERM023, APPRUI/RUNUI), reacting to violations by stopping Agents (Chief/WFRT policy, later), logging to files (ARCH004 is separate).

## 5. Detailed requirements

1. **ViolationKind** (extensible via new files; each has `severity: 'low'|'medium'|'high'`): `path_outside_allowed` (low), `path_traversal_attempt` (medium), `symlink_escape` (medium), `protected_location` (medium), `capability_denied` (low), `unknown_action` (medium), `agent_scope_violation` (high: an Agent token on an Owner route or on another Run), `channel_not_permitted` (medium), `telegram_widening_attempt` (high), `local_proof_invalid` (high), `approval_replay_or_mismatch` (high), `override_attempt` (high), `isolation_unavailable` (medium), `policy_unreadable` (medium).
2. **Input:** `{ kind, principal, reason: string (a DenyReason or error code), workspaceId?, runId?, agentId?, target: { kind, display }, details?: allowlisted record, correlationId? }`. `target.display` is the `~`/Workspace-relative display form produced by SEC002; the use case rejects (and replaces by `[redacted-path]`) any absolute path that is outside the user's home or is under it but not Workspace-relative, to avoid leaking host layout into logs.
3. **Audit mapping:** action `violation.<kind>`, category `violation`, `result: 'denied'`, `actor` from the principal, reasonCode. `details` pass through the audit redactor (PERM021).
4. **Dedupe:** key = `(runId ?? 'none', agentId ?? 'none', kind, sha256(target.display), reason)`. The first occurrence is appended immediately. Further occurrences in the next 60 s only increment an in-memory counter; when the window ends (timer or the next event after expiry) one `violation.suppressed` audit event is appended with `{ kind, count, firstAt, lastAt }`. Counters are bounded to 1000 keys (LRU); evicted keys flush their summary first.
5. **Flood control:** at most 120 violation events appended per minute installation-wide and 30 per Run per minute; beyond that, events are only counted and a single `violation.flood` event per minute is appended with counts per kind. High-severity kinds bypass dedupe the first time per key and per 10 s.
6. **Threshold:** 5 medium/high violations by one Run within 10 minutes (or 20 low) emit `perm.violation.threshold_reached { runId, agentId, count, kinds }` (event, not sound). Consumers decide (NOTIF shows a notification; Chief may pause the Agent: a later policy, not here).
7. **Never throws, never blocks the denial:** failure to append (disk full) logs an error with the redacted fields and increments a metric; the caller already denied the action (fail closed is unaffected); if the store is unavailable the service keeps the last 200 violations in a ring buffer and retries append on the next call.
8. **No secrets:** `details` are schema-allowlisted per kind (for example `path_outside_allowed`: `{ op, requestedRelative }`); nothing from the agent's free text goes into `details` except via a bounded `excerpt` (max 80 chars, control chars stripped) for `unknown_action`.
9. **Query:** violations are queried through the audit query API with `category=violation` (PERM023); no separate table.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AppendAudit` and the redactor (PERM020, PERM021), `Clock`, `EventBus`, `Logger`; display-path helper from SEC002.

## 8. Architecture and code placement

`packages/application/src/perm/violations/{record-violation.ts,dedupe.ts,flood.ts,thresholds.ts}`; kinds in contracts. The dedupe state is in-memory inside the use case instance (single engine process).

## 9. Security and safety

Violation records must be trustworthy and bounded: paths are display-redacted (no host layout leak), details allowlisted (no secrets, no prompt content), a loop cannot fill the disk (flood control) and cannot hide a different, rarer attack inside the noise (dedupe keys include kind and target; high severity bypass). The suppressed counters make "how many times" auditable. Logging a violation never grants anything.

## 10. Errors and edge cases

- Same violation 10 000 times in a minute: 1 event + 1 summary with count 10 000.
- Engine restart inside a dedupe window: the counter is lost; at most one extra event per key.
- Violation without a Run (a gateway call with a bad token): `runId` absent, principal `anonymous`? Anonymous calls are audited by SEC005's gateway rules (auth failures); this use case accepts `principal: Principal | 'unauthenticated'` and writes kind `agent_scope_violation`/`channel_not_permitted` only for authenticated principals.
- Audit store down: ring buffer, then flushed in order.

## 11. Acceptance criteria

- [ ] A denied out-of-scope read creates one `violation.path_outside_allowed` event with a display path and no absolute host path.
- [ ] 1000 identical violations in 60 s create exactly one event plus one `violation.suppressed{count:999}`.
- [ ] High-severity kinds (`telegram_widening_attempt`) are never silently suppressed on first occurrence.
- [ ] The threshold event fires on the 5th medium violation in 10 minutes and not on the 4th.
- [ ] Store failure does not raise to the caller and entries are flushed later in order.
- [ ] `details` outside the allowlist are dropped.

## 12. Test plan

Unit tests with `FakeClock` for windows and thresholds; flood tests; failure injection on `AppendAudit`; redaction test with absolute paths. `pnpm vitest run packages/application/src/perm/violations`.

## 13. Parallelization notes

Other PERM tasks call `RecordViolation` through its port; stub allowed. Parallel with PERM019..021.

## 14. Open questions and assumptions

- ASSUMPTION: thresholds (5 in 10 minutes) are defaults, configurable under `perm.violations` config.
- Open: should the Owner get a sound for high-severity violations? Default: notification only, no sound (NOTIF decides).
