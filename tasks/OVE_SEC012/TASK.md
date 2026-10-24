---
id: OVE_SEC012
title: Catalogue concrete abuse cases and their security verification hooks
area: SEC
kind: docs
size: S
priority: P0
mvp: true
status: in_review
depends_on: [OVE_SEC011]
soft_depends_on: []
provides: ["doc:security-abuse-catalogue"]
needs: []
owns: ["docs/security/abuse-cases.md"]
reads: ["tasks/OVE_SEC001/TASK.md", "docs/SPECIFICATION.md", "docs/architecture/ARCHITECTURE.md", "docs/security/THREAT-MODEL.md", "docs/security/requirements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 8", "SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 17"]
adr_refs: [3, 4, 6, 10, 12, 20, 21, 22, 26, 27]
---

# OVE_SEC012: Catalogue concrete abuse cases and their security verification hooks

## 1. Summary

Deliver the bounded document allocated below from OVE_SEC001. The parent retains its full acceptance criteria and final cross-document review; this task does not complete the parent or accept residual risks.

## 2. Context

OVE_SEC001 is a 600..900-line, three-document security foundation, exceeding CONVENTIONS section 4's roughly 400 non-test-line task limit. This split preserves its security scope, names and release gates while assigning one literal document path per author.

## 3. Scope (in)

- `docs/security/abuse-cases.md` with the requirements below; its own TASK.md lifecycle only.
- Real document consistency, format, secret and independent specification/standards review evidence.

## 4. Out of scope

- Other security documents: OVE_SEC010/011 as allocated, and final aggregate acceptance: OVE_SEC001.
- Runtime mitigations, penetration/escape execution and provider-term approval: existing implementing tasks and Owner authority described by OVE_SEC001.

## 5. Detailed requirements

1. MUST implement OVE_SEC001 section 5.5 with at least 36 uniquely numbered AC-nn cases covering every required case family; use the reserved summary ids from OVE_SEC010 and never renumber published ids.
2. MUST include title, actor, preconditions, non-executable attack steps, expected blocked/allowed-with-approval/detected behaviour, valid SR ids, test type and owning verification task in every case. Split related variants where expected outcomes differ.
3. MUST cover path and mount escape, DNS/HTTPS egress, parent/case/Unicode/firmlink requests, all content sources and forged authority, Telegram pairing/replay/stolen-phone scope, CLI/login/dialog/false-done, crash/retry ambiguity, gateway/token/scope, secrets/outbound path redaction, supply chain, login-port squatting, Markdown links, request/process exhaustion, cross-Workspace credentials, Global Pause and Owner Rule weakening.
4. MUST reference future injection fixtures owned by OVE_SEC004 rather than embedding payloads or runnable attacks. Use only synthetic secrets and generic paths. No destructive action, external target or live credential is needed for documentation verification.
5. MUST map the catalogue to existing threats and SRs without duplicating their normative statements, and record OPEN coverage rather than treating a proposed test as executed evidence.
6. MUST keep physical escape/penetration execution with implementing owners and dedicated safe infrastructure. Aim for 200..250 substantive lines; preserve the parent's aggregate 600..900-line requirement and 400-line change limit.
7. MUST introduce no runtime code, mitigation waiver, dependency, CI change or inferred Owner risk acceptance.

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

- [x] At least 36 stable cases cover every family listed in OVE_SEC001 section 5.5 and reference valid SR ids.
- [x] Every case has all seven required fields, an explicit expected denial/approval/detection outcome and a verifying task/activity.
- [x] Injection examples reference OVE_SEC004 fixture ownership; no executable attack, live secret or Owner-specific path is included.
- [x] The final three-document line total is 600..900 and the catalogue consistency pass retains any OPEN gap for parent review.

## 12. Test plan

Run implemented `pnpm check:docs` and normal format, secret, typecheck, lint and test gates under the shared coordinator. Check all ids, table row counts, score bounds, task references and document line totals using a script-free/manual consistency pass; preview Mermaid when present. Obtain independent standards and specification reviews for the exact final head. Missing reserved checks are not passing checks.

## 13. Parallelization notes

One child, one author, one task worktree. Other tasks may proceed on disjoint paths; child order 010 -> 011 -> 012 fixes reference allocation. The integrator alone updates parent allocation and generated task indexes through their real generator.

## 14. Open questions and assumptions

No new product assumptions. Twelve boundaries are already enumerated by ARCH001 and parent requirement 2; the parent's eleven count is corrected without dropping a boundary. SR-11 remains SHOULD. The Owner has not accepted residual provider-terms or weaker-isolation risks by delegating routine implementation choices.
