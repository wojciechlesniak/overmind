# OVE_SETUP017 packaging implementation contract

Status: coordination approved by the integrator; exact runtime scope explicitly
approved by the Owner on 2026-10-17.
Base: DEVELOP `969aff9f011667b8e6219da265c5640e7e1603e4`.
Task: [OVE_SETUP017](../OVE_SETUP017/TASK.md), GitHub issue #14.

## Accepted direction and outputs

Follow ADR 0030: official Node 22.23.3 darwin-arm64, engine SETUP016 CommonJS
bundle, esbuild 0.28.2, postject 1.0.0-alpha.6, no native SQLite companion.
Publish the verified executable
`apps/desktop/src-tauri/binaries/overmind-engine-aarch64-apple-darwin` and the
task-defined sorted, timestamp-free `overmind-engine.manifest.json` only after
all mandatory checks succeed. Build into independent directories beneath the
ignored `build/engine-tmp/`; copy the runtime to a fresh inode before injection.
Never edit tracked inputs while building or publish partially verified outputs.

The existing CLI contract is retained, with `--release` as required by TASK
section 9. SEA inputs use stable relative paths, snapshots/code cache disabled,
and `execArgvExtension: "none"`. Child execution strips Node injection settings.
Signing defaults to ad-hoc hardened runtime with JIT only. Developer ID,
notarization, DMG and arbitrary-user-file TCC evidence belong to SETUP014.

## Requested coordinated changes

- Add exactly `postject: 1.0.0-alpha.6` to the workspace catalog and
  `"postject": "catalog:"` to root devDependencies. Generate the lockfile with
  pinned pnpm; preserve release age, checksums, denied install scripts and all
  audit/license gates. No new license exceptions or script allowlist entries.
- Extend `docs/dependencies.md` with the required postject justification block:
  build-only Mach-O SEA injector selected by ADR 0030, MIT license, exact alpha
  pin and upstream maintenance/provenance risk; alternatives require replacing
  the accepted SEA method. Recheck the actual transitive graph before acceptance.
- `tools/skeleton.test.ts` currently accepts only stable numeric catalog pins.
  Permit the single explicitly approved postject alpha pin, retaining exact-pin
  checks for every other package; add a regression rejecting other prereleases.
- Coordinate the SBOM manifest file component and any required Tauri resource
  entries with their owners. Do not change CI, capabilities or root scripts
  without explicit integration approval. `package:engine` is already reserved.

## Runtime provenance

Candidate official archive:
`https://nodejs.org/dist/v22.23.3/node-v22.23.3-darwin-arm64.tar.gz`.
The SETUP011 recorded checksum is
`23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53`.
Before adding `node.lock.json`, independently verify official `SHASUMS256.txt`
and its detached signature against an official Node release-key fingerprint,
using a task-local GPG keyring; record the actual fingerprint and result.
SETUP011 did **not** verify that signature, so this proposal claims no GPG pass.
At build time use the shared `installResource` checksum verifier and extract
only the exact archive member `node-v22.23.3-darwin-arm64/bin/node`; the generic
basename installer also matches `include/node/` and must not be used. Preserve
Node's bundled third-party notices and review their actual license obligations.

## Small interfaces and tests agreed by TASK

Use the specified `Step.run(ctx): Promise<StepResult>` composition and one
`Runner` boundary wrapping bounded `execFile` calls with argument arrays.
`planSteps(variant)`, manifest serialization, lock/version validation and
entitlement validation are pure functions. Reuse SETUP016's bundle and metafile
guard through its build command/API without adding product-layer dependencies.

Implement vertical red/green slices: strict CLI and host/preflight validation;
checksum tampering before downloaded execution; step order and failure cleanup;
deterministic manifest; denied entitlements; process timeout and hostile paths;
then the real macOS pipeline. Linux tests exercise pure behavior and fake Runner
boundaries; macOS integration is visibly skipped elsewhere. Actual acceptance
must include two independent pre-sign hashes, signed `version --json`, bounded
`ensure-running --json`, signature/fuse/blob/size/system-library checks and an
actual Tauri debug bundle with execution from `Contents/MacOS`.

## Contract details to settle before implementation

- `--skip-sign` cannot satisfy mandatory signature verification or publication
  of a signed manifest. Proposed behavior: an explicit diagnostic build only,
  with no publication to the normal Tauri output; never claim acceptance for it.
- SETUP016's CLI has no data-directory override. The current exit-20 stub does
  no I/O, but a future live engine needs an explicit isolated-directory contract
  before the packaging verifier may start it. Coordinate that minimal seam;
  do not redirect or inspect the user's personal data directories.
- ADR 0030 requires a deployable source-map strategy. SETUP011 proved offline
  symbolication, not automatic stack mapping. Verify an actual thrown stack
  after deployment and include its canonical map as a manifest-listed resource
  or embedded SEA asset; select the smallest measured solution.
- Apply ADR 0030's minimal entitlement set; reject disabled library validation,
  DYLD injection, debugger and unproven memory entitlements. Do not add broad
  entitlements to make ad-hoc signing work.

## Initial evidence and limits

The isolated worktree has completed a frozen install with Node 22.23.3 and pnpm
12.11.2 and installed the normal repository hooks. The retained SETUP011 evidence
is source commit `ba898762b78a2bc95bc09f270f96c665495daeea`; its same-directory
hash equality does not establish independent-directory reproducibility, and it
does not establish actual Tauri placement/execution. No packaging code, signature
verification, SEA build, new dependency install or Tauri build is claimed here.

## Integrator-approved implementation coordination

The integrator authorized the exact postject catalog/root dependency/generated
lock and dependency justification, single-pin catalog regression, conditional
SBOM file component/schema/negative tests, and these additional scoped changes:

- `.gitignore`: only `/build/engine-tmp/` and `/build/engine-provenance/`.
- Tauri config and existing policy tests: exact source-to-destination resource
  mappings for `binaries/overmind-engine.resources/engine.cjs.map` to
  `engine/engine.cjs.map` and `binaries/overmind-engine.resources/LICENSE` to
  `engine/LICENSE`. Manifest companion paths are relative to deployed
  `Contents/Resources`, not source paths. No directory/glob resource allowance.
- Actual Tauri bundling failed with `No matching IconType` for the existing PNG.
  Derive `icons/icon.icns` mechanically using native sips/iconutil, include the
  exact icon entry, and test its protection. Existing PNG SHA-256 is
  `f12ddfea20dcca2fa350d75d5ed2ae76a4fffbcdfd2b8f2357558b90072dab9f`;
  resulting ICNS SHA-256 is
  `415b0732610f92d18d6cd3ffe14c3c7febbef2293b1c69f70609a917d1524bb2`.
  Native conversion uses temporary `.cache/ove014-icons.iconset/` PNGs resized by
  `sips -z` for sizes 16, 32, 64, 128, 256, 512, 1024, then `iconutil --convert
  icns --output apps/desktop/src-tauri/icons/icon.icns`. No new artwork.
- `.github/CODEOWNERS`: exact `/tools/package-engine/` Owner protection;
  `tools/ci/config-integrity.ts` and its actual Git-diff regression cover the
  same prefix. The PR requires `config-change`.
- The Owner explicitly approved the exact binary-only runtime ledger on
  2026-10-17: Node 22.23.3 darwin-arm64, the archive/notice hashes and only
  `bin/node` plus `LICENSE`, with the seven additional terms in
  [the notice inventory](OVE_SETUP017-runtime-notices.md). No other archive,
  version, extraction recipe or terms are approved. Proposed/missing approval
  and changed identities still fail closed. npm/Rust policy is unchanged.

Source-map deployment uses an explicit canonical map plus offline symbolication.
A real signed, relocated SEA throw fixture recovered its original TypeScript
line; ordinary engine diagnostics remain redacted, not silently converted to
full stack logs. Actual Tauri debug bundling/execution and both deployed resource
hashes passed with the exact static resource mappings. These measured results
will be rerun for the final source head; Developer ID/notarization are unclaimed.

The integrator also approved excluding only `.cache` from the existing manifest
discovery traversal in `tools/skeleton.test.ts`, matching SETUP012 fix `86c9552`.
This prevents a real concurrent pinned-bin fixture cleanup race; package graph
assertions remain unchanged.

The integrator checked the packaging guide against the completed OVE_OSS004
publication policy before integration. Its literal virtual file URL triggered
the existing local-URL rule. The guide now describes the same synthetic
`overmind/source/` namespace in prose; the rule and runtime identities are
unchanged. The real content and Markdown checks pass after that wording fix.

The final full check exposed that the register verification header still
preceded the recorded postject review date. The integrator advanced that header
to 2026-10-17, the actual review date; individual entries, exact pins, accepted
licenses and all date-validation rules remain unchanged. The existing actual-CLI
integration cases are rerun rather than weakening their positive/negative checks.
