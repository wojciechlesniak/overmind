---
id: OVE_SETUP008
title: Dependency policy, version pins, compatibility matrix and docs/dependencies.md
area: SETUP
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP001]
soft_depends_on: [OVE_SETUP006]
provides: ["lib:dependency-policy", "lib:dependency-register", "lib:renovate-config"]
needs: []
owns:
  - docs/dependencies.md
  - renovate.json
  - tools/deps-policy/**
reads: ["pnpm-workspace.yaml", "package.json", "packages/*/package.json", "apps/*/package.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 17", "SPECIFICATION 19"]
adr_refs: [12, 13, 18, 19, 26]
---

# OVE_SETUP008: Dependency policy, version pins, compatibility matrix and docs/dependencies.md

## 1. Summary

Write down, enforce and keep fresh the rules for third-party code: a verified compatibility matrix (exact versions, checked against the npm registry on 2026-10-13), the register `docs/dependencies.md` with a justification block per dependency (SPEC 19.7, DoD item 6), Renovate configuration with grouped updates and a release-age delay, and the `check:deps` tool that fails CI when code, catalog and register disagree. The critical, non-obvious rule: TypeScript is pinned to 6.0.3 because `typescript-eslint` does not yet accept TypeScript 6.1 or 7.

## 2. Context

Every new dependency needs a written justification: value, maintenance cost, license, alternatives (CONVENTIONS section 6). The project is open source under Apache-2.0 (ADR 0013), so every dependency license must be compatible. The supply chain is part of the threat model (OVE_SEC006 checklist). `OVE_SETUP001` puts the exact versions below into the `catalog:` of `pnpm-workspace.yaml`; this task owns the matrix as the reviewed source of truth and the tooling that keeps them in sync.

## 3. Scope (in)

- `docs/dependencies.md` with: matrix, register, "not adopted" list, upgrade rules.
- `renovate.json`.
- `tools/deps-policy/run.ts` (+ tests) implementing `pnpm check:deps`.
- Review checklist for lockfile changes (inside `docs/dependencies.md`).

## 4. Out of scope

- Installing packages (each task installs its own, using `catalog:`).
- License allow-list enforcement: OVE_SETUP006 (`check:licenses`).
- Vulnerability audit job: OVE_SETUP006. SBOM: OVE_SETUP007.
- Security checklist text for reviewers: OVE_SEC006.
- The herdr and container CLI pins: OVE_SETUP015 (the register links to its files).

## 5. Detailed requirements

1. **Compatibility matrix (verified 2026-10-13 with `npm view <pkg> version peerDependencies engines`).** `docs/dependencies.md` MUST contain this table (columns: package, pinned, registry `latest` that day, constraint source, note). Re-verify on the day of implementation and update both columns if they changed; keep the pinned column consistent with `pnpm-workspace.yaml`.

| Package | Pinned | Registry latest | Constraint / note |
|---|---|---|---|
| Node.js | 22.23.3 | 22.23.3 (line 22) | engines of eslint `^22.13`, vitest `^22.12`, jsdom `^22.22.2`, commitlint `>=22.12`; Node 22 is in maintenance LTS (end of life expected April 2027, verify at nodejs.org); plan: ADR to move to Node 24 LTS before that |
| pnpm | 12.11.2 | 12.11.2 | also published: 11.28.2, 10.34.6; `packageManager` field with hash via corepack |
| typescript | 6.0.3 | 7.0.2 | NOT latest. typescript-eslint 8.71.2 peer `typescript >=4.8.4 <6.1.0`. 6.0.2 and 6.0.3 are the newest 6.0.x |
| typescript-eslint | 8.71.2 | 8.71.2 | peers: `eslint ^8.57 \|\| ^9 \|\| ^10`, `typescript >=4.8.4 <6.1.0` |
| eslint | 10.12.0 | 10.12.0 | engines `^20.19 \|\| ^22.13 \|\| >=24` |
| @eslint/js | 10.0.1 | 10.0.1 | |
| eslint-config-prettier | 10.1.8 | 10.1.8 | |
| eslint-plugin-react-hooks | 7.1.1 | 7.1.1 | peers include eslint ^10 |
| eslint-plugin-react-refresh | 0.5.7 | 0.5.7 | peers eslint ^9 \|\| ^10 |
| globals | 17.13.0 | 17.13.0 | |
| eslint-plugin-jsx-a11y | not adopted | 6.10.2 | peer eslint only up to ^9; a11y via axe (Storybook, Playwright) |
| prettier | 3.9.10 | 3.9.10 | |
| vitest | 5.0.4 | 5.0.4 | peers `vite ^6.4 \|\| ^7 \|\| ^8`, `@types/node ^22 \|\| >=24`; engines `^22.12 \|\| ^24 \|\| >=26` |
| @vitest/coverage-v8 | 5.0.4 | 5.0.4 | must equal vitest version |
| jsdom | 30.1.2 | 30.1.2 | engines `^22.22.2 \|\| ^24.15 \|\| >=26` |
| @testing-library/react | 16.3.3 | 16.3.3 | |
| @testing-library/jest-dom | 7.0.1 | 7.0.1 | |
| vite | 8.3.4 | 8.3.4 | engines `^20.19 \|\| >=22.12` |
| @vitejs/plugin-react | 6.1.2 | 6.1.2 | peer `vite ^8` |
| react, react-dom | 19.3.0 | 19.3.0 | |
| @types/react, @types/react-dom | 19.3.0 | 19.3.0 | |
| @types/node | 22.20.5 | 26.6.5 | NOT latest: types must match the Node 22 runtime |
| @xyflow/react | 12.12.0 | 12.12.0 | peers react/react-dom `>=17`; MIT |
| zod | 4.6.7 | 4.6.7 | zod 4 ships `z.toJSONSchema`, so `zod-to-json-schema` (3.25.2, targets zod 3) is NOT adopted |
| storybook, @storybook/react-vite, @storybook/addon-a11y | 10.6.2 | 10.6.2 | react-vite peers: `vite ^5..^8`, react >=16.8, `storybook ^10.6.2`; all storybook packages must have the same version |
| playwright, @playwright/test | 1.64.0 | 1.64.0 | engines Node >=20; Docker image `mcr.microsoft.com/playwright:v1.64.0-noble` |
| @axe-core/playwright | 4.13.0 | 4.13.0 | |
| lefthook | 2.2.2 | 2.2.2 | |
| @commitlint/cli, @commitlint/config-conventional | 21.2.3 | 21.2.3 | engines Node >=22.12 |
| dependency-cruiser | 18.6.0 | 18.6.0 | engines `^22 \|\| ^24 \|\| >=26`; candidate for `check:boundaries` (decision OVE_ARCH002) |
| eslint-plugin-boundaries | 7.2.0 | 7.2.0 | peer `eslint >=6`; candidate for lint-time boundaries (OVE_ARCH002) |
| tsx | 4.23.15 | 4.23.15 | runs `tools/*.ts` |
| yaml | 2.9.1 | 2.9.1 | task linter, workflow tests |
| markdownlint-cli2 | 0.23.3 | 0.23.3 | docs lint (OVE_OSS004) |
| @tauri-apps/cli | 2.12.2 | 2.12.2 | |
| @tauri-apps/api | 2.12.3 | 2.12.3 | keep JS API and Rust crate in the same minor |
| tauri (crate) | 2.12.3 | 2.12.3 | MSRV Rust 1.90; Apache-2.0 OR MIT |
| tauri-build (crate) | 2.7.2 | 2.7.2 | |
| tauri-plugin-shell (crate) | 2.5.0 | 2.5.0 | MSRV 1.90; used only Rust-side (OVE_SETUP010) |
| tauri-plugin-single-instance (crate) | 2.5.3 | 2.5.3 | |
| tauri-plugin-dialog (crate) | 2.8.2 | 2.8.2 | used Rust-side only, folder picker command (OVE_SETUP010) |
| serde, serde_json, tokio (crates) | 1.0.229, 1.0.154, 1.53.2 | same | Rust shell: command payloads, Unix-socket byte proxy (features `net`, `io-util` only) |
| Rust toolchain | 1.90.0 | n/a | `rust-toolchain.toml`; minimum satisfying Tauri 2.12.3 |
| better-sqlite3 | candidate 13.0.3 | 13.0.3 | engines Node >=22; native addon (node-addon-api ^8); decision in OVE_SETUP011 |
| node:sqlite | built into Node 22.23.3 | n/a | stability to be verified in OVE_SETUP011 |
| bun | candidate 1.4.3 | 1.4.3 | `bun build --compile`, `bun:sqlite`; decision in OVE_SETUP011 |
| postject | candidate 1.0.0-alpha.6 | 1.0.0-alpha.6 | Node SEA blob injection (alpha, risk) |
| @yao-pkg/pkg | candidate 6.23.0 | 6.23.0 | maintained fork of `pkg`, engines Node >=22 |
| esbuild | candidate 0.28.2 | 0.28.2 | bundling for SEA/pkg; also a vite peer range `^0.27 \|\| ^0.28` |
| sqlite-vec | future 0.1.9 | 0.1.9 | only if vector search is adopted later (SPEC 10) |
| herdr | 0.9.3 | see OVE_SETUP015 | Apache-2.0; pinned binary |
| Apple `container` CLI | minimum 1.5.0 | see OVE_SETUP015 | macOS 26, Apple silicon |

2. **Not adopted, with reason** (a short section in the doc): TypeScript 7.x (typescript-eslint peer range), `@types/node` 26 (runtime is Node 22), `eslint-plugin-jsx-a11y` (no ESLint 10 support), `zod-to-json-schema` (redundant with zod 4), Electron (ADR 0018), LangGraph and other workflow frameworks (ADR 0019).
3. **Register format.** One H3 per direct dependency (npm, crates, binaries): fields `Version`, `License` (SPDX), `Used by` (packages), `Added by` (task ID), `Value`, `Maintenance cost` (release cadence, maintainers, size), `Alternatives considered`, `Risk` (install scripts, native code, network access), `Last reviewed` (date). Dev-only tools are marked `dev`. Transitive dependencies are not listed (the SBOM covers them).
4. **Upgrade rules** (section "How to upgrade" in the doc, normative):
   a. TypeScript is never bumped without proving the new version satisfies `npm view typescript-eslint@<ver> peerDependencies.typescript`; the bump and the typescript-eslint bump are one PR; the PR shows `pnpm typecheck && pnpm lint && pnpm test` results. Renovate has `allowedVersions: "<6.1.0"` for `typescript` until this rule's PR removes it.
   b. Tauri JS (`@tauri-apps/*`) and Rust crates move together; PR includes `pnpm tauri info` output and a diff of the generated capability schema.
   c. React, react-dom and their types move together; check `@xyflow/react`, Storybook and `@vitejs/plugin-react` peers first.
   d. Vitest and `@vitest/coverage-v8` move together; Storybook packages all move together; Playwright package and Docker image move together.
   e. Node: patch updates within 22.x through `.nvmrc`, `engines` and CI; a move to another major line needs an ADR.
   f. zod major or minor: run `pnpm check:contracts` (additive-only, OVE_ARCH008) and regenerate JSON Schema; contracts must not change.
   g. A fresh release waits `minimumReleaseAge` (3 days); security fixes for high/critical advisories are exempt from the wait and must be merged within 7 days.
   h. Every upgrade PR attaches the updated matrix row and the output of `pnpm check:deps`; the author skims the upstream changelog for breaking changes and links it.
   i. Renovate PRs are never auto-merged (ADR 0025: a human merges).
5. **Lockfile review checklist** (in the doc and linked from the PR template, OVE_OSS003): unexpected new packages; `resolution` URLs not pointing to the npm registry; changed `integrity` without a version change; packages with install scripts; names resembling popular packages (typosquats); maintainers recently changed; sudden large transitive trees.
6. **`renovate.json`:** `extends: ["config:best-practices", "helpers:pinGitHubActionDigestsToSemver"]`, `rangeStrategy: "pin"`, `minimumReleaseAge: "3 days"`, `prConcurrentLimit: 5`, `automerge: false`, `dependencyDashboard: true`, schedule `before 6am on monday` (security PRs immediately), labels `dependencies`. Groups: `typescript-toolchain` (typescript, typescript-eslint, eslint, @eslint/js, prettier, eslint-* plugins), `react` (react, react-dom, @types/react*), `tauri` (all `@tauri-apps/*` and crates matching `^tauri`), `storybook`, `vitest`, `vite` (vite, @vitejs/*), `playwright`, `commitlint`, `github-actions`, `rust-toolchain`. Major updates: `dependencyDashboardApproval: true` and label `dependencies-major`. Custom regex managers for `.nvmrc`, `rust-toolchain.toml`, `vendor/herdr/VERSION` (OVE_SETUP015), `tools/pinned-bin/lock.json` and `tools/secret-scan/gitleaks.lock.json` (these checksums are updated by hand, so Renovate only opens an issue). `typescript` rule: `allowedVersions: "<6.1.0"`.
7. **`pnpm check:deps`** (`tools/deps-policy/run.ts`) fails when: (a) any external specifier in any `package.json` is not `catalog:`; (b) a catalog entry is not an exact version; (c) a catalog entry has no row in the register or the versions differ; (d) the installed TypeScript is outside the typescript-eslint peer range; (e) `vitest` and `@vitest/coverage-v8`, all `storybook*` packages, `react`/`react-dom`, or `@tauri-apps/api`/crate `tauri` minors differ; (f) `pnpm.overrides`, `patchedDependencies` or `onlyBuiltDependencies` entries have no justification block; (g) a dependency of a pure layer (`contracts`, `domain`, `application`, `workflow-runtime`) is not marked `pure-layer-ok` in the register (default only `zod`); (h) the register's "verified on" date is older than 90 days (warning only, printed). Output is a table; exit code 1 on error.
8. **Developer flow:** a task that needs a new dependency opens the PR with (1) catalog entry, (2) register block, (3) `pnpm check:deps` green. Because `pnpm-workspace.yaml` is owned by OVE_SETUP001 and this task, new catalog lines are added by the dependency-introducing task as an append-only change, reviewed against the register.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Reads the manifests and catalog created by OVE_SETUP001; the license allow-list is imported from `tools/check-licenses/` (OVE_SETUP006) so there is one list. The register is the single place for justifications; PR templates (OVE_OSS003) link to it.

## 8. Architecture and code placement

Documentation (`docs/dependencies.md`), repository config (`renovate.json`) and a tool (`tools/deps-policy/`). The checker is pure functions over parsed files (`readCatalog`, `readManifests`, `parseRegister`, `checkRules`) with I/O at the edge, so it is unit-testable with fixtures.

## 9. Security and safety

- Supply chain is the main attack surface for a tool that runs agents and handles credentials: exact pins, the 3-day release delay, lockfile review checklist, ban on install scripts by default, no registry other than npmjs and crates.io (`deny.toml` sources), no git/tarball URL dependencies (checker rule: specifiers starting with `git`, `http`, `file:` outside the workspace are errors).
- Renovate has write access to branches: use the minimum GitHub App permissions (contents and pull requests), no secrets, PRs only, never merge. If a self-hosted Renovate is chosen, its token is a fine-grained token stored outside the repo.
- Typosquat and compromised-maintainer risk is addressed by the register's maintenance-cost field and the "recently changed maintainers" check.
- Dependency confusion: all workspace packages are `private` with the `@overmind` scope that Overmind does not publish; `.npmrc` has no alternative registry.
- A dependency that executes code at install (`preinstall`/`postinstall`) is rejected unless allow-listed with a justification.

## 10. Errors and edge cases

- Registry unreachable while verifying: the implementer states the date and source of the last successful check in the doc; never leave "unknown" in the pinned column.
- A package's `latest` is newer than the pinned version but incompatible (TypeScript, @types/node): the "Note" column says why; the checker only enforces consistency, not freshness.
- Peer ranges change after a minor release: rule 4a's `npm view` check is mandatory evidence in the PR.
- Two packages need different versions of the same dependency: forbidden by the single catalog; use an ADR to introduce a second catalog entry with a distinct alias.
- Rust crate yanked: `cargo deny` (OVE_SETUP006) fails; replace with the next compatible version.

## 11. Acceptance criteria

- [ ] `docs/dependencies.md` contains the full matrix with "verified on" date and the upgrade rules; the TypeScript row states 6.0.3 vs 7.0.2 and the reason.
- [ ] Given a package.json with `"react": "^19"`, then `pnpm check:deps` fails; with `catalog:` it passes.
- [ ] Given `typescript` 7.0.2 in the catalog, then `check:deps` fails on rule (d).
- [ ] Given vitest 5.0.4 and @vitest/coverage-v8 5.0.5, then it fails on rule (e).
- [ ] Given a catalog entry without a register block, then it fails on rule (c).
- [ ] `renovate.json` validates with `renovate-config-validator` and declares the groups and the `<6.1.0` TypeScript guard.
- [ ] The lockfile review checklist exists and is referenced from the register.
- [ ] Every version in the matrix equals the corresponding `catalog:` entry in `pnpm-workspace.yaml` (checked by the tool).

## 12. Test plan

Vitest unit tests in `tools/deps-policy/*.test.ts` with fixture trees under `tools/deps-policy/fixtures/` (good tree, one fixture per rule violation). A snapshot-free table-driven test of the register parser. Manual verification step recorded in the PR: for ten random rows, paste the `npm view` output. Commands: `pnpm test -- tools/deps-policy`, `pnpm check:deps`, `npx --yes renovate-config-validator` (dev-only invocation, version recorded).

## 13. Parallelization notes

Parallel with SETUP002..007. Hotspots: `docs/dependencies.md` is edited by every task that adds a dependency (append-only register sections, one H3 per dependency, merged with simple rebases); the matrix table is edited only by this task and by upgrade PRs. `pnpm-workspace.yaml` catalog lines: append-only, alphabetical order to keep merges trivial.

## 14. Open questions and assumptions

- ASSUMPTION: Renovate (GitHub App) rather than Dependabot because of grouping, regex managers and age delay. If the Owner prefers first-party tooling, an equivalent `.github/dependabot.yml` with groups is acceptable but loses the regex managers.
- ASSUMPTION: pnpm 12 supports `minimumReleaseAge` and `onlyBuiltDependencies`-style allow-lists; if the pinned version names them differently, adapt (see OVE_SETUP001).
- Open question for the Owner: moving to Node 24 LTS now instead of 22 (22 leaves maintenance in 2027); default stays 22 as requested.
- Open question: whether gitleaks, syft, actionlint, zizmor, cargo-deny and cargo-audit versions (not on npm) are recorded here; default: yes, pinned at implementation with checksums, and the matrix gets rows for them.
