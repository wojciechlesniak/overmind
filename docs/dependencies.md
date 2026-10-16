# Dependency policy and register

Verified on: 2026-10-16

The catalog is the exact source of pins. Registry latest is evidence, never an
instruction to upgrade. This review retains the Owner-approved SETUP006 tooling
and the deferred typescript-eslint update; it installs no new project package.
Licenses and exceptions remain SETUP006's unchanged authoritative policy.
Reserved catalog packages are not installed; their owning task must prove peers,
release age, scripts and the full transitive license graph before adoption.

## Compatibility matrix

| Package | Pinned | Registry latest on review date | Constraint source | Note |
| --- | --- | --- | --- | --- |
| Node.js | 22.23.3 | 22.23.3 | nodejs.org release/index and schedule | Maintenance LTS; EOL 2027-04-30; Node24 requires an ADR. |
| pnpm | 12.11.2 | 12.11.2 | npm; packageManager integrity; Corepack | pnpm12 allowBuilds=false; frozen lock; three-day age delay. |
| @axe-core/playwright | 4.13.0 | 4.14.0 | npm @axe-core/playwright@4.13.0 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| @commitlint/cli | 21.2.3 | 21.2.3 | npm @commitlint/cli@21.2.3 | Installed dev tool. |
| @commitlint/config-conventional | 21.2.3 | 21.2.3 | npm @commitlint/config-conventional@21.2.3 | Installed dev tool. |
| @eslint/js | 10.0.1 | 10.0.1 | npm @eslint/js@10.0.1 | Installed dev tool. |
| @playwright/test | 1.64.0 | 1.64.1 | npm @playwright/test@1.64.0 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| @storybook/addon-a11y | 10.6.2 | 10.6.2 | npm @storybook/addon-a11y@10.6.2 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| @storybook/react-vite | 10.6.2 | 10.6.2 | npm @storybook/react-vite@10.6.2 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| @tauri-apps/api | 2.12.3 | 2.12.4 | npm @tauri-apps/api@2.12.3 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| @tauri-apps/cli | 2.12.2 | 2.12.3 | npm @tauri-apps/cli@2.12.2 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| @testing-library/dom | 10.4.2 | 10.4.2 | npm @testing-library/dom@10.4.2 | Installed dev tool. |
| @testing-library/jest-dom | 7.0.1 | 7.0.1 | npm @testing-library/jest-dom@7.0.1 | Installed dev tool. |
| @testing-library/react | 16.3.3 | 16.3.3 | npm @testing-library/react@16.3.3 | Installed dev tool. |
| @types/node | 22.20.5 | 26.6.5 | npm @types/node@22.20.5 | Node22 runtime; do not adopt Node26 types. |
| @types/react | 19.3.0 | 19.3.0 | npm @types/react@19.3.0 | Installed dev tool. |
| @types/react-dom | 19.3.0 | 19.3.0 | npm @types/react-dom@19.3.0 | Installed dev tool. |
| @types/semver | 7.8.0 | 7.8.0 | npm @types/semver@7.8.0 | Installed dev tool. |
| @vitejs/plugin-react | 6.1.2 | 6.1.2 | npm @vitejs/plugin-react@6.1.2 | Catalog reserve only;6.1.2 requires Vite8 and is not installed with Vite7. SETUP009 must reconcile before adoption. |
| @vitest/coverage-v8 | 5.0.4 | 5.0.5 | npm @vitest/coverage-v8@5.0.4 | Installed dev tool. |
| @xyflow/react | 12.12.0 | 12.12.0 | npm @xyflow/react@12.12.0 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| dependency-cruiser | 18.6.0 | 18.6.0 | npm dependency-cruiser@18.6.0 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| eslint | 10.12.0 | 10.12.0 | npm eslint@10.12.0 | Installed dev tool. |
| eslint-config-prettier | 10.1.8 | 10.1.8 | npm eslint-config-prettier@10.1.8 | Installed dev tool. |
| eslint-plugin-boundaries | 7.2.0 | 7.2.0 | npm eslint-plugin-boundaries@7.2.0 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| eslint-plugin-react-refresh | 0.5.7 | 0.5.7 | npm eslint-plugin-react-refresh@0.5.7 | Installed dev tool. |
| globals | 17.13.0 | 17.13.0 | npm globals@17.13.0 | Installed dev tool. |
| happy-dom | 21.0.1 | 21.0.3 | npm happy-dom@21.0.1 | Approved MIT replacement for the denied jsdom transitive graph; unit DOM evaluation/network loading disabled. |
| lefthook | 2.2.1 | 2.2.2 | npm lefthook@2.2.1 | Retain2.2.1; no install build scripts allowed. |
| markdownlint-cli2 | 0.23.3 | 0.23.3 | npm markdownlint-cli2@0.23.3 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| oxlint | 1.87.0 | 1.88.0 | npm oxlint@1.87.0 | Approved native React hooks/compiler checks; replaces CC-BY-dependent plugin graph. |
| playwright | 1.64.0 | 1.64.1 | npm playwright@1.64.0 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| prettier | 3.9.10 | 3.9.10 | npm prettier@3.9.10 | Installed dev tool. |
| react | 19.3.0 | 19.3.1 | npm react@19.3.0 | Installed dev tool. |
| react-dom | 19.3.0 | 19.3.1 | npm react-dom@19.3.0 | Installed dev tool. |
| semver | 7.8.5 | 7.8.5 | npm semver@7.8.5 | Installed dev tool. |
| spdx-license-ids | 3.0.24 | 3.0.24 | npm spdx-license-ids@3.0.24 | Installed dev tool. |
| storybook | 10.6.2 | 10.6.2 | npm storybook@10.6.2 | Reserved catalog pin; not yet installed. Owning task rechecks peers and full license graph. |
| tsx | 4.23.15 | 4.23.15 | npm tsx@4.23.15 | Installed dev tool. |
| typescript | 6.0.3 | 7.0.2 | npm typescript@6.0.3; typescript-eslint peer >=4.8.4 <6.1.0 | Deliberately 6.0.3: typescript-eslint peer is >=4.8.4 <6.1.0; 7.x is incompatible. |
| typescript-eslint | 8.71.1 | 8.71.2 | npm typescript-eslint@8.71.1 | Owner deferred updating 8.71.1; peer accepts ESLint10 and TypeScript6.0 only. |
| vite | 7.3.7 | 8.3.4 | npm vite@7.3.7 | Approved license-compatible7.3 line; Vite8 brings mandatory MPL Lightning CSS. |
| vitest | 5.0.4 | 5.0.5 | npm vitest@5.0.4 | Installed dev tool. |
| yaml | 2.9.1 | 2.9.1 | npm yaml@2.9.1 | Installed dev tool. |
| zod | 4.6.6 | 4.6.7 | npm zod@4.6.6 | Retain mature4.6.6; built-in z.toJSONSchema replaces zod-to-json-schema. |
| eslint-plugin-react-hooks | not adopted | 7.1.1 | npm registry on review date | Oxlint supplies hooks/compiler checks without denied Babel metadata dependencies. |
| eslint-plugin-jsx-a11y | not adopted | 6.10.2 | npm registry on review date | ESLint10 peer mismatch; actual axe tests owned by Storybook/Playwright tasks. |
| jsdom | not adopted | 30.1.3 | npm registry on review date | Direct license MIT; its installed transitive graph violates the unchanged policy. Happy DOM replaces it. |
| zod-to-json-schema | not adopted | 3.25.2 | npm registry on review date | Targets zod3; zod4 already supplies schema conversion. |
| better-sqlite3 | candidate 13.0.3 | 13.0.3 | npm registry on review date | SETUP011 evaluates engine packaging/storage; sqlite-vec remains a future feature. Not an adoption. |
| bun | candidate 1.4.3 | 1.4.3 | npm registry on review date | SETUP011 evaluates engine packaging/storage; sqlite-vec remains a future feature. Not an adoption. |
| postject | candidate 1.0.0-alpha.6 | 1.0.0-alpha.6 | npm registry on review date | SETUP011 evaluates engine packaging/storage; sqlite-vec remains a future feature. Not an adoption. |
| @yao-pkg/pkg | candidate 6.23.0 | 6.23.0 | npm registry on review date | SETUP011 evaluates engine packaging/storage; sqlite-vec remains a future feature. Not an adoption. |
| esbuild | candidate 0.28.2 | 0.28.2 | npm registry on review date | SETUP011 evaluates engine packaging/storage; sqlite-vec remains a future feature. Not an adoption. |
| sqlite-vec | candidate 0.1.9 | 0.1.9 | npm registry on review date | SETUP011 evaluates engine packaging/storage; sqlite-vec remains a future feature. Not an adoption. |
| crate:tauri | planned 2.12.3 | 2.12.4 | https://crates.io/api/v1/crates/tauri/2.12.3 | Future Rust shell; MSRV 1.90; SETUP010 installs exact pins. |
| crate:tauri-build | planned 2.7.2 | 2.7.3 | https://crates.io/api/v1/crates/tauri-build/2.7.2 | Future Rust shell; MSRV 1.90; SETUP010 installs exact pins. |
| crate:tauri-plugin-shell | planned 2.5.0 | 2.5.0 | https://crates.io/api/v1/crates/tauri-plugin-shell/2.5.0 | Future Rust shell; MSRV 1.90; SETUP010 installs exact pins. |
| crate:tauri-plugin-single-instance | planned 2.5.3 | 2.5.4 | https://crates.io/api/v1/crates/tauri-plugin-single-instance/2.5.3 | Future Rust shell; MSRV 1.90; SETUP010 installs exact pins. |
| crate:tauri-plugin-dialog | planned 2.8.2 | 2.8.3 | https://crates.io/api/v1/crates/tauri-plugin-dialog/2.8.2 | Future Rust shell; MSRV 1.90; SETUP010 installs exact pins. |
| crate:serde | planned 1.0.229 | 1.0.229 | https://crates.io/api/v1/crates/serde/1.0.229 | Future Rust shell; MSRV 1.56; SETUP010 installs exact pins. |
| crate:serde_json | planned 1.0.154 | 1.0.154 | https://crates.io/api/v1/crates/serde_json/1.0.154 | Future Rust shell; MSRV 1.71; SETUP010 installs exact pins. |
| crate:tokio | planned 1.53.2 | 1.53.3 | https://crates.io/api/v1/crates/tokio/1.53.2 | Future Rust shell; MSRV 1.71; SETUP010 installs exact pins. |
| Rust toolchain | planned 1.90.0 | not adopted | Rust/Tauri MSRV | No rust-toolchain.toml yet; SETUP010 owns installation. |
| herdr | planned 0.9.3 | 0.9.5 | SETUP015 vendor/herdr/VERSION | SETUP015 selects a verified mature release; latest is younger than72 hours. |
| Apple container CLI | minimum 1.5.0 | 1.5.0 | Apple container publisher; SETUP015 | Requires macOS26/Apple silicon; no current runner. |
| node:sqlite | built into 22.23.3 | built in | Node22 API | SETUP011 verifies experimental status and chooses storage. |
| actionlint | 1.7.12 | 1.7.12 | Publisher release verified by SETUP006/007 | SHA256 platform pins; manual updates only. |
| zizmor | 1.30.1 | 1.31.1 | Publisher release verified by SETUP006/007 | Latest release is younger than72 hours; retain mature1.30.1. |
| cargo-deny | 0.20.2 | 0.20.2 | Publisher release verified by SETUP006/007 | SHA256 platform pins; manual updates only. |
| cargo-audit | 0.22.2 | 0.22.2 | Publisher release verified by SETUP006/007 | SHA256 platform pins; manual updates only. |
| gitleaks | 8.30.1 | 8.30.1 | Publisher release verified by SETUP006/007 | SHA256 platform pins; manual updates only. |
| syft | 1.54.1 | 1.54.1 | Publisher release verified by SETUP006/007 | SHA256 platform pins; manual updates only. |

| actions/checkout | 7.0.1 | 7.0.1 | Exact workflow SHA 3d3c42e5aac5ba805825da76410c181273ba90b1 | Publisher license at the pinned ref is MIT; no floating action tag. |
| actions/setup-node | 7.1.0 | 7.1.0 | Exact workflow SHA 949feb2413d6458794dcd2491c4babbbce0c15c1 | Publisher license at the pinned ref is MIT; no floating action tag. |
| actions/cache/restore | 6.1.0 | 6.1.0 | Exact workflow SHA 55cc8345863c7cc4c66a329aec7e433d2d1c52a9 | Publisher license at the pinned ref is MIT; no floating action tag. |
| actions/cache/save | 6.1.0 | 6.1.0 | Exact workflow SHA 55cc8345863c7cc4c66a329aec7e433d2d1c52a9 | Publisher license at the pinned ref is MIT; no floating action tag. |
| actions/upload-artifact | 7.0.2 | 7.0.2 | Exact workflow SHA cf430e030ddbb5b0abf93d22962f4752f3646cd9 | Publisher license at the pinned ref is MIT; no floating action tag. |
| actions/download-artifact | 8.0.2 | 8.0.2 | Exact workflow SHA 9000827ccba6bdab643e8b6fd33ac0654aef8333 | Publisher license at the pinned ref is MIT; no floating action tag. |
| actions/dependency-review-action | 5.0.0 | 5.0.0 | Exact workflow SHA a1d282b36b6f3519aa1f3fc636f609c47dddb294 | Publisher license at the pinned ref is MIT; no floating action tag. |
| github/codeql-action/upload-sarif | 4.38.3 | 4.39.0 | Exact workflow SHA 24c54180a607b1449ed407dd24f251e4e9147c8d | Publisher license at the pinned ref is MIT; no floating action tag. |

## How to upgrade

1. TypeScript and typescript-eslint move in one reviewed PR. Capture `npm view
   typescript-eslint@<version> peerDependencies.typescript`; prove the proposed
   TypeScript satisfies it with typecheck, lint and tests. TypeScript remains
   `<6.1.0` in Renovate until a reviewed change proves a new range. Do not upgrade
   the Owner-deferred typescript-eslint pin merely because a newer version exists.
2. Tauri JS API and Rust tauri crates move together by major/minor. Include
   `pnpm tauri info` and the generated capability-schema diff. No Rust toolchain
   or shell is installed by SETUP008.
3. React/react-dom and their types move together after checking XYFlow, Storybook
   and Vite plugin peers. Vitest/coverage, all Storybook packages, commitlint pairs,
   Playwright/package/Docker image and Rust toolchain pins are coordinated groups.
   The reserved plugin-react6 is incompatible with the adopted Vite7: it must not
   be installed before SETUP009 resolves that reserved row.
4. Node patches stay on22.x and update .nvmrc, engines, matrix and CI together.
   A move to another Node major requires an ADR; plan Node24 before22's recorded
   end of life. Types continue to match the runtime major.
5. A zod major/minor runs `pnpm check:contracts` and regenerates JSON Schema once
   ARCH008 supplies the real additive-contract gate. Missing foundation tooling
   is not proof that a contract stayed compatible.
6. Ordinary releases wait three days in both pnpm and Renovate. High/critical
   advisory fixes receive a narrowly reviewed exact-release emergency exception
   and must merge within seven days. Record advisory, version, expiry and reason;
   update the matching pnpm/Renovate exception together. No current exception or
   blanket age bypass is authorized. Security PRs bypass the weekly schedule.
7. Every update includes the matching matrix/register changes, upstream changelog
   links and `pnpm check:deps` output. Run the unchanged actual license/audit gates,
   tests and SBOM checks. No policy weakening, metadata rewriting or report
   exclusion may make an upgrade pass.
8. Renovate never merges. Human/Owner-authorized review and passing gates precede
   merge. Major updates wait for dashboard approval. Binary pins are manual:
   Renovate reports them in the dashboard issue, pending approval, and must not
   be approved for automatic edits. Update exact version, both archive URLs and
   publisher checksums together by hand; never update a version alone.

## Lockfile review checklist

- Unexpected packages or large new transitive trees, including optional peers.
- Resolution URLs outside npmjs/crates.io, redirects and embedded credentials.
- Integrity changes without corresponding version changes.
- Preinstall/install/postinstall scripts or native binaries; builds are denied
  unless explicitly justified and approved. Existing esbuild/lefthook builds stay false.
- Typosquats, unexpected aliases, publisher/maintainer changes and provenance.
- Peer/engine compatibility, age, unchanged allowed licenses and high advisories.
- Reproducible frozen install and lockfile-only SBOM from the exact reviewed SHA.

OSS003 links this checklist from the future PR template. Transitive packages are
covered by actual license reports and SBOM, not duplicated as direct register entries.

## Not adopted

TypeScript7 is outside the installed linter peer range. Node26 types do not match
Node22. eslint-plugin-jsx-a11y has no accepted ESLint10 peer support; actual axe
coverage belongs to UI test tasks. zod-to-json-schema duplicates zod4 and targets
zod3. Electron conflicts with ADR0018; LangGraph/other workflow frameworks conflict
with ADR0019. jsdom, the Babel-dependent hooks plugin and Vite8's mandatory Lightning
CSS graph were replaced under the unchanged license policy, not granted exceptions.
The plugin-react6 reserve cannot be adopted alongside the current Vite7 pin.

## Register

Each npm block includes catalog reserves as well as currently used dependencies.
Only zod is pure-layer-ok. Sizes and publisher counts below come from the exact
npm release manifest; cadence is upstream-driven and reviewed on every upgrade.
No install script listed here is authorized to run merely by being documented.

### @axe-core/playwright

This catalog reserve is blocked by the current policy: its direct MPL-2.0 license
is not approved. It is not installed. Future UI test tasks must select a compliant
solution or obtain an explicit policy decision; no exception is created here.

- Version: 4.13.0
- License: MPL-2.0
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserved browser accessibility audits; direct MPL license blocks adoption under current policy.
- Maintenance cost: Upstream-driven release cadence; review every update. 5 npm publisher maintainers; pinned unpacked size 46 KiB.
- Alternatives considered: Native accessibility-tree/keyboard assertions or a policy-compliant audit engine; the owning UI test task must decide.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@axe-core%2Fplaywright/4.13.0

### @commitlint/cli

- Version: 21.2.3
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP005
- Value: Parse and enforce actual Conventional Commits and task references at commit time.
- Maintenance cost: Upstream-driven release cadence; review every update. 4 npm publisher maintainers; pinned unpacked size 37 KiB.
- Alternatives considered: A bespoke regex hook; keep the tested official parser.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@commitlint%2Fcli/21.2.3

### @commitlint/config-conventional

- Version: 21.2.3
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP005
- Value: Share one Conventional Commits baseline with the task-aware local plugin.
- Maintenance cost: Upstream-driven release cadence; review every update. 4 npm publisher maintainers; pinned unpacked size 20 KiB.
- Alternatives considered: Maintain a separate full rule set; use the supported preset plus small project rules.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@commitlint%2Fconfig-conventional/21.2.3

### @eslint/js

- Version: 10.0.1
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Supply the official core JavaScript recommended checks for repository code.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 15 KiB.
- Alternatives considered: A handwritten core rule list with independent upgrade maintenance.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@eslint%2Fjs/10.0.1

### @playwright/test

- Version: 1.64.0
- License: Apache-2.0
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve real-browser E2E, keyboard and visual regression execution with the paired browser version.
- Maintenance cost: Upstream-driven release cadence; review every update. 5 npm publisher maintainers; pinned unpacked size 28 KiB.
- Alternatives considered: WebDriver-based runners or custom browser orchestration.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@playwright%2Ftest/1.64.0

### @storybook/addon-a11y

- Version: 10.6.2
- License: MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve component accessibility auditing; the owning task must first resolve its denied axe transitive graph.
- Maintenance cost: Upstream-driven release cadence; review every update. 12 npm publisher maintainers; pinned unpacked size 184 KiB.
- Alternatives considered: Policy-compliant component accessibility assertions; this reserve is not install approval.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@storybook%2Faddon-a11y/10.6.2

### @storybook/react-vite

- Version: 10.6.2
- License: MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve the React/Vite Storybook renderer compatible with the current Vite7 peer line.
- Maintenance cost: Upstream-driven release cadence; review every update. 12 npm publisher maintainers; pinned unpacked size 31 KiB.
- Alternatives considered: Standalone demo pages or another bundler integration.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@storybook%2Freact-vite/10.6.2

### @tauri-apps/api

- Version: 2.12.3
- License: Apache-2.0 OR MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve the typed desktop-shell IPC/window interface; engine data still passes through api-client.
- Maintenance cost: Upstream-driven release cadence; review every update. 7 npm publisher maintainers; pinned unpacked size 871 KiB.
- Alternatives considered: A bespoke native bridge or Electron, excluded by ADR0018.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@tauri-apps%2Fapi/2.12.3

### @tauri-apps/cli

- Version: 2.12.2
- License: Apache-2.0 OR MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve reproducible Rust-shell build and capability generation for SETUP010.
- Maintenance cost: Upstream-driven release cadence; review every update. 7 npm publisher maintainers; pinned unpacked size 420 KiB.
- Alternatives considered: Manual Cargo/app-bundle orchestration with duplicate platform logic.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@tauri-apps%2Fcli/2.12.2

### @testing-library/dom

- Version: 10.4.2
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Provide semantic DOM queries and satisfy the React testing-library peer without auto-installed peers.
- Maintenance cost: Upstream-driven release cadence; review every update. 18 npm publisher maintainers; pinned unpacked size 2409 KiB.
- Alternatives considered: Raw DOM selectors and manually maintained query helpers.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@testing-library%2Fdom/10.4.2

### @testing-library/jest-dom

- Version: 7.0.1
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Assert observable DOM states with shared Vitest matchers.
- Maintenance cost: Upstream-driven release cadence; review every update. 18 npm publisher maintainers; pinned unpacked size 324 KiB.
- Alternatives considered: Repeated custom DOM assertions in every UI test.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@testing-library%2Fjest-dom/7.0.1

### @testing-library/react

- Version: 16.3.3
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Render React components through user-visible behavior for unit tests.
- Maintenance cost: Upstream-driven release cadence; review every update. 18 npm publisher maintainers; pinned unpacked size 332 KiB.
- Alternatives considered: Renderer-internal assertions or a custom React test harness.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@testing-library%2Freact/16.3.3

### @types/node

- Version: 22.20.5
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Give the engine/tooling Node22 API types while keeping pure layers free of Node globals.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 2381 KiB.
- Alternatives considered: Newer Node types would describe APIs unavailable in the adopted runtime.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@types%2Fnode/22.20.5

### @types/react

- Version: 19.3.0
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Type React19 component props, hooks and JSX against the adopted runtime.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 399 KiB.
- Alternatives considered: Local ambient declarations with independent maintenance.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@types%2Freact/19.3.0

### @types/react-dom

- Version: 19.3.0
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Type the matching React DOM rendering and browser integration surface.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 32 KiB.
- Alternatives considered: Local renderer declarations or mismatched runtime types.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@types%2Freact-dom/19.3.0

### @types/semver

- Version: 7.8.0
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Type the existing semver helper used by hooks and dependency-policy compatibility checks.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 24 KiB.
- Alternatives considered: Local declaration copies; retain the supported declarations.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@types%2Fsemver/7.8.0

### @vitejs/plugin-react

- Version: 6.1.2
- License: MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve React fast-refresh/build integration only; this6.x pin requires Vite8 and remains uninstalled.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 45 KiB.
- Alternatives considered: Vite native JSX or a compatible SWC integration after peer/license review in SETUP009.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@vitejs%2Fplugin-react/6.1.2

### @vitest/coverage-v8

- Version: 5.0.4
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Collect native V8 coverage and enforce each unchanged package threshold.
- Maintenance cost: Upstream-driven release cadence; review every update. 5 npm publisher maintainers; pinned unpacked size 29 KiB.
- Alternatives considered: Istanbul instrumentation adds a separate transform path; keep the matching Vitest version.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@vitest%2Fcoverage-v8/5.0.4

### @xyflow/react

- Version: 12.12.0
- License: MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve the typed node/edge editor surface for the desktop workflow canvas.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 1188 KiB.
- Alternatives considered: A custom graph renderer and gesture engine; adoption remains a UI task.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/@xyflow%2Freact/12.12.0

### dependency-cruiser

- Version: 18.6.0
- License: MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve static import-graph and cycle analysis as an ARCH002 candidate.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 1022 KiB.
- Alternatives considered: ESLint boundaries or a small graph checker; ARCH002 makes the measured choice.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/dependency-cruiser/18.6.0

### eslint

- Version: 10.12.0
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Execute the reviewed TypeScript/JavaScript code rules and strict disable-reason policy.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 2879 KiB.
- Alternatives considered: Oxlint alone does not replace the complete existing project rule set.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/eslint/10.12.0

### eslint-config-prettier

- Version: 10.1.8
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Turn off formatting rules that conflict with the dedicated formatter.
- Maintenance cost: Upstream-driven release cadence; review every update. 3 npm publisher maintainers; pinned unpacked size 58 KiB.
- Alternatives considered: Maintain a duplicate conflict list in project configuration.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/eslint-config-prettier/10.1.8

### eslint-plugin-boundaries

- Version: 7.2.0
- License: MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve lint-time Clean Architecture import checks for ARCH002 evaluation.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 305 KiB.
- Alternatives considered: Dependency-cruiser or a shared small graph checker.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/eslint-plugin-boundaries/7.2.0

### eslint-plugin-react-refresh

- Version: 0.5.7
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Check component exports used by the future Vite refresh flow.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 24 KiB.
- Alternatives considered: Custom export-pattern checks; retain the compatible ESLint10 plugin.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/eslint-plugin-react-refresh/0.5.7

### globals

- Version: 17.13.0
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Use a reviewed list of JavaScript/Node/browser global identifiers in scoped ESLint configurations.
- Maintenance cost: Upstream-driven release cadence; review every update. 4 npm publisher maintainers; pinned unpacked size 251 KiB.
- Alternatives considered: Manual ambient-name lists prone to drift between environments.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/globals/17.13.0

### happy-dom

- Version: 21.0.1
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP006
- Value: Provide MIT DOM unit tests with script evaluation and external loading disabled.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 8952 KiB.
- Alternatives considered: jsdom was rejected by the unchanged transitive-license gate; real browser behavior stays in Playwright.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/happy-dom/21.0.1

### lefthook

- Version: 2.2.1
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP005
- Value: Run actual staged format/lint/secret guards and normal pre-push checks.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 28 KiB.
- Alternatives considered: Husky or bespoke hook installation; retain the verified pinned binary and denied install build.
- Risk: Install scripts: postinstall. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/lefthook/2.2.1

### markdownlint-cli2

- Version: 0.23.3
- License: MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve semantic Markdown linting for the OSS documentation task.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 229 KiB.
- Alternatives considered: Prettier formatting plus custom documentation checks.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/markdownlint-cli2/0.23.3

### oxlint

- Version: 1.87.0
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP006
- Value: Run the actual React hook and compiler-purity checks after the denied Babel-dependent graph was removed.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 2358 KiB.
- Alternatives considered: The previous hooks plugin required denied metadata dependencies; keep the tested native rule mapping.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/oxlint/1.87.0

### playwright

- Version: 1.64.0
- License: Apache-2.0
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve the paired browser automation API and reproducible browser version for E2E tooling.
- Maintenance cost: Upstream-driven release cadence; review every update. 5 npm publisher maintainers; pinned unpacked size 4916 KiB.
- Alternatives considered: WebDriver or direct CDP orchestration.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/playwright/1.64.0

### prettier

- Version: 3.9.10
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Format source, JSON, YAML and documentation consistently in hooks and CI.
- Maintenance cost: Upstream-driven release cadence; review every update. 11 npm publisher maintainers; pinned unpacked size 9726 KiB.
- Alternatives considered: Per-language formatters with separate configuration and upgrade paths.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/prettier/3.9.10

### react

- Version: 19.3.0
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Render the planned desktop interface through a typed component model.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 174 KiB.
- Alternatives considered: Another UI framework would require revisiting the existing design and test contracts.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/react/19.3.0

### react-dom

- Version: 19.3.0
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Render the same React19 runtime into the desktop WebView DOM.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 7875 KiB.
- Alternatives considered: A different renderer would change the desktop UI platform.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/react-dom/19.3.0

### semver

- Version: 7.8.5
- License: ISC
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Evaluate real prerelease/range semantics for commit tooling and TypeScript peer compatibility.
- Maintenance cost: Upstream-driven release cadence; review every update. 4 npm publisher maintainers; pinned unpacked size 99 KiB.
- Alternatives considered: A custom version parser adds a second interpretation of npm peer ranges.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/semver/7.8.5

### spdx-license-ids

- Version: 3.0.24
- License: CC0-1.0
- Used by: overmind (dev)
- Added by: OVE_SETUP006
- Value: Validate registered/deprecated SPDX identifiers in the bounded fail-closed license evaluator using CC0 data.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 14 KiB.
- Alternatives considered: A parser package carrying denied CC-BY exception data; no exception-name database is approved.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/spdx-license-ids/3.0.24

### storybook

- Version: 10.6.2
- License: MIT
- Used by: catalog reserve; not installed (future)
- Added by: OVE_SETUP001
- Value: Reserve isolated component development and documented visual states.
- Maintenance cost: Upstream-driven release cadence; review every update. 8 npm publisher maintainers; pinned unpacked size 21729 KiB.
- Alternatives considered: Standalone component demo routes; actual adoption must pass the full license graph.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/storybook/10.6.2

### tsx

- Version: 4.23.15
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Run TypeScript tooling with the pinned Node runtime without a separate emitted build.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 388 KiB.
- Alternatives considered: Compile every helper before invocation or maintain duplicate JavaScript entrypoints.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/tsx/4.23.15

### typescript

- Version: 6.0.3
- License: Apache-2.0
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Provide strict compile-time contracts and project references at the linter-compatible6.0.3 pin.
- Maintenance cost: Upstream-driven release cadence; review every update. 6 npm publisher maintainers; pinned unpacked size 23776 KiB.
- Alternatives considered: TypeScript7 is outside the actual typescript-eslint peer range.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/typescript/6.0.3

### typescript-eslint

- Version: 8.71.1
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Parse and type-check lint rules against TypeScript6.0 and ESLint10. The Owner-deferred8.71.1 pin remains.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 42 KiB.
- Alternatives considered: Untyped linting loses the existing type-aware safety checks.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/typescript-eslint/8.71.1

### vite

- Version: 7.3.7
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP006
- Value: Build the future desktop WebView on the approved MIT7.3 line without mandatory Lightning CSS.
- Maintenance cost: Upstream-driven release cadence; review every update. 2 npm publisher maintainers; pinned unpacked size 2192 KiB.
- Alternatives considered: Vite8 introduces the denied MPL graph; other bundlers require a deliberate reviewed change.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/vite/7.3.7

### vitest

- Version: 5.0.4
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Run isolated deterministic unit/integration tests and package-specific coverage with native V8 reports.
- Maintenance cost: Upstream-driven release cadence; review every update. 5 npm publisher maintainers; pinned unpacked size 2748 KiB.
- Alternatives considered: Another test runner would replace the existing workspace/environment/coverage contracts.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/vitest/5.0.4

### yaml

- Version: 2.9.1
- License: ISC
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Parse bounded workspace and workflow metadata as data for tooling.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 670 KiB.
- Alternatives considered: Custom YAML parsing or JSON-only configuration would duplicate existing ecosystem formats.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/yaml/2.9.1

### zod

- Version: 4.6.6
- License: MIT
- Used by: overmind (dev)
- Added by: OVE_SETUP001
- Value: Validate domain contracts and generate JSON Schema from one pure TypeScript source.
- Maintenance cost: Upstream-driven release cadence; review every update. 1 npm publisher maintainers; pinned unpacked size 6005 KiB.
- Alternatives considered: Manual validation or zod3 schema-conversion packages; zod4 already supplies conversion.
- Risk: Install scripts: none declared directly. Transitive scripts remain denied; tooling may use native code/network only in approved CI/helper flows.
- Last reviewed: 2026-10-16
- Pure layer: pure-layer-ok
- Source: https://registry.npmjs.org/zod/4.6.6

### actionlint

- Version: 1.7.12
- License: MIT
- Used by: verified tooling and hosted CI (dev binary)
- Added by: OVE_SETUP006
- Value: Existing workflow or Rust security gate.
- Maintenance cost: Review publisher releases and advisories manually; update both platform archives and SHA256 together. Native binary size is bounded to128 MiB by the shared installer.
- Alternatives considered: Reuse the generic downloader; no paid Gitleaks Action. Syft covers both lockfile ecosystems whereas pnpm SBOM covers JavaScript only.
- Risk: Third-party native executable; HTTPS and pinned checksum before execution, cached bytes reverified, least-privilege CI and no unchecked fallback.
- Last reviewed: 2026-10-16
- Source: https://github.com/rhysd/actionlint/releases

### zizmor

- Version: 1.30.1
- License: MIT
- Used by: verified tooling and hosted CI (dev binary)
- Added by: OVE_SETUP006
- Value: Existing workflow or Rust security gate.
- Maintenance cost: Review publisher releases and advisories manually; update both platform archives and SHA256 together. Native binary size is bounded to128 MiB by the shared installer.
- Alternatives considered: Reuse the generic downloader; no paid Gitleaks Action. Syft covers both lockfile ecosystems whereas pnpm SBOM covers JavaScript only.
- Risk: Third-party native executable; HTTPS and pinned checksum before execution, cached bytes reverified, least-privilege CI and no unchecked fallback.
- Last reviewed: 2026-10-16
- Source: https://github.com/zizmorcore/zizmor/releases

### cargo-deny

- Version: 0.20.2
- License: Apache-2.0
- Used by: verified tooling and hosted CI (dev binary)
- Added by: OVE_SETUP006
- Value: Existing workflow or Rust security gate.
- Maintenance cost: Review publisher releases and advisories manually; update both platform archives and SHA256 together. Native binary size is bounded to128 MiB by the shared installer.
- Alternatives considered: Reuse the generic downloader; no paid Gitleaks Action. Syft covers both lockfile ecosystems whereas pnpm SBOM covers JavaScript only.
- Risk: Third-party native executable; HTTPS and pinned checksum before execution, cached bytes reverified, least-privilege CI and no unchecked fallback.
- Last reviewed: 2026-10-16
- Source: https://github.com/EmbarkStudios/cargo-deny/releases

### cargo-audit

- Version: 0.22.2
- License: Apache-2.0 OR MIT
- Used by: verified tooling and hosted CI (dev binary)
- Added by: OVE_SETUP006
- Value: Existing workflow or Rust security gate.
- Maintenance cost: Review publisher releases and advisories manually; update both platform archives and SHA256 together. Native binary size is bounded to128 MiB by the shared installer.
- Alternatives considered: Reuse the generic downloader; no paid Gitleaks Action. Syft covers both lockfile ecosystems whereas pnpm SBOM covers JavaScript only.
- Risk: Third-party native executable; HTTPS and pinned checksum before execution, cached bytes reverified, least-privilege CI and no unchecked fallback.
- Last reviewed: 2026-10-16
- Source: https://github.com/rustsec/rustsec/releases

### gitleaks

- Version: 8.30.1
- License: MIT
- Used by: verified tooling and hosted CI (dev binary)
- Added by: OVE_SETUP007
- Value: Secret detection with strict fake-fixture policy.
- Maintenance cost: Review publisher releases and advisories manually; update both platform archives and SHA256 together. Native binary size is bounded to128 MiB by the shared installer.
- Alternatives considered: Reuse the generic downloader; no paid Gitleaks Action. Syft covers both lockfile ecosystems whereas pnpm SBOM covers JavaScript only.
- Risk: Third-party native executable; HTTPS and pinned checksum before execution, cached bytes reverified, least-privilege CI and no unchecked fallback.
- Last reviewed: 2026-10-16
- Source: https://github.com/gitleaks/gitleaks/releases

### syft

- Version: 1.54.1
- License: Apache-2.0
- Used by: verified tooling and hosted CI (dev binary)
- Added by: OVE_SETUP007
- Value: One CycloneDX inventory of npm and Cargo locks.
- Maintenance cost: Review publisher releases and advisories manually; update both platform archives and SHA256 together. Native binary size is bounded to128 MiB by the shared installer.
- Alternatives considered: Reuse the generic downloader; no paid Gitleaks Action. Syft covers both lockfile ecosystems whereas pnpm SBOM covers JavaScript only.
- Risk: Third-party native executable; HTTPS and pinned checksum before execution, cached bytes reverified, least-privilege CI and no unchecked fallback.
- Last reviewed: 2026-10-16
- Source: https://github.com/anchore/syft/releases

### crate:tauri

- Version: 2.12.3
- License: Apache-2.0 OR MIT
- Used by: planned Rust shell; not installed (SETUP010)
- Added by: OVE_SETUP010
- Value: Backlog-planned shell/API support; cataloging it does not adopt or install Rust.
- Maintenance cost: Review Rust MSRV, upstream cadence and feature/size impact together with the shell's future lockfile.
- Alternatives considered: Keep business logic in TypeScript engine/adapters; Rust remains a thin shell.
- Risk: Native code and possible crate build scripts; SETUP010 must prove licenses, sources, bans, locked install and capabilities before use.
- Last reviewed: 2026-10-16
- Source: https://crates.io/api/v1/crates/tauri/2.12.3

### crate:tauri-build

- Version: 2.7.2
- License: Apache-2.0 OR MIT
- Used by: planned Rust shell; not installed (SETUP010)
- Added by: OVE_SETUP010
- Value: Backlog-planned shell/API support; cataloging it does not adopt or install Rust.
- Maintenance cost: Review Rust MSRV, upstream cadence and feature/size impact together with the shell's future lockfile.
- Alternatives considered: Keep business logic in TypeScript engine/adapters; Rust remains a thin shell.
- Risk: Native code and possible crate build scripts; SETUP010 must prove licenses, sources, bans, locked install and capabilities before use.
- Last reviewed: 2026-10-16
- Source: https://crates.io/api/v1/crates/tauri-build/2.7.2

### crate:tauri-plugin-shell

- Version: 2.5.0
- License: Apache-2.0 OR MIT
- Used by: planned Rust shell; not installed (SETUP010)
- Added by: OVE_SETUP010
- Value: Backlog-planned shell/API support; cataloging it does not adopt or install Rust.
- Maintenance cost: Review Rust MSRV, upstream cadence and feature/size impact together with the shell's future lockfile.
- Alternatives considered: Keep business logic in TypeScript engine/adapters; Rust remains a thin shell.
- Risk: Native code and possible crate build scripts; SETUP010 must prove licenses, sources, bans, locked install and capabilities before use.
- Last reviewed: 2026-10-16
- Source: https://crates.io/api/v1/crates/tauri-plugin-shell/2.5.0

### crate:tauri-plugin-single-instance

- Version: 2.5.3
- License: Apache-2.0 OR MIT
- Used by: planned Rust shell; not installed (SETUP010)
- Added by: OVE_SETUP010
- Value: Backlog-planned shell/API support; cataloging it does not adopt or install Rust.
- Maintenance cost: Review Rust MSRV, upstream cadence and feature/size impact together with the shell's future lockfile.
- Alternatives considered: Keep business logic in TypeScript engine/adapters; Rust remains a thin shell.
- Risk: Native code and possible crate build scripts; SETUP010 must prove licenses, sources, bans, locked install and capabilities before use.
- Last reviewed: 2026-10-16
- Source: https://crates.io/api/v1/crates/tauri-plugin-single-instance/2.5.3

### crate:tauri-plugin-dialog

- Version: 2.8.2
- License: Apache-2.0 OR MIT
- Used by: planned Rust shell; not installed (SETUP010)
- Added by: OVE_SETUP010
- Value: Backlog-planned shell/API support; cataloging it does not adopt or install Rust.
- Maintenance cost: Review Rust MSRV, upstream cadence and feature/size impact together with the shell's future lockfile.
- Alternatives considered: Keep business logic in TypeScript engine/adapters; Rust remains a thin shell.
- Risk: Native code and possible crate build scripts; SETUP010 must prove licenses, sources, bans, locked install and capabilities before use.
- Last reviewed: 2026-10-16
- Source: https://crates.io/api/v1/crates/tauri-plugin-dialog/2.8.2

### crate:serde

- Version: 1.0.229
- License: MIT OR Apache-2.0
- Used by: planned Rust shell; not installed (SETUP010)
- Added by: OVE_SETUP010
- Value: Backlog-planned shell/API support; cataloging it does not adopt or install Rust.
- Maintenance cost: Review Rust MSRV, upstream cadence and feature/size impact together with the shell's future lockfile.
- Alternatives considered: Keep business logic in TypeScript engine/adapters; Rust remains a thin shell.
- Risk: Native code and possible crate build scripts; SETUP010 must prove licenses, sources, bans, locked install and capabilities before use.
- Last reviewed: 2026-10-16
- Source: https://crates.io/api/v1/crates/serde/1.0.229

### crate:serde_json

- Version: 1.0.154
- License: MIT OR Apache-2.0
- Used by: planned Rust shell; not installed (SETUP010)
- Added by: OVE_SETUP010
- Value: Backlog-planned shell/API support; cataloging it does not adopt or install Rust.
- Maintenance cost: Review Rust MSRV, upstream cadence and feature/size impact together with the shell's future lockfile.
- Alternatives considered: Keep business logic in TypeScript engine/adapters; Rust remains a thin shell.
- Risk: Native code and possible crate build scripts; SETUP010 must prove licenses, sources, bans, locked install and capabilities before use.
- Last reviewed: 2026-10-16
- Source: https://crates.io/api/v1/crates/serde_json/1.0.154

### crate:tokio

- Version: 1.53.2
- License: MIT
- Used by: planned Rust shell; not installed (SETUP010)
- Added by: OVE_SETUP010
- Value: Backlog-planned shell/API support; cataloging it does not adopt or install Rust.
- Maintenance cost: Review Rust MSRV, upstream cadence and feature/size impact together with the shell's future lockfile.
- Alternatives considered: Keep business logic in TypeScript engine/adapters; Rust remains a thin shell.
- Risk: Native code and possible crate build scripts; SETUP010 must prove licenses, sources, bans, locked install and capabilities before use.
- Last reviewed: 2026-10-16
- Source: https://crates.io/api/v1/crates/tokio/1.53.2

### Node.js

- Version: 22.23.3
- License: MIT
- Used by: workspace runtime/toolchain (dev; engine packaging remains SETUP011)
- Added by: OVE_SETUP001
- Value: Pinned Node22 runtime for the workspace and planned engine packaging.
- Maintenance cost: Review patch releases and security advisories on the pinned major; verify publisher checksums/integrity and all engines before updates.
- Alternatives considered: Node24 migration requires an ADR and compatibility proof.
- Risk: Executable runtime/package manager; no unchecked install-script execution, exact integrity and least-privilege CI.
- Last reviewed: 2026-10-16
- Source: https://nodejs.org/dist/v22.23.3/

### pnpm

- Version: 12.11.2
- License: MIT
- Used by: workspace runtime/toolchain (dev; engine packaging remains SETUP011)
- Added by: OVE_SETUP001
- Value: Integrity-pinned workspace installation, frozen lockfiles and build/age policy.
- Maintenance cost: Review patch releases and security advisories on the pinned major; verify publisher checksums/integrity and all engines before updates.
- Alternatives considered: npm or Yarn would replace the reviewed catalog/workspace policy.
- Risk: Executable runtime/package manager; no unchecked install-script execution, exact integrity and least-privilege CI.
- Last reviewed: 2026-10-16
- Source: https://registry.npmjs.org/pnpm/12.11.2

### actions/checkout

- Version: 7.0.1
- License: MIT
- Used by: shared setup/CI/security workflows (dev action)
- Added by: OVE_SETUP006
- Value: Fetch reviewed source/history with persisted credentials disabled.
- Maintenance cost: Review every publisher release and digest deliberately; source is pinned by full40-character SHA, with actual workflow/security tests.
- Alternatives considered: GitHub-hosted supported action reuses existing CI; avoid duplicating artifact/cache/API logic in shell.
- Risk: Executable third-party action; least-privilege job tokens, no fork secrets, no automatic merge, no unreviewed floating tags.
- Last reviewed: 2026-10-16
- Digest: 3d3c42e5aac5ba805825da76410c181273ba90b1
- Source: https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/LICENSE

### actions/setup-node

- Version: 7.1.0
- License: MIT
- Used by: shared setup/CI/security workflows (dev action)
- Added by: OVE_SETUP006
- Value: Install the .nvmrc runtime in the shared frozen setup action.
- Maintenance cost: Review every publisher release and digest deliberately; source is pinned by full40-character SHA, with actual workflow/security tests.
- Alternatives considered: GitHub-hosted supported action reuses existing CI; avoid duplicating artifact/cache/API logic in shell.
- Risk: Executable third-party action; least-privilege job tokens, no fork secrets, no automatic merge, no unreviewed floating tags.
- Last reviewed: 2026-10-16
- Digest: 949feb2413d6458794dcd2491c4babbbce0c15c1
- Source: https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/LICENSE

### actions/cache/restore

- Version: 6.1.0
- License: MIT
- Used by: shared setup/CI/security workflows (dev action)
- Added by: OVE_SETUP006
- Value: Restore dependency/compiler caches as hints; frozen install remains authoritative.
- Maintenance cost: Review every publisher release and digest deliberately; source is pinned by full40-character SHA, with actual workflow/security tests.
- Alternatives considered: GitHub-hosted supported action reuses existing CI; avoid duplicating artifact/cache/API logic in shell.
- Risk: Executable third-party action; least-privilege job tokens, no fork secrets, no automatic merge, no unreviewed floating tags.
- Last reviewed: 2026-10-16
- Digest: 55cc8345863c7cc4c66a329aec7e433d2d1c52a9
- Source: https://github.com/actions/cache/blob/55cc8345863c7cc4c66a329aec7e433d2d1c52a9/LICENSE

### actions/cache/save

- Version: 6.1.0
- License: MIT
- Used by: shared setup/CI/security workflows (dev action)
- Added by: OVE_SETUP006
- Value: Save caches only from trusted default-branch pushes.
- Maintenance cost: Review every publisher release and digest deliberately; source is pinned by full40-character SHA, with actual workflow/security tests.
- Alternatives considered: GitHub-hosted supported action reuses existing CI; avoid duplicating artifact/cache/API logic in shell.
- Risk: Executable third-party action; least-privilege job tokens, no fork secrets, no automatic merge, no unreviewed floating tags.
- Last reviewed: 2026-10-16
- Digest: 55cc8345863c7cc4c66a329aec7e433d2d1c52a9
- Source: https://github.com/actions/cache/blob/55cc8345863c7cc4c66a329aec7e433d2d1c52a9/LICENSE

### actions/upload-artifact

- Version: 7.0.2
- License: MIT
- Used by: shared setup/CI/security workflows (dev action)
- Added by: OVE_SETUP006
- Value: Publish test, coverage, verified tooling and validated SBOM evidence.
- Maintenance cost: Review every publisher release and digest deliberately; source is pinned by full40-character SHA, with actual workflow/security tests.
- Alternatives considered: GitHub-hosted supported action reuses existing CI; avoid duplicating artifact/cache/API logic in shell.
- Risk: Executable third-party action; least-privilege job tokens, no fork secrets, no automatic merge, no unreviewed floating tags.
- Last reviewed: 2026-10-16
- Digest: cf430e030ddbb5b0abf93d22962f4752f3646cd9
- Source: https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/LICENSE

### actions/download-artifact

- Version: 8.0.2
- License: MIT
- Used by: shared setup/CI/security workflows (dev action)
- Added by: OVE_SETUP006
- Value: Consume current-run evidence artifacts with tool checksums reverified.
- Maintenance cost: Review every publisher release and digest deliberately; source is pinned by full40-character SHA, with actual workflow/security tests.
- Alternatives considered: GitHub-hosted supported action reuses existing CI; avoid duplicating artifact/cache/API logic in shell.
- Risk: Executable third-party action; least-privilege job tokens, no fork secrets, no automatic merge, no unreviewed floating tags.
- Last reviewed: 2026-10-16
- Digest: 9000827ccba6bdab643e8b6fd33ac0654aef8333
- Source: https://github.com/actions/download-artifact/blob/9000827ccba6bdab643e8b6fd33ac0654aef8333/LICENSE

### actions/dependency-review-action

- Version: 5.0.0
- License: MIT
- Used by: shared setup/CI/security workflows (dev action)
- Added by: OVE_SETUP007
- Value: Reject high dependency advisories and disallowed direct license changes.
- Maintenance cost: Review every publisher release and digest deliberately; source is pinned by full40-character SHA, with actual workflow/security tests.
- Alternatives considered: GitHub-hosted supported action reuses existing CI; avoid duplicating artifact/cache/API logic in shell.
- Risk: Executable third-party action; least-privilege job tokens, no fork secrets, no automatic merge, no unreviewed floating tags.
- Last reviewed: 2026-10-16
- Digest: a1d282b36b6f3519aa1f3fc636f609c47dddb294
- Source: https://github.com/actions/dependency-review-action/blob/a1d282b36b6f3519aa1f3fc636f609c47dddb294/LICENSE

### github/codeql-action/upload-sarif

- Version: 4.38.3
- License: MIT
- Used by: shared setup/CI/security workflows (dev action)
- Added by: OVE_SETUP007
- Value: Upload minimal redacted same-repository SARIF; no CodeQL bundle execution.
- Maintenance cost: Review every publisher release and digest deliberately; source is pinned by full40-character SHA, with actual workflow/security tests.
- Alternatives considered: GitHub-hosted supported action reuses existing CI; avoid duplicating artifact/cache/API logic in shell.
- Risk: Executable third-party action; least-privilege job tokens, no fork secrets, no automatic merge, no unreviewed floating tags.
- Last reviewed: 2026-10-16
- Digest: 24c54180a607b1449ed407dd24f251e4e9147c8d
- Source: https://github.com/github/codeql-action/blob/24c54180a607b1449ed407dd24f251e4e9147c8d/LICENSE

## Operational limits and sources

Node22 status and EOL: https://github.com/nodejs/Release/blob/main/schedule.json.
Registry manifests are the exact version endpoints linked per block; latest was
checked at https://registry.npmjs.org/<package>/latest on the verification date.
Crate metadata uses the exact crates.io API endpoints linked above. Binary release
pins/checksums remain the publisher-verified values from SETUP006/007; a pin does
not authorize arbitrary future releases. herdr/container CLI pins remain SETUP015.

The pnpm12 configuration uses allowBuilds, not the removed onlyBuiltDependencies
setting. Both current build entries are false; no overrides, patches, license or
release-age exceptions are present. Pure-layer approvals are explicit, defaulting
to zod only. Package code cannot select an alternate registry or a git/tarball URL.

SETUP006's installed-tree license command is authoritative and includes production
and development graphs without exclusions. SBOM missing-license NOASSERTION is
not permission. The dependency policy tool imports the same allowed-license list.
Happy DOM disables script/external loads; Oxlint supplies actual hooks/compiler
rules. Vite7 retains PostCSS instead of forcing MPL Lightning CSS. SPDX IDs are CC0;
the bounded policy parser carries no CC-BY exception data. These approved choices
are documented in tasks/_proposals/OVE_SETUP006-license-compatible-tooling.md.

Renovate GitHub App is an external service, not a bundled product dependency;
configuration does not install/authorize an App or grant it a token. If enabled,
use minimum contents/PR permissions and issue permission for the dashboard, never
secrets or automatic merges. Default-branch deployment and App administration are
separate operational steps. Binary dashboard notices require a manual checksum PR.

Review evidence: ten seeded, actual npm view commands and their JSON outputs are
stored in tools/deps-policy/evidence/npm-view-2026-10-16.json. The official
Renovate validator44.155.1 passed --strict --no-global in an isolated temporary
Node24.21.0 runtime, with install scripts disabled and no project dependencies
added. Its optional native RE2 build remains disabled; it uses its own JavaScript
regex fallback for validation. The project runtime and pins remain Node22.

Project policy inputs are fail-closed: the workspace and package.json pnpm policy
objects reject unknown keys, including permissions, dangerouslyAllowAllBuilds and
minimumReleaseAgeExclude. New build permissions require an explicitly supported
schema plus a register justification; no release-age exclusion is authorized.
Project .npmrc permits only engine-strict=true and the official npm registry
(including scoped mappings); implicit .pnpmfile.cjs/.mjs hooks are rejected without
execution. Global user settings and command-line overrides are outside this
repository-file checker and remain subject to the controlled CI install process.
The supported Cargo Tauri declarations require =MAJOR.MINOR.PATCH, including inline
tables: a bare Cargo version is a caret range and cannot prove a matching minor.

Overrides support exact registry semver targets only; URL, git, file, alias and range
targets fail even with a justification. Patch files must be bounded regular files
inside the workspace. Supported inline Tauri tables place version first and may
then set features/default-features; alternative dependency sources and unknown
fields fail rather than being interpreted as proof of a compatible registry pin.

All supported Tauri declarations across workspace, package and target dependency
sections must agree. Quoted keys, aliases and dependency subtables are unsupported
and fail closed rather than hiding a second declaration from the minor guard.
