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

Give architectural decision records a template, a generated index and a lifecycle check, and fix the English file names of the 28 existing ADRs so the translation tasks and all links agree. ADRs are append-only (decisions are superseded, never deleted), in the same spirit as the product's own Decision Register (ADR 0008). The approved 2026-10-18 split accepts only a strictly tested tooling stage here: OVE_OSS014 prepares the historical-proof/ADR 0029 boundary, and OVE_OSS015 closes the real production collection/index/CI after OVE_OSS010/011. No production migration result or historical exception is approved by this split.

## 2. Context

SPEC 19.8 and CONVENTIONS section 8 require new architectural decisions to be recorded as ADRs. The Owner's 28 ADRs are short (one paragraph of decision and reasons, then a "Consequences" list; ADR 0020 also has a prototype confirmation section; ADR 0001 has YAML front matter `status: superseded by ADR-0023` and is replaced by ADR 0023). They are written in Polish with Polish file names; after translation (OVE_OSS005, OVE_OSS010, OVE_OSS011) they live in `docs/adr/` with English names. Parallel tasks will add ADRs (for example OVE_SETUP011 adds the engine packaging ADR) so number allocation must be collision-resistant.

## 3. Scope (in)

- `docs/adr/_template.md`, `docs/adr/README.md` (generated index plus human intro), `docs/adr/slug-map.json`.
- `tools/adr/`: `new.ts` (`pnpm adr:new "<title>"`), `gen-index.ts` (`pnpm gen:adr-index [--check]`), `check.ts` (`pnpm check:adr`), `renumber.ts` (`pnpm adr:renumber <old> <new>`).

## 4. Out of scope

- Translating ADR content: OVE_OSS010 (0001-0014) and OVE_OSS011 (0015-0028).
- Writing new ADRs for other areas (their tasks do).
- A docs website index.
- Source import and actual correspondence: OVE_OSS005; separately reviewed finite historical proof and ADR 0029 provenance/translation: OVE_OSS014. Complete production current/history/correspondence/index/renumber validation and unconditional required ADR/index CI: OVE_OSS015 after OVE_OSS010/011. Conforming real public CLI proof remains immediate here.

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
4. **`pnpm adr:new "<title>"`:** computes the next number as max(numbers in `docs/adr/` on the current branch, numbers in `origin/DEVELOP`, and numbers in files added by open `task/*` branches found with `git ls-remote` + `git diff --name-only`) + 1, zero-pads to 4 digits, derives a kebab-case ASCII slug (max 6 words, 60 characters), writes the template with filled front matter (status `proposed`, today's date from an injected Clock), prints the path. It refuses when the number already exists. Concurrent allocation can still collide; `check:adr` catches it in CI and `adr:renumber <old> <new>` renames the file, updates the front matter and rewrites links to it across `docs/` and `tasks/` (dry run by default).
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

- [ ] `slug-map.json` contains the exact 28 original identities, canonical English slugs and preserved Polish names, separately from later ADRs; schema and duplicate/identity-denial fixtures pass.
- [ ] The template is shorter than 60 lines, contains documented ADR/translation metadata, and the process README explains lifecycle, publication limits and the actual incomplete migration.
- [ ] The real public allocation CLI creates a valid next-free proposal in an isolated conforming Git repository, independently accounts for local, freshly fetched DEVELOP and remote task reservations, and refuses collisions/unavailable remote state without modifying existing ADRs.
- [ ] The strict checker passes a conforming collection and rejects malformed metadata/JSON, gaps, duplicates, invalid names/references, deletion, unpreserved rename, invalid lifecycle transitions and unauthorized accepted/superseded body changes, including real Git history and filesystem boundaries.
- [ ] Real public index generation then --check succeeds on a conforming repository and rejects a changed table; real renumber dry-run preserves every input byte, apply preserves protected examples/archives and rewrites all affected links, and the strict checker passes afterwards.
- [ ] Actual unmigrated production ADR/index failures are recorded with all original production obligations allocated to OVE_OSS005/014/010/011/015 below; no legacy-pass mode, invented dates, fixture index or false migration/publication success exists.
- [ ] All applicable exact-head tests, type/lint/build/security and independent Standards/Spec reviews pass, required hosted checks pass, and normal task/commit/merge protections remain in force.

## 12. Test plan

Unit tests for slug creation, next-number computation (fake git: local, DEVELOP and branch numbers), status transition rules, mutual-link check, index rendering (golden), renumber rewrites (fixture tree). Integration test on a temp git repo for immutability and deletion detection. Commands: `pnpm test -- tools/adr`, `pnpm check:adr`, `pnpm gen:adr-index --check`.

## 13. Parallelization notes

Approved sequence: OSS006 tooling -> OSS005 + OSS014 historical preparation -> complete reviewed OSS010/011 candidate -> OSS015 production closure -> OSS013 final review -> separate Owner publication approval. OSS014 depends on OSS005/006; OSS010/011 additionally depend on OSS014; OSS015 depends on OSS014/010/011; OSS013 additionally depends on OSS015. No readiness or partial-set bypass is permitted. See the full coordinated transfer contract in [OSS015](../OVE_OSS015/TASK.md).

Parallel with OVE_OSS001..005. Translation tasks OVE_OSS010/011 depend on the slug map. Hotspot: `docs/adr/README.md` table (regenerate on conflicts, never merge by hand); new ADRs add their own file only.

## 14. Open questions and assumptions

- ASSUMPTION: ADR dates for the existing 28 come from the project's document creation timestamps (all 2026-10-12 or 2026-10-13); the Owner may correct them.
- ASSUMPTION: the Owner is the sole acceptor of ADRs for now.
- Open question: the extra fields `tags` and `deciders` are additions to the Owner's minimal format; they are optional for the translated originals.

The following checkpoint paragraphs are retained historical evidence at their stated revisions. Their then-pending scope approvals were superseded by the integrator's Owner-delegated 2026-10-18 decision; failed commands remain failures. No criterion is checked or status advanced by that decision.

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

The rebased shared-parser correction has now demonstrated actual focused
RED-to-GREEN: the original five Markdown failures and a separately reproduced
raw-HTML heading failure are corrected. The named batch passed 20 tests across
five files in 1.33 seconds, including exact original-source spans, reference-key
preservation, denied ambiguous destinations, dry-run identity and refusal to
modify archived Polish source. Unrelated tests were explicitly skipped; full
shared regressions, type/lint/security checks and fresh independent reviews
remain pending. The strict production legacy-metadata failure and unapproved
Owner staged acceptance remain blockers. Detailed captures and fixture
corrections are recorded in the integration proposal.

Subsequent actual validation passed full typecheck, full lint and changed-source
formatting. The complete shared docs/ADR unit batch passed 75 and failed two
5000 ms deadlines (inherited documentation Git isolation and this task's real
CLI safety integration); no retry or budget relaxation was applied. Five actual
ADR integrations passed across four files in 25.22 seconds. Both strict public
ADR/index commands still exit 1 on legacy ADR 0001 metadata. A proposed
byte-preserving classification with mandatory hosted execution is recorded for
the real CLI safety test; it is not applied or approved yet. These failures,
remaining exact-head gates/reviews and Owner staged acceptance still block
completion.

Independent specification review found an omitted proposal-body self-link during
renumbering. A meaningful real dry-run/apply regression reproduced the broken
old filename before implementation; the existing span rewriter now updates the
proposal body before rendering. Both affected test files passed nine tests in
1.07 seconds while preserving the fragment, title, inline-code example and exact
dry-run bytes. This focused repair does not resolve the previously recorded
timeouts, legacy migration failure or pending Owner acceptance. Fresh review of
the corrected exact head remains required.

Independent standards review also reproduced disclosure of malformed slug-map
and event-label JSON through the public CLI error diagnostic. Two actual CLI
regressions first failed their privacy assertions, then passed after each JSON
parse boundary replaced parser/schema details with its own fixed safe message.
The same one-worker run passed both cases in 987 ms with unchanged child and
per-test limits. Generated input is never printed by the assertions. Scoped
strict TypeScript, lint and formatting passed; full gates and independent review
of this correction remain pending with the existing acceptance blockers.

The complete gate attempt at `6960b09`, using one coverage/integration worker
with unchanged assertions, limits and thresholds, passed 539 covered tests,
70 integrations and the build. Architecture validation then correctly rejected
the pending-link entry for the ADR README now created by this task; later
security/Rust/SBOM gates were not reached. The integrator approved removing only
that stale entry, retaining the other three and strict stale-entry enforcement.
This is a narrow integration repair, not a complete-gate or acceptance pass.
After the correction, actual `pnpm check:docs` passed with zero errors and
38 warnings, and scoped JSON formatting passed.

The actual complete-gate attempt at `00ff7c4` passed 539 covered tests, 70
integrations, build, architecture/workflow, npm license/audits and Rust
license/source/bans/fmt/Clippy/33 tests, then failed while downloading the pinned
cargo-audit archive (`UND_ERR_SOCKET`). The failed run is preserved. After an
exclusive byte-identical copy of an existing archive verified against the same
locked checksum, the original installer and only the failed/unreached gates
passed: cargo-audit, actual manifest-schema selection, both secret scans and
SBOM. This is a complementary continuation PASS, not an original `pnpm check`
PASS. Actual production ADR/index commands separately still exit 1 on legacy0001.

New actual public CLI coverage first exposed a 3000 ms deadline on the complete
31-published-record fixture. A one-time content-free Git diagnostic proved
repeated immutable tree reads. An invocation-local successful-read cache retains
at most 32 trees and 4 MiB of UTF-16 text accounting; it changes no history,
transition, label or error checks. With the same fixture/assertions/3 s child and
15 s test limits, both actual allocation and renumber/index/check CLI cases
passed in 11.22 seconds. Full typecheck/lint and source formatting then passed;
seven ADR integrations passed in 22.45 seconds and 76 shared ADR/docs unit tests
in 6.68 seconds. Fresh independent review and all exact-new-head gates remain
required. Current criteria, status and pending Owner acceptance are unchanged.

Fresh Spec review identified that one remote task reservation dominated the
earlier allocation case, so it could not independently prove the lower local
and DEVELOP sources. Two additional actual CLI cases now prove local-highest
37 selects 38, and a separately pushed remote DEVELOP 44 is fetched to select
45 while the local checkout stays unchanged. All four public CLI cases passed
in 17.51 seconds with the original limits and one worker. Only test coverage and
factual evidence changed; formatting, full typecheck and scoped lint passed.
Fresh exact-head reviews/gates and Owner scope acceptance remain pending.


Approved tooling-stage allocation (2026-10-18): original criterion 1's fixed map is immediate, while actual imported-source correspondence is OSS005/010/011 and final OSS015 validation. Original criterion 2 is immediate public allocation (historical 0029/0030 examples mean next-free, not overwriting existing records). Original criterion 3's denied-case tooling proof is immediate; actual complete production current/history PASS belongs to OSS014 preparation plus OSS010/011 inputs and OSS015 closure. Original criterion 4's conforming public generation/staleness proof is immediate, while the actual production table/0001-0023 notes are OSS015. Original criterion 5's conforming public dry-run/apply/check is immediate; final migrated production correspondence/renumber/link validation is OSS015. Original criterion 6's README is immediate. No obligation is erased or represented as completed by allocation.

Exact source a3f6a3ec9ef05583bd4f0d5b41efccd7c8ad8b73 passed the original applicable gate list once using the approved one-worker coverage/integration scheduling: 539 covered tests, 74 integrations, four architecture CLI cases, 33 Rust tests, types/lint/format/build, npm/Cargo license/audit/source/bans, workflow, secrets and SBOM (886 components). Original installer and actual Zod readManifest conditional selection ran. Production npm audit had no findings; development audit retained one LOW finding and Cargo retained five allowed warnings. Both secret scans found zero with one Keychain warning each. The earlier failed00ff attempt remains separate; this fresh run exited0. Independently, actual check:adr and gen:adr-index both exited1 at legacy ADR0001; no production migration PASS is claimed. Captures: ove026-full-gates-a3f6a3e.log/receipts/controller-result and ove026-gates-and-legacy-a3f6a3e.final-result under the retained session evidence directory. This new normative metadata delta needs its own reviews and exact-head gates before normal finish/merge; status stays in_review and all current criteria remain unchecked pending integrator verification.
