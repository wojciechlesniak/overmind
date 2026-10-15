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
