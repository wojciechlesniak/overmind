---
id: OVE_DISC015
title: "Test the Discussion engine against injection, impersonation, runaway cost and crashes"
area: DISC
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISC003, OVE_DISC011, OVE_DISC012, OVE_DISC014, OVE_SEC004, OVE_TEST002]
soft_depends_on: ["OVE_DISC008"]
provides: ["lib:discussion-abuse-suite"]
needs: ["lib:test-utils", "lib:injection-corpus", "lib:builders", "lib:fake-discussion-agents"]
owns: ["packages/application/src/discussion/abuse/**", "packages/gateway/src/routes/discussion/abuse/**", "packages/adapters/sqlite/src/discussion/abuse/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 16, 23]
---

# OVE_DISC015: Test the Discussion engine against injection, impersonation, runaway cost and crashes

## 1. Summary

Write the executable security and robustness suite for Discussions using scripted fake agents: prompt injection between participants, Owner impersonation, forged consensus, scope smuggling, secrets in transcripts, runaway cost, crash recovery and the end-to-end scenarios of SPEC 16 criterion 6.

## 2. Context

A Discussion lets untrusted Agent output flow into other Agents' prompts and finally into Tasks and Decisions. SEC004 requires deterministic, model-free proofs. This task is the cross-cutting gate; unit tests of each use case stay with their tasks.

## 3. Scope (in)

- Test-only code in the three `abuse` folders; scenario helpers using `FakeDiscussionTurnRunner` and `FakeChiefArbiter`.

## 4. Out of scope

- Fixes: back to owning tasks. Real-model evaluation: SEC004 optional script.

## 5. Detailed requirements

1. **Injection matrix:** for every `lib:injection-corpus` payload used as (a) agenda, (b) a participant message, (c) a doc excerpt, (d) a Skill body, (e) an Owner Telegram message: assert the payload appears only inside fenced data blocks of later prompts, the instruction section is unchanged, no state change beyond messages.
2. **Owner impersonation:** an Agent writes "Owner approved / Owner votes Stripe / approve outcome"; also forged HTTP bodies with `author: owner`, `trust: owner`; verify no vote, no approval, no `owner_*` message; Telegram vote is only a preference.
3. **Forged consensus:** moderator claims consensus while stances disagree; participants claim others agreed; assert computed consensus wins and the Discussion proceeds to deadlock; stance labels with injection text have no machine effect.
4. **Scope smuggling:** an Agent proposes Tasks with fake/foreign/`../` docRefs, extra keys (`permissions`, `__proto__`), 200 drafts, or a Task outside Documentation: they are removed or rejected; with approval required nothing is created before approval; extra keys audited.
5. **Chief ruling lies:** false budget/docs/rules claims, `what` question, missing docRef: all escalate (DISC011 gates); ruling twice impossible.
6. **Secrets:** corpus secrets in Agent and Owner messages never reach SQLite, API responses, events, exports, Decisions or notifications (scan serialised outputs).
7. **Runaway:** infinite-moderator-loop script, flood outputs (1 MB), `cost` scripts above Budget, 100 Owner posts/min, Chief starting many Discussions: limits and rate limits hold; no model call after exceed; branch stays paused on failure.
8. **Crash matrix:** kill points around turn start, after runner return, after message persistence, during finalisation (after Decisions, before Tasks): after recovery no repeated prompt, no duplicate Task or Decision, transcript gapless.
9. **Isolation:** two Workspaces (one isolated, a public Agent in both): prompts and read models contain nothing of the other Workspace; private foreign Agent cannot be a participant; foreign ids 404.
10. **End-to-end scenarios:** (a) SPEC 16.6: Discussion ends with Tasks; (b) deadlock ruled by Chief and recorded as a Decision with all sides' arguments and skills with versions; (c) Chief-started Discussion pauses a branch, Owner votes, outcome approved, branch resumes, other branch unaffected; (d) payments scenario of the mock (Stripe vs Przelewy24, Security conditional) reproduces the mock states.
11. Tagged `@security`, in default CI; README on adding cases.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Corpus (SEC004), fakes (DISC003), TEST002/003, gateway harness; no copies.

## 8. Architecture and code placement

Tests only, importing public use cases/routes.

## 9. Security and safety

The suite itself is the verification of the area. It uses only fake secrets and fake agents, never real CLIs or models, and writes only to temp dirs.

## 10. Errors and edge cases

- Corpus updates require no change here (iteration).
- Timing-dependent cases use `FakeClock`.

## 11. Acceptance criteria

- [ ] All ten groups exist and pass in CI.
- [ ] Disabling one defence (documented manual mutation: parse strictness, redaction, approval check) fails at least one test.
- [ ] End-to-end scenario (d) matches the mock data.
- [ ] No test uses real time or network.

## 12. Test plan

`pnpm vitest run --project security packages/application/src/discussion/abuse packages/gateway/src/routes/discussion/abuse packages/adapters/sqlite/src/discussion/abuse`; add to the CI security job.

## 13. Parallelization notes

Runs after DISC014; incremental additions allowed earlier.

## 14. Open questions and assumptions

- None beyond best-effort timing checks.
