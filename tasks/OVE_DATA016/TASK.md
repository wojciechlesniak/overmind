---
id: OVE_DATA016
title: ProjectDocRef contract, repository, SQLite schema, in-memory fake and contract test
area: DATA
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA007, OVE_DATA008, OVE_DATA009, OVE_DATA010, OVE_TEST003]
soft_depends_on: []
provides: ["contract:ProjectDocRef", "port:ProjectDocRefRepository", "table:project_doc_refs", "lib:project-doc-ref-fake"]
needs: ["lib:repository-base", "port:UnitOfWork", "lib:contract-test-harness"]
owns: ["packages/contracts/src/project-doc/**", "packages/application/src/ports/ProjectDocRefRepository.ts", "packages/adapters/sqlite/src/project-doc/**", "packages/adapters/sqlite/migrations/V202610130040__OVE_DATA016__create_project_doc_refs.sql", "packages/testing/src/fakes/InMemoryProjectDocRefRepository.ts", "packages/testing/src/builders/project-doc-ref.builder.ts", "packages/testing/src/contracts/ProjectDocRefRepository.contract.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 14"]
adr_refs: [16]
---

# OVE_DATA016: ProjectDocRef contract and persistence

## 1. Summary

A ProjectDocRef points at one Markdown file of the Project Documentation inside an Allowed Directory of a Workspace, at a given Git commit. Tasks and Decisions link to it. The database stores the reference and a content digest, never the file.

## 2. Context

ADR 0016: Project Documentation is Markdown in the project folder, versioned in Git, shared by Chief and Agents, read-only for Overmind; every Task must point to the place it follows from. SPEC 14: `ProjectDocRef(workspaceId, path, gitCommit)`.

## 3. Scope (in)

- Zod schema, repository port, table, SQLite repository, fake, builder, contract suite.
- Workspace cascade participant `project-doc-refs`.

## 4. Out of scope

- Registering and reading docs (path checks, Git): `OVE_DATA017`. Task linking: BOARD. Editing documentation: never (Owner edits it outside Overmind).

## 5. Detailed requirements

1. Contract `ProjectDocRef` (strict): `id: EntityId<'pdr'>`, `workspaceId`, `rootId: string` (Allowed Directory id from PERM), `path: string` (relative to the root, `/`-separated, no `..`, no leading `/`, must end `.md` or `.markdown`, <= 512 chars), `gitCommit: string | null` (40 hex lowercase), `contentSha256: string` (64 hex), `sizeBytes: int`, `title: string | null` (first H1, <= 200, extracted by use case), `anchorHint?` is NOT stored. `firstSeenAt`, `lastVerifiedAt`, `status: 'ok' | 'missing' | 'changed' | 'outside_allowed'`.
2. Table `project_doc_refs` STRICT: columns as above; `UNIQUE(workspace_id, root_id, path, COALESCE(git_commit,''))`; FK `workspace_id` to `workspaces(id)`; `CHECK(path NOT LIKE '/%' AND path NOT LIKE '%..%')` as defence in depth; index `(workspace_id, status)`; header `-- workspace-scoped: yes`.
3. Port: `upsert(tx, ref)` (same key updates `lastVerifiedAt`/status/digest), `get(id)`, `findByPath(workspaceId, rootId, path, commit?)`, `list(workspaceId, opts, filter?: { status?, pathPrefix? })`, `markStatus(tx, id, status, at)`, `deleteStale(tx, workspaceId, olderThan)` (only refs not referenced by Tasks/Decisions: referenced-by check is done through an injected `ReferenceCounter` multi-port to avoid knowing BOARD's tables; default none = nothing deleted).
4. Refs are immutable identifiers: a new commit or changed digest creates a NEW row (history preserved, Tasks keep pointing at the commit they were planned from); `status` is the only mutable column besides `lastVerifiedAt`.
5. Participant `project-doc-refs` deletes rows for the Workspace.
6. Fake and builder `aProjectDocRef()`; contract suite uses `repositoryContract` plus path CHECK tests (a stored `../x` is impossible) and Workspace isolation.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

DATA007 helpers, `repositoryContract`, id prefix `pdr` from DATA009.

## 8. Architecture and code placement

Contracts `packages/contracts/src/project-doc/`, port in application, adapter `packages/adapters/sqlite/src/project-doc/`. No filesystem or Git access in this task.

## 9. Security and safety

Only relative, normalised paths are stored; the DB constraint backs up the use case. The table never holds file content. A ref is a pointer and grants no access: reading always re-checks the path against current Allowed Directories (DATA017, SEC002). Document text is untrusted data (SR-08).

## 10. Errors and edge cases

- Same file at two commits: two rows.
- Path with Unicode normalisation differences: stored NFC.
- File renamed: old ref turns `missing` on verify, new ref created on next registration.
- Very long paths: rejected at 512.

## 11. Acceptance criteria

- [ ] Insert with `../secret.md` fails at schema and at DB level.
- [ ] Re-registering identical path+commit updates `lastVerifiedAt` without a second row.
- [ ] Contract suite passes on SQLite and fake; cascade removes only the Workspace's rows.

## 12. Test plan

Schema table tests, contract runners, DB constraint test with raw SQL. Commands: `pnpm vitest run packages/adapters/sqlite/src/project-doc packages/contracts/src/project-doc`.

## 13. Parallelization notes

Migration `V202610130040` reserved. BOARD and DEC need `contract:ProjectDocRef` early (just the id and schema).

## 14. Open questions and assumptions

- ASSUMPTION: new commit equals new row so Task provenance stays exact.
