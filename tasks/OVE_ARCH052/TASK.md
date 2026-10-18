---
id: OVE_ARCH052
title: "Implement actual hook fixture integration"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH023", "OVE_ARCH051"]
soft_depends_on: []
provides: ["lib:boundary-hook-fixture"]
needs: ["lib:boundary-public-tools", "lib:eslint-static-inventory"]
owns: ["tools/hooks/hooks.int.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP005/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH052: Implement actual hook fixture integration

## 1. Summary

Unchanged CURRENT three-command pre-push assertions and frozen-offline install/deadlines; copy real checker/plugin/catalog inputs and same canonical public source store. The fourth check:boundaries expectation is transferred intact with the actual lefthook change in053, preventing a false prerequisite cycle.

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

1. Keep tools/hooks/hooks.int.test.ts exercising real disposable Git repositories and real Lefthook, prepare and frozen/offline installation with existing child/outer deadlines and isolated Git env.
2. Capture the source workspace public pnpm store path using store path --silent with COREPACK_ENABLE_NETWORK=0,3 s/4096-byte bounds. Validate absolute canonical existing directory and no control chars; never print private store/config/environment contents.
3. Pass the SAME actual effective versioned directory as --store-dir to unchanged install --frozen-lockfile --offline; do not guess a parent/suffix, add network fallback/prewarm/skip or change install-script rules.
4. Copy real available policy/plugin/checker fixture inputs needed by ESLint, preserving actual config/code bytes. Keep all current pre-commit/commit-msg, staged size/privacy, prepare-idempotence/CI/common-hook assertions.
5. Until053 changes the actual hook, pre-push still expects typecheck,lint,test in sequence with abort on first failure.OVE_ARCH053 transfers the fourth check:boundaries expectation atomically with its real command; do not create a prerequisite cycle.
6. The previous actual run remains2/3 with yargs18.2.0 absent from selected source store. A missing tarball is a prerequisite failure, never a GREEN, automatic exemption or permission to prewarm.

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

- [ ] Actual public store path and explicit fixture selection match canonically; no filesystem fallback or private path disclosure.
- [ ] All original real hook/prepare/frozen-offline assertions pass under unchanged budgets/scripts; missing tarball remains a visible blocking failure until legitimately resolved.
- [ ] Three-command hook expectation matches actual pre-activation config; fourth assertion is retained for atomic053 integration, not silently discarded.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run --config vitest.int.config.ts tools/hooks/hooks.int.test.ts
- Do not install/prewarm/retry as part of this planning. Run once only in an authorized slot with actual prerequisites; report genuine failure.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
