---
id: OVE_ARCH048
title: "Implement dOM fixture capability alignment"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH037", "OVE_ARCH023"]
soft_depends_on: []
provides: ["lib:dom-boundary-fixture"]
needs: ["lib:vitest-relocation-batch-one", "lib:boundary-public-tools"]
owns: ["packages/api-client/src/dom-environment.test.ts", "tools/boundaries/dom-fixture.int.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH048: Implement dOM fixture capability alignment

## 1. Summary

Same real jsdom matcher/stub/cleanup/network/script denial with data-attribute marker; no bare global object escape.

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

1. Keep api-client src/dom-environment.test.ts as a per-file happy-dom test while the package default remains Node; actual document availability still selects setup-dom.
2. Preserve testing-library render/toBeInTheDocument, matchMedia, ResizeObserver, IntersectionObserver and scrollTo stubs plus cleanup of the previous rendered element.
3. Keep real fetch denial to example.com and the actual appended script-execution test. Use a DOM data-attribute marker, not a bare globalThis/window process-capability escape.
4. After appending the script, assert the attribute was never set; cleanup removes both script and marker in finally. A script must not access the test process even when DOM methods exist.
5. Change only marker observation/access necessary for strict globals; do not replace execution denial with static-string checking or enable HappyDOM JavaScript/network/file loading.
6. Add tools/boundaries/dom-fixture.int.test.ts as a Tools-owned integration proof using the actual corrected api-client DOM test source. Before global OVE_ARCH053 activation, invoke the native ESLint class with the complete boundaryPlugin/boundariesConfig from OVE_ARCH023 explicitly, not the still-unactivated root configuration. Also run the ACTUAL tools/boundaries/check.ts --root <isolated-mini-workspace> --json on copied actual sources with the real policy and confined resolver scaffolding. Reuse existing miniature/CLI fixture seams; declarations may model external imports for static resolution only, never substitute runtime tests. Positive sources must have zero violations; an independent globalThis.eval or another capability forbidden by the real api-client policy mutation must fail both tools with the real capability diagnostic. No new --files switch, full-root GREEN claim, variable import or activation dependency.

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

- [ ] All three real per-file DOM cases pass: matchers/stubs/network denial, cleanup and script nonexecution.
- [ ] Boundary checker and ESLint accept the DOM-only marker while still denying bare global-object capability escapes.
- [ ] The explicit native complete plugin and actual public checker accept the copied corrected sources and reject the independently injected forbidden-capability control before OVE_ARCH053 exists; original real runtime project tests still run separately.
- [ ] Package Node default and all DOM/network/security setup restrictions remain intact.

## 12. Test plan

- pnpm exec vitest run --project api-client packages/api-client/src/dom-environment.test.ts
- pnpm exec vitest run --config vitest.int.config.ts tools/boundaries/dom-fixture.int.test.ts; fixture must use native ESLint class with explicit OVE_ARCH023 config AND spawn the actual check.ts --root <isolated-mini-workspace> --json. No root/global lint PASS is claimed before OVE_ARCH053.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
