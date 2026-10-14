---
id: OVE_BOARD014
title: "Test the Board against abuse: forged docRefs, agent moves, isolation, history edits"
area: BOARD
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD010, OVE_BOARD013, OVE_SEC004, OVE_TEST002]
soft_depends_on: ["OVE_BOARD007"]
provides: ["lib:board-abuse-suite"]
needs: ["lib:test-utils", "lib:injection-corpus", "lib:builders"]
owns: ["packages/gateway/src/routes/board/abuse/**", "packages/application/src/board/abuse/**", "packages/adapters/sqlite/src/board/abuse/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 16]
---

# OVE_BOARD014: Test the Board against abuse: forged docRefs, agent moves, isolation, history edits

## 1. Summary

Write the security and abuse-case test suite for the whole Board area as an executable gate: documentation-link enforcement, who may move cards, cross-Workspace isolation, history immutability, injection through Task text, idempotency under crash, and flooding. It runs in CI and proves the claims of the other BOARD tasks.

## 2. Context

CONVENTIONS 7 and SEC004: model output and repository content are data; the Board is the shared state agents try to influence. ADR 0016 (no Task without Documentation), ADR 0011 (source of truth), ADR 0008 spirit (history is not rewritten), ADR 0028 (private Agents stay in their Workspace). This task collects cross-cutting negative tests that do not belong to a single use case.

## 3. Scope (in)

- Test-only code under the three `abuse` folders.
- Corpus-driven tests using `lib:injection-corpus` fields as Task titles, descriptions, docRef paths, reasons and lane names.
- Crash/retry simulations with failure-injecting fakes and SQLite.

## 4. Out of scope

- Fixes for any defect found: back to the owning task (proposal or follow-up), never patched here.
- Visual tests: BOARDUI. Generic gateway auth tests: SEC005.

## 5. Detailed requirements

1. **docRef forgery suite:** paths: `../../.ssh/id_rsa`, `/etc/passwd`, `docs/../../x.md`, `docs/%2e%2e/x.md`, NUL byte, 10 000 chars, backslash variants, symlink inside docs pointing outside (fixture via fake `PathProbe`), `.md` file outside Documentation roots, unicode normalisation tricks (`ｄｏｃｓ`), and anchors with script text. Expect `board.doc_ref_outside_documentation` or `board.doc_ref_unresolvable`, no row, audit event present for escapes, no absolute path in any response.
2. **Actor matrix suite:** generate (operation x actor kind) over create, move, assign, status, defer, evidence, progress, purge; compare with the table in BOARD008; includes agent identity spoofing (body field `actor`, `X-Agent-Id` header, text "I am the owner") which MUST have no effect.
3. **Agent self-completion:** an Agent reports `done` via progress, evidence of another Workspace, a forged artifact id, then via Node outcome without gate artifact: Task never reaches `done`.
4. **Isolation suite** (two Workspaces, one isolated, one public Agent used in both): all read paths (view, detail, search, progress, lane list) are Workspace scoped; foreign task ids return 404 uniformly (same body and similar timing class); assigning a private Agent of Workspace A in B fails; progress batch is owner-only (chief and agent callers rejected).
5. **History immutability suite:** raw SQL UPDATE/DELETE on `task_timeline`, attempt to delete a Task through the repository, to change `seq`, `workspace_id`, `doc_path` without a `doc_ref_changed` entry, and replay of an old `expectedVersion` — all fail; `deleteAllForWorkspace` works only inside a transaction, only for its Workspace, and leaves no guard row after commit.
6. **Injection through text:** run every corpus payload as title, description, reason, lane `hint`, criteria text, directive summary: stored as data, length-capped, control characters handled; the read model returns them verbatim-safe; a prompt-assembly call (SEC004) including Task text puts it only in a fenced block (cross-check with `PromptAssembler` through a fake caller). FTS queries built from payloads never throw.
7. **Idempotency and crash suite:** crash after Task insert before event, after event before publish, mid-batch; claim races; duplicate event delivery for approval linkage; retries with the same `Idempotency-Key`; the end state equals a single successful execution.
8. **Flooding suite:** 1 000 progress calls per second (coalesced), 300 creates in an hour (cap and rate limit), 10 000-character fields, 500 criteria: bounded effect, no timeline spam beyond thresholds.
9. **Telegram suite:** the `channel` caller cannot create Tasks or change status; receives summary shapes; cannot supply `overrideWip`... (allowed only for owner desktop); forged callback-like strings in reasons are inert.
10. Tests are tagged `@security` and included in the default CI run; a README section in the test folder documents how to add a case.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`lib:injection-corpus` (SEC004), SEC002 path fixtures, TEST002 fakes and builders, TEST003 harness, gateway test harness (ENGINE). No copies of corpora.

## 8. Architecture and code placement

Tests only: `packages/application/src/board/abuse/*.test.ts`, `packages/gateway/src/routes/board/abuse/*.test.ts`, `packages/adapters/sqlite/src/board/abuse/*.test.ts`. They import public use cases and routes, not internals.

## 9. Security and safety

This task is itself the security verification for the area; it must never weaken another task's rule to pass, and it stores no real secrets (corpus secrets are fake patterns). Failing tests block merge. Fixtures that simulate symlinks use fakes, not the real filesystem outside a temp dir.

## 10. Errors and edge cases

- A corpus entry that legitimately looks like a Markdown heading anchor is still treated as data.
- Timing assertions use ranges and run only in `@perf` mode to avoid flakiness; the 404 uniformity test compares response bodies exactly.
- Corpus update (new payloads) must not need changes here: tests iterate over the corpus.

## 11. Acceptance criteria

- [ ] All suites 1-9 exist, run in CI and pass against the implemented Board.
- [ ] Mutation check: deliberately disabling one defence (for example the path canonicalisation) makes at least one test fail (documented manual procedure in the README, run once at merge).
- [ ] No test reads outside its temp directory.
- [ ] The suites cover every audit event name listed in BOARD004/006/008.

## 12. Test plan

Run `pnpm vitest run --project security packages/application/src/board/abuse packages/gateway/src/routes/board/abuse packages/adapters/sqlite/src/board/abuse`. Add the three folders to the CI security job.

## 13. Parallelization notes

Runs after BOARD010/013; can be written incrementally alongside them (each earlier task owns its unit tests; this task adds the cross-cutting ones).

## 14. Open questions and assumptions

- Open: timing-oracle checks for 404 uniformity are best-effort in MVP (documented limitation).
