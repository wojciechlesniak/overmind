---
id: OVE_SEC006
title: Publish the supply-chain security checklist and automated repository checks
area: SEC
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SEC001, OVE_SETUP006, OVE_SETUP008]
soft_depends_on: [OVE_SETUP007, OVE_SETUP014, OVE_SETUP015]
provides: ["doc:supply-chain-policy", "lib:supply-chain-check"]
needs: []
owns: ["docs/security/supply-chain.md", "tools/security/check-supply-chain.ts", "tools/security/supply-chain/**"]
reads: ["docs/dependencies.md", ".github/workflows/**", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 17", "SPECIFICATION 19"]
adr_refs: [12, 13, 25, 26]
---

# OVE_SEC006: Publish the supply-chain security checklist and automated repository checks

## 1. Summary

Define the supply-chain rules for an open-source app that bundles third-party binaries and is mostly written by agents (lockfile discipline, pinned CI actions, install-script policy, license allowlist, provenance, SBOM, bundled binaries, container image pinning, review of new dependencies) and implement `pnpm security:supply-chain`, a repository checker that verifies the configuration actually matches the policy.

## 2. Context

Threat `TB-SUPPLY` (SEC001, SR-22). Overmind is Apache-2.0 (ADR 0013), welcomes contributions under a trusted-contributor model (ADR 0025), bundles a pinned herdr binary (ADR 0026), pulls container base images (ADR 0020) and uses Node, Rust and Tauri ecosystems with large transitive trees. Agents adding dependencies on their own is a risk: CONVENTIONS DoD item 6 requires justification and an entry in `docs/dependencies.md` (`OVE_SETUP008`). CI wiring is SETUP006/007; this task defines the policy and checks the result.

## 3. Scope (in)

- `docs/security/supply-chain.md`: normative checklist and rationale.
- Checker `tools/security/check-supply-chain.ts` with rule modules; JSON and human output; used locally, in CI and in the PR security review.
- License policy data file and SBOM expectations.
- Bundled binary and container image verification rules (documented; verification code lives in SETUP015/BOX, this task defines the required manifest format `tools/security/supply-chain/pins.json`).

## 4. Out of scope

- Secret scanning tool configuration and SBOM generation steps: `OVE_SETUP007`. Release signing/notarisation: `OVE_SETUP014`. Bundling herdr: `OVE_SETUP015`. Dependency justification document itself: `OVE_SETUP008`.
- Runtime plugin/Skill supply chain (Skills from internet): ADR 0012, SKILL, SEC004.

## 5. Detailed requirements

1. **Policy (MUST) in `supply-chain.md`:**
   - S1 Lockfile: `pnpm-lock.yaml` committed; CI uses `pnpm install --frozen-lockfile`; `Cargo.lock` committed and `cargo build --locked`; lockfile changes only in PRs that touch the matching `package.json`.
   - S2 Exact versions: direct dependencies pinned to exact versions (no `^`/`~`), `engines` set; the TypeScript version pinned compatible with typescript-eslint (SETUP002).
   - S3 Install scripts: `ignore-scripts=true` in `.npmrc`; allowed lifecycle scripts only for packages listed in `pnpm.onlyBuiltDependencies` (reviewed list, each with a reason, e.g. native modules such as `better-sqlite3`/esbuild binaries); no `postinstall` in our own packages.
   - S4 Minimum release age: new package versions younger than 7 days are not adopted (pnpm `minimumReleaseAge` or Renovate `minimumReleaseAge`), except security fixes via explicit label.
   - S5 New dependency gate: any added direct dependency requires an entry in `docs/dependencies.md` with value, maintenance cost, license, alternatives, maintainer count/last release, install scripts yes/no, native code yes/no (SETUP008 format); the checker verifies every direct dependency has an entry.
   - S6 License allowlist: permitted SPDX: `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `0BSD`, `CC0-1.0`, `Unlicense`, `BlueOak-1.0.0`, `Python-2.0` (tools only), `MPL-2.0` (allowed for unmodified dependencies, file-level copyleft; list reviewed), `CC-BY-4.0` (data/fonts only), `OFL-1.1` (fonts only). Denied: `GPL-*`, `AGPL-*`, `LGPL-*` (allowed only for dynamically-linked system libs not bundled, case by case), `SSPL`, `BUSL`, `Elastic`, `CC-BY-NC*`, unlicensed, `UNKNOWN`. Dual-licensed `(MIT OR GPL-3.0)` accepted choosing the permissive one. Rust crates checked with `cargo deny`. Fonts (Bricolage Grotesque, JetBrains Mono: OFL) are bundled locally.
   - S7 Provenance: prefer packages with npm provenance; CI runs `pnpm audit signatures`/`npm audit signatures` where supported and reports missing provenance as informational; direct dependencies without provenance need a note.
   - S8 Vulnerabilities: `pnpm audit --prod` (or OSV scanner) fails CI on high/critical in production dependencies; dev-only high issues create issues; an allowlist file with expiry dates for accepted advisories (`audit-allow.json`, each with reason and expiry <= 90 days).
   - S9 GitHub Actions: every `uses:` pinned to a full 40-char commit SHA with a version comment; `permissions:` declared at workflow level with least privilege (default `contents: read`); no `pull_request_target` with checkout of PR code; no secrets exposed to forks; third-party actions limited to an allowlist (`actions/*`, `pnpm/action-setup`, `github/codeql-action`, `dtolnay/rust-toolchain` ...); workflow files owned by maintainers (CODEOWNERS).
   - S10 Runners and secrets: signing/notarisation secrets only in protected environments for tagged releases; no secret printing; `GITHUB_TOKEN` read-only by default.
   - S11 Bundled binaries (herdr, container-related helpers): version pinned in `pins.json` with source URL, SHA-256 and (when available) signature/attestation; verified at build and again at first run (SETUP015); upgrade is a dedicated PR with changelog review and test run (ADR 0026).
   - S12 Container images: referenced by digest (`@sha256:`), never `latest`; base image rebuilt policy and scanning (Trivy/Grype informational); image provenance noted in `pins.json`.
   - S13 Reproducibility: the build is deterministic enough to compare artefacts (`SOURCE_DATE_EPOCH`, locked toolchains); SBOM (CycloneDX) generated per release and attached (SETUP007).
   - S14 Typosquatting/maintainer takeover: checker flags dependency names within Levenshtein distance 2 of popular packages that are not on the reviewed list; flags packages whose maintainers changed in the last 30 days (informational, via registry metadata when network is allowed).
   - S15 Update flow: Renovate/Dependabot PRs grouped, never auto-merged; human merge only (ADR 0025 spirit).
   - S16 Generated/vendored code: no vendored minified code; fonts and icons with license files in `THIRD_PARTY_NOTICES`.
   - S17 Contributor and agent PR rules: PRs that modify `.github/`, `.npmrc`, lockfile without manifest change, `pins.json`, `boundaries.json` or `tasks/CONVENTIONS.md` get label `needs-security-review` (CODEOWNERS + checker).
2. **Checker rules** (each a module `tools/security/supply-chain/rules/<id>.ts` returning findings `{ rule, severity, file, line, message }`; severity error fails CI):
   - `lockfile-present-and-fresh` (frozen install dry-run), `exact-versions` (package.json ranges), `npmrc-ignore-scripts`, `only-built-dependencies-reviewed` (each entry has a justification in `tools/security/supply-chain/script-allowlist.json`), `deps-documented` (every direct dependency present in `docs/dependencies.md`), `license-allowlist` (reads `pnpm licenses list --json` and `cargo deny` output; unknown/denied fails), `actions-pinned-sha`, `workflow-permissions-least`, `no-pull-request-target-unsafe`, `actions-allowlist`, `pins-present` (every bundled binary/image in the repo listed in `pins.json` with sha256/digest), `no-latest-images`, `audit-allowlist-expiry`, `min-release-age-configured`, `typosquat-heuristic`, `codeowners-covers-sensitive-paths`.
   - Output: `--json` and annotations for GitHub; exit 1 on error findings; `--offline` skips registry checks.
3. **Fixtures:** `tools/security/supply-chain/fixtures/` with minimal repos that violate each rule; test table asserts one finding per violation and zero on the clean fixture.
4. **`pins.json` schema** (zod in the tool): `{ "binaries": [{ "name": "herdr", "version": "0.9.3", "url": "https://github.com/herdrdev/herdr/releases/download/...", "sha256": "...", "license": "Apache-2.0", "signature": { "type": "minisign|cosign|none", "ref": "..." } }], "images": [{ "ref": "docker.io/library/node@sha256:...", "purpose": "agent-base", "scanned": "2026-10-13" }] }`.
5. **PR security review hook:** the checker prints a one-page summary appended by CI to the PR (new dependencies, licenses, scripts) for the reviewer.
6. The checker itself has zero runtime dependencies beyond Node built-ins, `yaml` and `zod` already in the repo (KISS, small attack surface).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Reads `docs/dependencies.md` (SETUP008), `.github/workflows` (SETUP006/007), SBOM/secret scanning outputs (SETUP007), SEC001 SR-22. The CI job fragment `tools/security/ci-job.yml` is included by SETUP006.

## 8. Architecture and code placement

All under `tools/security/` and `docs/security/supply-chain.md`; no package imports it. Rule modules are independent (OCP): adding a rule = adding a file; `rules/index.ts` is generated by a glob at runtime (no manual list).

## 9. Security and safety

The checker never executes dependency code (no `pnpm install`, only reads lockfile and metadata; `cargo deny` and `pnpm licenses` read manifests). Network access is optional and read-only to registries; results are cached; tokens are not required. Any finding that suggests compromise (hash mismatch of a pinned binary) is a hard error and instructs to stop the release. The checker's own dependencies are pinned. Policy decisions fail closed: unknown license = deny until reviewed.

## 10. Errors and edge cases

- Monorepo workspace dependencies (`workspace:*`) are exempt from pinning rules.
- Dual-licensed or `SEE LICENSE IN` packages: manual review file `license-overrides.json` with reason and reviewer; expires.
- Registry unavailable: `--offline` mode warns, CI runs online checks in a separate non-blocking job except audit (blocking with cached DB fallback).
- Peer dependency ranges: allowed to be ranges only in published libraries (none in MVP).
- Rust: `Cargo.toml` caret versions are semver-compatible ranges by design; `Cargo.lock` + `--locked` is the pin; check enforces lock presence.
- A mass dependency update PR: findings are aggregated per rule to keep output readable.

## 11. Acceptance criteria

- [ ] `supply-chain.md` states S1-S17 with rationale and links to SR-22.
- [ ] Each checker rule has a violating fixture that is detected and a clean fixture that passes.
- [ ] Running on the real repo reports zero errors once SETUP006/007/008 are merged (until then the checker lists the missing pieces as findings).
- [ ] Unpinned action, wildcard version, forbidden license, missing doc entry, `latest` image tag and `pull_request_target` misuse each produce an error.
- [ ] `pins.json` schema validated; a wrong SHA-256 in a fixture is flagged by the verification helper used by SETUP015.
- [ ] CI job fragment and PR summary output exist.
- [ ] License allowlist/denylist match the policy text (single data file `licenses.json` used by both).

## 12. Test plan

- Unit per rule with fixtures: `rules/*.test.ts`. Integration: run CLI against fixture repos, assert JSON output and exit codes. Snapshot of the PR summary format (no secrets).
- Commands: `pnpm vitest run tools/security`, `pnpm security:supply-chain --offline`.

## 13. Parallelization notes

Policy text can start now; the checker depends on SETUP006/008 outputs for the real repo but is developed against fixtures. Conflict hotspots: none (own folders); SETUP tasks add their files and this checker validates them.

## 14. Open questions and assumptions

- ASSUMPTION: pnpm `minimumReleaseAge` (or Renovate equivalent) is available at the pinned pnpm version; otherwise Renovate config enforces it.
- ASSUMPTION: GitHub Actions allowlist reviewed by maintainers; changes need `needs-security-review`.
- Open: use `cargo vet`/`cargo audit` in addition to `cargo deny`; default `cargo deny` + `cargo audit`.
