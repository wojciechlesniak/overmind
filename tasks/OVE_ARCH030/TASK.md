---
id: OVE_ARCH030
title: "Implement vite configuration relocation"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH027", "OVE_ARCH028", "OVE_ARCH029"]
soft_depends_on: []
provides: ["lib:desktop-vite-tooling"]
needs: ["lib:relocated-build-prerequisites", "lib:desktop-dist-guard-tooling", "lib:desktop-tauri-guard-tooling"]
owns: ["apps/desktop/vite.config.ts", "tools/vite/desktop.config.ts", "apps/desktop/tsconfig.node.json", "apps/desktop/package.json", "tools/package.json", "pnpm-lock.yaml", "tsconfig.json", "tools/ts-config.test.ts", "tools/skeleton.test.ts", ".github/workflows/ci.yml", "tools/ci/gates.test.ts", "apps/desktop/scripts/dev-server.int.test.ts", "apps/desktop/scripts/build.int.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP009/TASK.md", "tasks/OVE_SETUP003/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH030: Implement vite configuration relocation

## 1. Summary

Real dev/build/preview loopback, Host/CORS/fs/strictport/privateenv protections; source graph unchanged; preserve CI test step and config labels.

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

1. Move desktop vite.config.ts to tools/vite/desktop.config.ts; dev/build/preview scripts pass the explicit new --config while still running with desktop source root and output dist.
2. Use the existing pinned SWC plugin through Tools development dependencies. Remove only the obsolete desktop tsconfig.node.json/solution reference and former SWC importer when the new caller works; preserve UI tsconfig and all root test typing.
3. Keep dev127.0.0.1:5173 and preview127.0.0.1:4173, strictPort, allowed localhost/127.0.0.1 Hosts, cors:false and filesystem strictness; no fallback to a public bind or different port.
4. OVERMIND_DEV_PROXY is consumed only during serve, only plain http://127.0.0.1 origin with no credentials/path/query/hash; /v1 keeps changeOrigin:false. Production config never uses the proxy.
5. Keep VITE_OVERMIND_ env prefix, safari18 target, no production maps, no inline assets/polyfill, React dedupe and all production bundling settings. Old helper path guards must not skip implemented desktop acceptance CI.
6. Update actual scaffold/TS-solution/config tests and workflow existence checks for the new config; preserve all current packaging/guard callers and generated lock policy.
7. Before removing apps/desktop/vite.config.ts, update CURRENT apps/desktop/scripts/dev-server.int.test.ts configFile and CURRENT build.int.test.ts direct Vite child argv to the explicit tools/vite/desktop.config.ts. Preserve OVE_ARCH028's already-updated guard argv, all assertions/deadlines and old test locations until OVE_ARCH031. Do not use a compatibility config stub.

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

- [ ] Actual dev/preview bind only loopback with strict occupied-port failure and hostile Host/CORS/outside-file denial.
- [ ] Valid loopback development proxy preserves Host; invalid targets reject and production ignores proxy/private env.
- [ ] Both still-unmoved desktop integration files pass with the new explicit Vite configuration immediately; neither depends on deleted desktop/vite.config.ts or loses OVE_ARCH028's guard update.
- [ ] Desktop build/preview/dev use the new config; removed Node-only reference is absent while UI and root test typechecks remain.

## 12. Test plan

- pnpm exec vitest run tools/ts-config.test.ts tools/skeleton.test.ts
- pnpm exec vitest run --config vitest.int.config.ts apps/desktop/scripts/dev-server.int.test.ts apps/desktop/scripts/build.int.test.ts (both CURRENT callers, before OVE_ARCH031).

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
