---
id: OVE_ARCH031
title: "Implement desktop integration test relocation"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: ["OVE_ARCH028", "OVE_ARCH029", "OVE_ARCH030"]
soft_depends_on: []
provides: ["lib:desktop-acceptance-tooling"]
needs: ["lib:desktop-dist-guard-tooling", "lib:desktop-tauri-guard-tooling", "lib:desktop-vite-tooling"]
owns: ["apps/desktop/scripts/build.int.test.ts", "tools/build/desktop/build.int.test.ts", "apps/desktop/scripts/dev-server.int.test.ts", "tools/build/desktop/dev-server.int.test.ts", ".github/workflows/ci.yml", "tools/ci/gates.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP009/TASK.md", "tasks/OVE_SETUP007/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH031: Implement desktop integration test relocation

## 1. Summary

All real loopback/Host/CORS/fs/proxy/strictport/build/privateenv/scanner assertions and deadlines unchanged; CI names new paths.

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

1. Move actual desktop build.int.test.ts and dev-server.int.test.ts from scripts to tools/build/desktop, preserving every assertion/deadline and correcting only roots/imports/caller paths. Preserve the already-merged minimal caller updates from OVE_ARCH028/030; relocate the corrected current files, not their stale preserved pre-fix bytes.
2. The real production test must build with relocated Vite config, deny private env markers and source maps, run the relocated dist guard and actual pinned secret scanner with a deliberate redacted negative credential.
3. The real dev-server test must verify IPv4 loopback, hostile Host403, CORS denial, outside-filesystem denial, loopback-only proxy/Host preservation and strict occupied-port refusal.
4. Keep isolated Git/env/temp fixtures and terminate actual spawned servers on success/failure; no ports/processes remain after testing.
5. Update the existing hosted desktop acceptance step to the two exact new files and actual config-existence path; preserve required job/aggregate semantics and current integration gate assertions.

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

- [x] All five actual server/build integrations run at new paths and preserve original hostile/private-environment/secret-scanner denials.
- [x] The protected CI step invokes both relocated suites and cannot disappear through the old config/path condition.
- [x] No original test, assertion, timeout or process cleanup was dropped or replaced by a stub.

## 12. Test plan

- pnpm exec vitest run --config vitest.int.config.ts tools/build/desktop/dev-server.int.test.ts tools/build/desktop/build.int.test.ts
- pnpm exec vitest run tools/ci/gates.test.ts; actual workflow lint and applicable normal checks.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.

### Verified acceptance (2026-10-19)

All fifteen relocated integration cases and the existing CI gate tests passed locally.
The exact published source passed hosted CI/Security/Isolation; its build job ran
both new suite paths with fifteen passed cases. Evidence and limitations: PR #1007.
