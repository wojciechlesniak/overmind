---
id: OVE_ARCH029
title: "Implement tauri configuration guard relocation"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH027", "OVE_ARCH028"]
soft_depends_on: []
provides: ["lib:desktop-tauri-guard-tooling"]
needs: ["lib:relocated-build-prerequisites", "lib:desktop-dist-guard-tooling"]
owns: ["apps/desktop/scripts/check-tauri-config.mjs", "tools/build/desktop/check-tauri-config.mjs", "apps/desktop/test/check-tauri-config.test.ts", "tools/build/desktop/check-tauri-config.test.ts", "package.json", "tools/ci/gates.test.ts", "apps/desktop/package.json"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP010/TASK.md", "tasks/OVE_SETUP017/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH029: Implement tauri configuration guard relocation

## 1. Summary

Canonical config denial, alternate/case aliases, all icons and THREE current resources (Rust notices, engine map, Node LICENSE); no capability/CSP change.

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

1. Move the actual current check-tauri-config.mjs/test to tools/build/desktop; root check:tauri and desktop lint call that exact path, with default apps/desktop/src-tauri or explicit root argument.
2. Continue reading permission allowlist from apps/desktop/scripts/tauri-permission-allowlist.json. All policy inputs remain bounded regular nonsymlink files; alternate platform/JSON5/TOML/case aliases deny before config merge.
3. Keep exact current CSP/devCSP, main window, IPC permissions, capabilities, prototype protection, asset-protocol disable, identifiers, version and build commands; no remote/updater/private-macOS widening.
4. Keep icons/icon.png and icons/icon.icns plus exactly THREE resource mappings: Rust notices, engine.cjs.map to engine/engine.cjs.map, and generated engine LICENSE to engine/LICENSE. Do not copy the stale one-resource guard.
5. Retain exact external sidecar, app/dmg targets, macOS26 hardenedRuntime, Rust source allowlist/<200-lines/structured-logger/no-unsafe entry controls and updater dependency denial.
6. Update current configuration-change regressions/callers without weakening original path protections or privileged Tauri capability tests.

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

- [ ] Actual canonical Tauri config passes at the relocated path; every alternate/case-alias/capability/CSP/resource/icon mutation fails.
- [ ] All three generated resources, sidecar, macOS policy and original Rust privacy/unsafe checks remain exact.
- [ ] apps/desktop/package.json lint and root check:tauri both call the relocated guard in this PR; this exact manifest edit follows OVE_ARCH028 and precedes OVE_ARCH030.
- [ ] Root and desktop commands use the new guard; permission policy remains at its original protected desktop path.

## 12. Test plan

- pnpm exec vitest run tools/build/desktop/check-tauri-config.test.ts
- pnpm check:tauri; pnpm --filter @overmind/desktop lint; existing real config-change negative test.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
