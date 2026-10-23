---
id: OVE_ARCH058
title: Implement the system Clock with safe timer error logging
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH056, OVE_ARCH057, OVE_ARCH004]
soft_depends_on: []
provides: ["lib:system-clock"]
needs: []
owns: ["packages/adapters/system/src/clock/**"]
reads: ["tasks/OVE_ARCH007/TASK.md", "docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14", "SPECIFICATION 19"]
adr_refs: [5, 8, 16]
---

# OVE_ARCH058: Implement the system Clock with safe timer error logging

## 1. Summary

Deliver the actual system wall/monotonic clock and cancellable timers with the real Logger.
This keeps scheduling effects and safe callback diagnostics behind the accepted Clock port.

## 2. Context

ARCH007 defines the behavior and retains actual TEST002/003 system/fake acceptance.

## 3. Scope (in)

- SystemClock and focused actual timer/abort/failure tests.
- Finite integrator additions to the system public export and README.

## 4. Out of scope

- FakeClock and reusable shared suites: TEST002/003.
- Parent ARCH007 alone verifies complete system/fake suite parity.
No permissions, security-gate, dependency-version or feature-scope changes.

## 5. Detailed requirements

1. Preserve ARCH007 requirements 4-6 and Clock-related errors/security behavior.
2. Inject the existing ARCH004 Logger port. Use constant error messages and its
   existing redaction boundary; no duplicate logger, raw-secret sink or no-op fallback.
3. `nowIso` returns UTC milliseconds with Z; monotonicMs never decreases.
   sleep(0) yields, negative delays normalize to zero, abort rejects the existing
   internal.cancelled AppError and releases listeners/timers.
4. Timer/interval cancellation is idempotent. Both accept optional `{ref?:boolean}`;
   unref is default and ref:true explicitly keeps the process alive. Test actual Node
   process liveness, not only mocks. Reject nonfinite/unsafe/out-of-range delays.
5. Thrown timer callbacks are caught and logged at error through the actual Logger
   contract, never crash the process. Preserve logger failure behavior from ARCH004.
6. Use performance.now for monotonic elapsed time; wall-clock changes cannot extend
   budgets. Do not introduce a second clock or global mutable service locator.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Reuse contracts Result/AppError and pinned zod, without new dependencies.

## 8. Architecture and code placement

Pure contracts/ports have no ambient effects. Node effects stay in system adapters.
Use approved public entries, never deep imports or other adapters.

## 9. Security and safety

IDs are identifiers, never credentials or approval proofs. Malformed values fail
validation; no secret, arbitrary code, network or filesystem access is introduced.

## 10. Errors and edge cases

Preserve ARCH007 denials; unavailable dependencies/loggers/checks are not success.

## 11. Acceptance criteria

- [ ] Real wall/ISO/monotonic clocks, yielding sleep and abort behavior pass tests.
- [ ] Cancel, interval, nested timers and ref/unref liveness pass actual process tests.
- [ ] Thrown callbacks are safely logged and cannot crash the process or leak secret values.
- [ ] System adapter is publicly reachable and passes relevant native/security checks.

## 12. Test plan

Real public-seam Vitest, native/type/lint/security/build gates and exact-head
independent Standards/Spec/hosted reviews must pass before ordinary DEVELOP merge.

## 13. Parallelization notes

Use one claimed isolated worktree; integrator wiring follows the finite proposal.

## 14. Open questions and assumptions

The Owner delegated routine MVP decisions on 2026-10-23. Workspace uses `wsp` to
satisfy the original uniform three-letter invariant; timer ref defaults are false.
Parent ARCH007 keeps its original seven acceptance criteria and is not done early.
