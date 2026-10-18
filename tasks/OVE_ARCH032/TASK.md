---
id: OVE_ARCH032
title: "Implement engine bundler relocation"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH026", "OVE_ARCH027", "OVE_ARCH030"]
soft_depends_on: []
provides: ["lib:engine-bundler-tooling"]
needs: ["lib:engine-static-protocol", "lib:relocated-build-prerequisites", "lib:desktop-vite-tooling"]
owns: ["apps/engine/build/bundle.mjs", "tools/build/engine/bundle.mjs", "apps/engine/build/bundle.d.mts", "tools/build/engine/bundle.d.mts", "apps/engine/package.json", "tools/package.json", "pnpm-lock.yaml", "tools/package-engine/steps/bundle.ts", "tools/package-engine/pipeline.test.ts", "tools/package-engine/run.ts", "tools/package-engine/symbolicate.int.test.ts", "apps/engine/test/process.int.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_SETUP016/TASK.md", "tasks/OVE_SETUP017/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH032: Implement engine bundler relocation

## 1. Summary

Public CJS/metafile/map/bytes/protocol and actual SEA/repro/symbolication callers still run; no stale bundler path or old esbuild module-root assumption.

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

1. Move bundle.mjs and bundle.d.mts from apps/engine/build to tools/build/engine. Preserve bundleEngine({root?,outfile?}) and guardMetafile APIs and engine build script behavior.
2. Stamp protocol through026 static readProtocol, root version and validated Git SHA; never import contracts or execute its source. Output remains Node22 CJS engine.cjs with external map, linked legal comments and metafile.
3. Retain canonical input-root confinement, declared manifest dependency check, rejection of desktop/React/Tauri inputs and unknown externals; only Node builtins and exact existing compose/service hook externals survive.
4. Preserve deterministic repeated output bytes and source-map privacy: no private absolute paths; source map/metafile and real protocol/version/channel contracts remain actual tests.
5. Update FOUR current packaging callers: steps/bundle.ts, pipeline.test.ts, run.ts esbuild version lookup, symbolicate.int.test.ts esbuild executable. All must use the new Tools path/importer; keep exact esbuild0.28.2 validation.
6. Remove former engine esbuild declaration only after Tools availability is merged; regenerate lock normally and retain current SEA/license/reproducibility obligations.
7. Before deleting apps/engine/build/bundle.mjs, minimally update CURRENT apps/engine/test/process.int.test.ts to import the relocated tools/build/engine/bundle.mjs with its real bundleEngine API. Keep this suite in the old test directory until OVE_ARCH033; run it now with every original assertion/deadline. Do not add a reexport/compatibility stub.

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

- [ ] Public engine build produces valid CJS/map/metafile with exact protocol/version and repeatable bytes; unsafe inputs/externals and throwing/computed protocol source deny or remain static as specified.
- [ ] All four actual packaging/symbolication callers reach the relocated bundler and same pinned esbuild, with no stale engine node_modules dependency.
- [ ] The still-unmoved engine process integration suite imports the new real bundler and passes in this PR; no current caller imports removed apps/engine/build/bundle.mjs.
- [ ] Actual packaging/reproducibility tests and unchanged manifest/license/checksum controls pass; no DeveloperID/notary/release proof is invented.

## 12. Test plan

- pnpm --filter @overmind/engine build
- pnpm exec vitest run tools/package-engine/pipeline.test.ts tools/package-engine/policy.test.ts; applicable actual packaging/symbolication integrations.
- pnpm exec vitest run --config vitest.int.config.ts apps/engine/test/process.int.test.ts (CURRENT caller, before OVE_ARCH033).

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
