---
id: OVE_MEM011
title: "Add memory backup, restore and export hooks"
area: MEM
kind: infra
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_BACKUP003, OVE_MEM003, OVE_MEM004]
soft_depends_on: ["OVE_DATA010"]
provides: ["adapter:MemoryBackupContributor", "usecase:memory.export"]
needs: ["port:BackupContributor", "port:AgentMemoryRepository", "port:MemoryIndex"]
owns: ["packages/adapters/sqlite/src/memory/backup/**", "packages/application/src/memory/export/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [14]
---

# OVE_MEM011: Add memory backup, restore and export hooks

## 1. Summary

Register memory with the backup system, verify content hashes and rebuild FTS after restore, and offer an Owner export of Agent Memory.

## 2. Context

ADR 0014: memory is local; Owner owns all data. Restored data must keep immutability and indexes consistent.

## 3. Scope (in)

- Contributor, post-restore verification, export use case.

## 4. Out of scope

- Backup engine: DATA.

## 5. Detailed requirements

1. Contributor exports entries as JSON lines with `contentHash`.
2. After restore: recompute hashes, report mismatches as quarantined, rebuild FTS.
3. Owner export covers all Workspaces the Owner may see; isolated Workspaces are included for the Owner and marked.
4. Export writes through the file port with path canonicalisation.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

BackupContributor port.

## 8. Architecture and code placement

Adapter plus use case.

## 9. Security and safety

Hash check detects tampering; export is Owner only; no secrets since content was redacted at write time.

## 10. Errors and edge cases

- Hash mismatch: entry quarantined, listed in the restore report.

## 11. Acceptance criteria

- [ ] Round trip preserves entries and index.
- [ ] Tampered row quarantined.
- [ ] Export denied to non-Owner callers.

## 12. Test plan

- Adapter tests. Commands: `pnpm vitest run packages/adapters/sqlite/src/memory/backup`.

## 13. Parallelization notes

Independent.

## 14. Open questions and assumptions

- Open: whether export is encrypted. Default: plain JSON to Owner-chosen path.
