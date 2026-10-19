---
id: OVE_ARCH016
title: "Implement confined policy reader and matrix consistency"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_review
depends_on: ["OVE_ARCH001", "OVE_SETUP003"]
soft_depends_on: []
provides: ["lib:boundary-policy-inputs"]
needs: []
owns: ["tools/boundaries/policy.parse-boundary.ts", "tools/boundaries/consistency.test.ts", "tools/boundaries-fixtures/workspace.ts", "tools/boundaries/policy.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH016: Implement confined policy reader and matrix consistency

## 1. Summary

Malformed/missing/oversized/non-UTF8 policy; preserved-mtime cache invalidation; canonical bounded regular-file reads; every Markdown/JSON cell agrees.

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

1. Export readSource(root, absolutePath, maxBytes?) -> string and loadCatalog(root) -> BoundaryCatalog, with exported BoundaryCatalog/BoundaryPackage types; no source/config execution.
2. readSource defaults to 2 MiB; policy reads are512 KiB. Resolve canonical paths and reject escape, aliases/symlinks, non-regular files and oversize. Open O_NOFOLLOW|O_NONBLOCK; verify descriptor identity/type and unchanged size/mtime/ctime, close on every path and decode fatal UTF8.
3. Parse policy as unknown JSON with a strict version 1 schema: packages, testOnly and toolsMayImportAny. Each package has id,path,layer,allowedImports,allowedSubpaths,forbiddenBuiltins,forbiddenGlobals,forbiddenPackages; unknown fields, duplicate IDs/paths and unknown referenced IDs deny. Package IDs are lowercase canonical identifiers<=128 characters; paths<=256 have no empty or parent segments; layer is integer -1..4 and packages count1..512. Preserve the current bounded string-list validation.
4. Cache validated policy per canonical root/file identity including dev/ino/size/mtime/ctime; repeat unchanged reads reuse it. A preserved-mtime byte change must invalidate validation; failures are never cached as successful policy.
5. Compare every 14x10 documented matrix cell with JSON independently: complete row/column identities, adapter wildcard groups, tests, Tools/testing and application/ports. Missing/extra rows or either side changed alone must fail.
6. Keep fixture workspace creation isolated with complete cleanup and no pnpm requirement. Put reader-only denial tests in policy.test.ts; they must not import unfinished scan.ts.

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

- [x] Canonical valid policy loads and unchanged identity reuses it; preserved-mtime edit revalidates and reports the changed/invalid input.
- [x] Missing/malformed JSON, unknown field/reference, duplicate ID/path, non-UTF8, oversize, source symlink/escape/FIFO and changed descriptor are denied safely.
- [x] All 140 real matrix cells agree; independent JSON and Markdown mutations each fail, including wildcard partial access.
- [x] Reader tests and consistency tests run without the scanner/plugin or root activation.
- [x] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/boundaries/policy.test.ts tools/boundaries/consistency.test.ts
- pnpm typecheck; applicable CONVENTIONS Definition of Done and exact-head review/CI.

The original budgets, assertions and retry0 remain unchanged.

Acceptance checkpoint: source `cf40f11a271bc02a6fc06bbd9b96c4924b5e8fac`
passed the complete original local CI/security sequence in one wrapper: all 21
selected commands passed, with 627 covered unit tests, 92 integration tests,
four dependency-policy CLI tests and 33 Rust tests. The separate native reader
and matrix suites passed all 56 tests. The reader tracer and three catalogue
identity regressions first failed on actual behavior; those RED receipts and
prior native type/style failures remain retained.

The source-ready receipt is `ove016-source-ready-cf40f11-20261019.json`.
The source was normally rebased to DEVELOP `ddfa3b57c1d91927bafcc76c3514c3780916232a`;
all four source objects and dependency, Cargo and policy bytes were verified
unchanged. The normal publication hooks passed full typecheck, lint and all 667 tests
in 107 files at rebased in-review checkpoint `6daf8069a2e9828ef1159b9d7dd2b8df169b1ea2`.
Its independent Standards and Spec continuity reviews passed with zero findings,
and its actual hosted workflows passed:

- [CI](https://github.com/wojciechlesniak/overmind/actions/runs/39215575275)
- [Security](https://github.com/wojciechlesniak/overmind/actions/runs/39215575170)
- [Isolation gate](https://github.com/wojciechlesniak/overmind/actions/runs/39215575153)

The initial public finish push and the first recovery push failed; the latter
exposed an existing configuration-policy test exceeding its unchanged 30-second
limit. The same case passed in isolation. The normal rebased publication used
one Vitest worker while retaining every original assertion, budget and hook.
The external first full-run preparation failure occurred before any gate ran.
These failures remain recorded, without being relabelled as successes.

Cargo-audit retains five policy-allowed warnings. Both local secret scans found
zero secrets and retained one Keychain warning each. Every later metadata head
still requires fresh hosted checks and independent continuity reviews before
normal DEVELOP integration. Reserved boundary, contract, header, task-lint and
ownership tools are not claimed as implemented controls. No actual macOS escape,
product penetration, absent desktop acceptance scripts, Storybook implementation,
later scanner/plugin or parent ARCH002 acceptance is inferred.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
