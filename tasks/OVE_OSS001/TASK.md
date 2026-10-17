---
id: OVE_OSS001
title: Apache-2.0 LICENSE, NOTICE and per-file header policy
area: OSS
kind: docs
size: S
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_SETUP001]
soft_depends_on: [OVE_SETUP006, OVE_SETUP015]
provides: ["lib:license-files", "lib:license-header-policy", "lib:third-party-notices"]
needs: []
owns:
  - LICENSE
  - NOTICE
  - REUSE.toml
  - tools/check-headers/**
  - tools/licenses/**
  - docs/legal/license-policy.md
reads: ["package.json", "packages/*/package.json", "vendor/herdr/checksums.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 1", "SPECIFICATION 20"]
adr_refs: [13, 26]
---

# OVE_OSS001: Apache-2.0 LICENSE, NOTICE and per-file header policy

## 1. Summary

Put the project under Apache-2.0 from the first commit (ADR 0013): the canonical `LICENSE`, a `NOTICE` file, a one-line SPDX header policy for source files with an enforcing `pnpm check:headers` tool (and `--fix`), a `REUSE.toml` that licenses non-commentable files, and a generator for `THIRD_PARTY_NOTICES.md` that the release bundles. No CLA.

## 2. Context

ADR 0013: Apache-2.0 "from the first commit", chosen for patent protection and contributor friendliness, no CLA, so a later license change would need contributor consent. Apache-2.0 section 5 makes contributions inbound = outbound unless stated otherwise. Overmind bundles third-party code with its own license text obligations: herdr (Apache-2.0, ADR 0026) requires keeping its LICENSE and NOTICE; npm and crate dependencies are checked by OVE_SETUP006 (`check:licenses`); fonts planned by the visual style (Bricolage Grotesque, JetBrains Mono, docs/design/styl-wizualny.md) are under the SIL Open Font License and need their own license files. Section 4(d) of Apache-2.0: if the work includes a NOTICE file, redistributions must carry its attribution notices.

## 3. Scope (in)

- `LICENSE` (verbatim canonical Apache License 2.0), `NOTICE`.
- Header policy, `tools/check-headers/` (`pnpm check:headers [--fix]`), `REUSE.toml`.
- `tools/licenses/notices.ts` (`pnpm licenses:notices`) generating `THIRD_PARTY_NOTICES.md` (not committed; produced by CI/release).
- `docs/legal/license-policy.md`.

## 4. Out of scope

- License allow-list for dependencies: OVE_SETUP006. SBOM: OVE_SETUP007.
- CONTRIBUTING text about licensing: OVE_OSS002 (links here).
- Trademark policy (open question 14.3).
- Adding the header to all existing files: nothing exists yet; every task that creates source files includes the header (checked by this tool).

## 5. Detailed requirements

1. **`LICENSE`:** the exact text of the Apache License, Version 2.0 as published at apache.org (including the appendix, with the boilerplate NOT filled in or altered). The implementer downloads it from the canonical URL, records its SHA-256 in `tools/check-headers/license.sha256`, and a test fails if `LICENSE` differs. GitHub must detect it as Apache-2.0.
2. **`NOTICE`:** plain text: `Overmind` / `Copyright 2026 The Overmind Authors` (ASSUMPTION, see 14.1) / one sentence "This product includes software developed by third parties; see THIRD_PARTY_NOTICES.md and the licenses/ directory in distributed builds." Then required attribution lines only: herdr (name, URL, version, "licensed under the Apache License 2.0", copyright line copied from herdr's NOTICE if it has one, otherwise from its LICENSE). The NOTICE content is informational and does not modify the license (Apache 4(d)). A test asserts the herdr version in NOTICE equals `vendor/herdr/VERSION` once OVE_SETUP015 lands (skipped before).
3. **Header policy.** Every source file tracked by git starts (after an optional shebang line) with exactly one line `SPDX-License-Identifier: Apache-2.0` in the file's comment syntax: `// ` for `.ts .tsx .js .mjs .cjs .rs .css`(use `/* ... */` for `.css`), `# ` for `.sh .yml .yaml .toml .py`, `<!-- ... -->` for `.html .svg` (after `<!doctype>` for HTML). There is no per-file copyright line (years go stale and the NOTICE covers authorship). Markdown, JSON, lock files, images, fonts, `.plist` and generated binary assets are exempt from in-file headers and covered by `REUSE.toml`.
4. **`REUSE.toml`** (REUSE specification 3.x): `[[annotations]]` with `path` globs, `SPDX-FileCopyrightText = "2026 The Overmind Authors"`, `SPDX-License-Identifier = "Apache-2.0"` for `**/*.md`, `**/*.json`, `pnpm-lock.yaml`, `**/*.png`, `**/*.svg` (non-code), `tasks/**`, `docs/**`; separate annotations for third-party content: `packages/ui-kit/assets/fonts/**` -> `OFL-1.1` with the font copyright lines (added by the DS font task, which MUST also add `licenses/third-party/<font>/OFL.txt`); `vendor/herdr/**` -> `Apache-2.0` with herdr's copyright; vendored files that are not ours MUST be listed here with their license.
5. **Checker `pnpm check:headers`:** enumerates files with `git ls-files`; for each file with a code extension verifies the header (first line or second after shebang); for exempt files verifies a matching `REUSE.toml` annotation exists (every tracked file must have a license by header or annotation); verifies `license` in each `package.json` is `Apache-2.0` and in `Cargo.toml` is `Apache-2.0`; verifies `LICENSE` hash; flags files with a different SPDX id unless annotated; `--fix` inserts the header into code files lacking one (idempotent, preserves shebang and BOM-free UTF-8, never touches exempt files); prints a per-file table; exit 1 on violations. Generated files (barrels, schemas) carry the header emitted by their generators; the checker does not skip them.
6. **`pnpm licenses:notices`** generates `THIRD_PARTY_NOTICES.md` containing, for each production dependency (npm via `pnpm licenses list --json --prod`, crates via `cargo metadata` license fields plus license file texts, and bundled binaries from `vendor/herdr/checksums.json`): name, version, SPDX license, repository URL, and the full license text once per distinct text (deduplicated by hash). The output is deterministic and sorted. Files named `NOTICE*` found in a dependency package are appended verbatim under that dependency's entry (Apache 4(d) obligations of dependencies). The release workflow (OVE_SETUP014) places the result in `Resources/licenses/`. The tool fails when a production dependency has no license text discoverable.
7. **Policy doc `docs/legal/license-policy.md`:** inbound = outbound (Apache 5), no CLA/DCO (ADR 0013), what contributors agree to by opening a PR, how to add third-party code (license check, NOTICE, REUSE annotation, register entry in `docs/dependencies.md`), what is forbidden (copyleft in the app; code copied from sources with unknown license; AI-generated code that reproduces licensed code verbatim), how to handle fonts and images, how to relicense (requires consent of all contributors, so avoid).
8. **Editor support:** the header line is excluded from Prettier changes (it is a plain comment); ESLint needs no rule.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses `git ls-files`, the license allow-list constants from OVE_SETUP006 (`tools/check-licenses/allowed.json`) for deciding which license ids in annotations are acceptable, and herdr data from OVE_SETUP015. `check:headers` is called by CI (`architecture` job) and by pre-commit with `--staged` (hook entry by proposal to OVE_SETUP005).

## 8. Architecture and code placement

Legal files at repository root; tooling in `tools/check-headers/` and `tools/licenses/`; documentation in `docs/legal/`. Pure functions: `expectedHeader(ext)`, `hasHeader(text, ext)`, `insertHeader(text, ext)`, `matchAnnotation(path, annotations)`.

## 9. Security and safety

- License text integrity: hash check prevents silent edits of `LICENSE`.
- Supply-chain hygiene: `THIRD_PARTY_NOTICES` generation fails on unknown licenses, preventing silently shipping code with unknown terms; REUSE annotations make bundled third-party code visible.
- No secrets in legal files; `NOTICE` must not contain personal emails or addresses (the Owner decides which name appears, 14.1).
- `--fix` modifies files: it refuses to run on a dirty tree unless `--force`, writes atomically, and only prepends a comment line.
- The tool treats file contents as data: no execution.

## 10. Errors and edge cases

- File with a shebang: header goes on line 2; checker handles `#!/usr/bin/env node`.
- File that must start with a directive (`"use client"`, `"use strict"`, `@charset`): header is placed before the directive; the tool has a test for each.
- HTML with `<!doctype>`: header after the doctype to avoid quirks mode.
- JSON with comments (tsconfig): exempt by annotation (JSON, not JSONC).
- Files vendored without header (third-party): must be annotated in `REUSE.toml`, otherwise the checker fails.
- A dependency with dual license `MIT OR Apache-2.0`: notices list the SPDX expression; the allowed alternative is noted.
- Generated lockfiles: annotated; no header.

## 11. Acceptance criteria

- [ ] `LICENSE` matches the recorded hash and is detected by GitHub as Apache-2.0.
- [ ] `NOTICE` exists with the project line and the herdr attribution (once vendor files exist).
- [ ] Given a `.ts` file without the header, `pnpm check:headers` fails; `--fix` adds it; second run passes.
- [ ] Given a tracked PNG without a `REUSE.toml` match, the checker fails.
- [ ] Given a `package.json` with `"license": "MIT"`, the checker fails.
- [ ] `pnpm licenses:notices` produces a deterministic `THIRD_PARTY_NOTICES.md` (two runs identical) and fails on a fixture dependency without license text.
- [ ] `docs/legal/license-policy.md` states: no CLA, inbound = outbound, rules for third-party additions.

## 12. Test plan

Unit tests for header insertion per extension (shebang, doctype, directive cases), annotation matching with glob edge cases, notices dedupe and ordering with fixture packages (`tools/licenses/fixtures/`). Integration test on a temp git repo. Commands: `pnpm test -- tools/check-headers tools/licenses`, `pnpm check:headers`.

## 13. Parallelization notes

Parallel with OVE_OSS002..006. After merge every other task must add the header to files it creates; that is checked by CI, so agents run `pnpm check:headers --fix` before commit (the AGENTS.md checklist mentions it). Hotspot: `REUSE.toml` is append-only for third-party entries (added by the tasks bringing in fonts/vendored files, through small additive edits noted in their PRs).

## 14. Open questions and assumptions

1. ASSUMPTION: copyright holder text "The Overmind Authors" (contributors keep their copyright; no CLA). If the Owner wants their legal name, change `NOTICE` and `REUSE.toml` in one commit.
2. ASSUMPTION: SPDX short identifier only, not the long Apache boilerplate in every file (accepted practice, shorter, machine-checkable).
3. Open question: trademark/branding statement for the name "Overmind" and the logo (Apache 6 does not grant trademark rights); the Owner may add `TRADEMARKS.md` later. Note the name also exists as a StarCraft term (docs/design/styl-wizualny.md mentions avoiding that association); a trademark search is the Owner's call.
