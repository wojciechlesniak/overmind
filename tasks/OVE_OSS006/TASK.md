---
id: OVE_OSS006
title: ADR index, ADR template and English slug map
area: OSS
kind: docs
size: S
priority: P0
mvp: true
status: in_review
depends_on: [OVE_SETUP001]
soft_depends_on: [OVE_OSS004, OVE_OSS005]
provides: ["lib:adr-template", "lib:adr-index", "lib:adr-tooling", "lib:adr-slug-map"]
needs: []
owns:
  - docs/adr/README.md
  - docs/adr/_template.md
  - docs/adr/slug-map.json
  - tools/adr/**
reads: ["docs/pl/adr", "docs/adr"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [8, 16, 17]
---

# OVE_OSS006: ADR index, ADR template and English slug map

## 1. Summary

Give architectural decision records a template, a generated index and a lifecycle check, and fix the English file names of the 28 existing ADRs so the translation tasks and all links agree. ADRs are append-only (decisions are superseded, never deleted), in the same spirit as the product's own Decision Register (ADR 0008).

## 2. Context

SPEC 19.8 and CONVENTIONS section 8 require new architectural decisions to be recorded as ADRs. The Owner's 28 ADRs are short (one paragraph of decision and reasons, then a "Consequences" list; ADR 0020 also has a prototype confirmation section; ADR 0001 has YAML front matter `status: superseded by ADR-0023` and is replaced by ADR 0023). They are written in Polish with Polish file names; after translation (OVE_OSS005, OVE_OSS010, OVE_OSS011) they live in `docs/adr/` with English names. Parallel tasks will add ADRs (for example OVE_SETUP011 adds the engine packaging ADR) so number allocation must be collision-resistant.

## 3. Scope (in)

- `docs/adr/_template.md`, `docs/adr/README.md` (generated index plus human intro), `docs/adr/slug-map.json`.
- `tools/adr/`: `new.ts` (`pnpm adr:new "<title>"`), `gen-index.ts` (`pnpm gen:adr-index [--check]`), `check.ts` (`pnpm check:adr`), `renumber.ts` (`pnpm adr:renumber <old> <new>`).

## 4. Out of scope

- Translating ADR content: OVE_OSS010 (0001-0014) and OVE_OSS011 (0015-0028).
- Writing new ADRs for other areas (their tasks do).
- A docs website index.

## 5. Detailed requirements

1. **Slug map (`slug-map.json`, normative).** English file names, Polish originals in `docs/pl/adr/`:
   - 0001 `single-chief-as-sole-interlocutor` (superseded by 0023)
   - 0002 `workflow-as-executable-program`
   - 0003 `permissions-deny-by-default-and-intersection`
   - 0004 `real-os-level-isolation`
   - 0005 `engine-independent-of-window`
   - 0006 `telegram-as-second-channel`
   - 0007 `model-per-agent-and-node`
   - 0008 `decision-register-append-only`
   - 0009 `macos-only-first`
   - 0010 `one-installation-one-owner`
   - 0011 `own-task-board`
   - 0012 `internet-skills-only-from-owner`
   - 0013 `apache-2-license`
   - 0014 `two-memory-layers`
   - 0015 `chief-autonomy`
   - 0016 `project-documentation-as-source-of-truth`
   - 0017 `english-as-project-language`
   - 0018 `stack-tauri-react-typescript-sqlite`
   - 0019 `own-workflow-engine`
   - 0020 `macos-isolation-virtual-machine`
   - 0021 `default-approval-list`
   - 0022 `official-clis-like-herdr`
   - 0023 `direct-chats-with-agents`
   - 0024 `mvp-scope`
   - 0025 `contribution-model`
   - 0026 `herdr-as-terminal-layer`
   - 0027 `overmind-skill-for-agents`
   - 0028 `visibility-public-private`
   Resulting names: `docs/adr/NNNN-<slug>.md`. The JSON also stores, per ADR, the Polish original file name and the English title (the H1 of the translation, filled by the translation tasks, initially the descriptive working title). A title change never renames the file.
2. **Template (`_template.md`).** Front matter keys: `adr` (integer), `title`, `status` (`proposed` | `accepted` | `superseded` | `deprecated`), `date` (ISO), `deciders` (list, default `[Owner]`), `supersedes` (list of integers), `superseded_by` (list), `tags` (list from: architecture, security, product, process, tooling, legal). Body: `# <Title as the decision, one sentence>`; one paragraph "what we decided, in which context, and the main reason, including rejected alternatives with a reason each" (the existing ADR style: short); `## Consequences` bullets (positive and negative, follow-up obligations); optional `## Alternatives considered` when more than one sentence of detail is needed; optional `## Confirmation` (how the decision is verified, for example a prototype or test, with date and link). Length guideline: under 60 lines. Translated ADRs additionally carry the translation keys of OVE_OSS005.
3. **Existing status data.** Statuses of the Owner's ADRs: all `accepted` except 0001 `superseded` (`superseded_by: [23]`), dates from the project's document creation dates (2026-10-12 or 2026-10-13 as given in the manifest `projectCreatedAt`); ADR 0023's `supersedes: [1]`. `deciders: [Owner]`.
4. **`pnpm adr:new "<title>"`:** computes the next number as max(numbers in `docs/adr/` on the current branch, numbers in `origin/main`, and numbers in files added by open `task/*` branches found with `git ls-remote` + `git diff --name-only`) + 1, zero-pads to 4 digits, derives a kebab-case ASCII slug (max 6 words, 60 characters), writes the template with filled front matter (status `proposed`, today's date from an injected Clock), prints the path. It refuses when the number already exists. Concurrent allocation can still collide; `check:adr` catches it in CI and `adr:renumber <old> <new>` renames the file, updates the front matter and rewrites links to it across `docs/` and `tasks/` (dry run by default).
5. **`pnpm check:adr` rules:** every ADR has valid front matter; `adr` equals the file number; numbers are unique and contiguous (no gaps); file name equals `<NNNN>-<slug>.md` with a lower-case kebab slug; exactly one H1; `Consequences` section exists unless status is `proposed`; `supersedes`/`superseded_by` are mutual and refer to existing ADRs; a `superseded` ADR has `superseded_by` non-empty and its file content is unchanged except for front matter once superseded (compared with the git history: `git log -p` shows only front matter changes after the status flips); an `accepted` ADR's decision paragraph may not be edited except for typo fixes (heuristic: PRs touching accepted ADR bodies need label `adr-edit`); status transitions allowed: `proposed -> accepted -> (superseded | deprecated)`; the slug map contains the ADR; ADR numbers mentioned in other docs exist. Deleting an ADR file is an error (checked against the base branch).
6. **Index (`gen:adr-index`).** `docs/adr/README.md` = hand-written intro (what ADRs are, how to propose a new one, the append-only rule, the status meanings, link to the template and to ADR 0008 as the philosophy) + a generated table between markers `<!-- adr-index:start -->` and `<!-- adr-index:end -->` with columns `# | Decision | Status | Date | Tags | Notes` (notes show "superseded by 0023" or "supersedes 0001"); rows sorted by number; titles link to files; `--check` fails when the committed table differs.
7. **Process rules (in the README):** who may propose (anyone via an accepted issue or a task of kind `decision`/`spike`), who accepts (the Owner; an ADR PR merged by the Owner = accepted), that an ADR must exist before code that depends on a hard-to-reverse decision lands, that a decision change needs a new ADR that supersedes the old one, and that task files reference ADRs by number (`adr_refs`).
8. **Linking:** documents reference ADRs as `ADR 0013` (plain text with a link to the file on first mention); `check:docs` (OVE_OSS004) validates references; `adr_refs` in task front matter use integers.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

The translation front matter from OVE_OSS005 is merged into translated ADRs; reference validation shared with `tools/docs-check` (OVE_OSS004); the Clock injection pattern (OVE_ARCH007) for dates. The slug map is the single source for ADR English file names for OVE_OSS005 (`docs/i18n/map.json` reads it).

## 8. Architecture and code placement

Docs under `docs/adr/` and tooling in `tools/adr/` (pure parsing/rendering functions, git access behind an interface). No product dependency.

## 9. Security and safety

- Decisions about security (permissions, isolation, Telegram, skills from the internet) are protected from silent rewriting: append-only rule, `adr-edit` label for body edits, immutability check against git history, CODEOWNERS on `docs/adr/` (Owner).
- Number allocation reads remote branch data only through `git`; branch names are validated against the task regex before use; no shell interpolation.
- ADR files are data for tools; the index generator escapes pipes and backticks in titles.
- Superseding instead of deleting preserves the audit trail of why security-relevant choices were made.

## 10. Errors and edge cases

- Two parallel tasks create ADR 0029: CI of the second fails with duplicate number; `adr:renumber 29 30` fixes it and updates references.
- ADR with accepted status edited: allowed for typos with label; otherwise CI explains to write a superseding ADR.
- An ADR that supersedes several: `supersedes: [3, 4]`, each gets `superseded_by` including the new number.
- Translated ADR 0001 front matter conflict (`status: superseded by ADR-0023`): normalised to the template keys; the original string is kept in the Polish source only.
- Title change in translation: file name stays; index uses the H1.
- Slug contains non-ASCII (never, English slugs only): rejected.
- Missing slug-map entry for a new ADR: `adr:new` adds it.

## 11. Acceptance criteria

- [ ] `slug-map.json` has 28 entries and every Polish original file in `docs/pl/adr/` (after OVE_OSS005) maps to exactly one English name.
- [ ] `pnpm adr:new "Use X for Y"` creates `docs/adr/0029-use-x-for-y.md` (next free number) with valid front matter; on a repository where `origin/main` already has 0029 it picks 0030.
- [ ] `pnpm check:adr` passes on the 28 translated ADRs and fails for: gap in numbers, duplicate number, non-mutual supersede link, deleted ADR (fixture), body edit without label (fixture), wrong file name.
- [ ] `pnpm gen:adr-index` produces the table with ADR 0001 shown as superseded by 0023; `--check` fails after a manual edit between markers.
- [ ] `adr:renumber` dry run lists all link rewrites; apply updates them and `check:adr` passes afterwards.
- [x] `docs/adr/README.md` explains the process and the status meanings.

## 12. Test plan

Unit tests for slug creation, next-number computation (fake git: local, main and branch numbers), status transition rules, mutual-link check, index rendering (golden), renumber rewrites (fixture tree). Integration test on a temp git repo for immutability and deletion detection. Commands: `pnpm test -- tools/adr`, `pnpm check:adr`, `pnpm gen:adr-index --check`.

## 13. Parallelization notes

Parallel with OVE_OSS001..005. Translation tasks OVE_OSS010/011 depend on the slug map. Hotspot: `docs/adr/README.md` table (regenerate on conflicts, never merge by hand); new ADRs add their own file only.

## 14. Open questions and assumptions

- ASSUMPTION: ADR dates for the existing 28 come from the project's document creation timestamps (all 2026-10-12 or 2026-10-13); the Owner may correct them.
- ASSUMPTION: the Owner is the sole acceptor of ADRs for now.
- Open question: the extra fields `tags` and `deciders` are additions to the Owner's minimal format; they are optional for the translated originals.

Implementation checkpoint: strict tools, real conforming/denied fixtures and the
25-line template are ready for independent review. The actual repository
`check:adr` and index check still fail on unmigrated legacy ADR 0001 metadata;
source dates are unavailable. No blanket legacy exemption or fabricated
production pass is used. See [the integration and staged-acceptance proposal](../_proposals/OVE_OSS006-integration-and-acceptance.md).
Owner staged acceptance, full repository/CI gates and final independent reviews
remain pending; this task is not done.


Independent review of checkpoint 416e8ca found an archival-rename lifecycle bypass
and Markdown parsing/rewriting gaps. The rename/history and production Git
configuration repairs now pass 4 real-Git integration regressions (3 files,
9.99 seconds) and the pure Git-environment regression. Each fixture Git
subprocess remains isolated; the production port retains normal Owner config.
Markdown indented-heading/comment/fence and titled/angle-link regressions remain
RED pending the approved shared parser integration after OSS004 merges. No new
runtime dependency or unmerged import was added. These repairs are not a final
acceptance/review result; full checks and normal publication remain pending.
