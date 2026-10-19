---
id: OVE_ARCH017
title: "Implement workspace and TypeScript configuration resolution"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_review
depends_on: ["OVE_ARCH016"]
soft_depends_on: []
provides: ["lib:boundary-workspace-resolution"]
needs: ["lib:boundary-policy-inputs"]
owns: ["tools/boundaries/workspace.parse-boundary.ts", "tools/boundaries/compiler-options.parse-boundary.ts", "tools/boundaries/ts-resolve.ts", "tools/boundaries/resolution.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH017: Implement workspace and TypeScript configuration resolution

## 1. Summary

Longest owner prefix, exports/manifest identity, exact alias and confined store positives; tsconfig symlink denied by both public engines later.

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

1. Export readWorkspace(root) returning sorted packages and byName; WorkspacePackage contains path, parsed manifest and policy or undefined. Export ownerOf,packageSpecifier,relativeName,publicTargets,publicEntries and compilerOptions/resolveImport.
2. Discover actual apps/*,packages/*,packages/adapters/* and Tools manifests as bounded data only. Manifests use the 128 KiB reader; reject duplicate package names, governed directories missing manifests and symlink/nonregular inputs.
3. ownerOf uses longest path prefix with segment boundaries; domain2 must not match domain. Normalize backslashes in reported relative names. Parse scoped package roots/subpaths and explicit conditional/array exports without executing package code.
4. compilerOptions reads closest tsconfig through the strict reader with 512 KiB limits, preserving ORIGINAL path until symlink admission. TypeScript JSON/extends/parser failure is a safe Invalid TypeScript configuration error; absent config retains Bundler/ESNext/allowJs defaults.
5. resolveImport uses TypeScript resolution with these options and confined reads; aliases and relative escapes cannot disguise another workspace package. Only the admitted canonical dependency-manager store is permitted; no general source-symlink waiver.
6. Positive exports/aliases/store cases and missing/invalid/symlink tsconfig cases must be exercised directly now and by both public engines once present.

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

- [x] Longest-prefix ownership, scoped names, exported root/subpath and conditional exports return exact expected package identities.
- [x] Duplicate manifest names, unsafe/missing manifests, unknown config/extends or symlinked configuration reject; no premature realpath erases the denial.
- [x] TypeScript alias and confined-store positives resolve, while source escape/symlink and unresolvable targets cannot silently pass.
- [x] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/boundaries/resolution.test.ts
- After both engines exist: retain real symlink RED/GREEN and positive alias/store cases in imports/proving suites.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

### Actual verification checkpoint

- Direct resolver verification passed all 60 real-filesystem cases, covering exact
  ownership/exports/aliases, malformed and missing inputs, confined installed-store
  positives and both real hardlink denials. The original strict reader is unchanged.
- The integrator's finite four-path materialization repair first produced a real
  public-policy RED. Frozen installation and effective `clone-or-copy`, full
  typecheck/lint, the same public regression and all five policy integration cases
  passed. The external wrapper's wrong four-case count remains a failed receipt;
  its successful commands and additive continuation are recorded separately.
- The continuation passed the 60 resolver cases, dependency/license checks,
  high-production and critical-all audits, history/tree secret scans and scoped
  formatting. Normal publication at `718e0a83` passed full typecheck, lint and all
  800 unit tests in 109 files. No test assertion, deadline or retry was relaxed.
- Fresh exact `718e0a83` hosted [CI](https://github.com/wojciechlesniak/overmind/actions/runs/39240088385),
  [Security](https://github.com/wojciechlesniak/overmind/actions/runs/39240088291)
  and [Isolation](https://github.com/wojciechlesniak/overmind/actions/runs/39240088312)
  passed all required checks. Linux passed the original real installed-TypeScript
  positive. Implemented architecture checks, catalogue integration and documentation
  Git-environment integration passed; absent future boundary tools are not claimed.
- Independent whole Standards and Spec reviews passed without findings for all ten
  changed paths at `718e0a83`, including the four integrator-authored policy files.
  Both independently assessed Task section 12 and CONVENTIONS section 8: the
  directly applicable proof above is complete; the whole local integration glob
  was an additional diagnostic profile, rather than a named acceptance gate.
- Historical broad integration remains failed: 97 cases, 92 passed and 5 failed.
  The scoped diagnostic remains failed: 16 cases, 12 passed and 4 failed. Only two
  registry timeouts reproduced on the unaffected baseline; catalogue/Git/ADR failures
  are not claimed baseline-reproduced. Current required catalogue/Git hosted steps
  passed. No whole-glob success or universal environment cause is inferred.
- Original source REDs, the corrected ownership review finding, Linux nlink=2
  failure, failed launcher-equivalence diagnostic and failed count wrapper remain
  retained. The optional H2 timing probe was prepared but never executed.
- Evidence and exact hashes are in the PR's external applicability manifest and
  whole-review receipts. Fresh acceptance/done-head checks and reviews, normal
  latest-DEVELOP integration and actual post-merge CI/Security remain mandatory.
  Both public-engine proving suites remain future executions under section 12;
  parent ARCH002, real product/macOS penetration and isolation are not accepted.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
