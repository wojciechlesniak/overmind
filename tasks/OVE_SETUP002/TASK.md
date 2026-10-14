---
id: OVE_SETUP002
title: "Base TypeScript config with project references (pin TypeScript for typescript-eslint)"
area: SETUP
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP001]
soft_depends_on: [OVE_SETUP008]
provides: ["lib:tsconfig-base", "lib:ts-project-references"]
needs: []
owns:
  - tsconfig.base.json
  - tsconfig.json
  - apps/*/tsconfig.json
  - apps/*/tsconfig.*.json
  - packages/*/tsconfig.json
  - packages/adapters/*/tsconfig.json
  - tools/tsconfig.json
reads: ["pnpm-workspace.yaml", "package.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [18]
---

# OVE_SETUP002: Base TypeScript config with project references (pin TypeScript for typescript-eslint)

## 1. Summary

Provide one strict `tsconfig.base.json`, a root solution `tsconfig.json` with project references to every workspace package, and a small `tsconfig.json` per package that extends the base, so that `pnpm typecheck` (`tsc -b`) is incremental and catches layer violations at the type level. Pin TypeScript to 6.0.3, the newest version inside typescript-eslint's supported range.

## 2. Context

TypeScript is the only own-code language (ADR 0018). On 2026-10-13 the npm `latest` tag of `typescript` is 7.0.2, but `typescript-eslint@8.71.2` declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"` (re-verified with `npm view typescript-eslint@8.71.2 peerDependencies`). Installing TypeScript 7 would break type-aware linting (OVE_SETUP003) or force `strictPeerDependencies` off. The newest 6.0.x on the registry is 6.0.3 (6.0.2 exists too). The full compatibility matrix and the upgrade rule live in OVE_SETUP008; this task applies the pin. Packages are internal TypeScript-source packages (OVE_SETUP001 requirement 5): `exports` point to `src/index.ts`.

## 3. Scope (in)

- `tsconfig.base.json` with the compiler options below.
- Root `tsconfig.json` (`files: []`, `references` to all 17 workspace packages).
- Per-package `tsconfig.json` (composite) and, for `apps/desktop`, a second `tsconfig.node.json` for Vite/Node-side config files.
- `typescript` added to the catalog consumption (`devDependencies: { "typescript": "catalog:" }` in root).
- A tiny type-level self-test proving strictness and references (see Test plan).

## 4. Out of scope

- ESLint type-aware setup (parser `projectService`): OVE_SETUP003.
- Vite alias/paths: none are used; internal imports use package names (`@overmind/contracts`).
- Declaration emit for publishing: not needed (private source packages).
- Boundary rules between packages: OVE_ARCH002 (this task only gives the compiler the references).

## 5. Detailed requirements

1. Root devDependency `typescript` = catalog entry `6.0.3`. The task MUST NOT use TypeScript 7.x. A unit test (requirement 10) fails the build if `typescript` major.minor leaves the range accepted by the installed `typescript-eslint` peer range.
2. `tsconfig.base.json` `compilerOptions` (all set explicitly, never rely on TS 6 default changes):
   - Language and module: `target: "ES2023"`, `lib: ["ES2023"]` (UI packages add `"DOM"`, `"DOM.Iterable"` in their own tsconfig), `module: "ESNext"`, `moduleResolution: "Bundler"`, `moduleDetection: "force"`, `resolveJsonModule: true`, `allowImportingTsExtensions: true` with `noEmit`-style emit control below.
   - Strictness: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`, `noPropertyAccessFromIndexSignature: true`, `useUnknownInCatchVariables: true`, `noUnusedLocals: true`, `noUnusedParameters: true` (underscore prefix allowed), `forceConsistentCasingInFileNames: true`.
   - Modern syntax discipline: `verbatimModuleSyntax: true`, `isolatedModules: true`, `erasableSyntaxOnly: true` (no enums, no parameter properties, no namespaces: keeps code runnable by plain type-stripping and by any bundler), `noUncheckedSideEffectImports: true`.
   - Build: `composite: true`, `incremental: true`, `declaration: true`, `emitDeclarationOnly: true`, `outDir: "${configDir}/.tsbuild"`, `tsBuildInfoFile: "${configDir}/.tsbuild/tsconfig.tsbuildinfo"`, `skipLibCheck: true`, `types: []` (each package lists the ambient types it needs, for example `["node"]` for engine and adapters, `["vite/client"]` for desktop), `sourceMap: false`.
   - No `paths`, no `baseUrl`, no `rootDir` games. `esModuleInterop` not set (ESM only).
3. Each package `tsconfig.json`: `extends: "../../tsconfig.base.json"` (adjust depth), `include: ["src/**/*.ts", "src/**/*.tsx"]` plus `"test/**/*"`, `references` = exactly the internal packages from its `package.json` `dependencies` (one source of truth; a test compares them, requirement 10). `compilerOptions.types` as in 2.
4. Packages that need the DOM (`ui-kit`, `desktop`, `api-client`): `lib: ["ES2023", "DOM", "DOM.Iterable"]`, `jsx: "react-jsx"` for the two with React. `contracts`, `domain`, `application`, `workflow-runtime` MUST NOT include DOM or Node types (`types: []`, `lib: ["ES2023"]`): this enforces "no I/O in domain and application" at the type level (referencing `process` or `fetch` becomes a compile error).
5. `tools/tsconfig.json` includes `**/*.ts`, `types: ["node"]`, no references; it type-checks scripts.
6. Root `tsconfig.json`: `{ "files": [], "references": [ {"path": "./apps/desktop"}, ... ] }` listing every package; order irrelevant. `pnpm typecheck` = `tsc -b` (set in OVE_SETUP001). `tsc -b --verbose` MUST show each package built once and be a no-op on a second run.
7. Test files live next to sources (`*.test.ts`) and are part of `include`; Vitest globals are NOT enabled (`import { describe, it, expect } from "vitest"` explicitly, `types: []` stays clean).
8. `apps/desktop/tsconfig.node.json` covers `vite.config.ts`, `vitest.config.ts`; extends base with `types: ["node"]`.
9. Compiler diagnostics policy: `tsc -b` MUST finish with zero errors; `// @ts-ignore` is forbidden (lint rule in OVE_SETUP003), `// @ts-expect-error` needs a description and a linked task.
10. Guard tests in `tools/ts-config.test.ts`: (a) installed `typescript` version satisfies `semver` range of `typescript-eslint` peer dependency (read from `node_modules/typescript-eslint/package.json`), (b) every package `tsconfig.json` references equal its manifest `workspace:*` dependencies, (c) base config contains the strict flags listed above.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Single base config extended by every package (DRY). Package-graph source of truth is OVE_SETUP001's manifests; references are derived/validated, not invented.

## 8. Architecture and code placement

Layer: build configuration. `tsconfig.base.json` at root; one `tsconfig.json` per package. Project references mirror the Clean Architecture dependency direction, so an illegal import (for example `domain` importing `application`) fails type resolution because it is not referenced. This is a first line of defence before the lint-based boundary check (OVE_ARCH002).

## 9. Security and safety

- Strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`) reduce whole classes of bugs in permission and path code.
- `types: []` in pure layers blocks accidental I/O.
- Pinning TypeScript below 6.1 is a correctness pin, not only a convenience: type-aware lint rules are part of the quality gate, and silently disabling them would hide defects.
- No dependency on unpublished or nightly TypeScript (`next`, `dev` dist-tags are forbidden).

## 10. Errors and edge cases

- If a later Renovate PR bumps TypeScript to 6.1+/7.x, guard test 10(a) fails; the PR stays red until typescript-eslint supports it (rule in OVE_SETUP008).
- If TS 6.0 reports a deprecation as error for an option set here (for example `moduleResolution` or `target` values), switch to the documented replacement and record it in `docs/dependencies.md`; do not downgrade strictness.
- `emitDeclarationOnly` with `allowImportingTsExtensions`: if tsc refuses this combination, drop `allowImportingTsExtensions` and keep extension-less imports (default for bundlers).
- Circular references between packages are impossible by the manifest graph; `tsc -b` reports TS6202 if one appears, which is the intended failure.
- `.tsbuild` directories are ignored by git (OVE_SETUP001).

## 11. Acceptance criteria

- [ ] `pnpm ls typescript -r --depth 0` shows exactly one version, `6.0.3`.
- [ ] `pnpm typecheck` passes on the skeleton and a second run does nothing (incremental).
- [ ] Given a file in `packages/domain/src` that references `process.env`, when `pnpm typecheck` runs, then it fails.
- [ ] Given `packages/domain/src` importing `@overmind/application`, then typecheck fails with unresolved module (not referenced).
- [ ] Guard tests 10(a), (b), (c) pass and fail correctly when TypeScript is temporarily set to 7.0.2 (verified once, not committed).
- [ ] `apps/desktop` and `ui-kit` compile a sample `.tsx` with `jsx: react-jsx`.
- [ ] No `// @ts-ignore` exists in the repository.

## 12. Test plan

Unit: `tools/ts-config.test.ts` (guard tests above, run by Node test runner until OVE_SETUP004, later by Vitest). Negative fixtures: `tools/fixtures/ts-negative/*.ts` compiled in a throw-away temporary project by the test with `tsc --noEmit -p` expecting specific error codes (TS2304 `process`, TS2307 module not found). Commands: `pnpm typecheck`, `node --test --import tsx tools/ts-config.test.ts`.

## 13. Parallelization notes

Runs in parallel with SETUP003/004/005/008..012. Conflict hotspots: none beyond per-package tsconfig files (this task owns them all). New packages added later must add their own `tsconfig.json` and a `references` entry: that edit to root `tsconfig.json` is made by the task that adds the package (single-line additive change, allowed even though the file is owned here; mention in the PR).

## 14. Open questions and assumptions

- ASSUMPTION: target ES2023 (Node 22 supports it; WebKit in Tauri on macOS 26 is current). Raise when Node 24 is adopted.
- ASSUMPTION: `erasableSyntaxOnly` is on from day one; decision to relax requires an ADR.
- Question for the Owner: whether to adopt TypeScript 7 (native compiler) once typescript-eslint supports it; tracked in OVE_SETUP008 upgrade rules.
