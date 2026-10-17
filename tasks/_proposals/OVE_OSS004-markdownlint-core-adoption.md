# OVE_OSS004: adopt the same markdownlint core without the CLI wrapper

Status: narrow adoption approved explicitly by the Owner, confirmed 2026-10-17
(Europe/Warsaw; current clock 2026-10-16 22:16 UTC). No policy exception is granted.
Evidence date: 2026-10-16. Task claim: dfd1db61ff5cb566a9a33114a2f236162ef0e1a2
(2026-10-16T22:13:14+02:00).

## Required Owner decision

TASK section 5.4 explicitly says `.markdownlint-cli2.jsonc` "uses
`markdownlint-cli2` 0.23.3"; section 7 names that catalog dependency. Approve a
narrow requirement change to install `markdownlint` 0.41.1 directly and call its
official programmatic API from the existing `pnpm check:docs` adapter. This is
exactly the core version embedded by CLI2 0.23.3, not a newer rule engine.

Keep the prescribed configuration filename, semantic rules, checker flags,
offline defaults, publication checks and public checker behavior. The programmatic
adapter does not need CLI glob expansion or YAML configuration loading. It passes
only source strings and reviewed JSON configuration, with noInlineConfig enabled.

## Why the specified wrapper is blocked

- Its installed js-yaml 5.4.1 graph includes argparse 3.0.2, PSF-2.0. The existing
  npm license policy denies that license; no npm exception has been approved.
- Its micromatch/globby graph includes braces 3.0.3. The current audit reports
  HIGH GHSA-vfj7-8cjw-p6xm. The
  [official advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists
  versions through 3.0.3 as affected and no patched version. No safe version-only
  override was established; the HIGH finding is not waived.

## Isolated alternative evidence

The separate fixture `/private/tmp/ove-oss004-lint-trial-ztvompx8` installs only
markdownlint 0.41.1. It does not alter the project's current dependency graph.

- pnpm 12.11.2, Node 22.23.3; minimumReleaseAge 4320, strict dependency builds and
  peers, empty build permissions, installation with scripts disabled: PASS.
- Generated lockfile resolves 49 packages; pnpm license report lists all 49 as
  MIT, already allowed by the unchanged policy. No PSF-2.0 or braces is present.
- `pnpm audit --audit-level=high`: exit 0. Full JSON audit: zero critical, high or
  moderate findings; one LOW KaTeX finding GHSA-238p-pmpm-9mq7, affected below
  0.18.2. This finding is disclosed, not suppressed or waived. Existing thresholds
  remain unchanged; this trial does not establish whole-project audit success.
- Real official `lint` from `markdownlint/promise`: good document has no errors;
  duplicate H1 plus an unlabelled fence returns MD025 and MD040; an attempted
  inline markdownlint-disable still returns MD040 with noInlineConfig:true.
- Primary API documentation:
  [markdownlint 0.41.1 README](https://github.com/DavidAnson/markdownlint/blob/v0.41.1/README.md#api).
  The fixture contains the generated lockfile, license/audit JSON and smoke.mjs.

## Exact integration scope after approval

1. Add markdownlint 0.41.1 to the workspace catalog and as a root catalog-based
   development dependency. Remove only the installed CLI2 development dependency;
   keep CLI2's existing catalog reserve 0.23.3 and document why it remains blocked.
2. Regenerate pnpm-lock.yaml through pnpm; never edit it by hand.
3. Add the direct-core entry and evidence to docs/dependencies.md and qualify the
   CLI2 reserve. Keep all license, release-age, peer and script restrictions.
4. Switch the thin lint adapter to the direct official API. Preserve the same
   rules and tests; add no fallback that silently skips Markdown lint.
5. Update TASK's explicit dependency requirement to reflect the Owner's decision.
6. Run whole-project license/dependency/audit gates, lint, typecheck, real tests,
   independent review and hosted checks before acceptance or merge.

The proposal grants no Rust or npm license exception, security finding waiver,
release-age exclusion, install-script permission or unrelated package upgrade.
