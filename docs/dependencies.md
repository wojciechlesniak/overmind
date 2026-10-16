# Dependency register

This initial register covers the tools introduced by OVE_SETUP006. OVE_SETUP008
owns the complete workspace register. All Node versions are exact root catalog
pins; binary URLs and SHA-256 values are committed in `tools/pinned-bin/lock.json`.
No license exception has been approved.

| Tool | Version | License | Purpose and source |
| --- | --- | --- | --- |
| actionlint | 1.7.12 | MIT | Workflow syntax checking: [publisher release](https://github.com/rhysd/actionlint/releases/tag/v1.7.12) |
| zizmor | 1.30.1 | MIT | Workflow security analysis: [publisher release](https://github.com/zizmorcore/zizmor/releases/tag/v1.30.1) |
| cargo-deny | 0.20.2 | Apache-2.0 | Cargo license, bans and source policy: [publisher release](https://github.com/EmbarkStudios/cargo-deny/releases/tag/0.20.2) |
| cargo-audit | 0.22.2 | Apache-2.0 OR MIT | RustSec advisory checking: [publisher manifest](https://github.com/rustsec/rustsec/blob/cargo-audit/v0.22.2/cargo-audit/Cargo.toml) |
| vite | 7.3.7 | MIT | Supported 7.3 line, compatible with Vitest 5; default PostCSS pipeline has no mandatory Lightning CSS dependency: [support policy](https://vite.dev/releases) |
| happy-dom | 21.0.1 | MIT | DOM unit-test environment replacing jsdom; [Vitest/Testing Library integration](https://github.com/capricorn86/happy-dom/wiki/Setup-as-Test-Environment) |
| oxlint | 1.87.0 | MIT | Native hooks/compiler lint checks replacing the Babel-dependent plugin; [rule mapping](https://oxc.rs/blog/2026-08-18-react-compiler-support) |
| spdx-license-ids | 3.0.24 | CC0-1.0 | Registered and deprecated SPDX identifiers for the small fail-closed policy evaluator: [publisher](https://github.com/jslicense/spdx-license-ids.js) |
| gitleaks | 8.30.1 | MIT | Secret detection without a paid Action license; official Linux x64/Darwin arm64 archives and checksums in `tools/secret-scan/gitleaks.lock.json`: [release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) |
| syft | 1.54.1 | Apache-2.0 | CycloneDX 1.6 for both pnpm/Cargo lockfiles; existing generic downloader and separate pin file: [release](https://github.com/anchore/syft/releases/tag/v1.54.1) |
| actions/dependency-review-action | 5.0.0 | MIT | GitHub dependency-diff advisory/license gate, full SHA in security.yml: [publisher](https://github.com/actions/dependency-review-action/releases/tag/v5.0.0) |
| github/codeql-action/upload-sarif | 4.38.3 | MIT | Redacted same-repository SARIF upload only; no CodeQL scan/bundle runs: [publisher](https://github.com/github/codeql-action/releases/tag/v4.38.3) |

Binary archives for Linux x64 and Darwin arm64 were compared against publisher
release checksums or GitHub release-asset digests before committing the pins.
The installer verifies SHA-256 before use and re-verifies cached bytes. A binary
pin is not an approval of arbitrary future releases.

The original denied packages are removed from the installed graph and lockfile
snapshots, including optional peer snapshots. Peer declarations in upstream
manifests may still mention jsdom or Lightning CSS; neither is installed.
The allowed-license list and empty exceptions file are unchanged. Release age,
strict peers and denied dependency builds remain enforced. The full license
command reads production and development reports independently with no exclusions.

See `tasks/_proposals/OVE_SETUP006-license-compatible-tooling.md` for the
user-authorized replacements and their limits. ESLint 10, TypeScript and Vitest 5
are retained. The parser accepts registered license IDs/LicenseRef values, AND,
OR and parentheses. WITH/plus terms are always denied; a separate permitted OR
alternative still passes. Exception identifier syntax is parsed without an
exception-name database because no WITH term is approved.
It validates all operands even when a boolean result could short-circuit and
bounds input/token/nesting size. It does not contain copied CC-BY exception data.

SETUP007 binary pins were compared with publisher checksum files; versions were
verified on 2026-10-15/16 and are older than 72 hours. CodeQL upload deliberately
uses mature 4.38.3 instead of the just-published 4.39.0. No new npm dependency is
introduced. The pinned Ubuntu image supplies ordinary Bash/Git/tar/jq/checksum
utilities; the local hook uses Node for report parsing and requires no local jq.

Syft is chosen over pnpm 12's built-in SBOM command to include the future Cargo
tree in the same document. A lockfile-only snapshot, two explicit catalogers,
empty generated config and minimal environment prevent installed package/config
tampering. Missing lockfile license metadata is documented as NOASSERTION and
never replaces `check:licenses`. Maintenance cost is two deliberate binary pin
updates; no second downloader is introduced. See
`tasks/_proposals/OVE_SETUP007-security-integration.md` for integration choices.
