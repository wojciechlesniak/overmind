---
id: OVE_ARCH035
title: "Implement telegram exact manifest edges"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: done
depends_on: ["OVE_ARCH001", "OVE_ARCH034"]
soft_depends_on: []
provides: ["lib:telegram-boundary-alignment"]
needs: ["lib:engine-foundation-markers"]
owns: ["packages/adapters/telegram/package.json", "packages/adapters/telegram/tsconfig.json", "pnpm-lock.yaml", "tools/skeleton.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_ARCH001/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH035: Implement telegram exact manifest edges

## 1. Summary

Exact prescribed dependency edges/catalog-only externals, no runtime addition and no manifest bypass.

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

1. Align @overmind/adapter-telegram dependencies to exactly application,contracts and api-client with workspace:*; remove domain runtime edge, add no other internal or external dependency.
2. Update tsconfig project references to those same three packages; keep compiler options, test separation and source/export identity.
3. Use normal generated lockfile for importer changes; catalog pins, dependency age/license/audit/install-script policies remain unchanged.
4. Update scaffold assertions to check the exact internal edge set rather than membership alone; api-client is already an existing workspace package, not a new runtime capability.
5. Build/typecheck the adapter and dependent engine; do not implement Telegram behavior or weaken matrix/test restrictions to satisfy the graph.

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

- [x] Manifest and tsconfig contain exactly api-client/application/contracts and no domain edge; lockfile is normally generated/frozen-valid.
- [x] Exact scaffold graph assertion rejects an added/removed wrong edge; actual adapter and engine typechecks/build still pass.
- [x] No unrelated source behavior, package version or policy changed.
- [x] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/skeleton.test.ts
- pnpm typecheck; pnpm check:deps; normal frozen install validation.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.

Verified source `413d8c97e7fe0e454f62d21d0a1e902c18b4b780`: 9 scaffold and 931 unit tests,
adapter/engine builds, security, whole reviews and source CI: PR #1014 and
`ove035-source-checkpoint-20261019.json`. Fresh lifecycle/postmerge gates remain required.
