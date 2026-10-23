---
id: OVE_ARCH057
title: Implement the system ULID generator and its package foundation
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_ARCH056]
soft_depends_on: []
provides: ["lib:ids"]
needs: []
owns: ["packages/adapters/system/package.json", "packages/adapters/system/tsconfig.json", "packages/adapters/system/vitest.config.ts", "packages/adapters/system/src/index.ts", "packages/adapters/system/src/ids/**", "packages/adapters/system/README.md"]
reads: ["tasks/OVE_ARCH007/TASK.md", "docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14", "SPECIFICATION 19"]
adr_refs: [5, 8, 16]
---

# OVE_ARCH057: Implement the system ULID generator and its package foundation

## 1. Summary

Deliver the actual monotonic ULID adapter behind the accepted IdGenerator interface.
This supplies production entropy and sortable IDs without exposing those effects to pure callers.

## 2. Context

ARCH007 defines the behavior and retains actual TEST002/003 system/fake acceptance.

## 3. Scope (in)

- System package scaffold and real UlidIdGenerator implementation.
- Public adapter export and usage documentation.
- Workspace wiring applied only by the Root integrator in the seven paths from
  [the wiring proposal](../_proposals/OVE_ARCH057-system-workspace-wiring.md).
  Author owns remain unchanged; the author never edits those shared files.

## 4. Out of scope

- Clock implementation: ARCH058.
- Deterministic fake and shared-suite acceptance: TEST002/003 and parent ARCH007.
No permissions, security-gate, dependency-version or feature-scope changes.

## 5. Detailed requirements

1. Preserve ARCH007 requirements 1-3, 9 and 10 for actual ID generation.
2. Use only node:crypto.randomBytes entropy in the adapter, with injectable time for
   regression tests. Preserve the previous timestamp on wall-clock regression.
3. Increment the 80-bit random suffix for same/regressed timestamps; overflow throws
   InvariantError rather than wrapping. Validate timestamp range and prefix input.
4. Prove 100k unique strictly increasing IDs, fixed-millisecond increment, regression,
   random-overflow denial and ULID format using the actual public adapter.
5. Record an informational real benchmark against the original 5-microsecond target;
   never hide failures or modify test budgets to achieve a result.
6. Add no external dependency or new ambient permission. The system package has
   existing workspace:* contracts/application dependencies and the shared test config.
7. Root alone applies the proposal's seven shared paths: root TS references, native
   lockfile, skeleton, discovery, static coverage, discovery tests and coverage fixture.
   Preserve all old graphs, exports, projects, thresholds and denials; generate the
   lockfile with pinned pnpm, never by hand. Discovery/coverage additions require
   actual ARCH036 merge and post-green first. Include system in every final gate.

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

- [x] Actual public UlidIdGenerator yields 100k unique strictly increasing valid IDs.
- [x] Same-time/regressed clocks remain monotonic; malformed prefix/time and overflow deny.
- [x] Informational benchmark and real entropy-backed operation are recorded.
- [x] New system workspace participates in actual typechecking, tests, coverage and build.

## 12. Test plan

Real public-seam Vitest, native/type/lint/security/build gates and exact-head
independent Standards/Spec/hosted reviews must pass before ordinary DEVELOP merge.

## 13. Parallelization notes

Use one claimed isolated worktree. Root applies only the proposal's seven shared
paths through isolated integration; author owns do not widen. Initial root TS,
lockfile and skeleton wiring may precede 036. The remaining four paths follow
actual 036 merge/post-green; no source publication omits system tests or coverage.

## 14. Open questions and assumptions

The Owner delegated routine MVP decisions on 2026-10-23. Workspace uses `wsp` to
satisfy the original uniform three-letter invariant; timer ref defaults are false.
Parent ARCH007 keeps its original seven acceptance criteria and is not done early.
