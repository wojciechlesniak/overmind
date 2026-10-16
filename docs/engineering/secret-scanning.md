# Secret scanning and SBOM

`security.yml` runs credential scanning on PRs, watched branch pushes and merge
groups. Only same-repository PRs have a separate SARIF upload job with
`security-events: write`. Fork scan/dependency jobs inherit only `contents: read`,
receive no secrets and never post PR comments. The summary contains rule id,
file and line only; scanning uses `--redact=100`. A shared native Go template emits
minimal SARIF with rule, hashed file location, line and fixed message only. File
paths themselves can contain credentials, so every published location uses
`redacted-path/<SHA-256 of repository-relative path>`; raw filenames never enter
artifacts or summaries. For a known candidate path, compare its UTF-8 SHA-256
locally (without a trailing newline). This deliberately trades source navigation
for the no-secret-values guarantee. Keychain alerts have SARIF level warning. Upstream SARIF retains
raw commit messages even under redaction, so it is never published. Neither
matching source, secret values, commit messages nor author metadata enter reports.

## Local commands

Use the project's pinned Node/Corepack/pnpm first.

| Check | Command | Evidence |
| --- | --- | --- |
| Install/verify scanner | `pnpm exec tsx tools/secret-scan/install.ts` | Verified archive and executable under `.cache/tools/` |
| Prewarm both integration tools | `pnpm exec tsx tools/secret-scan/install.ts all` | Verified Gitleaks and Syft; test network guards remain active |
| Staged files | `pnpm exec tsx tools/secret-scan/staged.ts` | Credential findings block; unavailable local binary warns |
| PR commit range | `pnpm exec tsx tools/secret-scan/run.ts range <base-sha> <head-sha>` | Redacted `secret-results/range.sarif` |
| All reachable history | `pnpm exec tsx tools/secret-scan/run.ts all` | Redacted `secret-results/all.sarif` |
| Current tree | `pnpm exec tsx tools/secret-scan/run.ts tree` | Redacted `secret-results/tree.sarif` |
| SBOM | `pnpm run sbom` | `sbom/overmind-<gitsha>.cdx.json` |
| Validate SBOM | `pnpm exec tsx tools/sbom/validate.ts <file> [--rust]` | Fails on missing/invalid identity, license evidence or required packages |
| Real integration checks | `pnpm exec vitest run --config vitest.int.config.ts tools/secret-scan tools/sbom` | Actual scanner, hook, publisher-checksum tampering and Syft behavior |

The real CI-classifier integration probe additionally requires `jq` locally; the
staged hook itself requires no local jq.

Use **`pnpm run sbom`**: pnpm 12's built-in `pnpm sbom` shadows the script and
requires different arguments. The selected implementation uses Syft for both
JavaScript and Cargo lockfiles through the existing verified downloader.

The prepare hook installs both verified tools after Lefthook, outside CI.
A failed local download warns; it never downloads an unchecked fallback. The
staged hook rechecks cached archive/binary integrity. CI tool installation is
mandatory and fails on download/checksum problems. The GitHub scanner jobs consume
the same verified binary via a current-run artifact and verify its hash before
execution; they need no Node installation. Ubuntu's Bash, Git, tar, jq and checksum
utilities are used from the pinned runner image. Local JSON parsing uses Node.
`pnpm check` prewarms both tools before integration tests and includes full history,
tree scanning and SBOM generation. GitHub's dependency-diff service is additionally
verified by the hosted workflow; local audit/license gates provide local policy checks.

## Detection and exceptions

Default Gitleaks rules and entropy checks remain enabled. The wrapper compiles the
checksum-pinned publisher rules with our policy, removing upstream global
allowlists for lockfiles, images and placeholder values. Use these wrappers:
running raw Gitleaks with `[extend]` would restore those inherited exemptions.
The compiled configuration travels with the verified CI tool artifact.
The default PEM rule additionally requires an actual END header: the publisher
pattern otherwise joins two BEGIN examples across unrelated documentation text.
A complete PEM remains blocked, and the Apple-file rule still blocks its header
alone in AuthKey files. No documentation path is exempted.
Tree scanning copies Git-tracked files and nonignored new files into a temporary
snapshot; ignored reports and caches cannot scan themselves. Tracked files remain
included even when a later ignore rule matches them. Custom rules cover
Telegram, Anthropic/OpenAI prefixes, Apple key headers, encoded certificates and
literal Keychain password commands. The Keychain command rule is warning-only;
credential findings fail. Word boundaries prevent task-id slugs containing `task-`
from being mistaken for key prefixes. Bare/quoted real-format credentials remain
detected. File symlinks are not followed during tree scanning.

The only repository allow-list requires **both** a path under `fixtures/secrets/`
and the literal `OVERMIND_FAKE_SECRET` on the same line. There is no commit-wide,
global value, PNG path, `.gitleaksignore` or inline `gitleaks:allow` exemption.
For a deliberate fake fixture, generate a nonfunctional value at test time when
possible; otherwise place it in the fixture directory with the marker. A marker
outside that directory or a directory without the marker does not exempt it.
Do not add exceptions for real credentials or innocent documentation; rewrite an
example using obvious placeholders or fix an incorrect detection boundary with
positive and negative tests.

## When a secret is found

1. Treat the credential as compromised, even if the PR never merged. Rotate/revoke
   first: Telegram through BotFather; provider keys in the provider console; Apple
   signing/API keys in App Store Connect or the Developer portal. Do not paste the
   value into an issue, chat, commit message or incident record.
2. Remove it from current source. Removing a line alone does not revoke a secret.
   Decide whether history removal is needed, coordinating any rewrite with the
   Owner. Never rewrite unrelated branches automatically.
3. Create the first `docs/security/incidents.md` entry when an actual incident
   occurs. Record the affected provider/type, time, rotation/remediation and
   evidence links, without the value. The initial design-slug/placeholder findings
   were false positives and are not credential incidents.
4. Re-run the affected range, current tree and history checks. Preserve redacted
   evidence; verify that the revoked credential cannot authenticate through the
   provider's supported process. Fake-fixture testing is not rotation evidence.

Nightly full-history and tree checks run at `02:41 UTC`; manual dispatch uses the
same checks. Failed default-branch runs open/update `security: secret scan finding`
with occurrence counts only. Unavailable scanners or malformed/missing reports
fail closed. Schedules/trusted dispatch require promotion to the actual default
branch (`master` currently); merging to DEVELOP alone does not deploy them.

## SBOM evidence

Syft scans a temporary snapshot of the actual root `pnpm-lock.yaml` and optional
root/desktop Cargo locks. No install runs inside the generator and no package code
is executed. Lockfiles must be regular, tracked, unchanged from the named commit
and free of symlink parents. Copied bytes are compared directly with committed
Git blobs, including when index flags hide working-tree changes from Git diff. Installed `node_modules`, fixtures, repository Syft
configuration and inherited Syft environment cannot inject components. The CI job
uses frozen setup for the tooling itself; cataloging reads only the lock snapshot.

Output is CycloneDX **1.6**, includes npm `react`/`zod` and requires Cargo `tauri`
when a Cargo lock exists. Lockfiles omit license declarations, so missing license
metadata is represented as `NOASSERTION` with an explicit reason per component.
This does not approve a dependency's license: SETUP006's actual installed-tree
license policy remains mandatory and unchanged. SBOM artifacts remain available
for 90 days. SETUP014 attaches them to releases and adds provenance/attestation.

Real outside-contributor workflow verification remains an obligation of SETUP018
under the Owner-approved foundation sequence. Local fixtures and static permission
checks are not presented as a real fork-account run. Hardware isolation is likewise
still required by SETUP021/TEST007 and the exact-commit release gate.

Publisher references: [Gitleaks pinned usage/config](https://github.com/gitleaks/gitleaks/blob/v8.30.1/README.md),
[Syft formats](https://oss.anchore.com/docs/guides/sbom/formats/),
[Dependency Review v5](https://github.com/actions/dependency-review-action/blob/v5.0.0/README.md).
