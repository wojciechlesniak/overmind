# Secret-scanning integration

Implementation coordination under the Owner's request to implement SETUP007.
Its explicit requirements call for prepare-time scanner installation, the existing
hook extension, CODEOWNERS, dependency registration and config-change approval.
Accordingly this task updates tools/hooks/prepare.mjs, .github/CODEOWNERS,
tools/ci/config-integrity.ts, the shared workflow parser, local tools/ci/check.ts,
.gitignore and docs/dependencies.md. It does not
weaken earlier owner policies or change runtime product code.

Gitleaks 8.30.1 and Syft 1.54.1 are current stable publisher releases verified via
official GitHub release metadata/checksum files. Dependency Review v5 deprecates
deny-licenses; its allow-licenses input uses SETUP006's unchanged authoritative
allow-list, which is stricter. CodeQL upload uses mature v4.38.3, not today's
new v4.39.0. All actions remain SHA-pinned.

The OpenAI/Anthropic prefix rules add a word boundary so a task-id slug containing
`task-...` does not match `sk-...`. Actual bare/quoted credentials retain detection;
negative regression coverage is required. This is not a path or value exemption.
The Keychain literal-command guard is warning-only as requested by requirement 2;
real credential-rule findings fail. Inherited upstream entropy detection remains.

No broad PNG allow-list is added: requirement 3 restricts this repository's
exceptions to fake fixture path AND same-line marker. The shared pinned downloader also verifies the exact upstream default TOML as a
data resource. A compiler preserves its provider/entropy rules and removes only
upstream global exclusions; the effective global allow-list is the narrow fixture
conjunction. Real tests cover plaintext secrets named .png and pnpm-lock.yaml.
Tree scans use a Git file inventory snapshot to exclude ignored generated reports
and caches without policy exemptions. The generic installer gains a shared atomic
writer and verified data-resource support rather than a second downloader.

SBOM input is a temporary snapshot containing only the actual root pnpm lock and
optional root/desktop Cargo locks. This enforces the requirement to catalog
lockfiles, preventing node_modules, fixtures, symlinks or repository Syft config
from contributing fabricated components. Syft runs with only lockfile catalogers,
explicit empty config and a minimal environment. Missing lockfile license metadata
is documented as NOASSERTION per component; the separate license policy still gates
actual installed dependencies and is not replaced by SBOM validation.

Actual outside-contributor workflow verification remains tracked by SETUP018 under
the accepted SETUP006 sequence, covering the deployed CI/security workflows.

The inherited private-key regex is bounded by a real PEM END header. Its original
suffix also matches the end of a second BEGIN header, falsely joining separate
backlog examples into a key. Tests cover that case and a complete synthetic PEM;
the custom Apple filename/header guard is unchanged. No path/commit exception is
added. Default entropy checks and provider rules remain active.
