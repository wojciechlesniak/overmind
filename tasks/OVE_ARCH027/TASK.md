---
id: OVE_ARCH027
title: "Implement same-pin build dependencies and destination protection"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: ["OVE_SETUP017", "OVE_OSS004"]
soft_depends_on: []
provides: ["lib:relocated-build-prerequisites"]
needs: []
owns: ["tools/package.json", "pnpm-lock.yaml", "docs/dependencies.md", ".github/CODEOWNERS", "tools/ci/config-integrity.ts", "tools/ci/gates.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP017/TASK.md", "tasks/OVE_OSS004/TASK.md", "tasks/OVE_SETUP008/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH027: Implement same-pin build dependencies and destination protection

## 1. Summary

Same exact esbuild0.28.2/SWC4.3.3 versions; normal generated lock/frozen install; new tools/build/,tools/vite/,tools/vitest-projects/ protected and every legacy/014/OVE_ARCH025 guard retained.

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

1. Add development-only Tools catalog references for existing esbuild0.28.2 and @vitejs/plugin-react-swc4.3.3 needed by relocated build helpers; preserve exact current approved pins.
2. Regenerate pnpm-lock.yaml only through the real package manager. Retain old consumer declarations until their actual relocation removes them; no hand-edit, engine/Node change or runtime dependency expansion.
3. Update dependency justification/importer ownership without new licenses or exceptions; frozen install, age/audit/checksum/allowBuilds/strictDepBuilds restrictions remain.
4. Protect new tools/build/,tools/vite/ and tools/vitest-projects/ paths in CODEOWNERS/config-integrity before callers move there, with actual changed-path negative label regressions.
5. Retain every current root/Tauri/package-engine/errors/Markdown policy prefix and label requirement; do not overwrite current gate files with the preserved old version.
6. Changes are prerequisite availability/protection only, not product build behavior, global boundary activation or removal of source-side dependencies.

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

- [ ] Actual generated lock and frozen install resolve the exact existing versions under unchanged dependency/license/script policy.
- [ ] Every new sensitive destination requires config-change and applicable Owner approval; each previously protected prefix remains protected.
- [ ] Current app builds still work from old paths until their own relocation; no premature dependency removal.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/ci/gates.test.ts; pnpm install --frozen-lockfile
- pnpm check:deps; pnpm check:licenses; preserve actual config-change negative fixture.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
