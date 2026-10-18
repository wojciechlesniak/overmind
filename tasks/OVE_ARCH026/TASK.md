---
id: OVE_ARCH026
title: "Implement static engine protocol source reader"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH016"]
soft_depends_on: []
provides: ["lib:engine-static-protocol"]
needs: ["lib:boundary-policy-inputs"]
owns: ["tools/build/engine/protocol.parse-boundary.ts", "tools/build/engine/protocol.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH026: Implement static engine protocol source reader

## 1. Summary

Literal protocol/reexport traversal and cyclic/ambiguous/computed/mutable/malformed/symlink rejection; throwing source is never run.

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

1. Export readProtocol(root)->positive safe integer from tools/build/engine/protocol.parse-boundary.ts, using contracts source as data through the existing confined reader.
2. Follow PROTOCOL_VERSION literal exports from packages/contracts/src/index.ts, named aliases, local const, export-star and relative TS/JS-to-TS reexports. Accept numeric const wrapped by parentheses/as/satisfies only, not evaluation.
3. Read at most128 source files, each<=256 KiB under the canonical contracts/src root; reject malformed syntax, cycles, escape/symlink, unresolved and competing origins, mutable/computed/nonpositive/unsafe values.
4. Preserve established protocol1 fallback only when contracts entry/export is genuinely absent; missing intermediate referenced source or malformed metadata must not silently use fallback.
5. Never import/evaluate the entry: an otherwise valid contracts file that throws at runtime must still yield its reexported literal safely.
6. Provide direct source-reader tests before the bundler consumes it; keep public bundle stamp regressions with the later engine integration.

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

- [ ] Direct/local/named/star literal cases return exact version; runtime-throwing valid source is not executed.
- [ ] All invalid/cyclic/ambiguous/mutable/computed/nonpositive/oversized/escape/symlink cases deny with fixed Invalid contracts protocol version.
- [ ] Established genuine-absence fallback1 is preserved without swallowing other read/parse failures.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/build/engine/protocol.test.ts
- Later bundled public protocol tests must retain real throwing-module and malformed-source fixtures.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
