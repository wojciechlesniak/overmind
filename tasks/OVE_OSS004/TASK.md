---
id: OVE_OSS004
title: English README and docs structure with docs lint and link checks
area: OSS
kind: docs
size: M
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_SETUP001]
soft_depends_on: [OVE_OSS001, OVE_OSS002, OVE_SETUP006, OVE_SETUP008]
provides: ["lib:readme", "lib:docs-structure", "lib:docs-check"]
needs: []
owns:
  - README.md
  - docs/README.md
  - docs/engineering/README.md
  - docs/security/README.md
  - docs/architecture/README.md
  - .markdownlint-cli2.jsonc
  - tools/docs-check/**
reads: ["docs/SPECIFICATION.md", "docs/GLOSSARY.md", "docs/adr"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 1", "SPECIFICATION 13", "SPECIFICATION 16", "SPECIFICATION 17"]
adr_refs: [9, 13, 16, 17, 22]
---

# OVE_OSS004: English README and docs structure with docs lint and link checks

## 1. Summary

Create the public face of the repository: an English `README.md` that explains what Overmind is, its state, requirements and how to start developing, the documented layout of `docs/` with index pages, and a `pnpm check:docs` tool (Markdown lint, relative-link and anchor check, ADR and spec reference check, translation parity hooks, publication gate for unresolved Owner markers).

## 2. Context

ADR 0017: the repository and documentation are English; ADR 0013: open source from the start; ADR 0016: the Owner's documentation is the source of truth. The project documentation (SPECIFICATION v1.4, glossary, 28 ADRs, research notes, visual style) currently exists in Polish in the Owner's project and is translated by OVE_OSS005..013 into `docs/`, with Polish originals kept in `docs/pl/`. The README must be honest about maturity (nothing is built yet), prerequisites (macOS 26 on Apple silicon for isolation, ADR 0020), the provider-terms grey area (SPEC 17: Overmind does not log in for the user and does not present subscription limits as its own, ADR 0022), and that CLI logins live in the Owner's own CLIs. The visual identity (logo "honeycomb", dark violet palette) is in docs/design (translated by OVE_OSS012).

## 3. Scope (in)

- `README.md` (English), `docs/README.md` (index), folder index pages for `docs/engineering/`, `docs/security/`, `docs/architecture/` (short; their content is owned by other tasks).
- `.markdownlint-cli2.jsonc`.
- `tools/docs-check/` and the root script `check:docs` (name fixed in OVE_SETUP001).

## 4. Out of scope

- Translating the documents: OVE_OSS005 (process, glossary) and OVE_OSS008..013 (documents).
- The architecture document itself: OVE_ARCH001; threat model: OVE_SEC001; engineering docs: their tasks.
- Docs website (Starlight etc.): later / not planned (herdr has one; Overmind starts with GitHub-rendered Markdown).
- ADR index and template: OVE_OSS006.

## 5. Detailed requirements

1. **`README.md` sections, in order:** (1) logo placeholder line and one-sentence pitch (from SPEC 1: "an open-source macOS desktop app where one Owner leads teams of AI agents through a Chief, with visual workflows and real OS-level isolation"); (2) *Status*: pre-alpha, not usable yet, macOS only (ADR 0009), roadmap pointer to the specification; (3) *What it will do* (four pillars from SPEC 1, five bullets maximum); (4) *How it works* (Chief, Agents, Workflows, Task Board, Decision Register in 8-10 lines using glossary terms); (5) *Architecture at a glance* (the Mermaid diagram adapted from SPEC 13, English labels, linking to ARCHITECTURE.md); (6) *Security model* (deny by default, effective permissions are the intersection of policies, isolation via Apple `container` on macOS 26 + Apple silicon, secrets in Keychain, Telegram cannot widen permissions, agents can only file Access Requests) with a link to `SECURITY.md`; (7) *Requirements* (users: macOS 26, Apple silicon, an official CLI such as `claude` or `codex` that you log into yourself; developers: Node 22.23.3, pnpm via corepack, Rust 1.90 only for the shell); (8) *Quick start for developers* (`corepack enable`, `pnpm install`, `pnpm dev`, `pnpm check`); (9) *Repository layout* (table: apps/, packages/, skills/, tools/, docs/, tasks/); (10) *Documentation* (link list to docs/README, SPECIFICATION, GLOSSARY, ADR index, CONVENTIONS); (11) *Contributing* (one paragraph + the "accepted issue first" rule, link to CONTRIBUTING); (12) *Provider terms and disclaimers* (Overmind does not provide Claude/ChatGPT logins; you use the official CLIs under your own accounts and their terms; automated control of third-party CLIs is a grey area that may change; names and trademarks of third parties belong to their owners; no affiliation); (13) *License* (Apache-2.0, link to LICENSE and NOTICE); (14) *Credits* (herdr as terminal layer, Tauri, React Flow, etc., generated from `docs/dependencies.md` headline list).
2. **README rules:** under 250 lines; no screenshots until the UI exists (a placeholder image path `docs/assets/readme-hero.png` is allowed only if the file exists); no badges that expose private information; no marketing claims that the product cannot back (the status section is authoritative); every command in the README exists in root scripts (checked by the tool).
3. **Docs layout (`docs/README.md` table of contents):** `docs/SPECIFICATION.md` (product and architecture specification), `docs/GLOSSARY.md` (bilingual glossary), `docs/adr/` (decision records, index in `docs/adr/README.md`), `docs/architecture/` (ARCHITECTURE.md and diagrams), `docs/security/` (threat model, checklists, incident notes), `docs/design/` (visual style), `docs/research/` (herdr analysis, prototype findings), `docs/engineering/` (CI, release, local development, parallel agents, repository settings, runner, bundled binaries, PR gate), `docs/legal/` (license policy), `docs/dependencies.md`, `docs/pl/` (Polish originals; source of truth for the translation, ADR 0016/0017), `docs/user/` (end-user guide, later), `docs/assets/` (images used by docs). Each index page lists files with one-line descriptions and the owning task area; folder index pages for engineering/security/architecture contain the stub list that owner tasks extend by adding one line each (append-only).
4. **`.markdownlint-cli2.jsonc`:** uses the official programmatic `markdownlint` 0.41.1 core, exactly as embedded in `markdownlint-cli2` 0.23.3 (narrow Owner-approved substitution, 2026-10-17 Europe/Warsaw); rules: MD013 off (long lines allowed), MD033 allow `details, summary, br, img, kbd`, MD041 on (first line is a heading except files with front matter), MD025 single H1, MD024 siblings-only duplicate headings, MD046 fenced code style, MD040 languages on fences, MD036 off, MD051 on (valid link fragments). `ignores`: `docs/pl/**` (originals untouched), `tasks/**/design*.png` n/a, `node_modules`, `THIRD_PARTY_NOTICES.md`, `CODE_OF_CONDUCT.md` (verbatim upstream text).
5. **`pnpm check:docs` (`tools/docs-check/run.ts`):** flags `--publish`, `--i18n`, `--fix-toc`. Default checks over all tracked `*.md` outside `docs/pl/` and `tasks/`: (a) markdownlint; (b) relative links resolve to existing files, anchors exist (GitHub slug algorithm re-implemented and tested); (c) `ADR NNNN` / `ADR-NNNN` references resolve to `docs/adr/NNNN-*.md`; `SPECIFICATION N.M` or "spec section N" references point to an existing heading in `docs/SPECIFICATION.md` when written as `SPEC N`; (d) every command in a ```` ```bash ```` block that starts with `pnpm ` names an existing root script, or an existing script in the explicitly filtered tracked workspace manifest (integrator-approved interpretation, 2026-10-17); documented pnpm install/version builtins remain valid; (e) English check: warn on Polish diacritics outside code blocks in files that are not translated-from-Polish glossary rows; (f) forbidden strings: `TODO(` without a task ID, absolute local paths such as `/Users/`, `file://`, personal emails; (g) extension point: every module matching `tools/docs-*/check.ts` (default export `{ name, run(ctx): Diagnostic[] }`, flags passed through) is loaded automatically and its diagnostics are merged; OVE_OSS005 provides the translation checks this way and no file of this task is edited by it. `--publish` additionally fails on markers `TODO-OWNER`, any translation with `status: draft`, a README placeholder image missing, and missing `LICENSE`. `--i18n` runs the parity checks of OVE_OSS005. Output as table and `--github` annotations; exit 1 on errors.
6. **Link checking offline:** external `http(s)` links are only syntax-checked by default (no network in CI for flakiness); a separate manual flag `--external` checks reachability with a 10 s timeout and a small concurrency, never run by default or in PR CI; results are warnings.
7. **Docs conventions page** `docs/README.md#conventions`: English only, glossary terms capitalised as in the glossary (Owner, Chief, Workspace, Run, Node...), headings sentence case, diagrams as Mermaid, one H1 per file, decisions go to ADRs, ASSUMPTION/PROPOSED/OPEN legend copied from the specification header, no screenshots with personal data.
8. **Performance:** `check:docs` over 150 files in under 10 s.

## 6. Design notes

N/A, functionality only. (The README names the visual identity and links to `docs/design/visual-style.md`; no design image is embedded in this task.)

## 7. Reuse

Uses root scripts (OVE_SETUP001) as the source of valid commands; the ADR file pattern from OVE_OSS006; the glossary data module from OVE_OSS005 for term checks; the translation front-matter schema from OVE_OSS005. Tool dependency: Owner-approved `markdownlint` 0.41.1 from the catalog; GitHub-slug and link logic written in-house (small), no link-checker dependency.

## 8. Architecture and code placement

Documentation files at the repository root and under `docs/`; tooling in `tools/docs-check/` (pure functions `extractLinks(md)`, `slug(heading)`, `checkLinks(files)`, `checkCommands(md, scripts)`), CLI edge for file access. Owner-area docs remain owned by the tasks that create them; this task only creates the indexes.

## 9. Security and safety

- The README makes security claims; every claim must trace to the specification or an ADR (reviewer checks against SPEC 11 and ADRs 0003, 0004, 0006, 0020). Overstating isolation would mislead users into trusting a pre-alpha system: the Status section states what is not yet verified.
- The docs checker blocks accidental publication of local paths, personal emails and unresolved Owner markers (contacts, handles).
- It treats Markdown as data (no execution, no HTML rendering).
- Link checking is offline by default; the optional external mode makes only HEAD/GET requests to public URLs and never sends cookies or tokens.
- Provider-terms disclaimer is part of the honest risk communication (SPEC 17).

## 10. Errors and edge cases

- Heading with emoji or punctuation: slug algorithm follows GitHub (lowercase, remove punctuation except hyphens, spaces to hyphens, duplicate suffix `-1`).
- Duplicate headings produce `-1`, `-2` anchors; tests cover this.
- Link to a file that a later task creates (for example ARCHITECTURE.md): allowed only through a list `tools/docs-check/pending-links.json` with task ID; the entry is removed when the file exists; `--publish` fails if entries remain.
- Fenced code containing `[x](y)` is ignored.
- Translated files with front matter: first-line heading rule is relaxed after front matter.
- `docs/pl/` is excluded from lint and link checks (originals are verbatim).
- Windows line endings: error.

## 11. Acceptance criteria

- [ ] `README.md` has the 14 sections, is under 250 lines, passes `pnpm check:docs`.
- [ ] Every `pnpm` command in README and docs exists in its tracked manifest: root unless explicitly workspace-filtered (test bad commands and unknown workspaces).
- [ ] `docs/README.md` lists every docs folder with owner area and one-line purpose.
- [ ] Broken relative link and broken anchor fixtures are reported; duplicate-heading anchors resolve.
- [ ] `ADR 9999` reference fails; `ADR 0013` passes.
- [ ] `--publish` fails when `TODO-OWNER` exists anywhere, when a translated doc has `status: draft`, or when `LICENSE` is missing.
- [ ] A fixture with `/Users/someone/` fails the forbidden-strings rule.
- [ ] Run time under 10 s on a 150-file fixture.
- [ ] README states clearly: pre-alpha, macOS 26 + Apple silicon for isolation, Owner logs into CLIs themselves, no affiliation with providers.

## 12. Test plan

Unit tests for slug, link extraction, command extraction, ADR reference parsing and forbidden strings, with fixture Markdown trees under `tools/docs-check/fixtures/`. A snapshot-free test runs the checker on the real `README.md`. Commands: `pnpm test -- tools/docs-check`, `pnpm check:docs`, `pnpm check:docs --publish` (expected to fail until Owner markers are resolved).

Hook-environment regressions run the real fixture tests and documentation CLI in
child processes with Git selection variables pointing only to disposable sentinel
repositories. Assert that the sentinel index hash, configuration and inventory
remain unchanged, while the CLI reports the requested fixture's actual content.
The pre-fix RED evidence and shared-helper correction are recorded in
[the isolation follow-up](../_proposals/OVE_OSS004-git-environment-isolation.md).

The integrator-approved cold-cache packaging integration repair uses the existing
bounded public CLI subprocess before the relocated SEA test consumes its verified
runtime archive. Vitest's network denial, the 120-second test timeout and all
relocation/source-map assertions remain unchanged. The actual single cold RED and
GREEN, cache preservation and exact shared scope are recorded in
[the cold-cache follow-up](../_proposals/OVE_OSS004-cold-packaging-test.md).

## 13. Parallelization notes

Parallel with OVE_OSS001..003, 005, 006. Hotspots: `docs/README.md` and the folder index pages are append-only by other tasks (one line per document, alphabetical to keep merges trivial). `tools/docs-check/pending-links.json` entries are removed by the task that creates the target.

## 14. Open questions and assumptions

- ASSUMPTION: GitHub-rendered Markdown only; no docs site in the MVP phase.
- ASSUMPTION: README mentions the Owner-chosen logo by path only after `docs/assets/` has it (the logo is specified in the visual style doc; the asset task belongs to DS/branding).
- Open question: hosting a docs site later (Starlight) and versioned docs like herdr; not planned.
- Open question: whether the README should carry a "Why not just use X?" comparison; default no, to avoid unverifiable claims.
