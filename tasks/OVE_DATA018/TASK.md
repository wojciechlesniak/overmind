---
id: OVE_DATA018
title: Artifact contract, repository, SQLite schema, in-memory fake and contract test
area: DATA
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA007, OVE_DATA008, OVE_DATA010, OVE_TEST003]
soft_depends_on: []
provides: ["contract:Artifact", "contract:ArtifactProvenance", "port:ArtifactRepository", "table:artifacts", "lib:artifact-fake"]
needs: ["lib:repository-base", "port:UnitOfWork", "lib:contract-test-harness"]
owns: ["packages/contracts/src/artifact/**", "packages/application/src/ports/ArtifactRepository.ts", "packages/adapters/sqlite/src/artifact/**", "packages/adapters/sqlite/migrations/V202610130050__OVE_DATA018__create_artifacts.sql", "packages/testing/src/fakes/InMemoryArtifactRepository.ts", "packages/testing/src/builders/artifact.builder.ts", "packages/testing/src/contracts/ArtifactRepository.contract.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 14"]
adr_refs: [8, 28]
---

# OVE_DATA018: Artifact contract and persistence

## 1. Summary

An Artifact is a stored work product (test report, scan result, diff, document) with a checksum and provenance, used as evidence by Quality Gates. This task defines the record and its repository; the bytes are stored by `OVE_DATA019`.

## 2. Context

SPEC 7: test and scan reports are stored as Artifacts; AI assessment is an opinion, not evidence. SPEC 14: `Artifact(id, workspaceId, pathOrBlobRef, checksum, provenance)`. Artifacts are immutable once written: correcting evidence means a new Artifact.

## 3. Scope (in)

- Zod schemas, port, table, SQLite repository, fake, builder, contract suite, cascade participant `artifacts` (rows only; blob cleanup is registered by DATA019 as external cleanup).

## 4. Out of scope

- Blob storage, hashing, quotas: DATA019. Producing Artifacts: WFRT, PROV, tools. UI: RUNUI.

## 5. Detailed requirements

1. `Artifact` (strict): `id: 'art'`, `workspaceId`, `runId?`, `nodeExecutionId?`, `taskId?`, `kind: 'test_report'|'scan_report'|'diff'|'log_excerpt'|'document'|'screenshot'|'other'` (open enum), `name` (<=200), `mediaType` (allow-list: `text/plain`, `text/markdown`, `application/json`, `application/xml`, `text/html`, `image/png`, `image/jpeg`, `application/pdf`, `application/octet-stream`), `storage: { kind: 'blob', blobId: string /* sha256 hex */ } | { kind: 'project_file', rootId, path }`, `sizeBytes`, `checksum` (sha256 hex of content), `provenance`, `redacted: boolean`, `createdAt`.
2. `ArtifactProvenance`: `{ producer: { kind: 'agent'|'tool'|'engine'|'owner'|'import', id? }, agentId?, skillRef?: {id, version}, command?: string (<=500, redacted), toolVersion?, sourceCommit?, declaredByAgent: boolean }`. `declaredByAgent: true` marks agent-reported evidence (declaration, not proof, SR-19); gates may require `declaredByAgent: false` for tool/engine-produced evidence.
3. Table `artifacts` STRICT: columns above (JSON columns `CHECK json_valid`), `FK workspace_id`, indexes `(workspace_id, created_at)`, `(run_id)`, `(checksum)`; header `-- workspace-scoped: yes`. Rows are immutable: BEFORE UPDATE trigger aborts except column `redacted` going 0->1 together with a new blob (never used in MVP; reserved) -> simply abort all updates; deletion only by cascade (admin flag pattern) or retention (post-MVP).
4. Port: `insert(tx, artifact)`, `get(id)`, `list(workspaceId, opts, { runId?, taskId?, kind? })`, `findByChecksum(workspaceId, checksum)`, `countBytes(workspaceId)` (quota support).
5. Name and command are untrusted text: stored bounded; `command` passes the redactor before insert (use case in DATA019 does it; repository asserts it contains no token-like pattern in non-release builds).
6. Fake `InMemoryArtifactRepository`; builder `anArtifact()`; contract suite via `repositoryContract` (append-only variant) plus workspace isolation and checksum lookup.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

DATA007, DATA008 harness, redaction patterns (ARCH004) for the assertion helper.

## 8. Architecture and code placement

Contracts `packages/contracts/src/artifact/`, port in application, adapter `packages/adapters/sqlite/src/artifact/`.

## 9. Security and safety

Evidence integrity: immutable rows, checksum recorded at write. `project_file` storage refers to a path relative to an Allowed Directory and is re-checked on every read (DATA019). Secrets MUST NOT be stored: producers redact before write; a report containing a secret pattern is stored with `redacted: true` after replacement, never raw.

## 10. Errors and edge cases

- Same checksum stored twice: allowed (two Artifacts may share one blob).
- `mediaType` outside the allow-list: rejected.
- Workspace deleted: rows removed by participant; blobs by external cleanup.

## 11. Acceptance criteria

- [ ] UPDATE and DELETE on `artifacts` fail from a repository.
- [ ] Contract suite passes on SQLite and fake; two Workspaces never see each other's rows.
- [ ] `declaredByAgent` round trips; schema rejects unknown `mediaType`.

## 12. Test plan

Schema tests, contract runners, trigger test. Commands: `pnpm vitest run packages/adapters/sqlite/src/artifact packages/contracts/src/artifact`.

## 13. Parallelization notes

Migration `V202610130050` reserved. WFRT/QA tasks need `contract:Artifact` early.

## 14. Open questions and assumptions

- ASSUMPTION: media-type allow-list above; extend additively.
