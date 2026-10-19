---
id: OVE_ARCH018
title: "Implement eSLint static import resolution"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: done
depends_on: ["OVE_ARCH017"]
soft_depends_on: []
provides: ["lib:boundary-eslint-resolution"]
needs: ["lib:boundary-workspace-resolution"]
owns: ["eslint-rules/boundaries/resolve-package.ts", "eslint-rules/boundaries/import-nodes.ts", "eslint-rules/boundaries/import-capabilities.ts", "eslint-rules/boundaries/resolution.test.ts", "eslint-rules/boundaries/tsconfig.json", "eslint-rules/boundaries/vitest.config.ts", "vitest.config.ts", "tsconfig.tests.json"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH018: Implement eSLint static import resolution

## 1. Summary

Native RuleTester resolves workspace/type/relative/exports and fails unknown package or unverifiable input without executing source.

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

1. Provide environment(root, ESLint RuleContext), packageTarget(env,specifier), matrix/test-only/cross-adapter helpers and literal importNodes/importCapability helpers; return metadata, never execute project imports.
2. Resolve @overmind names, relative paths and TS aliases through017; retain actual manifest exports, nominal/resolved owner, public target/subpath, builtin, unknown and unresolved classifications. Unverifiable governed targets must remain detectable errors.
3. Cache only by actual sourceCode identity and canonical root. Identify test files by the established test suffix/test directory; tests may gain matrix imports only, never forbidden ambient/builtin permissions.
4. Enumerate import/export/import-equals/import-type/dynamic-import/require syntax; nonliteral specifiers remain unknown for a rule to report. Capability classification normalizes node: and bare names without granting platform access.
5. Add the actual boundary-rules Vitest project and test-compiler inputs without spreading a global plugin. Keep 17 workspace projects (16 product+Tools); the plugin is a separate18th test project, not a new workspace package.
6. Resolver tests must prove unknown workspace and unsafe source/config failures, deep/public entry distinctions and permitted ports/type-only cases before downstream rules use them.

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

- [x] Native ESLint parser/RuleTester resolution distinguishes allowed public imports from alias/relative/deep/unknown targets with exact package/subpath metadata.
- [x] Unsafe/unresolved governed inputs fail closed; lexical test detection does not erase builtin/global restrictions.
- [x] Root discovery retains all 17 workspace projects and adds exactlyone boundary-rules project; no global boundary rules are enabled yet.
- [x] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run --project boundary-rules eslint-rules/boundaries/resolution.test.ts
- pnpm exec tsc -b eslint-rules/boundaries; actual root test-config inclusion check.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.

Verified native resolution, security7, whole source reviews and source CI: PR #1013.
Evidence retains every failed attempt; fresh lifecycle and postmerge checks remain required.
