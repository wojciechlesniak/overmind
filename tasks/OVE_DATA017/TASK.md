---
id: OVE_DATA017
title: ProjectDocRef use cases (register, verify, read excerpt, list) with path and Git checks
area: DATA
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH009, OVE_ARCH014, OVE_DATA002, OVE_DATA016, OVE_PERM031, OVE_SEC002]
soft_depends_on: []
provides: ["usecase:RegisterProjectDoc", "usecase:VerifyProjectDocs", "usecase:ReadProjectDoc", "usecase:ListProjectDocs", "port:GitInfoReader", "api:project_docs.list", "api:project_docs.register", "api:project_docs.read", "api:project_docs.verify", "port:ProjectDocResolver"]
needs: ["lib:path-guard", "port:PathProbe", "port:ProcessRunner", "port:UnitOfWork", "port:Clock", "port:IdGenerator", "port:AllowedDirectoryReader", "lib:route-module"]
owns: ["packages/application/src/data/project-doc/**", "packages/application/src/ports/GitInfoReader.ts", "packages/adapters/system/src/git-info/**", "packages/contracts/src/project-doc/project-doc.routes.ts", "packages/gateway/src/routes/data/project-docs-*.route.ts", "apps/engine/src/composition/modules/data-project-doc.module.ts"]
reads: ["packages/application/src/ports/ProjectDocRefRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 11"]
adr_refs: [3, 16]
---

# OVE_DATA017: ProjectDocRef use cases

## 1. Summary

Register Markdown documentation files of a Workspace, verify them against disk and Git, and read bounded excerpts for Chief and Agents. Read-only: Overmind never writes Project Documentation.

## 2. Context

Chief creates Tasks from the Documentation and each Task links to a place in it (SPEC 6). The files live in an Allowed Directory (host side, or the same mount inside the sandbox). Host-side reads by the engine use `PathGuard.resolveForAccess` + `openVerified` (SEC002) to defeat symlink tricks. Git state is read with the `git` binary through `ProcessRunner` (no shell).

## 3. Scope (in)

- Four use cases, `GitInfoReader` port and system adapter, routes, module.

## 4. Out of scope

- Scanning a whole repository for docs automatically (Chief proposes registrations; later). Writing docs (never). Task linking (BOARD).

## 5. Detailed requirements

1. `RegisterProjectDoc { workspaceId, rootId, path }`: (a) fetch the Allowed Directory roots via `AllowedDirectoryReader` (PERM port; list of `{ rootId, canonicalPath, mode }` for the Workspace); empty list -> `perm.no_allowed_directories` (deny by default); (b) `PathGuard.resolveForAccess({ input: join(root, path), roots, mode: 'read' })`; any denial maps to the PathGuard error (audit-worthy log); (c) file must be a regular file, size <= 1 MiB, extension `.md`/`.markdown`; (d) read via `openVerified`, compute SHA-256, title = first `# ` heading (<= 200 chars, control characters stripped); (e) `GitInfoReader.headCommit(rootCanonical)` and `isTracked(path)` -> `gitCommit` (null if not a repo); (f) upsert in one transaction. Caller: owner, chief (internal), never agent-scope for registration.
2. `VerifyProjectDocs { workspaceId }`: for each ref, re-resolve and re-hash, set status `ok`/`changed`/`missing`/`outside_allowed` (e.g. root removed); emits `project_doc.status_changed` only on change (non-persisted hint event plus persisted `project_doc.changed` for `changed|missing`). Runs at Run start for referenced docs and on demand; bounded to 500 refs per call.
3. `ReadProjectDoc { id, maxBytes<=65536, range? }` returns text excerpt after re-verifying path and digest (if the file changed since registration the result carries `stale: true` and the new digest; callers decide). Agent-scope may read refs of their own Workspace only; content is returned marked `untrusted: true` with the instruction fence applied by SEC004 consumers, not here.
4. `GitInfoReader` port: `headCommit(dir)`, `fileLastCommit(dir, relPath)`, `isTracked`, `isDirty(path)`; adapter calls `git` via `ProcessRunner` with argv arrays, `cwd` = canonical root, env minimal (`GIT_CONFIG_NOSYSTEM=1`, `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`), 5 s timeout, output cap 64 KiB, no hooks run (read-only commands only, `-c core.fsmonitor=false`).
5. Routes: `GET /v1/workspaces/{id}/project-docs` (owner, agent own), `POST /v1/workspaces/{id}/project-docs` (owner), `POST /v1/project-docs/{id}/verify` (owner), `GET /v1/project-docs/{id}/content` (owner, agent own; `maxBytes` query).
6. Errors: `data.doc_too_large`, `data.doc_not_markdown`, `data.git_unavailable` (non-fatal: `gitCommit` null), plus PathGuard `path.*` codes.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`PathGuard`/`PathProbe` (SEC002), `ProcessRunner` (ARCH014), repository (DATA016), `AllowedDirectoryReader` (PERM, read-only view of roots), UnitOfWork.

## 8. Architecture and code placement

Use cases in `packages/application/src/data/project-doc/`; `GitInfoReader` port in application, adapter in `packages/adapters/system/src/git-info/` (uses ProcessRunner, adapter-to-adapter dependency avoided by receiving the port in the constructor).

## 9. Security and safety

Never trust the path string from UI/Agent: canonicalise engine-side; symlinks and mounts handled by PathGuard; open with `O_NOFOLLOW` and inode comparison. Git invoked without a shell, hooks and filesystem monitors disabled, repository config from an untrusted repo cannot run commands (`-c core.fsmonitor=false`, `-c protocol.allow=never`; `GIT_CONFIG_GLOBAL=/dev/null`). Size limits prevent memory exhaustion. Content is data, never instructions (SR-08).

## 10. Errors and edge cases

- Root removed after registration: status `outside_allowed`, reads denied.
- Symlink to a file outside the root: `path.outside_allowed`.
- Binary file named `.md`: rejected if it contains NUL bytes in the first 8 KiB.
- Git missing: `gitCommit` null, warning logged once.
- Huge repo, slow `git`: 5 s timeout then null.
- File changed between hash and read: `path.changed_during_check`.

## 11. Acceptance criteria

- [ ] Registering a path outside every root fails with the PathGuard code and writes no row.
- [ ] A symlink escaping the root is denied (matrix row in tests).
- [ ] With no Allowed Directories, registration is denied.
- [ ] Verify marks a modified file `changed` and a deleted file `missing`.
- [ ] Agent-scope read of another Workspace's ref returns not found.
- [ ] `git` is spawned with argv only and the hardened env (assert via `FakeProcessRunner`).

## 12. Test plan

Use-case tests with `FakePathProbe`, `FakeProcessRunner`; real temp-dir integration with a real `git` repo on CI; hostile path corpus from SEC002. Commands: `pnpm vitest run packages/application/src/data/project-doc packages/adapters/system/src/git-info`.

## 13. Parallelization notes

Needs PERM's `AllowedDirectoryReader` (flagged capability). Adapter dir is separate from other `adapters/system` owners.

## 14. Open questions and assumptions

- ASSUMPTION: `AllowedDirectoryReader` is provided by PERM as a small read port.
- ASSUMPTION: 1 MiB per doc, 500 refs per verify call.
