---
id: OVE_ARCH053
title: "Implement final activation and sensitive configuration integration"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH024", "OVE_ARCH031", "OVE_ARCH033", "OVE_ARCH034", "OVE_ARCH035", "OVE_ARCH045", "OVE_ARCH046", "OVE_ARCH048", "OVE_ARCH050", "OVE_ARCH051", "OVE_ARCH052"]
soft_depends_on: []
provides: ["ci:boundary-tools-activated"]
needs: ["lib:boundary-proving-oracle", "lib:desktop-acceptance-tooling", "lib:engine-lifecycle-tooling", "lib:engine-foundation-markers", "lib:telegram-boundary-alignment", "lib:vitest-static-discovery", "lib:pure-timezone-fixtures", "lib:dom-boundary-fixture", "lib:docs-plugin-registry-cli", "lib:eslint-static-inventory", "lib:boundary-hook-fixture"]
owns: ["eslint.config.d/boundaries.mjs", "eslint.config.mjs", "lefthook.yml", "package.json", "tools/ci/architecture.ts", "tools/ci/config-integrity.ts", "tools/ci/gates.test.ts", ".github/CODEOWNERS", ".github/workflows/ci.yml", "AGENTS.md", "tools/boundaries/ci-job.yml", "tools/hooks/hooks.int.test.ts", "tools/eslint/config-inventory.mjs", "tools/eslint/config.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP006/TASK.md", "tasks/OVE_SETUP003/TASK.md", "tasks/OVE_SETUP005/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH053: Implement final activation and sensitive configuration integration

## 1. Summary

Real complete commands run in root lint/hook/hosted architecture+ci-success; all sensitive prefixes retain existing OVE_SETUP017/OVE_OSS004/OVE_ARCH003 policy and negative labels; generated source is checked, zero exemptions.

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

1. After every declared prerequisite is merged, point BOTH root boundaries and check:boundaries scripts to tsx tools/boundaries/check.ts and update tools/ci/architecture.ts to the same real file, replacing the missing-tool foundation path. Architecture must treat the activated tool as mandatory even while OVE_ARCH002 final acceptance is todo; deletion/unavailability must not fall back to the old unfinished-task skip.
2. Add eslint.config.d/boundaries.mjs and the sixth literal inventory entry atomically, using boundariesConfig(root) with all seven errors/noInlineConfig. Generated product sources remain checked; no policy/test/package/global import exemption.
3. Add actual sequential Lefthook pre-push check:boundaries after typecheck,lint,test, and change its real fixture expectation to those exact FOUR commands in the same change; abort on first failure remains.
4. Integrate tools/boundaries/ci-job.yml into the existing required architecture job/aggregate path; actual checker failure/missing command/removal/skip/allowed-failure cannot report ci-success. Do not create an always-green stub or drop required integrations.
5. Protect root/plugin/checker/matrix, moved build/Vite/Vitest and existing package-engine/errors/docs paths in CODEOWNERS/config gate. Preserve config-change,lint-config-change,hooks-change protections and actual negative workflow/label tests.
6. Update AGENTS command availability only when the real tool runs; maintain exact 18 test projects and all existing source/coverage/security policies. Add actual forbidden generated-source ESLint test without replacing merged OVE_ARCH003 tiny CLI regressions.
7. Pass actual root lint/boundaries/full applicable gates on the completed integrated repository. OVE_ARCH002 still owns final exact acceptance/runtime and separate real violating scratch PR; do not mark it done here.

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

- [ ] Both root scripts, root lint, sequential hook and hosted architecture invoke the actual complete checker; real forbidden source fails with its specific diagnostic.
- [ ] All seven rules/generated files/suppression denial and fourth hook abort behavior are live; no stale foundation stub or variable registry import remains.
- [ ] Actual required-gate/label negative mutations reject removal/skip/failure/allowed-failure and preserve aggregate rejection plus all previous guards.
- [ ] AGENTS availability is truthful, independent exact-head reviews/CI pass, and OVE_ARCH002 nine acceptance criteria remain unchecked for its real proof.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm boundaries; pnpm check:boundaries; pnpm lint; pnpm check:agents-md
- pnpm exec vitest run tools/ci/gates.test.ts tools/eslint/config.test.ts; real hooks.int.test.ts and mandatory CI/workflow mutations
- Run normal applicable full checks; the separate real forbidden-import scratch PR remains OVE_ARCH002 work.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
