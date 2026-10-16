# Dependency policy integration

The Owner authorizes sequential implementation, review and passing merges. SETUP008
adds its checker through SETUP006's existing architecture-tool discovery. The
registry entry also runs this task's actual CLI integration test in the hosted
architecture job; a declared but missing integration test fails. No test gets a
passWithNoTests fallback. This requires the small tools/ci/architecture.ts registry
extension. CODEOWNERS and config-integrity additionally protect renovate.json,
docs/dependencies.md and the policy module. Existing license/audit gates remain.

No catalog/package/lock pin changes or dependency installation is introduced.
Current SETUP006 approved license-compatible tooling is preserved. The Owner's
previous typescript-eslint deferral is respected. Reserved catalog entries are
recorded even when not installed: @axe-core/playwright's MPL license is denied and
cannot be adopted under current policy. The checker warns about an uninstalled
reserve and fails if a manifest actually adopts a denied package; the unchanged
full installed-tree license gate still includes every production/dev dependency.
The incompatible plugin-react6/Vite7 reserve is explicitly documented for SETUP009.

The requested high/critical release-age rule is documented as a future exact,
Owner-reviewed emergency waiver. An attempted automatic Renovate exception was
rejected by automatic approval review for lacking separate authorization. No such
exception was applied. Current pnpm/Renovate age policies remain three days, with
no automatic exceptions and no automatic merging at any configuration scope.

Binary updates use Renovate dashboard approval before branch/PR creation, so
unapproved automation only reports a dashboard issue. Do not approve those items
for automatic edits: the maintainer updates version, both URLs and checksums by
hand. Renovate has no independent hard issue-only update mode; this is the native
approval gate. Configuration does not install/authorize a GitHub App or grant tokens.

Official validation uses Renovate44.155.1 (published2026-10-12), isolated Node24.21.0
(published2026-09-07), --strict --no-global and ignored install scripts. Project
runtime remains Node22.23.3. Node archive is publisher-SHA256 verified; its exact
bin/node member is staged privately because the generic binary-name selector also
finds include/node in this archive. No second downloader or unverified fallback.
The external validator is AGPL software used as a temporary standalone tool, not a
project dependency or redistributed application component. It falls back to its
JavaScript regex implementation because its optional native RE2 build is denied;
all configured regexes avoid backreferences/lookarounds. Schema/repository validation
passes. Actual update execution remains the external App's operational responsibility.

Independent review found and corrected two input-validation gaps before merge:
unknown pnpm policy keys now fail closed, including build-permission and release-age
bypasses, and Cargo Tauri pins require the exact = prefix. Real CLI negative cases
also cover package.json pnpm overrides, npmrc bypasses and implicit pnpm hook files;
the fixture hook is never executed. No actual install/build permission or age
exception was added.

Follow-up review also closed alternate dependency-source overrides and patch-path
escapes, with a complete justification present in each real CLI regression.
Override targets are exact registry versions; patches are bounded local regular
files without symlink components. The restricted Cargo inline-table parser checks
the full allowed form and cannot confuse fake-version with the actual version key.
