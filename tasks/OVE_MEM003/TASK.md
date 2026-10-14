---
id: OVE_MEM003
title: "Define memory ports, summariser seam, FTS index port, fakes and contract suites"
area: MEM
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_MEM001, OVE_MEM002, OVE_SEC004, OVE_TEST002, OVE_TEST003]
soft_depends_on: ["OVE_TEST003"]
provides: ["port:AgentMemoryRepository", "port:MemoryIndex", "port:SummariserModel", "port:MemoryReadModel", "lib:memory-fakes", "lib:memory-builders", "lib:memory-contract-suites", "port:MemoryReader", "port:MemoryAdmin"]
needs: ["port:UnitOfWork", "lib:test-utils", "lib:builders", "lib:contract-test-harness", "lib:fake-clock", "lib:prompt-assembly"]
owns: ["packages/application/src/ports/AgentMemoryRepository.ts", "packages/application/src/ports/MemoryIndex.ts", "packages/application/src/ports/SummariserModel.ts", "packages/application/src/ports/MemoryReadModel.ts", "packages/testing/src/fakes/InMemoryAgentMemoryRepository.ts", "packages/testing/src/fakes/InMemoryMemoryIndex.ts", "packages/testing/src/fakes/FakeSummariserModel.ts", "packages/testing/src/builders/memory.builder.ts", "packages/testing/src/contracts/AgentMemoryRepository.contract.ts", "packages/testing/src/contracts/MemoryIndex.contract.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [8, 14]
---

# OVE_MEM003: Define memory ports, summariser seam, FTS index port, fakes and contract suites

## 1. Summary

Define the ports of the memory layer, including the search index port that hides FTS5 so a hybrid or vector index can replace it later (P2), the summariser model seam, in-memory fakes with a scripted summariser (including hostile outputs), builders and contract suites.

## 2. Context

SPEC 10: SQLite plus FTS now, hybrid or vector search later. ADR 0014/SPEC 10: memory is retrieval, not training. Summarisation needs a model call (through the provider layer) that must be testable without a model. Ports follow ARCH006; all reads require the scope types of OVE_MEM002.

## 3. Scope (in)

- Ports, fakes, builders, suites; the documented P2 contract for a hybrid index (interface only, no implementation).

## 4. Out of scope

- SQLite/FTS: OVE_MEM004. Real summariser adapter over providers: PROV (capability `adapter:SummariserModel`). Hybrid index implementation: later / not planned (P2).

## 5. Detailed requirements

1. **AgentMemoryRepository:** reads take `AuthorisedScope` (branded): `list(scope, { agentId, workspaceId?, statuses?, cursor, limit })`, `get(scope, id)`, `countActive(scope, agentId, workspaceId)`, `sumChars(...)`; writes: `insert(entry, tx?)` (validates `workspaceId`/`agentId` against the caller's write scope token `AuthorisedWrite` issued for system jobs only), `setStatus(entryId, status, { compactedIntoId?, flags? }, tx?)` (status/flags/compaction pointers are the only mutable columns; content is immutable), `deleteBy(guard: DeletionGuard, tx)` where `DeletionGuard` is `{ reason: 'workspace_purge' | 'agent_deleted' | 'retention', workspaceId, agentId?, olderThan? }` (typed; used by MEM006/009/014 only). NO method to edit content or to read without a scope.
2. **MemoryIndex (search port):** `index(entry)`, `remove(entryIds)`, `search(scope: AuthorisedScope, query: { text, agentId, workspaceId, limit }): Array<{ entryId, score }>`, `rebuild(): Promise<Result<{ indexed: number }>>`. Contract states that backends may add embeddings: `HybridMemoryIndex` (P2) implements the same interface, adds optional `embed(text)`, and must pass the same suite; scoring is opaque to callers.
3. **SummariserModel:** `summarise(req: { prompt: AssembledPrompt, outputSchemaId: 'task_summary' | 'compaction', timeoutMs, limits: { maxOutputChars } }): Promise<Result<{ rawText, usage, modelRef }>>`; the adapter MUST run tool-free with no file or network access and no permissions beyond the model call (the summariser is the most exposed component: it reads untrusted text).
4. **MemoryReadModel:** `ownerList(scope, agentId, { workspaceId?, q?, cursor })` -> `MemoryEntryView[]` + `withheld`; `ownerGet(scope, id)`.
5. **Fakes:** in-memory repository enforcing the same immutability and scope filtering; `FakeSummariserModel` scripts: `ok(json)`, `invalid_json`, `inject(corpusId)` (summary text contains instructions), `long`, `secret(text)`, `timeout`; records prompts.
6. **Builders:** `aMemoryEntry({ agent: 'dev', workspace: 'rezerwacje', title: 'Koszyk z rabatami' })` reproducing the three mock entries; `aQuarantinedEntry`.
7. **Contract suites:** scope filtering (two Workspaces, public Agent in both: entries separated); immutable content (type test and runtime: no edit method); status-only updates; deletion only with a typed guard and only for the guard's Workspace/Agent; index returns only entries inside the scope even if the query matches others; rebuild idempotent.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`AuthorisedScope` (MEM002), TEST002 builders/clock, TEST003 harness, SEC004 `AssembledPrompt`.

## 8. Architecture and code placement

Ports in `packages/application/src/ports/`, fakes/builders/suites in `packages/testing`.

## 9. Security and safety

Type-level isolation: no read port method exists without a branded scope; content is immutable (no edit API); deletion requires a typed guard for explicit reasons; the summariser port documents the tool-free requirement; the index port cannot return rows outside the scope even for hostile queries (suite).

## 10. Errors and edge cases

- Empty query text: returns recent entries by recency (fake and real).
- Index lag after insert: `search` immediately after `insert` in the same transaction finds the entry (suite requirement).
- Guard with `olderThan` for non-retention reasons: rejected.

## 11. Acceptance criteria

- [ ] Ports compile; fakes pass both suites.
- [ ] No read method without scope; no content-edit method (type tests).
- [ ] The summariser fake supports hostile outputs and records prompts.
- [ ] Mock builders yield the three entries of the Agenci panel.
- [ ] A conforming `HybridMemoryIndex` stub in the test folder passes the index suite (proves the P2 extension point).

## 12. Test plan

- Suites on fakes, builder tests, type tests, stub hybrid index test. Commands: `pnpm vitest run packages/testing`.

## 13. Parallelization notes

MEM004 onward depend on it. Hotspot: `packages/testing/package.json` via proposal.

## 14. Open questions and assumptions

- ASSUMPTION: summariser runs tool-free; adapter owned by PROV.
