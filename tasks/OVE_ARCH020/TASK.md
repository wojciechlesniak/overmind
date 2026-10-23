---
id: OVE_ARCH020
title: "Implement forbidden builtins and ambient capability rules"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: ["OVE_ARCH018"]
soft_depends_on: []
provides: ["lib:boundary-capability-rules"]
needs: ["lib:boundary-eslint-resolution"]
owns: ["eslint-rules/boundaries/no-forbidden-builtins.ts", "eslint-rules/boundaries/no-forbidden-globals.ts", "eslint-rules/boundaries/no-forbidden-builtins.test.ts", "eslint-rules/boundaries/no-forbidden-globals.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH020: Implement forbidden builtins and ambient capability rules

## 1. Summary

Unshadowed capabilities, aliases/computed access, Function/eval and zero-arg Date; shadows remain valid; tests receive no ambient exception.

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

1. Implement noForbiddenBuiltins(root) and noForbiddenGlobals(root) as separate RuleModule factories; read forbidden capabilities from the canonical policy, not a second allowlist.
2. Normalize node: and bare builtin forms, including fs/promises, process spawning, network, threads and randomness. Report BOUNDARY_FORBIDDEN_BUILTIN; blocked @tauri/platform package reports BOUNDARY_FORBIDDEN_PACKAGE.
3. Desktop/ui-kit cannot import any node:*; @tauri-apps/* is allowed only inside the exact desktop/src/shared/platform/tauri segment subtree. A similarly named prefix outside it is denied.
4. Globals include Date.now, zero-arg new Date, Math.random, process.env, fetch, console members, timers, eval and Function constructors. Cover named/global-object aliases, computed access and bare global-object capability escapes.
5. Distinguish local runtime lexical shadows from ambient declarations or bindings in another file; the latter cannot legalize an actual ambient access. Shorthand properties and member names must not create missing/duplicate diagnostics.
6. Apply capabilities to tests as well as production; test matrix overlays never grant time/random/process/network access. Keep valid fixed-date inputs and genuinely local shadow positives.

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

- [ ] Bare/node-prefixed/subpath builtins and unsafe platform locations fail exact IDs; exact Tauri bridge location passes.
- [ ] All listed ambient capabilities, aliases and computed constructors fail; runtime shadows and fixed-argument Date positives pass.
- [ ] Cross-file/ambient names cannot hide globals, and no test exemption or duplicate member diagnostic appears.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run --project boundary-rules eslint-rules/boundaries/no-forbidden-builtins.test.ts eslint-rules/boundaries/no-forbidden-globals.test.ts

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
