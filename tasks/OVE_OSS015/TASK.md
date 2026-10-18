---
id: OVE_OSS015
title: Close the ADR production index and required validation gates
area: OSS
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_OSS014, OVE_OSS010, OVE_OSS011]
soft_depends_on: []
provides: ["lib:adr-production-validation", "lib:adr-production-index"]
needs: []
owns:
  - docs/adr/README.md
  - docs/i18n/ADR-CLOSURE.md
reads: ["docs/pl/MANIFEST.json", "docs/i18n/map.json", "docs/adr/slug-map.json", "docs/adr/legacy-history.json", "docs/i18n/STYLE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [8, 16, 17]
---

# OVE_OSS015: Close the ADR production index and required validation gates

## 1. Summary

Close OSS006's deferred real production correspondence, whole current/historical ADR validation, generated index and final production renumber/link proof. Activate unconditional required ADR/index CI only after the actual complete migrated collection passes. OSS013 and final Owner translation/publication approval remain separate.

## 2. Context

The Owner-delegated integrator approved the split on 2026-10-18. OSS006 must already prove public allocation/index/renumber on conforming real Git; those immediate requirements are not deferred here. OSS014 supplies separately reviewed finite historical proof and ADR 0029 provenance before translations need them. The acyclic chain is OSS014 -> OSS010/011 -> OSS015 -> OSS013, with OSS005/006 prerequisites of OSS014.

## 3. Scope (in)

- Complete actual source-to-English correspondence and current/history production validation.
- Real generated ADR index, staleness denial and final production correspondence/renumber/link evidence.
- Integrator-applied unconditional required CI commands and protected workflow/aggregate denial proofs.
- Exact recorded complete-candidate provenance and closure evidence in docs/i18n/ADR-CLOSURE.md.

## 4. Out of scope

- Source/import/glossary infrastructure: OSS005; historical-proof algorithm and ADR 0029: OSS014; original two translation halves: OSS010/011.
- Whole-set current-body review/approval checklist: OSS013; publication/owner-approved status: Owner.
- Generic legacy/body exceptions, new decisions, date invention, archived-source or Git-history rewriting.

## 5. Detailed requirements

1. **Normative pre-merge translation coordination.** OSS014 must be normally integrated first. Prepare and independently review both translation halves from that DEVELOP, against exact preserved sources; obtain independent meaning/Spec and Standards reviews before the first translation merge. Neither partial branch is marked done to manufacture readiness.
2. **Complete OSS010 candidate.** Before either translation merge, the integrator assembles the full candidate on OSS010 through an expressly approved OSS011 transfer. Record exact commit/blob provenance and affected-owner approval for all fourteen canonical English files 0015-0028, deletion of their distinct old active Polish paths only after exact OSS005 archive/manifest verification, ALL actual incoming links/definitions across root documentation/instructions, docs and tasks, and only the corresponding fourteen proof-data entries binding exact lineage to the pinned reviewed English hashes BEFORE the first full check/merge. Transfer no OSS011 status/claim, unreviewed file, altered archive or reader/schema relaxation.
3. **Both halves and finite ownership.** OSS010 performs the identical archive/hash verification, old-active-path removal, complete incoming-link rewrite and reviewed English proof work for 0001-0014. Review exact affected path/span sets before authorization; preserve fragments, titles, reference keys and protected code/examples, and never rewrite archived sources. Resolve overlapping links without discarding either half. Actual ownership checks must represent the approved finite changes; obtain a concrete reviewed integration first if they cannot. No ownership/security bypass or unrestricted directory permission is granted; instruction/config changes retain usual labels/reviews. None of these prerequisites can be deferred to this final closure stage.
4. **Validate before first merge.** Run actual complete current AND historical ADR checks, both halves' provenance/parity/security-language/link criteria and all normal exact-head tests/security/hosted gates. Independently review the complete transfer. Failure blocks both merges; no partial-set pass or known-pending allowance substitutes. Rebase/finish OSS010 normally and merge only its exact complete passing head. OSS011 then rebases onto that DEVELOP, proves the exact reviewed bytes already integrated unchanged, retains its claim/TASK history and finishes normally with fresh complete-set/exact-head evidence; its remaining diff may be metadata only. Only both genuine done statuses unlock this task.
5. **Every real record.** Validate the original 0001-0028 correspondence, separate ADR 0029 provenance and all legitimately added current records including English-only 0030. Preserve exact source hashes, initial reviewed translation commit/blob proof, canonical metadata, contiguous unique IDs and reciprocal 0001/0023 supersession. Never invent dates, rewrite decisions or substitute an English-HEAD-only check for historical validation.
6. **Real commands and index.** Run actual public pnpm check:adr against the complete migrated repository/history. Generate docs/adr/README.md using pnpm gen:adr-index, commit that real table and prove pnpm gen:adr-index --check succeeds. Verify actual status/date/tags/titles/links and reciprocal 0001/0023 notes. No fixture placeholder is a production index. Retain real public renumber dry-run/apply/check byte-preservation and denial regressions; validate final production correspondence/links without altering an accepted decision merely for a test experiment.
7. **Required CI closure.** Only after actual full production ADR/index PASS, the integrator makes both commands unconditional in the existing required architecture CI path and updates its protected validator. Preserve all mandatory integrations, security steps and aggregates. Actual failing/removal/allowed-failure/unreachable/skip mutations must reject missing gates and prevent a skipped gate masquerading as success. Normal sensitive configuration ownership, labels and independent reviews remain mandatory.
8. **Both translation cohorts.** Preserve exactly 33 mandatory originals and 28 original ADR mappings plus every approved registered addition, initially ADR 0029. Every hash, parity, stale/missing, current-body review/status and publication check applies to both cohorts; status includes 33 + N rows even when additions are draft/missing/stale/unreviewed. English-only ADRs are not translations, but all current ADRs remain in production validation. Reject duplicate/overlapping/unapproved mappings; never hide additions through filtering or count truncation.
9. **Corrections and evidence.** Later body corrections reset review evidence/status to draft and remain strict failures until actual independent review and required Owner approval. Never replace the initial pinned English history hash to bless current content; accepted/superseded immutable-body rules remain. Unsupported corrections stop for a reviewed decision. Record exact source/candidate/merged hashes, commands/results, reviewers, transfer and all deferred-original-criterion closures in ADR-CLOSURE.md. Keep any failed attempts honestly distinct. OSS013's later current-body whole-set review and the Owner's approval enumerate both cohorts and are not supplied by this task.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Use OSS005 manifest/parity/status, OSS006 strict public tools and shared Markdown spans, and OSS014's reviewed finite historical proof. Reuse existing architecture registry/validator through approved integrator changes; add no parallel permissive checker, dependency or security policy exception.

## 8. Architecture and code placement

Own the final real README/index and explicit closure record; shared CI/configuration edits remain integrator-applied approved integrations. The earlier coordinated translation transfer is performed by its named owners before their merges, not by premature implementation of this task. Generated content is produced only by real tools.

## 9. Security and safety

- Treat repository/history/proof/CLI content as data; no execution or permission grant comes from it.
- Preserve canonical path/symlink/mount/size, command, audit, checksum and immutable-source controls.
- No secrets in diagnostics or records; fixed safe boundary errors remain.
- Required checks fail closed and retain existing protected ownership/labels/reviews; no catch-and-continue, retry/budget relaxation or legacy/current-body waiver.
- Owner primary files, immutable archives, accepted meaning and original history remain untouched.

## 10. Errors and edge cases

- Either translation half unmerged/not done: this task remains unready; never fake status.
- Incomplete source/proof, duplicate active paths or invalid history: actual production validation fails.
- Unreviewed/changed additional translation: visible stale/draft failure and publication denial.
- Generated table edited manually: --check fails.
- Required ADR/index command removed, skipped, unreachable or allowed to fail: CI validator/aggregate refuses success.
- Unsupported superseded-body correction: stop for a reviewed decision, not a relaxed proof hash.

## 11. Acceptance criteria

- [ ] OSS014/010/011 are normally integrated and done; exact reviewed transferred bytes, combined-candidate meaning/provenance and exact-head evidence are recorded without premature completion.
- [ ] Original 0001-0028 and additional 0029 correspondence/metadata/decisions validate; all other current ADR identities and meaning remain intact under the original/additional cohort controls.
- [ ] Actual production pnpm check:adr passes with real historical validation; unknown/tampered history and immutable-body denials still fail.
- [ ] The committed real generated index passes --check, contains correct 0001/0023 notes and rejects a changed table.
- [ ] Public renumber/byte-preservation/link-denial regressions and final production correspondence/link validation pass without editing archives or accepted decisions for a test.
- [ ] Both ADR/index commands are unconditional required architecture gates, with actual failing/removal/allowed-failure/unreachable/skip mutations refused; every prior required integration/security step remains intact.
- [ ] Applicable full tests, types/lint/build/security/dependencies/licenses/audits/secrets/SBOM and exact-head hosted checks pass with independent Spec/Standards reviews, unchanged budgets/assertions/retries/policies.
- [ ] ADR-CLOSURE.md closes every deferred OSS006 production obligation with actual evidence; OSS013 current-body whole-set review and Owner translation/publication approval remain separate until they actually pass.

## 12. Test plan

Run actual production ADR/index commands and complete translated-source parity/status/link checks; compare the committed index with deterministic generation. Preserve public renumber/provenance/body/unknown-proof denials and test all protected workflow/aggregate mutations against actual configuration. Run full applicable normal gates and independent exact-head reviews. Record failures separately, never convert them into PASS by changing limits or scope.

## 13. Parallelization notes

This task starts only after OSS014/010/011 are merged and done; OSS013 additionally depends on this task. The approved translation sequence in section 5 is normative for OSS010/011 before they merge. Coordinate CI edits with their owners/integrator; use normal proposals and protections. No source/import ownership or foreign task status transfers.

## 14. Open questions and assumptions

- Assign one implementer through normal task claim after readiness; source, proof, translation and CI owners retain their explicit roles.
- Initial staging approval authorizes no historical algorithm or publication permission. Unresolved source/meaning/proof decisions remain Owner decisions.
- A current-body fix unsupported by immutable-history rules stops for separately reviewed resolution; no arbitrary future correction is promised valid.
