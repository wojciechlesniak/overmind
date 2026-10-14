---
id: OVE_DATA019
title: Content-addressed artifact blob store with quotas and the StoreArtifact use case
area: DATA
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH007, OVE_ARCH009, OVE_ARCH013, OVE_DATA002, OVE_DATA012, OVE_DATA018, OVE_SEC002]
soft_depends_on: [OVE_SEC002]
provides: ["port:BlobStore", "usecase:StoreArtifact", "usecase:ReadArtifact", "api:artifacts.list", "api:artifacts.get", "api:artifacts.content"]
needs: ["lib:data-dir", "port:Clock", "port:UnitOfWork", "port:Logger", "lib:redaction", "lib:path-guard", "lib:route-module"]
owns: ["packages/application/src/ports/BlobStore.ts", "packages/adapters/system/src/blob-store/**", "packages/application/src/data/artifact/**", "packages/contracts/src/artifact/artifact.routes.ts", "packages/gateway/src/routes/data/artifacts-*.route.ts", "apps/engine/src/composition/modules/data-artifact.module.ts"]
reads: ["packages/application/src/ports/ArtifactRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 14"]
adr_refs: [8]
---

# OVE_DATA019: Artifact blob store and use cases

## 1. Summary

Store Artifact bytes under `artifacts/` in the data directory, addressed by SHA-256, with size and quota limits, redaction of text before storage, and use cases to store and read Artifacts.

## 2. Context

ARCH005 reserves `artifacts/` (0700, content-addressed). Evidence is produced by tools, agents and the engine; Quality Gates and the UI read it. Blobs must survive Workspace deletion only until the cascade's external cleanup runs.

## 3. Scope (in)

- `BlobStore` port + filesystem adapter.
- `StoreArtifact`, `ReadArtifact`, listing routes, cascade external cleanup for blobs.

## 4. Out of scope

- Artifact producers. Garbage collection of orphan blobs beyond the cascade: a maintenance task later (documented). Backup of blobs: BACKUP.

## 5. Detailed requirements

1. `BlobStore`: `put(stream | bytes, { maxBytes }) -> Result<{ blobId: string; sizeBytes: number }>` (writes to `artifacts/tmp/<ulid>` with mode 0600, hashes while streaming, `fsync`, renames to `artifacts/<aa>/<bb>/<sha256>` (2+2 hex fan-out, dir 0700); if exists, discards tmp and returns existing); `open(blobId) -> Result<ReadableStream>`; `stat`; `delete(blobId)` (used only by cleanup); `exists`.
2. Limits: per blob 50 MiB (config `artifacts.maxBlobBytes`), per Workspace 2 GiB (`countBytes`), exceeding returns `data.quota_exceeded` (ASSUMPTION values). Streaming; never buffer more than 1 MiB for hashing.
3. Reads verify integrity lazily: `ReadArtifact` re-hashes when the size is under 5 MiB or on `verify=true`; mismatch -> `data.checksum_mismatch` and a `system.integrity_failed` finding.
4. `StoreArtifact { workspaceId, runId?, kind, name, mediaType, content | projectFile{rootId,path}, provenance }`: text-like media types pass the redactor (ARCH004 patterns) and, if anything was replaced, `redacted: true`; `project_file` variant resolves via PathGuard, stores a reference only (no copy) plus current checksum; inserts the Artifact row and appends `artifact.stored` (persisted event: `{artifactId, kind, runId?, sizeBytes}`) in one transaction. The blob is written BEFORE the transaction; if the transaction fails the orphan blob remains for GC (documented, harmless, content-addressed).
5. `ReadArtifact { id, range? }`: caller `owner`, or `agent` for own Run's Workspace; content returned with `Content-Type` from the record and header `X-Overmind-Untrusted: 1`; HTML and SVG are served as `text/plain` with `Content-Disposition: attachment` to prevent script execution in the webview (SR-35).
6. Routes: `GET /v1/workspaces/{id}/artifacts`, `GET /v1/artifacts/{id}`, `GET /v1/artifacts/{id}/content`. Creation by agents goes through their own report routes (WFRT/AGENT) calling `StoreArtifact`.
7. Cascade: participant `artifacts` (DATA018 rows) adds `describeExternal` listing blob ids not referenced by any other Workspace's Artifact (checked via `findByChecksum` across Workspaces); cleanup deletes them idempotently via `pending_cleanups`.
8. Directory initialisation uses `DataDirLayout.artifactsDir` and the initializer (ARCH005); no literal paths.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AtomicFileWriter` is not used for large blobs (16 MiB cap, ARCH013); this adapter reuses its tmp+fsync+rename pattern and the symlink refusal helper by calling the shared `assertNoSymlink` exported by ARCH013 where available. `Clock`, redaction (ARCH004), PathGuard (SEC002).

## 8. Architecture and code placement

Port in application; adapter `packages/adapters/system/src/blob-store/`; use cases `packages/application/src/data/artifact/`.

## 9. Security and safety

Content-addressing prevents path injection (blob ids are hex only, validated `^[0-9a-f]{64}$`). Files 0600 under 0700 directories; symlinks refused. Stored text is redacted; binary content is not scanned (documented). Served content cannot execute in the UI. Quota prevents disk exhaustion by a runaway agent (SR-37). Agents never get host blob paths.

## 10. Errors and edge cases

- Disk full mid-write: tmp removed, `data.disk_full`.
- Crash between blob write and DB insert: orphan blob, collected later.
- Two concurrent puts of equal content: second sees existing file, no error.
- `project_file` changed after storing: `ReadArtifact` reports `stale: true` with current checksum.
- Blob missing on disk: `data.blob_missing`, finding recorded.

## 11. Acceptance criteria

- [ ] Same bytes stored twice yield one file and two Artifact rows.
- [ ] A 51 MiB upload is rejected and leaves no tmp file.
- [ ] A text report containing a fake API key is stored redacted with `redacted: true`.
- [ ] HTML Artifact is served as attachment `text/plain`.
- [ ] Tampering with a blob file makes `ReadArtifact(verify)` fail with `data.checksum_mismatch`.
- [ ] Workspace deletion removes blobs not shared with other Workspaces.

## 12. Test plan

BlobStore contract suite (`BlobStore.contract.ts`, file owned here) for fs adapter and an in-memory fake; use-case tests; fault test via kill during put. Commands: `pnpm vitest run packages/adapters/system/src/blob-store packages/application/src/data/artifact`.

## 13. Parallelization notes

The in-memory `InMemoryBlobStore` lives in `packages/testing/src/fakes/` and is added via proposal to TEST002 owners or created here under the generated-barrel convention (file name unique, no edit of shared files): created here.

## 14. Open questions and assumptions

- ASSUMPTION: 50 MiB/blob and 2 GiB/Workspace defaults.
- ASSUMPTION: orphan blob GC is post-MVP.
