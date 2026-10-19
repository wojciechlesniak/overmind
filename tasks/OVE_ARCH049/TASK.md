---
id: OVE_ARCH049
title: "Implement automatic documentation plugin registry generation"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_review
depends_on: ["OVE_OSS004"]
soft_depends_on: []
provides: ["lib:docs-plugin-static-registry"]
needs: []
owns: ["tools/docs-check/plugin-registry.ts", "tools/docs-check/plugin-registry.test.ts", "tools/docs-check/plugin-registry.generated.ts", "tools/docs-check/input.parse-boundary.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_OSS004/TASK.md", "tasks/OVE_OSS005/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH049: Implement automatic documentation plugin registry generation

## 1. Summary

Discover every canonical tools/docs-[a-z0-9-]+/check.ts automatically; deterministic literal imports; no arbitrary imported path or executing candidates during generation; bounded/fatalUTF8/symlink denial.

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

1. Provide a development-only deterministic registry generator for every tracked canonical tools/docs-[a-z0-9-]+/check.ts plugin path, discovered from the actual document-check inventory rather than a hand-maintained name list.
2. Validate plugin candidate path/regular-file/canonical-root/UTF8/size using existing bounded docs readers before generating anything. Reject symlink/escape/unknown syntax safely, without importing or executing candidate code during discovery.
3. Generate plugin-registry.generated.ts with sorted literal namespace imports and immutable path->unknown namespace entries. Use existing pluginModule/pluginDiagnostics validation at the execution boundary; no any, eval, new Function or variable import.
4. Repeat generation against unchanged inventory must produce identical bytes; added/removed real candidates change the registry completely. Missing/malformed inventory denies rather than keeping stale success.
5. Use existing bounded atomic repository writer or approved ephemeral generated-file lifecycle so failed admission cannot overwrite a valid output or execute a candidate. No new dependency, Node policy or runtime user plugin installation.
6. Keep generated output checked and independently inventory-compared; discovery must remain automatic for future005 i18n and any valid docs-* checker. Do not filter candidates to make boundaries pass.

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

- [x] Actual added/removed docs-* check.ts changes sorted literal imports deterministically; all discovered candidates are present exactlyonce.
- [x] Symlink/escape/nonregular/oversize/invalid UTF8 candidates fail before any harmless execution marker can run.
- [x] Generated values stay unknown until existing schemas validate; no variable import or manual omitted-plugin list remains in the registry mechanism.
- [x] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/docs-check/plugin-registry.test.ts
- Use disposable real Git inventory fixtures for candidate add/remove/determinism and admission denials; no candidate source execution.

The required commands retain their original budgets, assertions and retry0.

Acceptance checkpoint: source `5821807655e9f8309bcc199dbb3f2376c2b4f597`
was rebased on DEVELOP `4293eddf0f941d8213482ceaa6c56881ed43c1e1`.
Actual local evidence contains 611 covered unit tests, 92 integration tests,
four dependency-policy CLI tests and 33 Rust tests. All 21 selected original
commands passed across the retained failed 17-command prefix and successful
four-command security continuation. The original wrapper failed on a pinned
cargo-audit archive download; it remains failed. Only the exact verified archive
was reused before the normal installer verified and extracted it.

Both whole-source reviews and independent in-review continuity reviews passed
with zero findings. The in-review checkpoint is `329625aa7ff817c76467230daf2249f3f7e2ae84`;
its actual hosted workflows passed:

- [CI](https://github.com/wojciechlesniak/overmind/actions/runs/39211756900)
- [Security](https://github.com/wojciechlesniak/overmind/actions/runs/39211756918)
- [Isolation gate](https://github.com/wojciechlesniak/overmind/actions/runs/39211757051)

The source-ready receipt is `ove049-source-ready-5821807-20261019.json`;
local gate receipts are consolidated in
`ove049-full-gates-consolidated-58218076-20261019.json`. Prior actual RED,
lint and review failures remain recorded in the integration proposal and receipts.
Cargo-audit policy-allowed warnings and local Keychain scan warnings remain visible;
both local secret scans reported zero findings. Every later metadata head still
requires fresh exact-head hosted checks and independent continuity reviews before
normal DEVELOP integration. Reserved task-lint/ownership scripts are not claimed
as implemented controls. No actual macOS escape, absent desktop e2e/visual script,
Storybook implementation, Task050 consumer or parent ARCH002 acceptance is claimed.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
