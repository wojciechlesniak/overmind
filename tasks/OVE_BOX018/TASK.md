---
id: OVE_BOX018
title: Define sandbox events and audit emission for start, stop and violations
area: BOX
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_ENGINE016, OVE_PERM019]
soft_depends_on: [OVE_ARCH010]
provides: ["lib:sandbox-audit", "event:sandbox.env_created", "event:sandbox.env_started", "event:sandbox.env_stopped", "event:sandbox.env_destroyed", "event:sandbox.violation", "event:sandbox.image_progress"]
needs: ["lib:define-event", "port:AuditSink", "port:EventBus", "contract:AuditEvent", "port:Clock", "lib:redaction"]
owns:
  - packages/contracts/src/events/sandbox-env-*.event.ts
  - packages/contracts/src/events/sandbox-violation.event.ts
  - packages/contracts/src/events/sandbox-image-progress.event.ts
  - packages/contracts/src/events/sandbox-sweep-completed.event.ts
  - packages/adapters/sandbox-macos/src/audit/**
reads: ["docs/security/requirements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 15", "SPECIFICATION 16"]
adr_refs: [3, 4, 20]
---

# OVE_BOX018: Define sandbox events and audit emission for start, stop and violations

## 1. Summary

Define the event contracts of the sandbox module and a single `SandboxAudit` emitter that writes both domain events (for Activity and notifications) and append-only `AuditEvent`s (for security review) whenever an Environment starts, stops, is destroyed, reaped or violates a rule. All other BOX tasks emit through it.

## 2. Context

SR-17: security-relevant decisions write append-only audit events to the event store. SPEC 15 requires Activity to show who did what and with which result. The prior BOX tasks reference `sandbox.*` events by name; this task fixes their schemas once (contract-first, additive-only per OVE_ARCH008). `AuditEvent` and `AuditSink` belong to PERM. Hostile data (paths, command lines, CLI output) must never enter events.

## 3. Scope (in)

- Event schemas (zod via `defineEvent`) for the sandbox module.
- `SandboxAudit` helper with typed methods and the mapping to `AuditEvent`.
- Violation taxonomy and severity.

## 4. Out of scope

- Storage of events and the audit table (DATA/PERM). Notifications to the Owner about violations (NOTIF subscribes). Proxy decision events (defined in BOX011/BOX013 files).

## 5. Detailed requirements

1. **Events** (one file each under `packages/contracts/src/events/`): 
   - `sandbox.env_created { envId, workspaceId, agentId, imageDigest, specHash, at }`
   - `sandbox.env_started { envId, workspaceId, agentId, mountCount, roMountCount, rwMountCount, egressMode, at }`
   - `sandbox.env_stopped { envId, reason: 'idle'|'requested'|'pause'|'shutdown'|'oom'|'crash'|'violation', at }`
   - `sandbox.env_destroyed { envId, reason, keptVolumes: boolean, at }`
   - `sandbox.violation { envId?, workspaceId?, agentId?, kind: ViolationKind, severity: 'warning'|'critical', detailCode: string, at }`
   - `sandbox.image_progress { phase, percent?, at }` (persisted: false)
   - `sandbox.sweep_completed { tracked, reapedCount, errorCount, durationMs, at }`
   - all with `persisted: true` except progress. IDs use the shared id formats (OVE_ARCH007).
2. **ViolationKind** enum (open enum, `openEnum: true`): `mount_drift`, `spec_mismatch`, `egress_bypass`, `egress_denied_burst`, `git_tamper`, `oom`, `pid_limit`, `image_digest_mismatch`, `proxy_failure`, `exec_denied_cwd`, `bridge_failure`, `login_forward_denied`, `unexpected_privilege`, `reap_foreign`. Severity mapping is a pure table in `violation-severity.ts` (`mount_drift`, `egress_bypass`, `git_tamper`, `image_digest_mismatch`, `unexpected_privilege` are critical).
3. **SandboxAudit API:**
   ```ts
   class SandboxAudit {
     envCreated(i); envStarted(i); envStopped(i); envDestroyed(i);
     violation(i: { kind; envId?; workspaceId?; agentId?; detailCode: string })
     imageBuilt(i); loginForward(i); credentialsDeleted(i); setupPerformed(i); reaped(i)
   }
   ```
   Each method publishes the event on `EventBus` and writes an `AuditEvent` `{ actor: 'system:sandbox', action: 'sandbox.<name>', target: <envId|volume ref>, result: 'ok'|'denied'|'violation', details: {...ids and codes only} }`. Audit write failure is logged and retried once; for `critical` violations a failure to audit raises `internal.audit_failed` to the caller, which fails closed (the Environment is stopped).
4. **Redaction/limits:** `detailCode` matches `^[a-z0-9_.]{1,60}$`; no free text, paths, hostnames of the Owner, argv, env values. Host names of blocked egress are not in these events (they are in `sandbox.egress_blocked`, normalised).
5. **Critical violation side effects** (a small policy object, not buried in emitters): on `critical` the emitter requests `EnvironmentStopper.stop(envId, 'violation')` via an injected callback and publishes a high-urgency notification event `notify.request` (NOTIF contract) with a localisable key `sandbox.violation.critical` and the ids; the callback wiring is in OVE_BOX022.
6. **Rate limiting:** identical violations (same kind+env) are collapsed to one event per minute with a counter field `count` to avoid flooding.
7. **Docs table:** a generated table of events and violation kinds for `docs/sandbox/events.md` is produced by the contracts pipeline (no hand-written duplicate).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineEvent` (OVE_ARCH010), event envelope, `AuditSink`/`AuditEvent` (PERM), ids (ARCH007), redaction vectors (SEC003) for the fuzz test.

## 8. Architecture and code placement

Contracts in `packages/contracts/src/events/sandbox-*.event.ts` (one file per event); emitter in `packages/adapters/sandbox-macos/src/audit/{sandbox-audit.ts,violation-severity.ts,collapse.ts}`. The emitter depends on ports only.

## 9. Security and safety

Events are the evidence trail for escapes and tampering. They must be tamper-evident downstream (append-only store, DATA/PERM), contain only ids and short codes, and be written before the dangerous Environment is allowed to continue (critical). Hostile input: detail codes are generated by code, never copied from CLI output; fuzz test feeds secret-like strings into every free parameter and asserts they never appear in events or audit rows.

## 10. Errors and edge cases

- Event bus down: audit still written; events retried from the store by the outbox (DATA) or dropped with a log line.
- Audit sink slow: emission is async but `critical` waits up to 2 s before stopping.
- Duplicate emission after engine restart: events carry deterministic ids for lifecycle changes (`envId + state + at`), consumers deduplicate.
- Violation for an unknown Environment id: allowed (`envId` optional), recorded with `kind` only.
- Clock skew: timestamps from the injected `Clock`.

## 11. Acceptance criteria

- [ ] All events validate with zod, appear in the contracts snapshot, and pass `contracts:check` as additive.
- [ ] Each emitter method produces exactly one event and one audit row with the documented fields.
- [ ] Critical violations stop the Environment and fail closed when audit cannot be written (fake sink failing).
- [ ] Collapsing limits repeated violations to one per minute with a counter.
- [ ] Fuzz test: secret patterns, absolute paths and URLs passed as `detailCode` are rejected or never serialised.
- [ ] `docs/sandbox/events.md` table is generated from the schemas.

## 12. Test plan

Unit tests per emitter method with fake bus/sink/clock; contract tests for schemas; fuzz test with the redaction corpus (OVE_SEC003). Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/audit packages/contracts/src/events`.

## 13. Parallelization notes

Merge early: every other BOX task emits through `SandboxAudit`. Event files are one per event so additions never conflict; the severity table is the only shared file (single owner).

## 14. Open questions and assumptions

- ASSUMPTION: PERM's `AuditEvent` has `actor`, `action`, `target`, `result`, `details` (Spec section 14 lists `actor, action, target, result, timestamp`).
- Open: whether the Owner wants `env_started` events visible in the main Activity feed (noise); default: stored, hidden unless filtered.
