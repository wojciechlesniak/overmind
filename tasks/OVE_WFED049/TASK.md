---
id: OVE_WFED049
title: "Property-based and fuzz tests of commands, history, mappers, clipboard, rules"
area: WFED
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST002, OVE_WFED002, OVE_WFED004, OVE_WFED006, OVE_WFED007, OVE_WFED008, OVE_WFED009, OVE_WFED010, OVE_WFED011, OVE_WFED012, OVE_WFED013, OVE_WFED015, OVE_WFED016, OVE_WFED022]
soft_depends_on: []
provides: ["suite:editor-properties"]
needs: ["lib:editor-document-model", "lib:editor-commands", "lib:editor-history", "lib:workflow-mappers", "lib:editor-connection-rules", "lib:editor-graph-queries", "lib:editor-clipboard-format", "lib:editor-test-builders", "lib:test-utils", "lib:fake-clock"]
owns: ["apps/desktop/src/features/workflow-editor/testing/properties/**", "apps/desktop/src/features/workflow-editor/testing/properties/arbitraries.ts", "apps/desktop/src/features/workflow-editor/testing/properties/*.property.test.ts", "apps/desktop/src/features/workflow-editor/testing/properties/corpus/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED049: Property-based and fuzz tests of commands, history, mappers, clipboard, rules

## 1. Summary

Randomised tests for the parts where a single wrong case silently corrupts a Workflow: arbitrary command sequences never break the document invariants, undo and redo are exact inverses, definition-to-document-to-definition is lossless, hostile clipboard text never gets past the parser, and the connection rules never allow a raw cycle. Failures are shrunk to a minimal sequence and stored in a corpus so they stay fixed.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The document model has invariants I1..I9 (WFED002: unique keys, ordered arrays consistent with maps, edges reference existing nodes and ports, no duplicate edges, limits, integer positions, group members exist, lane bindings exist, no raw cycle) and every mutation goes through serialisable commands with inverses (WFED007, WFED009..WFED012). Persisted graphs come from the engine and from Chief; a mapper bug corrupts them silently. The test environment is pure TypeScript (no React), so properties run thousands of cases per second. `fast-check` is the property library (TEST001 test strategy: required for parsers and canonicalisers).

## 3. Scope (in)

- Arbitraries: valid documents, valid commands against a given document, hostile definitions, hostile clipboard strings.
- Properties for commands, history, mappers, clipboard, connection rules and the autosave scheduler.
- Failure corpus and replay mechanism.
- CI settings (runs count, seed logging).

## 4. Out of scope

- Example-based unit tests (each task owns them).
- UI-level fuzzing (Playwright).
- Engine-side validation tests (WFRT).

## 5. Detailed requirements

1. Arbitraries (`arbitraries.ts`): `arbDocument({ maxNodes })` generates valid documents by applying random valid commands to the empty document (so generation and invariants cannot drift apart); `arbCommand(doc)` produces a command that is VALID for `doc` (picks existing keys, legal ports) or deliberately INVALID with an expected error code (`unknown_node`, `occupied_port`, `limit_exceeded`, `read_only`, `raw_cycle`, ...); `arbDefinition()` generates persisted definitions including degenerate ones (dangling edges, duplicate keys, unknown node types, extra fields, huge labels, `__proto__` keys, nulls); `arbClipboardText()` mixes valid fragments, truncated JSON, oversize payloads, deep nesting, foreign MIME payloads and Markdown that contains JSON.
2. P1 invariants: for any document and any sequence of up to 60 commands (valid or invalid), after each command the document satisfies I1..I9 (`assertInvariants`), a refused command returns the SAME document reference, and an accepted command changes only what its declared `touches` set says (structural sharing check).
3. P2 inverse law: for any valid command `c` on `d`, `apply(inverse(c), apply(c, d))` equals `d` deeply (order arrays included); `undo` after `redo` after `undo` is stable; history never exceeds its cap of 100 and coalescing never merges commands with different coalesce keys or different node sets; `markSaved` and `getPosition` agree with the dirty flag for any interleaving of commands, undo, redo and saves.
4. P3 serialisation: every command survives `JSON.parse(JSON.stringify(c))` and replays to the same document (commands carry ids in the payload, no closures).
5. P4 mapper round trip: for any valid document `fromDefinition(toDefinition(d))` equals `d` (including order, groups, lanes, ui positions); for any VALID persisted definition `toDefinition(fromDefinition(x))` equals `x` modulo the documented normalisations (key order, default fields); for any hostile definition `fromDefinition` either returns a valid document with warnings or a typed error, NEVER throws and never produces a document that fails invariants; unknown node types are preserved read-only and round-trip untouched; definition size above 512 KiB or more than 200 nodes is refused.
6. P5 canvas projection: `projectDocument(d)` is deterministic, has no duplicate ids, every edge endpoint exists, frames contain their members, and `planFromIntent(project(d), intent)` for random kit intents yields only plans that the commands accept or a typed refusal (never an exception).
7. P6 connection rules and cycles: `checkConnection` agrees with a naive reference implementation (full DFS over the graph with return edges removed) on random graphs of up to 25 nodes; a connection accepted by the rules can never make the engine cycle detector (reference Tarjan in the test, ported from the WFRT013 description) report a cycle; the vectors of WFED004 and WFED017 are included as examples (`fc.examples`).
8. P7 clipboard: `parseFragment` on `arbClipboardText` never throws, never allocates more than the documented limits (assert with a size guard), returns either a valid fragment (keys sanitised, ids regenerated on paste) or `null`; pasting any valid fragment into any valid document yields a valid document or `limit_exceeded` without partial insertion; hostile keys (`__proto__`, `constructor`, `prototype`) never reach the document.
9. P8 autosave scheduler (with `lib:fake-clock`): for any sequence of edits, saves, failures and conflicts, at most one request is in flight, the saved revision is monotonic, no change is lost (the last accepted save contains the latest document after the next debounce) and the retry delays follow the documented table.
10. Settings: default 200 runs per property locally, 2000 in the nightly job, seed printed on failure and re-runnable with `FC_SEED`; `verbose` shrinking enabled; every shrunk failure is appended as a JSON file to `corpus/` and replayed first on every run (`fc.assert(..., { examples })`); the corpus folder is reviewed in PRs. Total time budget under 90 seconds for the default run.
11. Mutation sanity check: a documented manual procedure (not CI) injects three known bugs (command forgets to remove incident edges, inverse forgets a group membership, mapper drops `lanes`) and confirms that a property fails within the default run; the result is noted in the doc header of `arbitraries.ts`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `fast-check` (approved by TEST001/SETUP008), `lib:test-utils`, `lib:fake-clock`, `lib:editor-test-builders` (WFED002) and the cycle vectors (WFED004); `assertInvariants` of WFED002 is reused, not rewritten.

## 8. Architecture and code placement

Layer: tests of the pure core (`testing/properties/`), importing only `document/`, `commands/`, `history/`, `mappers/`, `rules/`, `catalog/` and the scheduler of `session/` (no React). Not imported by production code (layering test).

## 9. Security and safety

These tests are the cheapest defence against silent graph corruption and prototype-pollution through definitions from Chief, Agents or the clipboard: they run hostile inputs against the parser and mapper and assert fail-closed behaviour. The corpus must contain only synthetic data. The reference cycle detector in the test is independent of the production implementation, so a shared bug cannot hide.

## 10. Errors and edge cases

- Generator produces an unreachable state: generation uses real commands only, so every state is reachable.
- Flaky timing: no real timers, the fake clock only.
- Shrinking too slow: `maxShrinks` capped at 500 with a warning.
- A property fails only on a 200-node document: `arbDocument({ maxNodes: 200 })` runs in the nightly profile.
- New command added later: the property test lists all command kinds from the registry and fails when one has no arbitrary (completeness check).

## 11. Acceptance criteria

- [ ] Given 200 random 60-command sequences, Then invariants hold after every step and refused commands keep the same reference.
- [ ] Given any valid command, Then its inverse restores the document exactly.
- [ ] Given hostile definitions, Then `fromDefinition` never throws and never returns an invalid document.
- [ ] Given hostile clipboard strings, Then the parser never throws and respects limits.
- [ ] Given random graphs up to 25 nodes, Then the rules agree with the reference cycle check.
- [ ] Given a new command kind without an arbitrary, Then the completeness check fails.
- [ ] Given a stored corpus file, Then it is replayed first and passes.

## 12. Test plan

Vitest with fast-check (`pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/testing/properties`); nightly profile with `FC_NUM_RUNS=2000`.

## 13. Parallelization notes

Can start as soon as the commands and mappers exist; parallel with WFED045..WFED048. Conflict hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: `fast-check` is available (TEST001 requires it for parsers); if the dependency list is not approved yet, a seeded loop helper in `arbitraries.ts` is the fallback.
- GAP: a shared vector file with WFRT013 (cycle detection) would make P6 an exact parity check; today the reference implementation is written from the WFRT013 description. Proposal to WFRT.
- OPEN: whether to publish the corpus to the engine tests so the server validator sees the same hostile definitions (cross-area, TEST area).
