---
id: OVE_ARCH034
title: "Implement engine foundation marker alignment"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: ["OVE_ARCH032", "OVE_ARCH033"]
soft_depends_on: []
provides: ["lib:engine-foundation-markers"]
needs: ["lib:engine-bundler-tooling", "lib:engine-lifecycle-tooling"]
owns: ["apps/engine/src/compose/index.ts", "apps/engine/src/service/index.ts", "apps/engine/src/cli.ts", "apps/engine/src/commands/run.ts", "apps/engine/src/commands/ensure-running.ts", "apps/engine/test/cli.test.ts", "apps/engine/package.json", "apps/engine/tsconfig.json", "apps/engine/README.md", "tools/skeleton.test.ts", "pnpm-lock.yaml"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP016/TASK.md", "tasks/OVE_ARCH006/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH034: Implement engine foundation marker alignment

## 1. Summary

Exact absent hooks preserve20, actual hook exported only when implemented, unknown/malformed markers denied, original startup/signal/privacy assertions unchanged.

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

1. After OVE_ARCH033 has merged the real moved process suite, create only foundation compose/index.ts and service/index.ts exports UNIMPLEMENTED=true; do not implement DI or service lifecycle owned by future tasks.
2. Add isUnimplementedHook(unknown)->boolean that accepts ONLY a nonnull module object with exactlyone own enumerable export named UNIMPLEMENTED with value true. False/extra/malformed exports must not mask a real hook error.
3. Replace missing-module type suppressions with literal hook imports; exact marker follows existing missing-hook20 path. A present real hook is called normally and nested dependency/import/runtime failures remain70.
4. Align engine runtime manifest/tsconfig to the architecture graph: adapters, application/contracts/domain/gateway/workflow-runtime remain; remove api-client and ui-kit edges. Preserve build/start/test script contracts.
5. Regenerate lock after exact edge removal and update scaffold assertions/README honestly: marker is not engine availability or a working compose/service feature.
6. Keep the actual original CLI/signal/privacy behavior and all process tests; generated-source boundary checking has no exception for marker files.

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

- [ ] Exact marker returns20; false/extra/invalid marker and nested dependency cases follow actual internal-failure behavior instead of silently claiming unimplemented.
- [ ] Engine manifest and project references match exact permitted runtime edges; no UI/API-client edge remains.
- [ ] Present hooks still execute and preserve shutdown/signal/privacy contracts; foundation docs claim no implemented engine/service.

## 12. Test plan

- pnpm exec vitest run apps/engine/test/cli.test.ts tools/skeleton.test.ts
- pnpm exec vitest run --config vitest.int.config.ts tools/build/engine/process.int.test.ts; engine build/typecheck.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
