---
id: OVE_SETUP017
title: Script that builds the engine sidecar executable for Tauri (pnpm package:engine)
area: SETUP
kind: infra
size: M
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_SETUP006, OVE_SETUP011, OVE_SETUP016]
soft_depends_on: [OVE_SETUP006, OVE_SETUP010, OVE_SETUP014]
provides: ["lib:engine-executable", "lib:engine-manifest"]
needs: ["lib:pinned-bin"]
owns:
  - tools/package-engine/**
  - docs/engineering/engine-packaging.md
reads: ["apps/engine/dist", "docs/adr", "apps/desktop/src-tauri/tauri.conf.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9, 18]
---

# OVE_SETUP017: Script that builds the engine sidecar executable for Tauri (`pnpm package:engine`)

## 1. Summary

Implement `pnpm package:engine`: turn the bundled engine into the single signed executable `apps/desktop/src-tauri/binaries/overmind-engine-aarch64-apple-darwin` plus a manifest with hashes and versions, following the packaging decision of OVE_SETUP011 (default: Node SEA from the pinned official Node 22.23.3 binary). The result is what Tauri declares as `externalBin` (OVE_SETUP010) and what the release workflow signs and notarizes (OVE_SETUP014).

## 2. Context

Tauri sidecars are single executables whose file name carries the target triple; companion files go to `resources`. Only Apple silicon is targeted (ADR 0009, Apple `container` needs it). The engine runs as a per-user background service and must keep working when the window closes (ADR 0005). Every Mach-O file in the app bundle must be signed with the hardened runtime for notarization. The default method (Node SEA): bundle with esbuild (OVE_SETUP016), create the SEA blob with Node's config, copy the pinned Node binary, remove its signature, inject the blob with `postject` (alpha, pinned) using the SEA fuse sentinel and Mach-O segment name `NODE_SEA`, then sign. If OVE_SETUP011 chose differently (for example Bun compile), implement that variant and keep this task's output contract unchanged.

## 3. Scope (in)

- `tools/package-engine/run.ts` CLI and step modules (`bundle`, `fetch-runtime`, `sea-blob`, `inject`, `sign`, `verify`, `manifest`).
- Output files and manifest schema (requirement 4).
- Build verification and reproducibility check.
- `docs/engineering/engine-packaging.md`.

## 4. Out of scope

- Production signing identity, entitlements files, notarization, DMG: OVE_SETUP014 (this script signs with an identity given by environment and defaults to ad-hoc).
- Bundling herdr: OVE_SETUP015.
- The engine code: ENGINE area; the entry/bundle: OVE_SETUP016.

## 5. Detailed requirements

1. **Command.** `pnpm package:engine [--identity <name|->] [--entitlements <plist>] [--out <dir>] [--skip-sign] [--check-reproducible]`. Default identity `-` (ad-hoc) unless `OVERMIND_SIGN_IDENTITY` is set; default entitlements `build/entitlements/engine.plist` (created by OVE_SETUP014; if missing, the script uses a minimal built-in plist with `com.apple.security.cs.allow-jit` only and warns).
2. **Runtime acquisition.** Download the official Node archive for `darwin-arm64` at the version pinned in `.nvmrc` (22.23.3) through the pinned-binary downloader (OVE_SETUP006); URL and SHA-256 are in `tools/package-engine/node.lock.json` (hashes copied from the `SHASUMS256.txt` published by nodejs.org and double-checked against the detached signature when the maintainer updates the lock; the script only trusts the lock). Reject any mismatch. The Node version in the lock MUST equal `.nvmrc` (test).
3. **Steps (default Node SEA variant).** (1) run `apps/engine` bundle (OVE_SETUP016) -> `dist/engine.cjs`; (2) write `sea-config.json` `{ "main": "dist/engine.cjs", "output": "build/sea-prep.blob", "disableExperimentalSEAWarning": true, "useCodeCache": false, "useSnapshot": false }` (code cache and snapshots are off for reproducibility and portability; the ADR may enable them); (3) `node --experimental-sea-config sea-config.json` using the pinned Node; (4) copy the Node binary to `build/overmind-engine-aarch64-apple-darwin`; (5) `codesign --remove-signature`; (6) inject with the pinned `postject` (`npx` is forbidden, call the installed binary from `node_modules/.bin`) `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`; (7) if the ADR requires companion files (for example a `.node` addon), copy them to the manifest-listed resource locations; (8) sign every produced Mach-O (`codesign --force --options runtime --timestamp --entitlements <plist> --sign <identity>`; `--timestamp=none` for ad-hoc); (9) verify (requirement 5).
4. **Output.** `apps/desktop/src-tauri/binaries/overmind-engine-aarch64-apple-darwin` (mode 0755) and `apps/desktop/src-tauri/binaries/overmind-engine.manifest.json`: `{ "schema": 1, "name": "overmind-engine", "version", "protocol", "buildSha", "target": "aarch64-apple-darwin", "node": "22.23.3", "sha256": "<of the signed binary>", "sha256Unsigned": "<before signing>", "bundleSha256": "<dist/engine.cjs>", "companions": [ {path, sha256} ], "toolVersions": { "esbuild", "postject", "node" }, "createdBy": "OVE_SETUP017" }` (no timestamps; sorted keys). A `rustc --print host-tuple` check ensures the file name suffix equals the Tauri target triple when building on arm64 macOS; on other hosts the script refuses (cross-building is not supported).
5. **Verification (must all pass or the script deletes the output and exits 1).** `codesign --verify --strict --verbose=2`; `spctl` assessment is NOT run (needs notarization); run the binary with `version --json` and compare version/protocol with the manifest; run `ensure-running --json` against a temp data dir and assert it returns a well-formed JSON line (exit 20 is acceptable before ENGINE lands); check that the executable contains the sentinel and the blob; verify file size <= 150 MB (warn above 100 MB); verify no `.node` addon is referenced that is not listed in `companions`; verify `dist/engine.meta.json` imports are all allowed (reuses the guard of OVE_SETUP016); `otool -L` shows only system libraries (no absolute paths into the build machine).
6. **Reproducibility.** `--check-reproducible` runs steps 1-7 twice in separate temp directories and compares `sha256Unsigned`; mismatches print the differing section sizes. Known sources of nondeterminism (absolute paths in source maps, timestamps) are removed by `esbuild` options (`sourceRoot`, `absWorkingDir`) and `SOURCE_DATE_EPOCH`; if a mismatch cannot be removed it is documented as accepted in the doc with the reason.
7. **Idempotent and clean.** The script never modifies tracked files; temp work is in `build/engine-tmp/` (gitignored) and removed on success.
8. **CI usage.** The `desktop-package` job (added by OVE_SETUP014's release workflow and a dry-run PR job in OVE_SETUP006's proposal) calls this script on a macOS arm64 hosted runner.
9. **Documentation.** `docs/engineering/engine-packaging.md`: why SEA, the steps, how to update the Node pin (change `.nvmrc`, update `node.lock.json` hash from `SHASUMS256.txt`, re-run), how companions work, troubleshooting (`codesign` errors, quarantine).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses the pinned-binary downloader (OVE_SETUP006), the bundle step and guard (OVE_SETUP016), the entitlements from OVE_SETUP014, and the manifest consumed by OVE_SETUP014 (release verification) and OVE_SETUP015-style startup checks. One `Step` interface (`run(ctx): Promise<StepResult>`), steps composed by `run.ts` (OCP: another packaging variant is another step list).

## 8. Architecture and code placement

Tooling in `tools/package-engine/`. Pure planning functions (`planSteps(variant)`, `buildManifest(inputs)`) are unit-tested; process execution lives behind a `Runner` interface (`execFile` wrapper) so tests use a fake runner.

## 9. Security and safety

- **Supply chain:** the Node runtime embedded in the engine is the most privileged third-party code; it is downloaded only through checksum-pinned lock data, never `latest`. `postject` (alpha) is pinned in the catalog and invoked from `node_modules`, not fetched on the fly. The manifest records every input hash for audit and SBOM (OVE_SETUP007 adds the manifest to the SBOM as a file component).
- **Signing:** hardened runtime is mandatory (`--options runtime`); the entitlement set is minimal (JIT only; `disable-library-validation` must not be added; companions are signed with the same identity). The script refuses an entitlements file containing `com.apple.security.cs.disable-library-validation`, `allow-dyld-environment-variables`, `get-task-allow` or `com.apple.security.cs.debugger` for release builds (`--release` flag set by OVE_SETUP014) and warns otherwise.
- **Secrets:** signing identity names are not secrets, but the keychain passphrase never enters this script; the identity is resolved from the already-unlocked temporary keychain created by the release workflow.
- **Command execution:** `execFile` with argument arrays; no shell strings; working directories confined to the repository and the build directory.
- **Fail closed:** any failed verification deletes the output; Tauri then fails to find `externalBin` and the build stops.
- **Untrusted input:** none beyond the lock files (CODEOWNERS-protected).

## 10. Errors and edge cases

- Not running on macOS arm64: exit 1 with message (Linux CI can run all unit tests, not the packaging).
- `postject` fails on an already signed binary: step 5 removes the signature first; verify the removal.
- Disk space low: preflight check requires 1 GB free.
- Node archive hash changed upstream: the lock mismatch fails; maintainers re-verify manually.
- ADR chooses Bun compile: the Bun variant (`bun build --compile --target=bun-darwin-arm64 --minify --sourcemap`) replaces steps 2-6, still signs and verifies identically; Bun archive pinned in a `bun.lock.json`.
- `.node` companion required: sign it individually; ensure `process.execPath`-relative loading works from `Contents/Resources` (verified in a Tauri debug bundle test).
- Quarantine attribute on downloaded artifacts: the script strips `com.apple.quarantine` from files it creates and refuses to run on quarantined inputs.

## 11. Acceptance criteria

- [ ] On macOS arm64, `pnpm package:engine --identity -` produces the binary and the manifest and all verifications pass.
- [ ] `overmind-engine version --json` from the produced binary matches the manifest.
- [ ] Tampering with the Node lock hash makes the script fail before executing anything from the download.
- [ ] `--check-reproducible` either passes or the documented exception exists.
- [ ] A release-mode run with an entitlements file containing `disable-library-validation` fails.
- [ ] The produced file name ends with `-aarch64-apple-darwin` and Tauri's `tauri build --debug` places it in `Contents/MacOS/` (manual check in PR).
- [ ] Unit tests (Linux) for step planning, manifest builder, lock validation and entitlement guard pass in CI.

## 12. Test plan

Unit tests: `planSteps`, `buildManifest` (golden JSON), lock validation (Node version equals `.nvmrc`), entitlement guard, fake-runner sequence tests including failure at each step (output deleted). macOS-only integration test `package.int.test.ts` (skipped on non-darwin with a visible skip reason) running the full pipeline into a temp directory. Commands: `pnpm test -- tools/package-engine`, `pnpm package:engine --identity -`.

## 13. Parallelization notes

Starts after OVE_SETUP011 and 016. Parallel with OVE_SETUP014 (shares the entitlements file contract) and OVE_SETUP015. Hotspot: `tools/package-engine/node.lock.json` (updated only by upgrade PRs).

## 14. Open questions and assumptions

- ASSUMPTION: Node SEA variant per default rule of OVE_SETUP011.
- ASSUMPTION: arm64 only; universal binaries are not produced.
- Open question: embed a code cache for faster startup (adds platform specificity); default off.
