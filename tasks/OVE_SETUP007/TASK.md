---
id: OVE_SETUP007
title: Secret scanning and SBOM in CI
area: SETUP
kind: security
size: S
priority: P0
mvp: true
status: done
depends_on: [OVE_SETUP001, OVE_SETUP005, OVE_SETUP006]
soft_depends_on: [OVE_SETUP008]
provides: ["lib:secret-scanning", "lib:sbom"]
needs: ["lib:ci-setup-action", "lib:pinned-bin"]
owns:
  - .github/workflows/security.yml
  - .gitleaks.toml
  - lefthook-secrets.yml
  - tools/sbom/**
  - tools/secret-scan/**
  - docs/engineering/secret-scanning.md
reads: ["lefthook.yml", "pnpm-lock.yaml", ".github/actions/setup/action.yml"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 17"]
adr_refs: [3, 12, 22]
---

# OVE_SETUP007: Secret scanning and SBOM in CI

## 1. Summary

Add a `security.yml` workflow that scans every pull request and the full history for committed secrets (Overmind-specific token formats included), reviews dependency changes for new vulnerabilities and disallowed licenses, and produces a CycloneDX SBOM for the JavaScript and Rust dependency trees that is validated and attached to CI runs and later to releases. A local pre-commit hook runs the same scanner.

## 2. Context

Secrets live only in the macOS Keychain (CONVENTIONS section 7) and the project handles high-value material: Telegram bot tokens, CLI login volumes (never in the repo), Apple signing certificates and notarization keys (OVE_SETUP014), Anthropic/OpenAI keys used in later versions. The repository is public, so a leaked secret is immediately exploitable. The supply chain risk list in SPEC 17 and the policy in ADR 0012 (skills from the internet) show the project treats third-party content as hostile. GitHub-native secret scanning and push protection are enabled as repository settings in OVE_SETUP018; this task adds the in-repo, reviewable layer.

## 3. Scope (in)

- `.github/workflows/security.yml` with jobs `secrets`, `dependency-review`, `sbom`, and a nightly full-history `secrets-full` (via `schedule`).
- `.gitleaks.toml` with custom rules and a narrow allow-list.
- `lefthook-secrets.yml` (extends the hooks from OVE_SETUP005).
- `tools/sbom/` generator wrapper and validator; `tools/secret-scan/` helper that downloads and verifies the scanner binary.
- Runbook `docs/engineering/secret-scanning.md` (what to do when a secret leaks).

## 4. Out of scope

- Repository settings (native secret scanning, push protection, private vulnerability reporting): OVE_SETUP018.
- Signing keys handling in the release workflow: OVE_SETUP014.
- Runtime secret redaction in logs: OVE_ARCH004 and OVE_SEC003.
- License policy check on the dependency tree: OVE_SETUP006 (`check:licenses`).
- Vulnerability audit of lockfiles (`pnpm audit`, `cargo audit`): OVE_SETUP006.

## 5. Detailed requirements

1. **Scanner choice and pinning.** Use the `gitleaks` binary, not the GitHub Action (the Action requires a paid license key for organization repositories). The version and the SHA-256 per platform are stored in `tools/secret-scan/gitleaks.lock.json` (`{ "version": "...", "assets": { "linux-x64": { "url": "...", "sha256": "..." }, "darwin-arm64": {...} } }`), the implementer pins the current stable release and records it in `docs/dependencies.md` (OVE_SETUP008). `tools/secret-scan/install.ts` is a thin wrapper over the generic pinned-binary downloader `tools/pinned-bin/` created by OVE_SETUP006: it downloads over HTTPS, verifies the SHA-256, refuses on mismatch and caches under `.cache/tools/` (gitignored).
2. **Rules (`.gitleaks.toml`).** `[extend] useDefault = true`, plus custom rules with ids and regexes: `overmind-telegram-bot-token` (`\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b`), `overmind-anthropic-api-key` (`sk-ant-[A-Za-z0-9_\-]{20,}`), `overmind-openai-api-key` (`sk-(?:proj-)?[A-Za-z0-9_\-]{20,}`), `overmind-apple-p8` (PEM header `-----BEGIN PRIVATE KEY-----` in files named `AuthKey_*.p8`), `overmind-p12-base64` (long base64 starting `MIIK` in YAML/JSON/env), `overmind-keychain-ref-guard` (a warning rule: any literal `security add-generic-password ... -w <value>`). Entropy-based detection stays on its default.
3. **Allow-list.** Only fixtures that deliberately contain fake secrets: paths matching `^(?:.*/)?fixtures/secrets/.*$` AND the line containing the literal marker `OVERMIND_FAKE_SECRET`. No global regex allow-listing, no allow-listing by commit. Each allow-list entry carries a comment with the owner task ID. A unit test checks that the allow-list file only contains these two constructs.
4. **Job `secrets` (pull_request, push, merge_group):** hosted ubuntu, `permissions: contents: read`, checkout with `fetch-depth: 0` and `persist-credentials: false`, scan the commit range `base..head` (`gitleaks git --log-opts="<base>..<head>" --redact --report-format sarif`). On fork PRs it runs with the same read-only token (no upload to code scanning because `security-events: write` is unavailable to forks): the job prints findings in the log with `--redact` and fails; for same-repo PRs it additionally uploads SARIF with job-scoped `security-events: write`. The scanner never prints secret values (`--redact=100`).
5. **Job `secrets-full` (schedule `41 2 * * *` UTC, workflow_dispatch):** scans the whole history and the current tree; failure opens or updates one issue `security: secret scan finding` with finding count only (no values).
6. **Job `dependency-review` (pull_request only):** uses GitHub's `actions/dependency-review-action` pinned by SHA with `fail-on-severity: high`, `deny-licenses` aligned with OVE_SETUP006's denied list, `comment-summary-in-pr: never` for forks (no write token). Skipped on `merge_group` and `push`.
7. **Job `sbom` (pull_request, push to main, release call):** generates one CycloneDX 1.6 JSON SBOM: `tools/sbom/generate.ts` runs a pinned `syft` (checksum-verified like gitleaks) on the repository root with the catalogers limited to lockfiles (`pnpm-lock.yaml`, `Cargo.lock`) and writes `sbom/overmind-<gitsha>.cdx.json`. The implementer MAY use `pnpm sbom --sbom-format cyclonedx --prod` if the pinned pnpm supports it; the decision is recorded in OVE_SETUP008. `tools/sbom/validate.ts` validates structure (bomFormat, specVersion, `components` non-empty, each component has purl, version and license or a documented `NOASSERTION`) and checks that the SBOM mentions `react`, `zod` and (when present) `tauri`. The file is uploaded as artifact `sbom` (retention 90 days). OVE_SETUP014 attaches it to releases.
8. **Pre-commit hook (`lefthook-secrets.yml`):** `gitleaks protect --staged --redact` through the verified binary; skipped with a warning if the binary is not yet downloaded (`pnpm exec tsx tools/secret-scan/install.ts` is invoked by `prepare`). Hook is advisory; CI is the gate.
9. **Runbook.** `docs/engineering/secret-scanning.md`: (a) never fix a leak by only deleting the line; treat the secret as compromised and rotate it (Telegram: revoke via BotFather; provider keys: revoke in the provider console; Apple keys: revoke in App Store Connect / Developer portal), (b) then remove from history only if needed, (c) record an incident entry in `docs/security/incidents.md` (created on first use), (d) how to add a fake fixture secret correctly.
10. All workflows use the composite `setup` action only where Node is needed; `secrets` job needs no Node.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

The pinned-binary downloader `tools/pinned-bin/` (OVE_SETUP006) is reused for gitleaks and syft; this task must not write a second downloader. Hook mechanism reuses Lefthook `extends` from OVE_SETUP005.

## 8. Architecture and code placement

Tooling and CI only. Scripts in TypeScript under `tools/`, run by `tsx`. No product package depends on them. The workflow file is a thin caller.

## 9. Security and safety

- The scanner and `syft` are third-party binaries run on untrusted PR content: they run in a job with read-only token, no secrets, no network write-back. Binaries are verified by pinned SHA-256; the checksum file is itself protected by CODEOWNERS.
- `--redact` always on; logs and SARIF never contain secret values. Findings in fork PRs are reported in the job summary by rule id and file:line only.
- A found secret blocks the merge. Scanning the PR range protects the repository; the history scan protects against secrets introduced through a merge commit or a force-push elsewhere.
- Secrets in CI: this workflow uses none. Signing material is in an environment-scoped store (OVE_SETUP014), not in repository secrets.
- SBOM is built from lockfiles, never from `node_modules` (which could be tampered with during the job).
- Lockfile integrity: SBOM generation does not run `install`; the `dependency-review` job flags new or changed packages in the lockfile diff.
- Allow-list abuse: the unit test in requirement 3 prevents broad exemptions; a PR changing `.gitleaks.toml` needs CODEOWNERS approval and the label `config-change` (OVE_SETUP006 `config-integrity`).

## 10. Errors and edge cases

- Binary download fails or checksum mismatches: job fails (never falls back to unverified download).
- Large binary assets in history (images in `tasks/`): excluded by path rules `tasks/**/*.png`, `docs/**/*.png` in the scanner's `[[allowlists]] paths`.
- Base SHA unreachable in a shallow clone: `fetch-depth: 0` is mandatory; the job fails with a clear message otherwise.
- False positive on a documentation example: use an obviously fake token with the `OVERMIND_FAKE_SECRET` marker inside `fixtures/secrets/` or rewrite the example; never allow-list globally.
- SBOM cataloger finds zero components: validator fails.
- Rust not yet present: Cargo cataloging simply yields no crates; once `Cargo.lock` exists, validator requires `tauri`.

## 11. Acceptance criteria

- [x] Given a throw-away commit with a fake Telegram token `123456789:AAAA...` (35 chars), then job `secrets` fails and the log does not contain the token.
- [x] Given the same string inside `fixtures/secrets/` with the marker, then the scan passes.
- [x] Given a fork PR, then `secrets` and `dependency-review` run with a read-only token and no secrets.
- [x] Given a PR adding a dependency with a known high-severity advisory, then `dependency-review` fails.
- [x] `sbom` produces a valid CycloneDX JSON containing `react`, `zod` and `tauri` (when Rust exists) and uploads it as artifact `sbom`.
- [x] Pre-commit hook blocks a staged file containing `-----BEGIN PRIVATE KEY-----`.
- [x] `tools/secret-scan/gitleaks.lock.json` has a checksum for linux-x64 and darwin-arm64; tampering with the checksum makes the install script fail.
- [x] Runbook exists and covers the four steps in requirement 9.

Acceptance evidence (2026-10-16): code commit `6bc0e4a` passed independent
Standards and Spec reviews with zero remaining findings. Local checks passed
92 unit tests and 11 integration tests, unchanged license/advisory gates,
full-history/tree scanning and SBOM. [Clean CI](https://github.com/wojciechlesniak/overmind/actions/runs/38871595365)
and [Security](https://github.com/wojciechlesniak/overmind/actions/runs/38871595386)
passed; the actual SBOM artifact has 344 components including React/Zod.
[Secret probe PR940](https://github.com/wojciechlesniak/overmind/pull/940) failed
`secrets` with one finding; the complete log and SARIF contain no generated value.
[Advisory probe PR941](https://github.com/wojciechlesniak/overmind/pull/941)
[run38872283312](https://github.com/wojciechlesniak/overmind/actions/runs/38872283312)
failed `dependency-review` on two high-severity lodash advisories. Both probes are
closed without merge. Only the fake-secret scratch ref is returned to verified
clean code with an exact lease; no implementation/unrelated history is rewritten.
Fork permissions are verified by workflow tests; real outside-account execution
remains SETUP018 under the Owner-approved SETUP006 foundation sequence.
GitHub dependency graph/alerts were enabled as the required service prerequisite;
no automatic update PRs were enabled. Scheduled dispatch awaits default-branch
promotion. Regex/SARIF safety adaptations are recorded in the integration proposal.

## 12. Test plan

Unit tests: allow-list structure test; install script with a local HTTP fixture server (checksum match and mismatch); SBOM validator against good/bad fixtures (`tools/sbom/fixtures/`). Integration: `tools/secret-scan/scan.int.test.ts` creates a temp git repo, commits fake secrets (generated at test time, never stored), runs the verified binary and expects exit codes. Workflow checks reuse `tools/check-workflows.test.ts` from OVE_SETUP006. Commands: `pnpm test -- tools/secret-scan tools/sbom`.

## 13. Parallelization notes

Parallel with OVE_SETUP008..013 after OVE_SETUP006. Hotspots: none shared; `lefthook-secrets.yml` is included via `extends` in OVE_SETUP005's `lefthook.yml` (one line added there at integration time by this task, noted in the PR). 

## 14. Open questions and assumptions

- ASSUMPTION: gitleaks and syft pinned to their current stable releases at implementation time (cannot be looked up in this backlog because they are not on npm); the implementer records exact versions, URLs and checksums in `docs/dependencies.md`.
- ASSUMPTION: CodeQL is not enabled by this task; the Owner may enable GitHub default code scanning in OVE_SETUP018.
- Question: whether the SBOM must also be signed (cosign / GitHub attestation); default: attested by the release workflow (OVE_SETUP014).
