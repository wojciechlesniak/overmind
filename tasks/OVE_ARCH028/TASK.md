---
id: OVE_ARCH028
title: "Implement desktop distribution guard relocation"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH027"]
soft_depends_on: []
provides: ["lib:desktop-dist-guard-tooling"]
needs: ["lib:relocated-build-prerequisites"]
owns: ["apps/desktop/scripts/check-dist.mjs", "tools/build/desktop/check-dist.mjs", "apps/desktop/test/check-dist.test.ts", "tools/build/desktop/check-dist.test.ts", "apps/desktop/package.json", "tools/ci/gates.test.ts", "apps/desktop/scripts/build.int.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP009/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH028: Implement desktop distribution guard relocation

## 1. Summary

Every real bundle/privacy/URL/script denial remains; exact two React-function prose allowances; native actual bundle passes.

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

1. Move check-dist.mjs and its unit test from desktop scripts/test to tools/build/desktop; preserve exported checkDist(directory,allowancePath?) result {failures,largest} and CLI exit/report behavior.
2. Default input remains apps/desktop/dist; reviewed allowances stay apps/desktop/scripts/check-dist.allow.json, not a new Tools-local policy. Update exact desktop build script and moved-test imports/root calculation.
3. Retain recursive regular-file/symlink denial,32 MiB file limit, required index.html, largest10 byte report and source-map/sourceMappingURL rejection.
4. Deny eval/new Function, remote URLs/providers, inline styles and unsafe script tags. Keep only the two exact reviewed React error-format prose functions; real request/import of the same URL or uppercase HTTPS remains denied.
5. Validate script attributes/src/type/crossorigin exactly; duplicate/unknown attributes, remote/protocol-relative/src-less and inline execution fail. Do not broaden JSON allowance grammar or policy patterns.
6. Run the actual current production bundle through the new CLI; keep permission/allowance ownership and negative configuration checks at their existing paths.
7. Before deleting apps/desktop/scripts/check-dist.mjs, minimally update the CURRENT apps/desktop/scripts/build.int.test.ts guard child argv to tools/build/desktop/check-dist.mjs. Keep this test in its original location until OVE_ARCH031 and preserve all build/environment/scanner assertions and deadlines. No compatibility stub or deferred caller repair.

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

- [ ] All original guard cases pass at the new path, including wrong attributes, remote imports, uppercase URL, maps and symlinks.
- [ ] Actual Vite bundle passes; injected unsafe script/remote request fails; only exact reviewed React prose survives.
- [ ] The still-unmoved apps/desktop/scripts/build.int.test.ts passes using the new guard immediately in this PR; no child invokes the removed scripts/check-dist.mjs.
- [ ] Desktop build points to the relocated guard while the original allowlist remains canonical and protected.

## 12. Test plan

- pnpm exec vitest run tools/build/desktop/check-dist.test.ts
- pnpm --filter @overmind/desktop build; node tools/build/desktop/check-dist.mjs apps/desktop/dist
- pnpm exec vitest run --config vitest.int.config.ts apps/desktop/scripts/build.int.test.ts (current caller, before OVE_ARCH031).

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
