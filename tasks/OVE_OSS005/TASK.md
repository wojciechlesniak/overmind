---
id: OVE_OSS005
title: Translation process, Polish originals import and bilingual glossary (ADR 0017)
area: OSS
kind: docs
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP001, OVE_OSS004]
soft_depends_on: [OVE_OSS006, OVE_SETUP005]
provides: ["lib:translation-process", "lib:glossary-bilingual", "lib:polish-originals", "lib:docs-i18n-check"]
needs: []
owns:
  - docs/pl/**
  - docs/GLOSSARY.md
  - docs/glossary/**
  - docs/i18n/**
  - tools/glossary/**
  - tools/docs-i18n/**
reads: ["tasks/CONVENTIONS.md", "tools/docs-check/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [16, 17]
---

# OVE_OSS005: Translation process, Polish originals import and bilingual glossary (ADR 0017)

## 1. Summary

Prepare everything needed to translate the Owner's Polish project documentation into English without losing meaning or authority: import the Polish originals verbatim into `docs/pl/` with a hash manifest, define the translation front matter and structural parity rules, build the `docs-i18n` checks (drift, parity, term consistency), and produce the bilingual glossary (`docs/GLOSSARY.md`) from a single data file. The actual document translations are tasks OVE_OSS008..013; OVE_OSS014 separately registers and translates ADR 0029 under the approved original/additional cohort contract below.

## 2. Context

ADR 0017: code, repository, documentation and default UI are English; the existing Polish project documentation will be translated before the repository is published; the glossary gets names in both languages. ADR 0016: the Owner's documentation is the source of truth; nothing is added by agents on their own initiative. Consequence: translations must be faithful, reviewable and traceable to an exact version of the Polish source, and must not become a second, diverging source. The fixed original cohort contains 33 project documents: `docs/SPECIFICATION.md` (v1.4), `claude/GLOSSARY.md`, `docs/design/styl-wizualny.md`, `docs/research/herdr-analiza.md`, `docs/research/prototyp-wnioski.md`, and 28 ADRs `docs/adr/0001..0028-*.md` (ADR 0001 is superseded by 0023 and has YAML front matter `status: superseded by ADR-0023`). The CONVENTIONS section 10 table already maps the main Polish terms to their English names; this task extends it to the whole glossary. The Polish glossary entries each have a definition and an "Unikaj" (avoid) list that doubles as a list of forbidden synonyms.

## 3. Scope (in)

1. Import of the fixed 33 Polish originals into `docs/pl/` (verbatim) with `docs/pl/MANIFEST.json`, plus separately approved registered additional sources under the same controls (initially ADR 0029, coordinated by OVE_OSS014).
2. Translation front matter schema, status model and file/slug naming rules (`docs/i18n/README.md`).
3. `tools/docs-i18n/` (`pnpm check:docs --i18n`, `pnpm docs:import-pl`, `pnpm docs:status`).
4. Glossary data `docs/glossary/terms.yaml` and generator `tools/glossary/` producing the bilingual `docs/GLOSSARY.md` and `docs/glossary/terms.json`; glossary term-consistency check.
5. Translation style guide for authors and reviewers.

## 4. Out of scope

- Translating SPECIFICATION, ADRs, research and design docs: OVE_OSS008..012. Consistency review pass: OVE_OSS013.
- ADR slugs and index: OVE_OSS006 (this task consumes the slug map).
- UI string translation (i18n infrastructure and Polish UI translation): OVE_ARCH011 and feature tasks.
- Machine translation services: not used by tooling; authors may use AI assistance but the result is human-reviewed (Owner speaks Polish and approves).

## 5. Detailed requirements

1. **Import of originals.** For each of the fixed 33 original documents and every explicitly registered additional translation source write the exact content (as returned by the Projects tool `project_read`) to `docs/pl/<relative path>` where the relative path equals the repository path except `claude/GLOSSARY.md` which becomes `docs/pl/GLOSSARY.md`. Files are byte-for-byte (UTF-8, LF, final newline preserved as returned). `docs/pl/MANIFEST.json`: `{ "schema": 1, "importedFrom": "Owner project 'Overmind'", "files": [ { "path": "docs/pl/adr/0005-engine-niezalezny-od-okna.md", "sha256": "...", "englishPath": "docs/adr/0005-engine-independent-of-window.md", "projectCreatedAt": "2026-10-12T16:52:02Z" } ] }` sorted by path. The importer `pnpm docs:import-pl --from <dir>` (for later updates: the Owner exports a folder; the tool copies changed files, updates the manifest, and marks the matching English files stale in its report). `docs/pl/**` is excluded from Prettier, markdownlint, header checks (REUSE annotation), and ESLint. A banner is NOT added to originals.
2. **English file naming.** English documents keep the same folder structure; ADR file names use the English slugs from OVE_OSS006; `styl-wizualny.md` -> `docs/design/visual-style.md`; `herdr-analiza.md` -> `docs/research/herdr-analysis.md`; `prototyp-wnioski.md` -> `docs/research/prototype-findings.md`; `claude/GLOSSARY.md` -> `docs/GLOSSARY.md`. The mapping lives in `docs/i18n/map.json` (generated into the manifest's `englishPath`).
3. **Translation front matter (YAML, first lines of each English translation):** `translation_of` (path under `docs/pl/`), `source_sha256` (hash of that Polish file at translation time), `translated_on` (date), `status` (`draft` | `reviewed` | `owner-approved`), `translator` (name or "AI-assisted: <model> + reviewer <name>"), `notes` (optional). ADR files merge this with the ADR front matter of OVE_OSS006 (`status` of the ADR itself is named `adr_status` in translated ADRs to avoid collision; OVE_OSS006 handles the field name in the template: ADR `status` stays `status`, translation state is `translation_status`). Final key names: `translation_of`, `source_sha256`, `translated_on`, `translation_status`, `translator`. Documents with no Polish original (new English-only docs) have no such keys.
4. **Status model.** `draft`: written, unreviewed (blocks publication). `reviewed`: a second person or agent compared with the original (checklist in the style guide) and the structural checks pass. `owner-approved`: the Owner (Polish speaker) confirmed the meaning (recorded by the Owner's approval on the PR; the front matter is changed by the PR). Publication (`check:docs --publish`) requires all translated docs to be at least `reviewed`; the Owner's final approval of the whole set is a separate release step recorded in `docs/i18n/APPROVAL.md` (date, commit, who).
5. **Structural parity checks (`pnpm check:docs --i18n`).** For every English file with `translation_of`: (a) the Polish file exists and its current SHA-256 equals `source_sha256` (otherwise `stale translation`); (b) heading tree identical in count, level and order (text may differ, numbering such as "## 3." identical); (c) the same number of tables, table rows and columns; (d) code blocks and Mermaid blocks identical after allowing translation of quoted labels only inside Mermaid node text (rule: identifiers and arrows equal; a per-block allow-list comment `<!-- i18n: labels-translated -->` permits text differences); (e) same set of link targets after path mapping (ADR links updated to English slugs); (f) same ADR numbers and `SPEC` section numbers mentioned; (g) same count of list items per list; (h) paragraph count within +-10% as a smell warning. Failures are errors except (h).
6. **Term consistency.** The glossary check scans English prose (outside code spans/blocks) for forbidden synonyms: the `avoid_en` list of each term (for example for Agent: "bot", "worker", "assistant"; for Run: "execution", "job"; for Task: "ticket", "issue"; for Workspace: "project", "folder"; for Workflow: "pipeline", "diagram", "flow"; for Node: "block", "step"; for Allowed Directory: "whitelist"; for Approval: "confirmation"). Exceptions: quoted text, the glossary file itself, `ADR`/spec passages that explain what to avoid, and an explicit `<!-- i18n-ignore-term: X -->`. The check also requires that capitalised glossary terms appear capitalised (Owner, Chief, Workspace, Run, Node, Skill, Task Board, Lane, Approval, Access Request, Global Pause...). Generic words like "task" in "Task" (domain) vs generic usage are disambiguated by capitalisation: the check only enforces capitalisation when the surrounding text is a glossary phrase (multi-word terms) and otherwise reports a warning.
7. **Bilingual glossary.** `docs/glossary/terms.yaml`: one entry per term: `id`, `group` (People and agents, Work, Capabilities and models, Permissions, Channels, Memory), `en` (primary English term, matching CONVENTIONS section 10 and the TypeScript type name), `pl` (Polish term from the Owner's glossary), `code` (type or identifier name or null), `definition_en`, `definition_pl` (verbatim from the Owner's glossary), `avoid_en` [list], `avoid_pl` [list from "_Unikaj_"], `see` [ids], `source` ("owner" for terms from the Owner's glossary, "derived" for English-only additions, which are limited to the ones in CONVENTIONS section 10), `status` as for translations. All terms from the Polish glossary are included (about 50) with exact Polish text; the English definitions are translations flagged `draft` until reviewed. The generator writes `docs/GLOSSARY.md` as: intro paragraph (translated), then per group a table `English | Polish | Definition | Avoid`, followed by the Polish definition in a collapsible `<details>` block per term (so the Polish text stays visible and checkable), and writes `docs/glossary/terms.json` for other tools (i18n lint in OVE_ARCH011, docs checks). `pnpm gen:glossary --check` verifies the committed Markdown equals generation.
8. **Style guide `docs/i18n/STYLE.md`:** meaning over word order; keep sentence boundaries where possible; use glossary English terms exactly; keep identifiers, code, file names and ADR numbers unchanged; preserve emphasis, lists and tables; do not add or drop content (no summarising); keep Polish product names (e.g., "Grok Bot") as is; translate UI copy quotes in the design doc only if the doc says they are UI strings, otherwise keep the Polish quotation with an English gloss in parentheses; dates ISO; decimal separators; the legend USTALONE / PROPONOWANE / OTWARTE becomes FIXED / PROPOSED / OPEN consistently (mapping table in STYLE.md; the specification's own legend is translated by OVE_OSS008 using this table); ASSUMPTION marker is `ASSUMPTION` as in CONVENTIONS. Reviewer checklist: structure parity pass, glossary pass, number/date/version pass (all numbers equal), links pass, meaning spot-check of 10 passages against the original.
9. **`pnpm docs:status`:** enumerate all 33 original translations plus every explicitly registered additional translation (33 + N rows), including missing, draft, stale and unreviewed entries. Report Polish/English paths, translation_status, freshness and reviewer. No status filter, fixed-count truncation or ignored unknown mapping may hide an addition. ADR 0029 is the initial approved addition owned by OVE_OSS014; registration follows this task's source/import contract, so N is zero until an addition is actually registered. Planning approval is not evidence of an imported source. Once registered, an entry cannot disappear because its files or review are missing. English-only ADR 0030 is not a translation. Keep the original 28 ADR map distinct from additions and the complete current ADR set. All source/English hashes, staleness, missing-file, parity, review/status and publication controls apply to both cohorts; reject duplicate/overlapping mappings and unapproved additions.
10. **CI wiring:** `check:docs --i18n` runs in the `architecture` job once any translation exists (guard by file existence), and `--publish` is the gate before making the repository public (a manual Owner action, documented).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Extends `tools/docs-check` (OVE_OSS004) without editing it: the OSS004 runner auto-discovers extra check modules at `tools/docs-*/check.ts` (extension point), and this task provides `tools/docs-i18n/check.ts`. Uses the area/term table of CONVENTIONS section 10 as the seed of the glossary data.

## 8. Architecture and code placement

Data: `docs/glossary/terms.yaml` (single source for the bilingual glossary). Generated: `docs/GLOSSARY.md`, `docs/glossary/terms.json`. Tools: `tools/glossary/` (load, validate with zod, render), `tools/docs-i18n/` (manifest, importer, parity, drift, term check). All pure functions with file I/O at the edge.

## 9. Security and safety

- Documents are untrusted text for tools: parsed as data; no HTML execution; the importer refuses paths outside `docs/pl/` (no `..`), refuses symlinks and files over 2 MiB.
- Integrity: hashes in the manifest and in each translation tie the translation to an exact source version, preventing silent drift (and silent insertion of new requirements, which would violate ADR 0016: agents add nothing from their own initiative; a translation that adds content fails the parity check).
- Source-of-truth protection: `docs/pl/**` is CODEOWNERS-protected (Owner only) and excluded from automated reformatting; the manifest check fails if an original changes without the manifest being updated by the importer.
- The glossary's "Avoid" lists carry security meaning (for example "Approval" vs "confirmation" vs "Access Request"); mistranslating Approval/Access Request/Effective Permissions in a security document is a defect (listed in the reviewer checklist).
- AI-assisted translation may hallucinate; mandatory review and the structural checks mitigate; translator field records the assistance.
- No personal data: the Owner's name or paths appear only if they are in the originals; the docs checker (OVE_OSS004) still rejects local absolute paths in English docs (Polish originals are exempt but reviewed once for private data before publication; findings go to the Owner).

## 10. Errors and edge cases

- Polish source updated after translation: `stale translation` error; a new translation task is opened for the diff (process in `docs/i18n/README.md`: re-translate changed sections, update `source_sha256`).
- ADR 0001 has YAML front matter: the translation keeps its keys and adds the translation keys; parity check treats front matter separately.
- Original uses Polish quotation marks or non-breaking spaces: preserved in `docs/pl/`, normalised to straight quotes in English.
- Tables with Polish-only cell content (UI copy): translated or glossed per style guide; parity checks only structure.
- A term absent from the glossary (new term): must be added to `terms.yaml` first (SPEC 19.8); the term check warns when capitalised unknown multi-word terms appear.
- The Owner edits Polish docs in the Project while translation is in flight: the importer reports mismatch; the translation PR is rebased on the new source.
- `claude/GLOSSARY.md` has no English counterpart text: all English definitions are new translations, flagged draft.

## 11. Acceptance criteria

- [ ] `docs/pl/` contains the exact 33 original sources plus every explicitly registered additional source, byte-identical to approved sources; manifest hashes verify and `pnpm docs:status` enumerates all 33 + N translations, including every missing/draft row. The ADR 0029 addition is coordinated with OVE_OSS014, not silently treated as one of the original 33.
- [ ] `docs/GLOSSARY.md` is generated from `terms.yaml`, contains every term of the Polish glossary with English and Polish names, both definitions, and avoid lists; `pnpm gen:glossary --check` passes.
- [ ] Every term in CONVENTIONS section 10 appears in `terms.yaml` with the same English name.
- [ ] Given an English translation whose Polish source hash changed, `check:docs --i18n` reports a stale translation.
- [ ] Given a translation with one heading missing, one extra table row, or a changed code block, the parity check fails with the location.
- [ ] Given English text using "ticket" for a Task or "bot" for an Agent, the term check reports it; with the ignore comment it passes.
- [ ] `docs/i18n/README.md` documents the process (import, translate, review, approve, drift) and `STYLE.md` contains the legend mapping and reviewer checklist.
- [ ] `pnpm docs:import-pl` with an unchanged folder changes nothing; with one modified file updates the manifest and lists the affected English file.

## 12. Test plan

Unit tests: manifest build/verify, importer path safety, heading/table/code/link parity on fixture pairs, stale detection, term check with positive/negative cases, glossary schema validation (zod) and generator golden test on a 3-term fixture. Integration: run the generator on the real `terms.yaml` and compare to the committed Markdown. Manual: a second person spot-checks 10 glossary definitions against the Polish text (recorded in the PR). Commands: `pnpm test -- tools/glossary tools/docs-i18n`, `pnpm gen:glossary --check`, `pnpm check:docs --i18n`, `pnpm docs:status`.

## 13. Parallelization notes

First task of the OSS translation chain: OVE_OSS008..013 depend on it (they need `docs/pl/`, the front matter schema, the checks and the glossary). Parallel with OVE_OSS006 (ADR slugs). Hotspots: `docs/glossary/terms.yaml` (translation tasks that discover a missing term add it through a proposal to this file's owner or a small additive PR; terms.yaml is sorted by id to ease merges).

## 14. Open questions and assumptions

- Approved coordination (2026-10-18): preserve the original 33-source/28-ADR cohort; OVE_OSS014 owns ADR 0029 provenance/translation and coordinates its exact manifest/import mapping with this owner. The same checks apply to additions, including changed hash/body, missing source/English file and publication denial until actual review. No archive rewrite or invented date is approved.

- ASSUMPTION: Polish originals are authoritative until the Owner marks English documents `owner-approved`; afterwards the English text becomes the working text and the Polish copy stays as an archived original (decision recorded in `docs/i18n/APPROVAL.md`). The Owner may prefer to keep Polish canonical; the tooling supports both.
- ASSUMPTION: the Polish originals are imported once at the start and refreshed by the importer on request; there is no live sync with the Project.
- Open question: should `docs/pl/` ship in the public repository? Default yes (transparency, ADR 0017 says the Polish docs are translated, not deleted).
- Open question: who is the second reviewer besides the Owner; default: an AI reviewer pass followed by the Owner's approval.
