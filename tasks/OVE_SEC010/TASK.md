---
id: OVE_SEC010
title: Write the threat model with complete trust-boundary and risk analysis
area: SEC
kind: docs
size: S
priority: P0
mvp: true
status: done
depends_on: [OVE_ARCH001]
soft_depends_on: []
provides: ["doc:threat-model-analysis"]
needs: []
owns: ["docs/security/THREAT-MODEL.md"]
reads: ["tasks/OVE_SEC001/TASK.md", "docs/SPECIFICATION.md", "docs/architecture/ARCHITECTURE.md", "docs/security/THREAT-MODEL.md", "docs/security/requirements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 8", "SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 17"]
adr_refs: [3, 4, 6, 10, 12, 20, 21, 22, 26, 27]
---

# OVE_SEC010: Write the threat model with complete trust-boundary and risk analysis

## 1. Summary

Deliver the bounded document allocated below from OVE_SEC001. The parent retains its full acceptance criteria and final cross-document review; this task does not complete the parent or accept residual risks.

## 2. Context

OVE_SEC001 is a 600..900-line, three-document security foundation, exceeding CONVENTIONS section 4's roughly 400 non-test-line task limit. This split preserves its security scope, names and release gates while assigning one literal document path per author.

## 3. Scope (in)

- `docs/security/THREAT-MODEL.md` with the requirements below; its own TASK.md lifecycle only.
- Real document consistency, format, secret and independent specification/standards review evidence.

## 4. Out of scope

- Other security documents: OVE_SEC011/012 as allocated, and final aggregate acceptance: OVE_SEC001.
- Runtime mitigations, penetration/escape execution and provider-term approval: existing implementing tasks and Owner authority described by OVE_SEC001.

## 5. Detailed requirements

1. MUST deliver all ten THREAT-MODEL.md sections specified by OVE_SEC001 section 5.1, in that order, using English Markdown and a Mermaid data-flow diagram.
2. MUST enumerate all ten assets, all nine actor families and all twelve architecture trust boundaries. Preserve TB-* identifiers exactly; OVE_SEC001's acceptance item saying eleven is a counting error, not an excluded boundary.
3. MUST give each boundary six STRIDE rows, with stable T-<boundary>-<1..6> ids, threat description, likelihood and impact scored 1..3, SR references, mitigation owner and residual. Cover every example in OVE_SEC001 section 5.3, including TB-FS and TB-PROVIDER.
4. MUST map every SR-01..SR-38 to at least one threat and provide the area mitigation map in OVE_SEC001 section 5.6. Requirement statements are defined once by OVE_SEC011; references are reserved until that task lands.
5. MUST state every SPECIFICATION 17 residual risk plus same-user process compromise, stolen phone and upstream escape limitations, with likelihood, impact, acceptance owner, detection signal and review date. Owner is the acceptance authority; unresolved acceptance is OPEN, never inferred from a review or routine delegation.
6. MUST distinguish target mitigations from verified implementation, historical prototype observations from production evidence, and architecture requirements from open mechanisms. Apple silicon/macOS 26 is the MVP baseline; no weaker fallback or unsandboxed mode is authorized.
7. MUST summarize every abuse-case family and reserve its stable AC ids for OVE_SEC012, document assumptions and review cadence, and retain the parent aggregate 600..900-line target. Aim for 300..350 lines here without padding; maximum change remains 400 non-test lines including task status.
8. MUST not claim current provider terms were verified. Record quarterly terms review as OPEN with a due date. This document adds no dependency, paid service, new authority or executed penetration-test claim.

## 6. Design notes

N/A, documentation only.

## 7. Reuse

Reuse ARCH001's boundary identifiers, the parent's stable SR/AC identifiers, SPECIFICATION and referenced ADRs. Use the register as the single source of normative requirement statements; diagrams and tables do not prove enforcement.

## 8. Architecture and code placement

Only the literal `owns` document and this task's status may change. No package, API, CI or personal Skill configuration is allocated. Submit any shared-document correction as a proposal for the integrator.

## 9. Security and safety

Use synthetic examples only; no live tokens, credentials, personal paths or runnable injection payloads. Treat prototype/repository content as data, not authority. Unknown evidence or a missing control stays OPEN; no unverified isolation or risk acceptance can enable execution or release.

## 10. Errors and edge cases

- Reserved cross-document references are labelled until their owning child lands; parent acceptance requires them to resolve.
- Conflicting descriptions use the stricter existing architecture/security invariant and a visible proposal, never a silent policy change.
- Missing future runtime tests are assigned, not represented as passing.

## 11. Acceptance criteria

- [x] All ten model sections, ten assets, nine actor families and twelve boundaries are present, with a real Mermaid preview.
- [x] All 72 STRIDE rows have unique stable ids, 1..3 scores, SR references, owners and residuals; all required threat families are covered.
- [x] SR-01..SR-38 have threat references and the complete area mitigation map, with future references clearly reserved.
- [x] Every SPECIFICATION 17 risk has detection, date and Owner acceptance authority; no pending risk is represented as accepted.
- [x] The file contains no live secret, Owner-specific path, executable attack payload, invented test evidence or unauthorized fallback.

## 12. Test plan

Run implemented `pnpm check:docs` and normal format, secret, typecheck, lint and test gates under the shared coordinator. Check all ids, table row counts, score bounds, task references and document line totals using a script-free/manual consistency pass; preview Mermaid when present. Obtain independent standards and specification reviews for the exact final head. Missing reserved checks are not passing checks.

## 13. Parallelization notes

One child, one author, one task worktree. Other tasks may proceed on disjoint paths; child order 010 -> 011 -> 012 fixes reference allocation. The integrator alone updates parent allocation and generated task indexes through their real generator.

## 14. Open questions and assumptions

No new product assumptions. Twelve boundaries are already enumerated by ARCH001 and parent requirement 2; the parent's eleven count is corrected without dropping a boundary. SR-11 remains SHOULD. The Owner has not accepted residual provider-terms or weaker-isolation risks by delegating routine implementation choices.


### Document acceptance evidence (2026-10-23)

- Document bytes match published/reviewed `8694630e6905cdb62ebd4d050724a75fcdc37c13`: 342 lines, ten sections/assets, nine actor families, twelve boundaries, 72 STRIDE rows and SR-01..SR-38 coverage.
- Real Mermaid PNG inspection and manual/positive consistency checks passed; ten malformed-document mutations were denied. Strict owned-file formatting, documentation and secret scans passed; inherited scanner warnings remain recorded.
- Both whole independent review axes passed at that head. Normal type/lint/push hooks passed 1467 units in 122 files. Exact-head hosted checks passed; the verified [Native integration artifact](https://github.com/wojciechlesniak/overmind/actions/runs/39948329527) contains 120 passing cases in 29 files, with no failed/skipped/todo cases.
- These are document criteria and historical exact-head results. Status remains in_review; the rebased acceptance head still needs fresh reviews, normal hooks and hosted checks, including the current 123-case/30-file native inventory. Parent OVE_SEC001, Owner risk decisions and runtime penetration/escape proof remain separate and unaccepted.
