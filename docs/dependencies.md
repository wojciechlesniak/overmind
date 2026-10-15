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
| spdx-expression-parse | 4.0.0 | MIT | Parse standard SPDX expressions instead of maintaining a bespoke parser |
| @types/spdx-expression-parse | 4.0.0 | MIT | Types for the parser |

Binary archives for Linux x64 and Darwin arm64 were compared against publisher
release checksums or GitHub release-asset digests before committing the pins.
The installer verifies SHA-256 before use and re-verifies cached bytes. A binary
pin is not an approval of arbitrary future releases.

The parser's transitive `spdx-exceptions@2.5.0` is CC-BY-3.0. It is denied under
the unchanged license policy, alongside pre-existing development dependencies
listed in the declined license proposal. The register documents this blocker;
it does not grant an exception.
