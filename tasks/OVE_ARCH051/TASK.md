---
id: OVE_ARCH051
title: "Implement static ESLint module inventory"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH023"]
soft_depends_on: []
provides: ["lib:eslint-static-inventory"]
needs: ["lib:boundary-public-tools"]
owns: ["tools/eslint/config-inventory.mjs", "tools/eslint/config-inventory.d.mts", "tools/eslint/config.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP003/TASK.md", "tasks/OVE_ARCH003/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH051: Implement static ESLint module inventory

## 1. Summary

Exact actual config-directory inventory of the EXISTING five literal namespaces, readonly unknown declaration then unchanged Zod validation; new/unlisted module refuses. Add the sixth boundaries module/import only atomically with root activation053.

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

1. Export configModules from config-inventory.mjs as a readonly ordered inventory of the EXISTING five module namespaces: base.mjs,react.mjs,tests.mjs,typescript.mjs,zz-vitest.mjs.
2. Use literal namespace imports only. The companion .d.mts exposes readonly [filename,unknown] tuples; existing Zod module/rule schema validates unknown before use. Do not add a broad any/declaration escape.
3. Compare the actual canonical eslint.config.d/*.mjs file set with inventory exactly; extra/missing/duplicate module must fail. Preserve rule-override ownership reporting from the real namespace contents.
4. Keep merged OVE_ARCH003 full pure assertions and tiny actual ESLint CLI positive/negative fixture, existing 5 s test/3 s child bounds and full normal pnpm lint; do not replay old stale config.test.ts.
5. Do NOT create/import boundaries.mjs yet because root auto-discovery would activate it.OVE_ARCH053 atomically adds its sixth literal namespace/module and generated-source/forbidden-import assertions.
6. Remove only variable module import from the composition test, without relaxing exact severity, generated-build ignore policy, schema validation or existing suppression-reason checks.

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

- [ ] Five current namespace imports typecheck through unknown+Zod and exactly match the real directory inventory.
- [ ] Added/missing/duplicate module or overriding critical rule is still detected; original037 actual CLI/pure assertions remain.
- [ ] Root global boundary policy has not been activated by this prerequisite; sixth module waits for053.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/eslint/config.test.ts
- pnpm typecheck; pnpm lint remains the full actual repository command, not the tiny test fixture.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
