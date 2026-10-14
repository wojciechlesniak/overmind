---
id: OVE_SETUP001
title: Initialise the pnpm monorepo skeleton and root files
area: SETUP
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: []
soft_depends_on: [OVE_SETUP008]
provides: ["lib:monorepo-skeleton", "lib:root-scripts", "lib:version-catalog"]
needs: []
owns:
  - package.json
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - .npmrc
  - .nvmrc
  - .gitignore
  - .gitattributes
  - .editorconfig
  - apps/desktop/package.json
  - apps/engine/package.json
  - packages/*/package.json
  - packages/adapters/*/package.json
  - tools/package.json
  - tools/README.md
reads: ["tasks/PLAN.md", "tasks/OVE_SETUP008/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [5, 9, 13, 17, 18]
---

# OVE_SETUP001: Initialise the pnpm monorepo skeleton and root files

## 1. Summary

Create the empty but installable pnpm workspace described in `PLAN.md` section 1: the root `package.json` with every script name the project will ever use, `pnpm-workspace.yaml` with the version catalog and supply-chain settings, Node 22 and pnpm pinning, and one `package.json` plus `src/index.ts` per workspace package with the internal dependency graph already declared. Nothing runs yet, but every later task finds its package, its script entry and its exact dependency versions in place.

## 2. Context

This is the very first code-bearing task; almost all other tasks depend on it (directly or through SETUP002). The layering rule is `contracts <- domain <- application <- {workflow-runtime, gateway, adapters/*} <- apps/engine`; `ui-kit` has no internal dependencies; `apps/desktop` imports only `ui-kit`, `api-client`, `contracts` (CONVENTIONS section 6). The declared `dependencies` in each package manifest are the single source from which ARCH002 derives the boundary rules, so they must be exact here. The Owner works on one Mac (ADR 0009), TypeScript only in own code (ADR 0018), English everywhere (ADR 0017). Versions come from the compatibility matrix in OVE_SETUP008 (verified 2026-10-13).

## 3. Scope (in)

- Root `package.json`, `pnpm-workspace.yaml` (workspace globs, `catalog:`, security settings), `.npmrc`, `.nvmrc`, `.gitignore`, `.gitattributes`, `.editorconfig`.
- One `package.json` and `src/index.ts` placeholder for each workspace package listed in requirement 5.
- `tools/package.json` (private package `@overmind/tools`, runs scripts with `tsx`) and `tools/README.md` describing the `tools/<name>/` convention.
- First `pnpm install` producing `pnpm-lock.yaml`, committed.

## 4. Out of scope

- TypeScript configuration, project references: OVE_SETUP002.
- ESLint, Prettier configs: OVE_SETUP003. Vitest configs: OVE_SETUP004. Git hooks: OVE_SETUP005. CI: OVE_SETUP006.
- `docs/dependencies.md`, Renovate, dependency policy checker: OVE_SETUP008.
- Vite/React content of `apps/desktop`: OVE_SETUP009. Tauri shell: OVE_SETUP010. Engine entry and packaging: OVE_SETUP011, OVE_SETUP016.
- LICENSE, README, CONTRIBUTING: OVE_OSS001, OVE_OSS004, OVE_OSS002. CODEOWNERS: OVE_OSS003.
- Implementations behind scripts such as `check:boundaries` and `gen:contracts`: OVE_ARCH002, OVE_ARCH008.

## 5. Detailed requirements

1. **Runtime pinning.** `.nvmrc` contains exactly `22.23.3`. Root `package.json` has `"engines": {"node": ">=22.22.2 <23", "pnpm": ">=12.11.2 <13"}` and `"packageManager": "pnpm@12.11.2+sha512.<hash>"` (the implementer obtains the hash with `corepack use pnpm@12.11.2`). `.npmrc` has `engine-strict=true`. README-level instruction (put into `tools/README.md`): `corepack enable && corepack install`. Node 22 is in maintenance LTS; the upgrade path to Node 24 is a decision in OVE_SETUP008, not here.
2. **Root `package.json`** keys: `name: "overmind"`, `private: true`, `version: "0.0.0"`, `license: "Apache-2.0"`, `type: "module"`, `engines`, `packageManager`, `scripts`. No `dependencies`. `devDependencies` are added by the tasks that introduce each tool (every entry uses `catalog:`, never a literal version).
3. **Script names (final, kebab/colon style).** `dev` -> `node --import tsx tools/dev/run.ts` (OVE_SETUP012); `dev:tauri` -> `pnpm --filter @overmind/desktop tauri dev`; `build` -> `pnpm -r --if-present run build`; `typecheck` -> `tsc -b`; `lint` -> `eslint . --max-warnings 0`; `lint:fix`; `format` -> `prettier --write .`; `format:check` -> `prettier --check .`; `test` -> `vitest run`; `test:watch`; `test:coverage` -> `vitest run --coverage`; `test:e2e` -> `pnpm --filter @overmind/desktop run test:e2e` (OVE_TEST004); `test:visual` -> `pnpm --filter @overmind/desktop run test:visual` (OVE_TEST005); `test:escape` -> `tsx tools/escape-tests/run.ts` (OVE_TEST007); `storybook` / `build:storybook` -> `pnpm --filter @overmind/ui-kit run <same>`; `check:boundaries` -> `tsx tools/check-boundaries/run.ts` (OVE_ARCH002); `check:licenses` -> `tsx tools/check-licenses/run.ts` (OVE_SETUP006); `check:deps` -> `tsx tools/deps-policy/run.ts` (OVE_SETUP008); `check:tasks` -> `tsx tools/tasks/lint.ts` (OVE_SETUP022); `check:owns` -> `tsx tools/tasks/check-owns.ts` (OVE_SETUP020); `check:docs` -> `tsx tools/docs-check/run.ts` (OVE_OSS004); `check:headers` -> `tsx tools/check-headers/run.ts` (OVE_OSS001); `check:contracts` -> `tsx tools/gen-contracts/check-additive.ts` (OVE_ARCH008); `gen:contracts` -> `tsx tools/gen-contracts/run.ts` (OVE_ARCH008); `gen:task-index` -> `tsx tools/tasks/gen-index.ts` (OVE_SETUP023); `task:claim|task:finish|task:status|task:next` -> `tsx tools/tasks/<name>.ts` (OVE_SETUP013); `audit` -> `pnpm audit --audit-level=high --prod`; `sbom` (OVE_SETUP007); `package:engine` (OVE_SETUP017); `check` -> `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run check:boundaries && pnpm run check:deps`; `prepare` -> `lefthook install` (OVE_SETUP005).
4. **Placeholder handover.** For every `tools/<name>/run.ts` named above whose owner task is not yet merged, SETUP001 creates NO file. Owner tasks create theirs; until then the script fails with "module not found", which is the intended fail-closed behaviour (CI jobs that call a script are added by the owner task or are guarded by the file existing, see OVE_SETUP006). The only placeholders SETUP001 creates are `src/index.ts` files containing `export {};` and the header comment `// PLACEHOLDER(<OWNER TASK>): replaced wholesale by the owner task.` Owner tasks may overwrite such a file without it counting as a conflict.
5. **Workspace packages** (name, path, internal `dependencies` as `workspace:*`):
   - `@overmind/contracts` `packages/contracts`: none.
   - `@overmind/domain` `packages/domain`: contracts.
   - `@overmind/application` `packages/application`: contracts, domain.
   - `@overmind/workflow-runtime` `packages/workflow-runtime`: application, domain, contracts.
   - `@overmind/gateway` `packages/gateway`: application, contracts.
   - `@overmind/api-client` `packages/api-client`: contracts.
   - `@overmind/ui-kit` `packages/ui-kit`: none.
   - `@overmind/adapter-sqlite|herdr|sandbox-macos|providers|telegram|keychain-macos|notifications-macos` `packages/adapters/<name>`: application, contracts, domain (adapters never depend on each other).
   - `@overmind/engine` `apps/engine`: every package above (composition root).
   - `@overmind/desktop` `apps/desktop`: ui-kit, api-client, contracts.
   - `@overmind/tools` `tools`: none internal (it may read `tasks/` and `docs/` as files).
   Each manifest: `name`, `version: "0.0.0"`, `private: true`, `type: "module"`, `license: "Apache-2.0"`, `exports: {".": "./src/index.ts"}` (internal packages are consumed as TypeScript source, no build step), `sideEffects: false` for libraries. Adapters, the engine and the desktop app have no `main`.
6. **`pnpm-workspace.yaml`:** `packages: ["apps/*", "packages/*", "packages/adapters/*", "tools"]` (the `packages/adapters` folder itself has no manifest and is ignored). `catalog:` with exact versions (no `^`, `~`, `latest`), copied verbatim from the matrix in OVE_SETUP008 section 5 (typescript 6.0.3 is the critical one). Settings: `minimumReleaseAge: 4320` (minutes, three days, defeats freshly published malicious versions; allow-list exceptions only in OVE_SETUP008), `onlyBuiltDependencies: []` initially (dependency lifecycle scripts are denied; additions need a justification in `docs/dependencies.md`), `strictPeerDependencies: true`, `autoInstallPeers: false`, `savePrefix: ""`, `linkWorkspacePackages: false`, `shamefullyHoist: false`. If the pinned pnpm names a key differently, use the pinned pnpm's documented name and note it in `tools/README.md`.
7. **`.gitignore`:** `node_modules/`, `.tsbuild/`, `dist/`, `coverage/`, `storybook-static/`, `test-results/`, `playwright-report/`, `.dev-data/`, `.env*` (except `.env.example` if ever added), `*.log`, `.DS_Store`, `target/` (Rust), `apps/desktop/src-tauri/binaries/` and `apps/desktop/src-tauri/resources/` (generated), `*.p12`, `*.p8`, `*.pem`, `*.key`. `pnpm-lock.yaml` is NOT ignored.
8. **`.gitattributes`:** `* text=auto eol=lf`; `pnpm-lock.yaml linguist-generated -diff` is NOT set (reviewers must see lockfile changes); `*.png binary`; `docs/pl/** linguist-documentation`.
9. **`.editorconfig`:** UTF-8, LF, final newline, 2 spaces, trim trailing whitespace (not for `.md`).
10. `pnpm install --frozen-lockfile` MUST succeed from a clean checkout; the committed lockfile is produced by the pinned pnpm version.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Versions: the catalog is the only place with version numbers (DRY); every package refers to `catalog:`. Package graph: the declared `workspace:*` edges are reused by OVE_ARCH002 and OVE_SETUP002 (project references) and must not be duplicated in a second file.

## 8. Architecture and code placement

Layer: repository infrastructure. Files at repo root and inside each package root only. The dependency edges in requirement 5 encode the Clean Architecture rule; changing an edge needs an ARCH decision and a task. Packages are "internal source packages": consumers import TypeScript source through `exports`, bundlers (Vite, the engine bundler) compile them; this keeps KISS (no per-package build) at the cost that publishing to npm is impossible without a later build step (accepted).

## 9. Security and safety

- Supply chain: exact versions, committed lockfile, `minimumReleaseAge`, dependency build scripts denied by default (`onlyBuiltDependencies` allow-list), `engine-strict`, `packageManager` hash pinned (corepack verifies it).
- Lockfile integrity: reviewers MUST read lockfile diffs; `pnpm install --frozen-lockfile` is the only install form in CI (OVE_SETUP006).
- No registry credentials in `.npmrc`; `.npmrc` contains no `_authToken`. Publishing is disabled by `private: true` on every package.
- `.gitignore` blocks key and certificate files and `.env*` so signing material (OVE_SETUP014) cannot be committed by accident (OVE_SETUP007 adds scanning for the case it is not enough).

## 10. Errors and edge cases

- Wrong Node: `pnpm install` fails because of `engine-strict`; the message is acceptable, `tools/README.md` documents the fix (`nvm use`, `corepack enable`).
- pnpm key renamed in the pinned pnpm: install prints an unknown-setting warning. Treat any warning as an error: run `pnpm install --frozen-lockfile 2>&1 | grep -i warn` and fix before merging.
- A catalog entry is missing for a package a later task needs: that task adds the entry to OVE_SETUP008's matrix through a proposal file (`tasks/_proposals/<ID>-catalog.md`), it does not edit the catalog in a feature PR.
- Lockfile merge conflicts: resolve by `git checkout origin/main -- pnpm-lock.yaml && pnpm install`, never by hand-editing.
- Windows path separators are irrelevant (ADR 0009) but `.gitattributes` keeps LF so line endings cannot corrupt shell scripts.

## 11. Acceptance criteria

- [ ] Given a clean clone with Node 22.23.3 and corepack, when `corepack enable && pnpm install --frozen-lockfile` runs, then it succeeds with no warnings.
- [ ] Given Node 20 or 24, when `pnpm install` runs, then it fails because of `engine-strict`.
- [ ] `pnpm -r exec node -e "process.exit(0)"` visits all 17 workspace packages (2 apps, 7 libraries, 7 adapters and `tools`; count asserted by a test).
- [ ] Every internal dependency edge matches requirement 5 exactly (asserted by a unit test that reads all manifests).
- [ ] A unit test asserts that every `scripts` key listed in requirement 3 exists in root `package.json`.
- [ ] A unit test asserts that no `package.json` contains a version range symbol (`^ ~ * latest`) outside `engines`/`peerDependencies`, and that all external dependency specifiers are `catalog:`.
- [ ] `pnpm-lock.yaml` is committed and `git status` is clean after `pnpm install`.
- [ ] `.gitignore` rejects `foo.p12`, `.env.local`, `target/` (checked with `git check-ignore`).

## 12. Test plan

Vitest is not yet installed when this task lands (OVE_SETUP004). The two manifest assertions are written as plain Node test files `tools/skeleton.test.ts` run with `node --test --import tsx` and are re-run by Vitest later (OVE_SETUP004 includes `tools/**/*.test.ts`). Commands: `pnpm install --frozen-lockfile`, `node --test --import tsx tools/skeleton.test.ts`, `git check-ignore -v foo.p12 .env.local`.

## 13. Parallelization notes

First task of the project; blocks everything. After merge, SETUP002, 003, 004, 005, 008, 009, 010, 011, 013, OSS001..006 can start in parallel. Conflict hotspots: root `package.json` (`devDependencies` and `scripts` are append-only by owner tasks; scripts block is owned here, owner tasks only add devDependencies), `pnpm-lock.yaml` (regenerate, never merge). Extension point: new packages are added only by a proposal plus a task that edits `pnpm-workspace.yaml`.

## 14. Open questions and assumptions

- ASSUMPTION: package scope `@overmind/*` (not published). Owner may rename later with one codemod task.
- ASSUMPTION: pnpm 12.11.2 is used because it is the registry `latest` on 2026-10-13; if its behaviour differs from the settings named in requirement 6, fall back to pnpm 11.28.2 and record it in OVE_SETUP008.
- ASSUMPTION: `minimumReleaseAge` of 3 days; Owner may tighten.
- Question: a mono-license header policy is in OVE_OSS001; this task only sets the `license` field.
