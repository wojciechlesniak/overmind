---
id: OVE_SKILL014
title: Add the Skills security, scoping and protocol test suite
area: SKILL
kind: test
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_SKILL008, OVE_SKILL009, OVE_SKILL011, OVE_SKILL013, OVE_TEST002]
soft_depends_on: []
provides: ["suite:skills-security"]
needs: ["lib:test-utils", "lib:fake-clock", "lib:fake-ports"]
owns: ["packages/application/src/skill/__e2e__/**"]
reads: ["packages/application/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16", "SPECIFICATION 13"]
adr_refs: [12, 15, 27, 28]
---

# OVE_SKILL014: Add the Skills security, scoping and protocol test suite

## 1. Summary

End-to-end tests of the Skills backend proving the trust model: Owner-only import and accept, Chief proposals stay pending, private scoping, hash pinning and prompt fencing.

## 2. Context

Skills are a prompt-injection supply chain. These tests wire the real use cases to in-memory adapters and exercise whole flows with adversarial inputs, complementing the unit tests per task and SEC/TEST suites.

## 3. Scope (in)

- Flow suites for import, proposal, review, edit, visibility, materialisation, cascade and routes.

## 4. Out of scope

- Cross-area UI tests. Performance tests.

## 5. Detailed requirements

1. Import flow: Owner imports hostile Skill (fence-break, bidi, exfil) via paste and fake URL; stays pending, scanner flags; accept needs confirmation; Chief/Agent/Telegram actors are refused at use case and route level.
2. Chief flow: simulated `propose` action creates a private pending Skill and a Proposal; Chief cannot activate, assign, publish or fetch; cap tests.
3. Scoping: Workspace A cannot list, read, assign or record usage for B's private Skill; narrowing blocked while in use elsewhere; cascade removes private Skills and usage.
4. Pinning: edit after Run start leaves the Run's version unchanged; tampering with a stored row (via raw SQL) is caught by hash verification and fails closed for the builtin.
5. Materialisation: adversarial Skill text cannot escape its fence in the assembled prompt; budget and drop rules hold; usage recorded once.
6. Builtin: cannot be edited, archived, or made private; seeding idempotent.
7. Route-level matrix: every route with Owner session, agent token, Telegram session, no auth; expected statuses.
8. All suites run with the standard fake clock and deterministic ids; no network.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

TEST006 conventions, in-memory adapters.

## 8. Architecture and code placement

`packages/application/src/skill/__e2e__/*.test.ts` plus fixtures dir.

## 9. Security and safety

The suite is itself a regression guard for the security rules: failures must block merge. Fixtures contain hostile text only as inert strings; nothing executes.

## 10. Errors and edge cases

- Flaky ordering: deterministic ids and clock.
- Large fixtures: capped sizes.

## 11. Acceptance criteria

- [ ] All listed flows pass in CI.
- [ ] Mutation check: removing the Owner-only guard in any use case fails at least one test.
- [ ] Suite runs under 30 s.

## 12. Test plan

Command: `pnpm vitest run packages/application/src/skill/__e2e__`.

## 13. Parallelization notes

Last task of the area; parallel with CHIEF020 and AGENT/CHAT suites.

## 14. Open questions and assumptions

- ASSUMPTION: TEST harness libs named `lib:test-harness`, `lib:fake-clock`, `lib:in-memory-app` exist in TEST area (to be matched by linker).
