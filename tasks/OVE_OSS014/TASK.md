---
id: OVE_OSS014
title: Bridge legacy ADR history and preserve ADR 0029 provenance
area: OSS
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_OSS005, OVE_OSS006, "OVE_OSS016"]
soft_depends_on: []
provides: ["lib:adr-history-proof", "lib:adr-0029-translation"]
needs: []
owns:
  - docs/pl/adr/0029-backlog-w-github-issues-i-ochrona-master.md
  - docs/adr/0029-backlog-w-github-issues-i-ochrona-master.md
  - docs/adr/0029-github-issues-backlog-and-master-protection.md
  - docs/adr/legacy-history.json
  - tools/adr/history.ts
  - tools/adr/legacy-history.parse-boundary.ts
reads: ["docs/pl/MANIFEST.json", "docs/i18n/map.json", "docs/adr/slug-map.json", "docs/i18n/STYLE.md", "docs/GLOSSARY.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [8, 16, 17, 29]
---

# OVE_OSS014: Bridge legacy ADR history and preserve ADR 0029 provenance

## 1. Summary

Prepare the finite historical-proof boundary needed before translations can pass strict ADR history validation. Preserve and translate ADR 0029 with evidenced source/date/status, immutable archival provenance and independent Polish/English meaning review. This stage neither validates the complete migrated production collection nor activates its final CI gates.

## 2. Context

The Owner-delegated integrator approved this bounded split on 2026-10-18 under ADR 0016. OSS006 supplies strict tools; its historical reader parses old Git blobs, so translating HEAD cannot repair missing historical metadata. OSS005 imports exactly 33 original sources ending at ADR 0028; ADR 0029 is an explicitly registered addition, while English-only ADR 0030 is not a translation. ADR 0008 still forbids erasing decision history.

## 3. Scope (in)

- Independently designed finite proof schema/data/reader and real pinned-history denial tests.
- ADR 0029 exact source/archive/date/status, canonical English successor and removal of its distinct old active path after verification.
- Approved OSS005-owner manifest/import mapping, configuration protection and finite incoming-link integrations.

## 4. Out of scope

- Original ADR 0001-0028 translations: OSS010/011; source-import infrastructure and glossary: OSS005.
- Final actual production correspondence/index/required CI closure: OSS015; whole-set review: OSS013; final translation/publication approval: Owner.
- Product runtime, history rewrite, invented dates, new decisions, dependencies or a generic legacy/current-body waiver.

## 5. Detailed requirements

1. **Evidence first.** Obtain exact approved Owner source/export and verifiable date/status evidence for ADR 0029. Archive bytes at its owned docs/pl path and coordinate its manifest/map registration with OSS005. Preserve original 33/28 cohort identities; register 0029 separately. Missing/conflicting evidence blocks affected work for an explicit Owner source decision; neither Git commit time nor today's date substitutes silently.
2. **Design before reader changes.** Independently review the finite proof schema and algorithm for docs/adr/legacy-history.json before implementation. Inventory same-number revisions from actual pinned Git history. Bind exact commit/path/blob/content hashes to evidenced metadata, lineage and preserved body bytes. Complete history coverage and meaningful lifecycle/immutability must remain checkable; Git history is never rewritten.
3. **Deny uncertainty.** Unknown/omitted revisions, duplicate identity, unavailable/changed proof/archive, wrong provenance and unproved date/status fail closed. No prefix skip, date cutoff, label-only authorization, catch-and-continue or generic legacy flag is permitted. Split approval does not approve the future algorithm.
4. **Translation boundary.** Bind exact source hashes, independently reviewed meaning and the initial reviewed English body hash to its exact translation commit/blob BEFORE validation. Accepted-body translation remains an explicit reviewed edit. A superseded source needs a specifically reviewed boundary preserving immutable raw source; ordinary lifecycle/body rules apply afterwards. A label must never authorize arbitrary decision changes.
5. **Later corrections.** Never replace initial pinned proof to bless current content. Corrections reset current-body review evidence/status to draft and remain strict failures until actual independent review and required Owner approval; accepted/superseded immutable-body rules still apply. Unsupported corrections stop for a reviewed decision, without promising arbitrary translation fixes can pass.
6. **Archive and links.** Remove the old active Polish ADR 0029 path only after exact archival/hash verification and mapping to its existing canonical English identity. No duplicate active same-number record may remain. Review the finite path/span plan and affected-owner approval for ALL actual incoming links/definitions across root documentation/instructions, docs and tasks; preserve fragments, titles, reference keys and protected code/examples. Archives are never rewrite input. Instruction/configuration edits retain their normal labels/reviews.
7. **Both cohorts.** Use OSS005's amended original-plus-registered-additions contract for mapping/import/status/parity/publication. Both cohorts receive every hash, stale/missing, parity, current-body review and publication check. No status filter, fixed-count truncation or ignored unknown entry may hide ADR 0029. Real denials cover missing additional source/English file, changed hashes and unreviewed/changed additional bodies.
8. **Protection and hand-off.** Coordinate proof/reader/configuration protection and actual negative regressions with their owners/integrator; preserve every prior guard. Assign an independent Polish-capable meaning/Spec reviewer who did not implement ADR 0029 and an independent Standards/security reviewer before pre-merge review, without depending on OSS013. Strictly validate actual pinned history plus conforming translated fixtures; record incomplete live-collection findings honestly. OSS010/011 later populate only their bounded reviewed English proof entries before their first complete-candidate check; OSS015 cannot defer or substitute for that prerequisite.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Reuse OSS006 parsing/lifecycle/Git ports and its slug map, OSS005 manifest/import/parity/status contract, and the shared Markdown destination spans for actual link edits. Use existing bounded canonical/nonblocking readers and real Git fixture isolation; introduce no second permissive checker or copied parser. The exact proof algorithm requires its own review.

## 8. Architecture and code placement

Tools remain development-only with pure proof validation and I/O at existing ports. Owned exact paths above are sequential edits after OSS005/006, not unrestricted ownership of their directories. Manifest/map, finite link files and sensitive configuration changes are coordinated through explicit approved affected-owner proposals and normal checks, never a scope bypass.

## 9. Security and safety

- Treat all sources, proof records and history as untrusted data; execute none of their contents.
- Canonicalize and enforce symlink/mount/size bounds; keep subprocess argv bounded and shell-free, and all fixture Git calls isolated.
- Protect originals/proof/reader against silent edits; preserve existing configuration labels/CODEOWNERS and real negative gates.
- No secret values in evidence or diagnostics. Use fixed safe errors; append-only audit applies when its mechanism exists.
- No Owner primary files, immutable archive bytes, accepted meaning or original Git history may be overwritten.

## 10. Errors and edge cases

- Missing/conflicting source date/status: stop affected migration for an Owner source decision.
- Missing/tampered/unknown proof or historical revision: deny, without fallback to current text.
- Same-number old/new active paths: deny until verified archival and exact old-path removal.
- Accepted/superseded unauthorized body change on either side of translation: deny.
- Later unreviewed correction: stale/draft failure, never repaired by silently repinning proof.
- Other legacy ADRs still lack conforming current inputs: retain actual live failure, not whole-collection PASS.

## 11. Acceptance criteria

- [ ] ADR 0029 has exact archived approved source, verified manifest/hash/date/status evidence, its existing mapped English identity and independent pre-merge Polish/English meaning review; original sources and Owner files are unchanged.
- [ ] Its distinct old active path is removed only after verified archival; every actual incoming link resolves, proof pins the reviewed English commit/blob/hash before validation, and no duplicate active identity remains.
- [ ] Finite proof schema/reader receives independent Spec, Standards and security review; actual pinned history and conforming translated fixtures demonstrate meaningful lifecycle/body checks without history rewriting.
- [ ] Real Git regressions reject changed source/body/archive/proof, omitted/unknown history, wrong identity/provenance and unauthorized accepted/superseded edits/transitions before and after translation.
- [ ] Both translation cohorts retain hash/parity/stale/missing/review/publication controls; missing or changed additional source/English bodies visibly deny rather than disappearing from status.
- [ ] New proof/reader protection and negative regressions pass while every existing guard remains intact.
- [ ] Applicable full tests, types/lint/build, security/dependencies/licenses/audits/secrets/SBOM, exact-head hosted gates and independent reviews pass without policy/budget/assertion/retry relaxation; incomplete live migration is recorded honestly.
- [ ] Normal integration precedes dependent translation validation; no live whole-collection/index PASS, OSS015 completion or publication approval is claimed.

## 12. Test plan

First review the exact proof schema/algorithm. Use actual pinned production history and disposable conforming real-Git translations for positive and denial cases, with original child/test budgets. Exercise the public ADR CLI and both source/English manifest cohorts. Run applicable normal tests, typecheck/lint/build and security gates; separately record the actual production check:adr/index outcome. Review ADR 0029 side by side with its preserved Polish source.

## 13. Parallelization notes

Hard dependencies are OSS005/006 only; never add completed OSS010/011 or OSS013 as prerequisites. Both translation halves depend on this task. The coordinated complete-candidate transfer and normal merge/finish order are normative in [OSS015 section 5](../OVE_OSS015/TASK.md#5-detailed-requirements). Source/archive and proof changes require assigned owner review; no active task claim or status is transferred.

## 14. Open questions and assumptions

- The exact proof algorithm remains a separate design/security decision; this task assignment approves no exception mechanism.
- The implementer is selected through normal atomic claim after dependencies pass. Assign independent Polish-capable Spec/meaning and Standards/security reviewers before reviewing ADR 0029; OSS013 is a later whole-set review, not a prerequisite.
- If exact Owner source/date/status is unavailable, keep affected work blocked; do not invent evidence.
