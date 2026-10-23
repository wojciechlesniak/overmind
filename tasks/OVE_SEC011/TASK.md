---
id: OVE_SEC011
title: Register all security requirements and their verification ownership
area: SEC
kind: docs
size: S
priority: P0
mvp: true
status: in_review
depends_on: [OVE_SEC010]
soft_depends_on: []
provides: ["doc:security-requirements-register"]
needs: []
owns: ["docs/security/requirements.md"]
reads: ["tasks/OVE_SEC001/TASK.md", "docs/SPECIFICATION.md", "docs/architecture/ARCHITECTURE.md", "docs/security/THREAT-MODEL.md", "docs/security/requirements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 8", "SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 17"]
adr_refs: [3, 4, 6, 10, 12, 20, 21, 22, 26, 27]
---

# OVE_SEC011: Register all security requirements and their verification ownership

## 1. Summary

Deliver the bounded document allocated below from OVE_SEC001. The parent retains its full acceptance criteria and final cross-document review; this task does not complete the parent or accept residual risks.

## 2. Context

OVE_SEC001 is a 600..900-line, three-document security foundation, exceeding CONVENTIONS section 4's roughly 400 non-test-line task limit. This split preserves its security scope, names and release gates while assigning one literal document path per author.

## 3. Scope (in)

- `docs/security/requirements.md` with the requirements below; its own TASK.md lifecycle only.
- Real document consistency, format, secret and independent specification/standards review evidence.

## 4. Out of scope

- Other security documents: OVE_SEC010/012 as allocated, and final aggregate acceptance: OVE_SEC001.
- Runtime mitigations, penetration/escape execution and provider-term approval: existing implementing tasks and Owner authority described by OVE_SEC001.

## 5. Detailed requirements

1. MUST implement OVE_SEC001 section 5.4 with exactly the stable initial identifiers SR-01..SR-38; never renumber or silently remove an invariant.
2. MUST use columns ID, Statement (MUST/SHOULD), Threat ids, Implemented by (area/task), Verified by (test/task). Every row needs existing threat ids from OVE_SEC010, at least one concrete implementing task/capability, and a verifying task plus activity type.
3. MUST preserve SR-11 as SHOULD pending peer-uid support, all other required MUST controls, scoped transport-token handling and CLI-owned subscription credential exceptions from ARCHITECTURE section 12. No secret can be exposed to model/UI/logs.
4. MUST provide explicit coverage for security-related SPECIFICATION 16 criteria 1, 7, 8, 9, 10 and 14, and the consequences of ADRs 0003, 0004, 0006, 0012, 0020, 0021, 0022, 0026 and 0027. Include ADR 0010 and 0028 context without changing product scope.
5. MUST distinguish assigned future verification from an executed passing test, with a coverage checklist for the parent final review. Unmitigated/unallocated items stay OPEN and get a proposal rather than a fabricated implementing task.
6. MUST link to the single threat model and forthcoming abuse catalogue; no duplicated threat/requirement register. Aim for 140..190 substantive lines, respecting the parent aggregate 600..900 lines and task maximum 400 non-test changed lines.
7. MUST introduce no executable control, dependency, CI change, payload fixture, residual-risk acceptance or publication claim.

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

- [x] All SR-01..SR-38 rows preserve required semantics and include valid threat, implementing and verifying references.
- [x] Every listed security-related SPECIFICATION criterion and ADR consequence is explicitly mapped.
- [x] The coverage checklist distinguishes planned verification, actual evidence and OPEN gaps; no missing future tool is called passed.
- [x] All references resolve to the model or an allocated backlog task/capability, and all sensitive examples are synthetic.

## 12. Test plan

Run implemented `pnpm check:docs` and normal format, secret, typecheck, lint and test gates under the shared coordinator. Check all ids, table row counts, score bounds, task references and document line totals using a script-free/manual consistency pass; preview Mermaid when present. Obtain independent standards and specification reviews for the exact final head. Missing reserved checks are not passing checks.

## 13. Parallelization notes

One child, one author, one task worktree. Other tasks may proceed on disjoint paths; child order 010 -> 011 -> 012 fixes reference allocation. The integrator alone updates parent allocation and generated task indexes through their real generator.

## 14. Open questions and assumptions

No new product assumptions. Twelve boundaries are already enumerated by ARCH001 and parent requirement 2; the parent's eleven count is corrected without dropping a boundary. SR-11 remains SHOULD. The Owner has not accepted residual provider-terms or weaker-isolation risks by delegating routine implementation choices.


### Document verification evidence (2026-10-23)

Source 8468a2c supplies the 159-line register with exactly SR-01..SR-38, SR-11 alone SHOULD, six explicit security acceptance mappings and eleven ADR consequences. The author completed the required script-free/manual reference and semantic consistency pass. Runtime verification assignments, the parent coverage checklist and all Owner residual-risk decisions remain OPEN.

The initial independent Spec review at 8f6b005 found one missing explicit CLI Approval delivery prohibition; that P2 remains recorded. The finite SR-19 and ADR0026 correction preserves the required denial and Approval/Escalation with existing PROV008 zero-send verification. Both fresh independent whole Standards and Spec reviews passed the corrected 8468a2c source with zero findings.

Actual owned-document format/docs, tree/staged secret checks and normal commit hooks passed. The documentation checker retains 38 inherited warnings and the tree scanner one existing Keychain warning. Ordinary source-publication hooks then passed typecheck, lint and unit tests without bypasses. The conditional boundary hook did not execute its unavailable reserved caller; no standalone boundary pass is claimed. The corrected source preserves the original native claim identity and all 37 native source/control pins.

At this source-acceptance checkpoint, native in-review and final DONE heads still require their own fresh whole reviews and exact-head hosted/security verification, including all 123 native cases in 30 files, before ordinary integration and actual DEVELOP post verification. This child document does not implement or accept runtime, penetration/escape, parent SEC001, provider terms, residual risks or release.
