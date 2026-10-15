---
id: OVE_SETUP014
title: macOS build, code signing and notarization pipeline
area: SETUP
kind: infra
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_SETUP006, OVE_SETUP007, OVE_SETUP010, OVE_SETUP017]
soft_depends_on: [OVE_SETUP007, OVE_SETUP015, OVE_SETUP018, OVE_SETUP011]
provides: ["lib:release-pipeline", "lib:entitlements", "lib:release-verification"]
needs: ["lib:ci-setup-action", "lib:pinned-bin", "lib:sbom"]
owns:
  - .github/workflows/release.yml
  - build/entitlements/**
  - tools/release/**
  - docs/engineering/release.md
reads: ["apps/desktop/src-tauri/tauri.conf.json", "tools/package-engine/**", "apps/desktop/src-tauri/binaries/overmind-engine.manifest.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 17"]
adr_refs: [9, 13, 20, 26]
---

# OVE_SETUP014: macOS build, code signing and notarization pipeline

## 1. Summary

Define and implement the release path from a version tag to a signed, notarized, stapled `Overmind.dmg` for Apple silicon: gated verification, an environment-protected build job holding the Apple credentials only for the duration of the job, deterministic signing order for all nested executables, post-build verification, provenance attestation, SBOM and checksums, and a draft GitHub Release that a human publishes.

## 2. Context

The app bundle contains: the Tauri app (Rust), the engine sidecar (Node SEA or alternative, OVE_SETUP017), the bundled Linux `herdr` binary as a resource (OVE_SETUP015), optionally native companions. Gatekeeper requires Developer ID signing with the hardened runtime and notarization for apps distributed outside the Mac App Store. The app is not sandboxed (it must launch `container`, mount user-selected folders, run a background service), so entitlements are minimal runtime exceptions only. Release is rare and security-critical: whoever controls the signing credentials can ship code that every user trusts. Isolation escape tests must have passed on the release commit (OVE_SETUP006 requirement 7). Credentials (Apple Developer ID certificate, App Store Connect API key) are provided by the Owner.

## 3. Scope (in)

- `.github/workflows/release.yml` with jobs `verify`, `build-macos`, `publish`.
- `build/entitlements/app.plist`, `build/entitlements/engine.plist`.
- `tools/release/`: `check-versions.ts`, `prepare.ts`, `verify-bundle.ts`, `notes.ts` and tests.
- `docs/engineering/release.md`: runbook, credential setup, rotation, revocation.

## 4. Out of scope

- Homebrew cask and auto-update (post-MVP; no updater, OVE_SETUP010).
- Engine executable creation: OVE_SETUP017. herdr bundling: OVE_SETUP015.
- Repository protections (tag protection rules, environment configuration in the GitHub UI): OVE_SETUP018 lists the settings; this task documents what must be configured.
- Windows/Linux builds (ADR 0009).

## 5. Detailed requirements

1. **Triggers.** `push` of tags matching `v[0-9]+.[0-9]+.[0-9]+` (and `-rc.N` pre-release suffixes) and `workflow_dispatch` with input `dry_run` (default `true`). Top-level `permissions: {}`; every job declares its own. `concurrency: release` (no cancel). Dry run: no environment, no secrets, ad-hoc signing, artifacts only, no release, no attestation.
2. **Job `verify`** (ubuntu-24.04, `contents: read`, `actions: read`, `checks: read`): (a) the tag commit is reachable from `main` (`git merge-base --is-ancestor`); (b) the tag is annotated and its name equals `v` + version in root `package.json`, `apps/desktop/src-tauri/Cargo.toml` and `tauri.conf.json` (`pnpm release:check`); (c) required checks succeeded on that commit: `ci-success`, `secrets` (security.yml) and the latest `isolation.yml` run for the commit conclusion `success` (queried with `gh api`, otherwise exit 1; skipped is failure); (d) `pnpm check:deps`, `pnpm check:licenses`; (e) `CHANGELOG`/release notes can be generated; (f) tag was created by an account with admin permission (verified through the API `GET /repos/{r}/git/ref/tags/...` and the tagger; documentation relies on tag protection rules).
3. **Job `build-macos`** (`macos-15` arm64 via `vars.MACOS_RUNNER`, `environment: release` which requires a reviewer approval by the Owner and allows only tags `v*`, `contents: read`): 
   1. checkout (`persist-credentials: false`), `setup` action, `rustup`-pinned toolchain from `rust-toolchain.toml`, `pnpm install --frozen-lockfile`.
   2. **Temporary keychain:** `KEYCHAIN=$RUNNER_TEMP/overmind-release.keychain-db`; password from `openssl rand -hex 32` stored only in a masked env var (`::add-mask::`); `security create-keychain -p`, `set-keychain-settings -lut 3600`, `unlock-keychain`, `security import` of the base64 `.p12` (written with `umask 077` into `$RUNNER_TEMP`, deleted immediately), `security set-key-partition-list -S apple-tool:,apple: -s -k`, add to the search list. A final `if: always()` step deletes the keychain and the `.p8` file (`security delete-keychain`, `shred`-equivalent `rm -P`).
   3. **Signing order (inside out):** (i) `pnpm package:engine --release --identity "$APPLE_SIGNING_IDENTITY" --entitlements build/entitlements/engine.plist`; (ii) companion `.node` files if any (done by the same script); (iii) `pnpm --filter @overmind/desktop tauri build --target aarch64-apple-darwin --bundles app,dmg` with `APPLE_SIGNING_IDENTITY` set so Tauri signs the app with `build/entitlements/app.plist` and the hardened runtime; (iv) notarize the `.app` zip and the `.dmg` with `xcrun notarytool submit <file> --key $RUNNER_TEMP/AuthKey.p8 --key-id $APPLE_API_KEY_ID --issuer $APPLE_API_ISSUER --wait --timeout 30m` (credentials from the environment, never on a command line visible to other users: use env-based flags), then `xcrun stapler staple` on app and dmg. If notarization is rejected, print the `notarytool log` JSON (it contains no secrets) and fail.
   4. **Entitlements.** `app.plist`: empty dictionary (hardened runtime, no sandbox, no JIT); `engine.plist`: `com.apple.security.cs.allow-jit` only, plus `com.apple.security.cs.allow-unsigned-executable-memory` only if the runtime provably crashes without it (record evidence from OVE_SETUP011 in `docs/engineering/release.md`). Forbidden: `disable-library-validation`, `allow-dyld-environment-variables`, `get-task-allow`, `com.apple.security.cs.debugger`, `com.apple.security.app-sandbox`; `verify-bundle.ts` enforces this list.
   5. **Info.plist usage strings** set via `tauri.conf.json` bundle macOS `infoPlist` (owned by OVE_SETUP010; requested by proposal): `NSDesktopFolderUsageDescription`, `NSDocumentsFolderUsageDescription`, `NSDownloadsFolderUsageDescription`, `NSRemovableVolumesUsageDescription` each "Overmind needs access to the folders you add to a Workspace so your agents can work in them." (EN; PL translation in localized InfoPlist strings by a later task).
   6. **Verification (`tools/release/verify-bundle.ts`)**, failing the job on any error: `codesign --verify --deep --strict --verbose=2 Overmind.app`; every Mach-O found by walking the bundle has hardened runtime (`codesign -dv` shows `runtime`), a secure timestamp, the same Team ID, and entitlements from the allowed set; `spctl --assess --type execute --verbose=4` accepts the app; `xcrun stapler validate` on app and dmg; `spctl --assess --type open --context context:primary-signature` on the dmg; engine manifest hash equals the signed binary hash recorded after signing (the manifest records both unsigned and signed hashes); bundled herdr files match `vendor/herdr/checksums.json` (OVE_SETUP015); `apps/desktop/scripts/check-dist.mjs` passes on the packaged web assets; no file in the bundle is world-writable; no `.env`, `.p12`, `.p8`, `.pem` or source maps with absolute paths; smoke test: copy the app to a temp directory, run `Contents/MacOS/overmind-engine version --json` (the sidecar name inside the bundle) and verify the output.
4. **Job `publish`** (ubuntu, needs `build-macos`, `permissions: contents: write, id-token: write, attestations: write` only for this job): download artifacts, compute `SHA256SUMS`, generate SBOM (`sbom` artifact from OVE_SETUP007), create build provenance attestations for the dmg and the engine binary with the GitHub attestation action (pinned by SHA), create a **draft** GitHub Release named after the tag with the dmg, `SHA256SUMS`, SBOM, notes generated by `tools/release/notes.ts` from Conventional Commit headers since the previous tag (grouped by type; security fixes first). A human publishes the draft (ADR 0025 spirit: humans decide).
5. **Version tooling.** `pnpm release:check` (`tools/release/check-versions.ts`) validates version consistency; `pnpm release:prepare <version>` (`prepare.ts`) updates `package.json`, `Cargo.toml`, runs `cargo update -w --offline` check, creates a release branch `release/vX.Y.Z` commit `chore(release): vX.Y.Z` and prints the tag command; it never pushes tags.
6. **Credential configuration (documented in `docs/engineering/release.md`).** Environment `release` secrets: `APPLE_DEVELOPER_ID_P12_BASE64`, `APPLE_DEVELOPER_ID_P12_PASSWORD`, `APPLE_SIGNING_IDENTITY` (name), `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID`. Repository-level secrets MUST NOT hold these. Rotation: certificate yearly or on suspicion; App Store Connect key revoke/recreate procedure; incident steps (revoke certificate in the developer portal, notify via SECURITY.md channel).
7. **Reproducibility statement.** The release notes include the commit SHA, the Node version, Rust version, pnpm version, and `SHA256SUMS`. Full bit-for-bit reproducibility is not claimed; the engine pre-signing hash reproducibility result from OVE_SETUP017 is referenced.
8. **Dry-run mode** produces an unsigned (ad-hoc) dmg as a workflow artifact retained 3 days and runs the same verification steps in "ad-hoc mode" (skips notarization checks).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses the `setup` action and pinned downloader (OVE_SETUP006), `package:engine` (OVE_SETUP017), SBOM generation (OVE_SETUP007), herdr checksum file (OVE_SETUP015) and the dist guard (OVE_SETUP009). Conventional commit parsing reuses the commitlint parser package already in the catalog (`@commitlint/parse` via `@commitlint/cli`) rather than a new dependency.

## 8. Architecture and code placement

CI/CD and release scripts only: `.github/workflows/release.yml`, `tools/release/*.ts` (pure logic with an injected command runner), `build/entitlements/*.plist`. No product package depends on them.

## 9. Security and safety

- **Credentials:** exist only in the `release` environment (reviewer-gated), are written to disk only inside `$RUNNER_TEMP` with mode 0600 and deleted in an `always()` step; the temporary keychain is random-password and deleted; secrets are masked; no `set -x`; no secrets in command lines visible via `ps` (use env/stdin where the tool allows, otherwise file paths with 0600).
- **Who can trigger:** only tags matching the pattern on protected refs; the environment requires an Owner approval each time; forks cannot access environments or secrets; `pull_request` events never reach this workflow.
- **Workflow tampering:** the tag-triggered workflow file is the one on the tagged commit, so changes to `release.yml` are subject to CODEOWNERS and `config-change` review before they can ever be tagged; the `verify` job additionally compares the workflow file hash on the tag with the one on `main` at the tag's parent merge (mismatch fails).
- **Supply chain:** all actions pinned by SHA; tool binaries via checksum-pinned downloads; builds use `--frozen-lockfile`; no network fetches during signing except Apple services; provenance attestation and SBOM provide post-hoc auditability.
- **Least privilege:** `permissions: {}` at top; `contents: write` only in `publish`; `id-token`/`attestations` only for attestation.
- **Fail closed:** missing isolation evidence, failed notarization, forbidden entitlement, unsigned nested binary or checksum mismatch aborts the release.
- **Hardened runtime and minimal entitlements** reduce the damage from a compromised dependency; library validation stays on.
- **Leak response:** the doc defines revocation steps, because a leaked Developer ID key can sign malware under the project's name.

## 10. Errors and edge cases

- Notarization queue slow: 30-minute timeout; the job is retried manually by the reviewer (no auto-retry loops).
- Apple service outage: release blocked; documented waiting procedure.
- Certificate expired: `verify` is unaffected, `build-macos` fails at import with a clear message; runbook covers renewal.
- Tag pushed from a non-main commit: `verify` fails.
- A dependency adds an unsigned Mach-O inside resources: `verify-bundle` fails listing it.
- `stapler staple` fails after a successful notarization (CDN delay): retry up to 3 times with 30 s spacing; then fail.
- Dry-run triggered by someone with write access: no secrets available, harmless.
- Build host runs a newer Xcode that changes signing behaviour: the Xcode version is pinned via `maxim-lobanov/setup-xcode`-like step (pinned SHA) or `sudo xcode-select -s` to a specific path recorded in the doc.
- TCC prompts for protected folders (see 14.2) are not testable in CI.

## 11. Acceptance criteria

- [ ] Real escape evidence for the exact release commit is mandatory; a successful hosted-only isolation gate with escape skipped must fail release verification.

- [ ] A dry run on a PR branch (workflow_dispatch) produces an ad-hoc signed dmg artifact and passes `verify-bundle` in ad-hoc mode.
- [ ] A real tagged release (rc) by the Owner produces a notarized, stapled dmg whose `spctl --assess` and `stapler validate` succeed on a clean Mac.
- [ ] Every Mach-O in the bundle is signed with the same Team ID, hardened runtime and timestamp; entitlements are exactly the allowed set (test with a deliberately added forbidden entitlement in a dry run: pipeline fails).
- [ ] The release is a draft with dmg, `SHA256SUMS`, SBOM and attestations; nothing is published automatically.
- [ ] The job log contains no secret values (checked by running the secret scanner over the downloaded log in the test release).
- [ ] The temporary keychain does not exist after the job (verified in the log by a `security list-keychains` step).
- [ ] A tag on a commit without a successful isolation run fails `verify`.
- [ ] `pnpm release:check` fails when `Cargo.toml` and `package.json` versions differ.

## 12. Test plan

Unit tests for `check-versions`, `notes` (Conventional Commit grouping), entitlement allow-list checker and Mach-O discovery with a fake runner. Workflow static tests (OVE_SETUP006 `check-workflows`) cover SHA pinning and permissions. Manual verification procedure on the Owner's machine for the first release candidate is part of `docs/engineering/release.md` (checklist with commands and expected output). Commands: `pnpm test -- tools/release`, `pnpm release:check`.

## 13. Parallelization notes

Can start once OVE_SETUP010 and 017 exist; parallel with OVE_SETUP015 and 018. Hotspots: `release.yml` (owned here), `tauri.conf.json` bundle section (owned by OVE_SETUP010: proposals for `infoPlist`, `entitlements`, `hardenedRuntime` entries).

## 14. Open questions and assumptions

1. ASSUMPTION: the Owner will enrol in the Apple Developer Program (needed for Developer ID and notarization). Until then only dry runs work; early users run unsigned builds with Gatekeeper override (documented in README by OVE_OSS004).
2. Open question (macOS TCC): the engine runs as a LaunchAgent child process and the sandboxed container runtime mounts user folders; verify which process receives the "access to Documents/Desktop" prompt and whether the engine executable needs an embedded Info.plist usage string (impossible to add to an injected Node SEA binary). Test during OVE_SETUP011/OVE_BOX tasks; the fallback is a signed launcher app bundle for the engine.
3. ASSUMPTION: GitHub-hosted `macos-15` arm64 for building; no hosted macOS 26 needed for building (SDK targets 26 via Xcode of the image; verify minimumSystemVersion behaviour).
4. ASSUMPTION: Tauri performs signing/notarization of the `.app` from environment variables; if the pinned version does not, use explicit `codesign`/`notarytool` steps.
5. Open question: publish the Homebrew cask in a separate repository later.


### Owner-approved acceptance sequencing (2026-10-15)

The accepted SETUP006 staged foundation delivery does not waive release isolation. A workflow conclusion of success can mean a hosted gate denied/skipped the escape job. Verify successful real escape execution and matching evidence for the exact release SHA, not merely isolation.yml conclusion success. Missing runner, harness, artifacts or an inconclusive/failed escape result blocks release.

Source: tasks/_proposals/OVE_SETUP006-acceptance-sequence.md.
