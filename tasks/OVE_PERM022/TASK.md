---
id: OVE_PERM022
title: Implement audit maintenance (anchors, chain verification, export, retention)
area: PERM
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_ARCH007, OVE_ARCH012, OVE_ARCH013, OVE_ENGINE029, OVE_PERM019, OVE_PERM020, OVE_PERM021, OVE_SEC002]
soft_depends_on: [OVE_PERM008]
provides: ["usecase:AuditMaintenance", "usecase:VerifyAuditChain", "usecase:ExportAudit", "lib:audit-anchor"]
needs: ["port:AtomicFileWriter", "port:Clock", "port:Scheduler", "port:Notifier", "lib:data-dir", "lib:path-guard"]
owns: ["packages/application/src/audit/maintenance/**", "packages/contracts/src/audit/export.ts", "packages/contracts/src/audit/actions/audit.actions.ts", "apps/engine/src/composition/modules/audit-maintenance.module.ts"]
reads: ["packages/application/src/ports/AuditLog.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 15"]
adr_refs: [3, 8]
---

# OVE_PERM022: Implement audit maintenance

## 1. Summary

Keeps the audit log trustworthy over time: periodic anchors (head hash outside the database), chain verification at start and on demand, redacted NDJSON export, and a retention policy (MVP: keep everything).

## 2. Context

The chain detects tampering inside the database but not removal of the newest events; anchors in the data directory (picked up by BACKUP) close that gap. Export serves reports (SPEC 15). Retention must not silently destroy security evidence.

## 3. Scope (in)

Anchor writer, `VerifyAuditChain`, `ExportAudit`, retention policy object, integrity notification, scheduler jobs.

## 4. Out of scope

Row pruning (not provided), daily DB backup (BACKUP), query routes (PERM023), UI (SETUI/APPRUI).

## 5. Detailed requirements

1. Anchor `{seq, hash, keyId, at}` written atomically (0600) to `<dataDir>/audit/anchors/<date>-<seq>.json` every 500 events, daily and on clean shutdown; keep 90 days. The newest anchor must match the stored row at its seq and the head seq must be >= anchor seq, else `anchor_mismatch`.
2. `VerifyAuditChain({fromSeq?, toSeq?, fullScan})`: last 1000 events at start, full scan monthly and on request; report `{ok, checked, fromSeq, toSeq, head, firstBadSeq?, reason?, anchorsChecked}`. Failure appends `perm.audit.verify_failed`, sets engine status `integrity_warning` and notifies the Owner (high urgency, no sound). Success appends `perm.audit.verified` at most daily. Key rotation segments are verified by `keyId`.
3. `ExportAudit({filter})`: Owner desktop only (authority `audit.export`). The target folder is validated with PathGuard and refused if inside any Workspace Allowed Directory (an Agent could read it). Output is NDJSON of stored (already redacted) events plus an end line `{type:'end', count, headHash, keyId}`; max 1 000 000 events per file, mode 0600, atomic write.
4. Retention: only `keep_all` in MVP. Warn at 2 million events or 2 GB. P2 design in open questions.
5. Jobs never block engine start; scans run in chunks of 5000 rows yielding to the event loop; cancellable via AbortSignal.
6. No Keychain material in exports; `keyId` is opaque.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AtomicFileWriter`, `verifyChain` (PERM019), `AuditLog`, `Notifier`, `PathGuard`, data dir layout (ARCH005), `authorize` (PERM008).

## 8. Architecture and code placement

`packages/application/src/audit/maintenance/{anchor.ts,verify.ts,export.ts,retention.ts}` plus a composition module for scheduling owned here.

## 9. Security and safety

Anchors and exports are evidence outside the DB: owner-only, atomic, kept away from agent-accessible folders. Verification failure is loud and audited. Export never un-redacts. Removing anchors weakens only tail-truncation detection (documented).

## 10. Errors and edge cases

- Fresh install without anchor: chain-only check.
- Backup restored older than the newest anchor: `anchor_mismatch`, reason `rollback_suspected`.
- Unwritable export folder: `data.write_failed`, no partial file.
- Empty filter: file with the end line only.

## 11. Acceptance criteria

- [ ] Anchors are written at thresholds and shutdown, 0600, atomically.
- [ ] Deleting the last 10 events is detected with an anchor; a middle deletion is detected without.
- [ ] Export contains only stored fields plus the proof line and refuses a target inside a Workspace directory.
- [ ] Verification failure audits, sets the warning state and notifies.
- [ ] Scanning 100 000 events blocks the event loop under 50 ms per chunk.

## 12. Test plan

Use case tests with fakes and `FakeClock`; tamper table from PERM019; export path tests; scheduler tests. `pnpm vitest run packages/application/src/audit/maintenance`.

## 13. Parallelization notes

Parallel with PERM023. Tell BACKUP to include `<dataDir>/audit/anchors/`.

## 14. Open questions and assumptions

- ASSUMPTION: no automatic deletion in MVP.
- Open: P2 archive-then-prune (signed `audit.pruned` checkpoint, Local Approval) needs the Owner's retention preference.
