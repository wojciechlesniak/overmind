---
id: OVE_ARCH033
title: "Implement engine lifecycle integration relocation"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: done
depends_on: ["OVE_ARCH032"]
soft_depends_on: []
provides: ["lib:engine-lifecycle-tooling"]
needs: ["lib:engine-bundler-tooling"]
owns: ["apps/engine/test/process.int.test.ts", "tools/build/engine/process.int.test.ts", "tools/tsconfig.json"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP016/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH033: Implement engine lifecycle integration relocation

## 1. Summary

Same actual compiled CLI, missing hooks20/nested dependency70, redacted detail, 5 s shutdown and second130, real Unix socket.

## 2. Context

Owner approved splitting OVE_ARCH002 on 2026-10-18, without a size or policy exception.
This task provides one independently verifiable prerequisite; OVE_ARCH002 retains final acceptance.

## 3. Scope (in)

Implement only the exact API/data/caller requirements below and the enumerated owns paths.
Shared paths require the integrator and affected owner to approve the exact finite integration.

## 4. Out of scope

No new product behavior, matrix permission, dependency version, policy exception or foreign claim/status.
No acceptance of OVE_ARCH002 or replay of its preserved bulk implementation; keep existing newer guards.

## 5. Detailed requirements

1. Move the full actual apps/engine/test/process.int.test.ts to tools/build/engine/process.int.test.ts; retain source/bundle dual execution and all existing child/test deadlines and cleanup. Carry forward OVE_ARCH032's already-corrected bundler import; relocate the current suite without reverting earlier caller repairs.
2. Actual missing compose/service hooks return20, nested missing dependency returns70, invalid args64 and version output/channel contracts remain. A present hook throwing is never mislabeled missing.
3. Retain real normal-detail bounded512 redaction in JSON/stderr, native Unix socket checks and broken-stdout behavior; privacy tests assert absence without printing sensitive markers.
4. Retain SIGTERM/SIGINT graceful shutdown, real hanging shutdown abandoned at5 s and immediate second signal130, including startup rejection while shutdown is active.
5. Retain actual bundler UI/undeclared-import/metafile/map/reproducibility and static protocol tests, including symlink, malformed/computed/cyclic/ambiguous literals and throwing contracts module.
6. Point the moved test at the real new bundler and original engine source; include it in normal integration discovery/typing, not a fake helper that bypasses public process behavior.

## 6. Design notes

N/A, functionality only. Public signatures/data and explicit denied cases above define the contract.

## 7. Reuse

Use the existing TypeScript/ESLint/Vitest and bounded tooling APIs. Canonical policy stays single-source.
Keep ESLint and standalone violation decisions independent; no copied permissive parser or second matrix.

## 8. Architecture and code placement

Exact source/test/caller paths are listed in owns. Product packages never import Tools.
Reconcile current OVE_SETUP017, OVE_OSS004 and OVE_ARCH003 integrations; preserve their protections.

## 9. Security and safety

Repository/config/source inputs are data. Preserve fail-closed canonical/symlink/regular-file/size/UTF8 rules.
Keep safe diagnostics, no secret values, actual Git isolation and all dependency/license/install controls.
Normal hooks, sensitive configuration labels, ownership and independent review remain mandatory.

## 10. Errors and edge cases

The explicit missing/malformed/unsafe cases above deny, never become a stub, skip or permission exception.
A genuine prerequisite/test failure remains recorded and stops dependent work; obtain a decision for scope conflicts.

## 11. Acceptance criteria

- [x] The complete moved public-process suite passes with every original budget/assertion, including five-second/second-signal and nested-dependency denials.
- [x] Real source and bundle CLI outputs agree on protocol/exit/channel contracts; privacy and Unix lifecycle remain tested.
- [x] All bundler/protocol security regressions remain live; the previously unrun moved suite is not called passed before execution.

## 12. Test plan

- pnpm exec vitest run --config vitest.int.config.ts tools/build/engine/process.int.test.ts
- pnpm typecheck and applicable original process/packaging checks; preserve actual failures without retry/budget increase.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.

Verified source `8daec33ba98e6604072be77146a7d07365d86580`: actual15 process/68 protocol tests, security,
whole reviews and source CI are recorded in PR #1008 and
`ove033-readme-repair-checkpoint-20261019.json`; fresh lifecycle/postmerge gates remain required.
