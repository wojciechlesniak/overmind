---
id: OVE_SETUP015
title: Bundling pinned herdr and the container CLI check into the app
area: SETUP
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_SETUP001, OVE_SETUP006, OVE_SETUP016]
soft_depends_on: [OVE_SETUP010, OVE_SETUP014, OVE_SETUP008]
provides: ["lib:herdr-bundle", "lib:preflight", "lib:bundled-binaries-policy"]
needs: ["lib:pinned-bin", "lib:result"]
owns:
  - vendor/herdr/**
  - tools/bundle/**
  - apps/engine/src/preflight/**
  - docs/engineering/bundled-binaries.md
reads: ["apps/desktop/src-tauri/tauri.conf.json", "docs/research/herdr-analiza.md", "docs/research/prototyp-wnioski.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 17", "SPECIFICATION 18"]
adr_refs: [4, 9, 13, 20, 22, 26]
---

# OVE_SETUP015: Bundling pinned herdr and the container CLI check into the app

## 1. Summary

Ship a pinned, checksum-verified herdr binary inside the Overmind app (Apache-2.0 attribution included), verify it again at runtime before it is ever mounted into an isolated environment, and implement the preflight that checks the Apple `container` CLI (macOS 26, Apple silicon, minimum version, signature, running system). Anything missing, outdated or tampered with fails closed: agents do not run.

## 2. Context

ADR 0026: Overmind controls terminals and CLIs through herdr running INSIDE the isolation (ADR 0020), so the binary to bundle is the **Linux arm64** build of herdr (the container is a Linux VM on Apple silicon), not the macOS one. ADR 0026 also requires a pinned version, license and authorship information, and deliberate, tested upgrades. The prototype used herdr 0.9.3 and `container` 1.5.0 (docs/research/prototyp-wnioski.md). Apple's `container` tool is a signed `.pkg` that needs macOS 26 on Apple silicon; the wizard installs or guides installation and starts the kernel (ADR 0020). Both binaries are high-trust third-party code: herdr executes inside the sandbox but orchestrates agent CLIs, and the `container` CLI is the isolation boundary itself. herdr's own agent-detection manifests can update remotely from herdr.dev (analysis section 2.2); the project decided not to accept unreviewed remote rule updates (analysis section 5).

## 3. Scope (in)

- `vendor/herdr/` pin files and license texts; `tools/bundle/fetch-herdr.ts` (`pnpm bundle:herdr`) and `tools/bundle/verify-herdr.ts`.
- Build output layout for the app resources and a build-time manifest.
- Runtime preflight module in the engine: `apps/engine/src/preflight/` (`container-cli.ts`, `herdr-bundle.ts`, `os.ts`, `report.ts`).
- Policy document for bundled and external binaries (versions, update procedure).

## 4. Out of scope

- Mounting herdr into containers, container lifecycle, images, volumes, networks: BOX area.
- The herdr adapter (API client, state mapping): PROV area (`adapters/herdr`).
- Wizard screens and copy for installing `container`: ONB area (this task provides the structured report and message keys).
- Gateway endpoint exposing the report (`api:system.preflight`): ENGINE area.
- Adding the `resources` entry to `tauri.conf.json`: proposal to OVE_SETUP010 (requirement 4).

## 5. Detailed requirements

1. **Pin files.** `vendor/herdr/VERSION` contains the exact version (initially `0.9.3`, the version verified by the prototype; the implementer MUST check the upstream releases page and either keep 0.9.3 or bump deliberately with the full procedure of requirement 8). `vendor/herdr/checksums.json`: `{ "schema": 1, "version", "tag", "repository": "herdrdev/herdr", "assets": { "linux-aarch64": { "file", "url", "sha256", "size" } }, "license": { "spdx": "Apache-2.0", "file": "LICENSE", "sha256" }, "notice": { "file": "NOTICE" | null, "sha256" }, "provenance": { "method": "github-attestation" | "signature" | "release-checksums" | "maintainer-computed", "evidence": "<command and output summary>" }, "verifiedOn": "YYYY-MM-DD", "verifiedBy": "<name>" }`. `vendor/herdr/LICENSE` and `NOTICE` are the upstream files at that tag, unmodified. `vendor/herdr/README.md` explains the pin, why Linux, and how to bump.
2. **Fetch and verify (`pnpm bundle:herdr`).** Uses the pinned-binary downloader (OVE_SETUP006): download the Linux arm64 asset (glibc build to match the Debian-based container image; if only a musl build exists use it and note it) over HTTPS from the pinned URL, verify size and SHA-256 against `checksums.json`, abort on mismatch, make the file mode 0755, write it to `apps/desktop/src-tauri/resources/herdr/<version>/herdr` (gitignored, generated), copy LICENSE and NOTICE to `apps/desktop/src-tauri/resources/licenses/herdr/`, and write `apps/desktop/src-tauri/resources/herdr/herdr.manifest.json` `{ "version", "sha256", "size", "file": "<version>/herdr", "licenseSha256" }`. The script is idempotent and verifies existing output before reuse.
3. **Provenance at pin time.** When pinning or bumping, the maintainer verifies the asset by the strongest method upstream offers, in this order: GitHub artifact attestation (`gh attestation verify <file> --repo herdrdev/herdr`), a detached signature (minisign/cosign/GPG) with a documented public key, the release's published checksum file, and as the last resort a maintainer-computed hash from two independent downloads on two machines. The method used is recorded in `checksums.json.provenance`. The CODEOWNERS entry for `vendor/herdr/**` requires two maintainer approvals (set in OVE_OSS003).
4. **Tauri resources.** Proposal file `tasks/_proposals/OVE_SETUP015-tauri-resources.md` requests `bundle.resources: { "resources/herdr/**": "herdr/", "resources/licenses/**": "licenses/" }` in `tauri.conf.json` (OVE_SETUP010 applies it). Inside the app the files are under `Contents/Resources/herdr/` and `Contents/Resources/licenses/herdr/`. The release verification (OVE_SETUP014) compares them with `checksums.json`.
5. **Runtime herdr verification (`herdr-bundle.ts`).** `verifyHerdrBundle(deps): Promise<Result<VerifiedHerdr, PreflightError>>` where `deps` = `{ resourceDir, readFile(streaming hash), expected: { version, sha256 } }`. It reads `herdr.manifest.json`, hashes the binary (SHA-256, streaming), compares with the build-embedded expected value (compiled into the engine from `vendor/herdr/checksums.json` at bundle time through esbuild `define`, so editing the resource folder cannot change the expectation), checks the file is a regular file (not symlink), owned by the current user or root, not group/world writable, and the resource directory path is inside the app bundle. Result `VerifiedHerdr { version, path, sha256 }`. The BOX area calls this immediately before every mount and refuses to mount on any error (TOCTOU is reduced by copying the verified file into a root-owned read-only volume and re-hashing from the volume, documented here and implemented by BOX).
6. **Container CLI preflight.** Checks in order, each returning a typed status and remediation key:
   1. `os`: macOS version from `sw_vers -productVersion` (injected runner) >= 26.0 else `unsupported_os` (key `preflight.os.unsupported`); `process.arch` = `arm64` else `unsupported_arch`.
   2. `locate`: look only at the absolute paths `/usr/local/bin/container` and `/opt/homebrew/bin/container` (never resolve via `PATH`, to prevent PATH hijack); require a regular file, not a symlink pointing outside those prefixes, owner root or current user, mode without group/world write. Not found -> `missing`.
   3. `signature`: `codesign --verify --strict` succeeds and `codesign -dv --verbose=4` reports the Team Identifier and Authority recorded in `apps/engine/src/preflight/container-trust.json` (the implementer fills them from a real Apple-signed install and cites the command); mismatch -> `tampered`.
   4. `version`: run `container --version`, parse semver; constants `MIN_CONTAINER_VERSION = 1.5.0`, `TESTED_CONTAINER_VERSIONS = [1.5.0]`; lower -> `too_old`; same major with higher minor/patch -> `ok` with warning `untested_version`; higher major -> `blocked_untested` (fail closed until tested and the constants are updated by a task).
   5. `system`: run `container system status` (timeout 10 s); not running -> `not_running` (remediation: user-confirmed `container system start`, performed by the wizard through a port, never silently); kernel missing (status output or error text matching the pattern recorded in tests from the prototype: the kernel must be installed with `container system kernel set --recommended`) -> `kernel_missing`.
   Output `PreflightReport { overall: "ready" | "degraded" | "blocked", generatedAt (injected Clock), checks: [{ id, status, message, remediationKey, details }] }`. `overall` is `blocked` if any of os, arch, locate, signature, version, herdr bundle is failing; `degraded` for `not_running` or `kernel_missing` or `untested_version` (remediable by the wizard).
7. **Fail closed contract.** Consumers MUST treat any report whose `overall !== "ready"` as "isolation unavailable": no agent command runs, no CLI terminal starts (SPEC 11, 18). The preflight runs: at engine start, before every Run start, after `container system` restarts, and on demand from the wizard/settings. It never caches `ready` for more than 5 minutes. A thrown exception inside a check is converted to status `error` and counts as blocked.
8. **Update policy** (documented in `docs/engineering/bundled-binaries.md`): herdr is bumped only by a PR that (a) changes `VERSION` and `checksums.json`, (b) attaches the provenance evidence, (c) updates the committed API schema snapshot `vendor/herdr/api-schema.<version>.json` (output of `herdr api schema --json` run inside a container) and shows that the diff against the previous snapshot is additive, (d) runs the herdr adapter contract tests and the isolation escape tests (OVE_TEST007) with the new binary, (e) reviews upstream release notes and the diff of agent-detection manifests, (f) updates `docs/dependencies.md`. Renovate does not auto-bump (it opens an issue). The `container` CLI is NOT bundled: Overmind states a supported range; updating the range (`TESTED_CONTAINER_VERSIONS`) needs the same test run. If herdr is abandoned or compromised, the adapter interface (ADR 0026) allows replacement; the runbook for "revoke a bundled herdr version" (ship a patch release with a new pin; the engine's expected hash is compiled in, so old installs refuse nothing automatically; add an `engine.deny-list` in `vendor/herdr/denied.json` consulted at startup with versions known bad) is included.
9. **Remote manifest updates.** herdr can fetch agent detection manifests from herdr.dev; Overmind must not accept unreviewed remote rules. Identify the herdr configuration key or environment variable that disables remote updates (from upstream docs at the pinned version), record it in `vendor/herdr/README.md`, and expose it as the constant `HERDR_DISABLE_REMOTE_MANIFESTS` consumed by BOX when it starts herdr. In addition the container network allow-list (BOX) must not include `herdr.dev`. Local detection rules for "login required" and "CLI selection dialog" are shipped by PROV in a reviewed directory.
10. **Licenses.** The app's About/Licenses data includes the herdr license and NOTICE text; `THIRD_PARTY_NOTICES` generated by OVE_OSS001 includes herdr with version and URL. The build fails if `licenses/herdr/LICENSE` is missing from the resources.
11. **Size and layout limits.** The herdr binary is expected to be < 40 MB; the script fails above 100 MB (sanity). Only the Linux arm64 build is bundled; no macOS or x86_64 herdr is shipped.

## 6. Design notes

N/A, functionality only. (Message keys: `preflight.os.unsupported`, `preflight.arch.unsupported`, `preflight.container.missing`, `preflight.container.too_old`, `preflight.container.tampered`, `preflight.container.untested`, `preflight.container.not_running`, `preflight.container.kernel_missing`, `preflight.herdr.tampered`, `preflight.herdr.missing`; texts belong to ONB/SETUI.)

## 7. Reuse

Pinned downloader (OVE_SETUP006), `Result` type (OVE_ARCH003), `Clock` port (OVE_ARCH007), command runner port `ProcessRunner` (defined here as an interface in `apps/engine/src/preflight/ports.ts` if ARCH006 has not defined one; replaced by it when available), the manifest/hash conventions of OVE_SETUP017.

## 8. Architecture and code placement

Build-time: `tools/bundle/*` and `vendor/herdr/*`. Runtime: `apps/engine/src/preflight/` is application-level glue in the composition root (it needs the OS); pure decision logic (`evaluate(checks) => PreflightReport`, version comparison, path policy) is in `pure.ts` with no I/O and tested without mocks; I/O is behind `ProcessRunner`, `FileSystem`, `Clock` interfaces (DIP). The platform-specific commands live here only because they are macOS facts about the host, consistent with ADR 0009; when the sandbox adapter (BOX) exists it may re-export the report type.

## 9. Security and safety

- **Supply chain of bundled binaries:** pinned version, pinned SHA-256, provenance method recorded, two-maintainer review, no runtime downloads (the app never fetches herdr), license/NOTICE included.
- **Tamper detection at use time:** build-embedded expected hash plus hash check before mounting; refusal on symlink/permission anomalies.
- **PATH hijack prevention:** `container` is located by absolute paths only, with ownership/mode/signature checks. No `which`.
- **Fail closed everywhere:** unknown output, timeouts, exceptions and untested majors block agent execution.
- **No secrets involved**, but the report may include paths and versions only; it never includes environment variables or file contents.
- **Prompt injection and untrusted data:** command outputs are parsed with strict patterns; unrecognized text never changes `overall` to ready.
- **Auditing:** each preflight run writes an audit event with overall status and failing check ids (AuditEvent port from PERM; this task emits through an `AuditSink` interface injected by the composition root).
- **Remote rule updates disabled** to keep behaviour reproducible and reviewed.

## 10. Errors and edge cases

- Apple silicon Mac on macOS 15 or older: `unsupported_os`, wizard shows requirements (alternative isolation for older systems is a future task, ADR 0020 note).
- Intel Mac: `unsupported_arch`, blocked.
- `container` installed in a non-standard location: `missing` with advice to reinstall the signed pkg; no override flag in the MVP.
- `container system status` hangs: 10 s timeout then `error`.
- Two installed copies with different versions: the first allowed path wins; the report lists both in `details`.
- herdr asset renamed upstream: fetch fails (404); maintainers update the pin deliberately.
- Disk corruption of the bundled herdr: hash mismatch -> `tampered` (message suggests reinstalling the app).
- Time-of-check/time-of-use between verify and mount: documented mitigation (copy to read-only volume, re-hash).
- Running from a translocated or quarantined app path: path policy accepts only the real bundle resource directory reported by the Tauri shell/engine launcher; otherwise `herdr_missing`.

## 11. Acceptance criteria

- [ ] `pnpm bundle:herdr` produces the resources and manifest; flipping one byte in the downloaded asset makes it fail before copying.
- [ ] `checksums.json` contains asset hash, license hash, provenance method and verification date; `vendor/herdr/LICENSE` equals upstream.
- [ ] `verifyHerdrBundle` rejects: wrong hash, symlinked file, group-writable file, missing manifest (unit tests).
- [ ] Preflight table tests: macOS 15 -> blocked; arm64 + 26.1 + 1.5.0 + running -> ready; 1.4.9 -> too_old; 1.6.0 -> ready with `untested_version` warning (degraded); 2.0.0 -> blocked; stopped system -> degraded `not_running`; PATH-only `container` -> missing.
- [ ] The preflight never invokes a binary found via `PATH` (test with a fake runner asserting absolute paths).
- [ ] A thrown error inside a check yields `error` and `overall: "blocked"`.
- [ ] The engine's compiled-in expected herdr hash equals `checksums.json` (build test).
- [ ] `docs/engineering/bundled-binaries.md` documents the update policy, the remote-manifest setting and the deny-list procedure.
- [ ] Proposal file for the Tauri resources entry exists.

## 12. Test plan

Unit tests (pure): version comparison, report evaluation, path-policy decisions. Contract-style tests of each check with a fake `ProcessRunner`/`FileSystem` fixtures recorded from the prototype's real outputs (`tools/bundle/fixtures/container-*.txt`, scrubbed of user names). Integration test (`*.int.test.ts`, skipped off macOS) running the real `container --version` on the self-hosted runner (OVE_SETUP021) to validate parsing and signature trust data. Build test for `fetch-herdr` using a local HTTP fixture server with good and bad checksums. Commands: `pnpm test -- tools/bundle apps/engine/src/preflight`, `pnpm bundle:herdr`.

## 13. Parallelization notes

Parallel with OVE_SETUP010 (resources proposal), OVE_SETUP014, BOX and PROV tasks. BOX consumes `lib:herdr-bundle` and `lib:preflight`; PROV consumes the pinned version and the remote-manifest setting. Hotspots: `vendor/herdr/**` (two-maintainer review), `apps/engine/src/preflight/` (owned here).

## 14. Open questions and assumptions

- ASSUMPTION: a glibc Linux arm64 herdr asset exists on the pinned release; the exact asset name and the available provenance method are determined by the implementer from the release page (not retrievable while writing this task).
- ASSUMPTION: Apple's Team Identifier / Authority strings are filled from a real signed install.
- ASSUMPTION: `container` 1.5.0 is the minimum and only tested version (from the prototype).
- Open question for BOX/Owner: one container per Agent vs per Workspace (ADR 0020) does not change this task; herdr is mounted read-only either way.
- Open question: which herdr option disables remote manifest updates in 0.9.3; if none exists, rely on the network allow-list and file a request upstream (risk accepted until then, documented).
