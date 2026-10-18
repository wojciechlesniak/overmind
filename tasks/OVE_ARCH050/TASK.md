---
id: OVE_ARCH050
title: "Implement documentation registry caller and public CLI proof"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH049"]
soft_depends_on: []
provides: ["lib:docs-plugin-registry-cli"]
needs: ["lib:docs-plugin-static-registry"]
owns: ["tools/docs-check/plugins.ts", "tools/docs-check/plugins.test.ts", "tools/docs-check/run.ts", "tools/docs-check/registry.int.test.ts", "package.json", "tools/docs-check/README.md"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_OSS004/TASK.md", "tasks/OVE_OSS005/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH050: Implement documentation registry caller and public CLI proof

## 1. Summary

check:docs regenerates registry BEFORE loading it on every invocation inclcheck/docs CI/publish; actual auto-added plugin executes, deleted/malformed/symlink candidate denies BEFORE marker execution. Existing flags/plugin diagnostics/path checks/i18n and <10 s budget retained.

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

1. Wire every public pnpm check:docs invocation to regenerate/validate049 registry BEFORE importing the runPlugins consumer; preserve all existing CLI flags including --publish,--i18n and optional external-link checks.
2. runPlugins consumes static registry namespaces with existing PluginContext {root,files,paths,flags}, pluginModule and pluginDiagnostics. Freeze context/flags as before and reject diagnostics targeting untracked paths.
3. Keep all automatically discovered tools/docs-*/check.ts plugins, stable sorted execution and existing plugin-failure fixed diagnostics. Missing i18n remains a warning normally and error under --i18n until005 implements it.
4. The actual CLI must observe a newly added valid plugin and a removed plugin on consecutive invocations, not a stale module cache/manual list; plugin return values/diagnostics still use strict existing schemas.
5. Actual malformed/symlink/escape candidate denial occurs before its execution marker; preserve no-secret logs, atomic generation failure and all default/publish/link/Markdown checks.
6. Keep original docs checker under 10 s requirement and flags/exit semantics. A static registry is not permission to ignore future plugins or turn mandatory publish errors into warnings.

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

- [ ] Actual public CLI auto-discovers and executes a newly added valid plugin with existing validated context/diagnostics; removal cannot leave a stale imported entry.
- [ ] Malformed/unsafe candidate is denied before execution, with fixed safe diagnostic; untracked or malformed plugin result fails as before.
- [ ] Normal/publish/i18n behavior and original required checks/under 10 s contract remain, with no variable plugin import.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/docs-check/plugins.test.ts
- pnpm exec vitest run --config vitest.int.config.ts tools/docs-check/registry.int.test.ts; pnpm check:docs; actual publish still denies unresolved original obligations.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
