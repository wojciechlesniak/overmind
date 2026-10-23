---
id: OVE_ARCH056
title: Provide validated entity identifiers and time and ID ports
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: done
depends_on: [OVE_ARCH001, OVE_ARCH003]
soft_depends_on: []
provides: ["contract:EntityId", "port:Clock", "port:IdGenerator"]
needs: []
owns: ["packages/contracts/src/kernel/ids.ts", "packages/contracts/src/index.ts", "packages/application/src/ports/Clock.ts", "packages/application/src/ports/IdGenerator.ts", "packages/application/src/ports/index.ts", "packages/application/package.json", "tools/skeleton.test.ts"]
reads: ["tasks/OVE_ARCH007/TASK.md", "docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14", "SPECIFICATION 19"]
adr_refs: [5, 8, 16]
---

# OVE_ARCH056: Provide validated entity identifiers and time and ID ports

## 1. Summary

Deliver browser-safe ID validation and the two effect interfaces without constructing adapters.
This gives pure callers typed IDs and cancellable time operations before adapters exist.

## 2. Context

ARCH007 defines the behavior and retains actual TEST002/003 system/fake acceptance.

## 3. Scope (in)

- Initial prefixes, branded IDs, zod schemas and safe parsing.
- Clock/IdGenerator interfaces, Cancel, Instant and duration/isoNow helpers.
- Explicit public contract exports and application/ports entry.

## 4. Out of scope

- System entropy/ULID generation: ARCH057; SystemClock/logging: ARCH058.
- Shared fakes/suites: TEST002/003; their end-to-end acceptance remains ARCH007.
No permissions, security-gate, dependency-version or feature-scope changes.

## 5. Detailed requirements

1. Preserve ARCH007 requirements 1, 2, 4-6 and 8 as contracts; use `wsp` for Workspace.
2. Validate the exact Crockford alphabet, 26 characters and first digit 0-7; do not echo invalid input.
3. Expose a pure registry validator for duplicate and non-three-letter lower-case prefixes.
   Preserve the per-area extension seam; do not add side-effect registration.
4. `setTimer` and `setInterval` accept optional `{ ref?: boolean }`, default false;
   `sleep` accepts the portable `CancellationSignal`: readonly `aborted`, and
   addEventListener/removeEventListener for abort callbacks with optional once:true.
   Native AbortSignal and deterministic fakes MUST be structurally compatible.
   Keep application ES2023/types:[] unchanged; no DOM/Node type imports or compiler relaxation.
5. Duration helpers accept finite safe millisecond values; seconds conversion detects
   overflow. Document that wall time may regress while monotonic time must not.
6. Public exports are additive. Preserve the application placeholder root for ARCH006;
   create only the explicit `./ports` entry. No DI tokens before their owning ARCH006.

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

- [x] Valid initial IDs parse and retain prefix-specific types through the public API.
- [x] Wrong prefix/length/alphabet/overflow and duplicate/malformed prefixes are denied.
- [x] Clock/IdGenerator signatures, timer ref defaults and cancellation contract compile.
- [x] Contracts remain browser-bundle safe; pure layers have no ambient clock/randomness.

## 12. Test plan

Real public-seam Vitest, native/type/lint/security/build gates and exact-head
independent Standards/Spec/hosted reviews must pass before ordinary DEVELOP merge.

## 13. Parallelization notes

Use one claimed isolated worktree; integrator wiring follows the finite proposal.

## 14. Open questions and assumptions

The Owner delegated routine MVP decisions on 2026-10-23. Workspace uses `wsp` to
satisfy the original uniform three-letter invariant; timer ref defaults are false.
Parent ARCH007 keeps its original seven acceptance criteria and is not done early.

### Contract verification evidence (2026-10-23)

The implementation bytes at 9c79e6f passed 65 actual focused cases through public entries and the exact bootstrap export assertion, including native cancellation compatibility, malformed/overflow denial, JSON Schema metadata and browser bundling. Types/lint and normal staging hooks passed 1522 unit tests in 124 files with all eight source/test blobs unchanged.

Thirteen applicable local checks passed: native task-index check, format, implemented architecture, dependency/license policy, production-high/all-critical audits, verified-tool prewarm, history/tree secrets, SBOM, build and documentation. The existing low development audit finding and Keychain warnings remain recorded; unavailable reserved gates are not counted as passes. No dependency, compiler or policy changed.

The initial ordinary pre-push with 1521 passing tests and one failure exposed the obsolete root-only bootstrap export assertion and remains recorded. The integrator assigned and corrected only that exact assertion; all other package exports remain strict. Both fresh independent whole combined-source axes reported zero findings. At that source checkpoint, the next in-review head still required fresh whole reviews and its own hosted checks, including all 123 native cases in 30 files. System adapters, shared fake parity, runtime isolation and parent ARCH007 acceptance remain assigned elsewhere and are not claimed here.

Exact in-review head `b254ec1` passed both fresh whole review axes and all four first-attempt hosted workflows. Its verified Native artifact contains 123 passing exact cases in 30 files, zero failed/skipped/todo cases and the pinned runtime. The unchanged native finish command then completed DONE at `26faf11`; that original DONE head and its runs remain separate staging evidence. That completed DONE/evidence checkpoint was rebased on verified DEVELOP `8499d94`; subsequent rebases preserve the same source. Fresh final whole reviews and exact-head hosted gates remain required before ordinary integrator merge; no parent ARCH007, system adapter, shared fake or runtime isolation acceptance is claimed.
