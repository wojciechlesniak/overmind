---
id: OVE_BACKUP006
title: "Schedule the daily backup: 03:00 default, sleep catch-up, single-flight, runs while paused"
area: BACKUP
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH007, OVE_ARCH010, OVE_BACKUP001, OVE_BACKUP002, OVE_BACKUP003, OVE_BACKUP004, OVE_BACKUP005]
soft_depends_on: ["OVE_PAUSE005"]
provides: ["service:BackupScheduler", "lib:backup-job-runner"]
needs: ["port:Clock", "port:ConfigStore", "port:EventBus", "port:Logger"]
owns: ["packages/application/src/backup/scheduler/**", "packages/adapters/backup/src/job/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5]
---

# OVE_BACKUP006: Schedule the daily backup: 03:00 default, sleep catch-up, single-flight, runs while paused

## 1. Summary

Decides when backups run and executes the pipeline: snapshot, manifest, retention, event. Catches up after sleep and never runs two jobs at once.

## 2. Context

SPEC 12 and 16: the local database is the Owner's memory; losing it loses the organisation. Backup is a daily local job plus manual export, restore is a staged, explicit operation. ARCH005 defines `config.backup { enabled, time:'03:00', retentionDays:14 }`, `backups/backup-target.json` (0600) and `db/snapshots/` (owned here); DATA001 exposes `SqliteDatabase.backupTo(dest)`. The engine may sleep with the lid closed or be off at 03:00.

## 3. Scope (in)

- `BackupJobRunner` implementation (pipeline).
- Scheduler with next-run computation and catch-up.
- Single-flight lock.

## 4. Out of scope

- Failure notification and manual run: BACKUP007.

## 5. Detailed requirements

1. Pipeline: validate folder -> snapshot -> write manifest -> verify -> retention -> persist `lastSuccess` -> emit `backup.completed`. Any failure emits `backup.failed` with the error code and keeps older backups.
2. Scheduler: next run = next local `time`; on engine start or wake, if the last successful scheduled backup is older than 24 hours and the planned time has passed, run once within 2 minutes after start (catch-up). Uses `Clock`; timers recomputed on wake and on settings change.
3. Single-flight: a second `run` while one is active returns `backup.already_running`; manual request during a scheduled run attaches to its result.
4. Backup is NOT a PauseParticipant: it runs while globally paused (safety must not depend on pause). Documented in a comment and tested.
5. Disabled setting: no scheduled run, manual still works.
6. Failure backoff: after a failed scheduled run retry once after 30 minutes, then wait for the next day; each failure notifies (BACKUP007) but at most once per day.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Snapshotter, format, retention, `Clock`.

## 8. Architecture and code placement

Scheduler in `packages/application/src/backup/scheduler/`; concrete runner in `packages/adapters/backup/src/job/`.

## 9. Security and safety

- The job runs with engine rights and only writes inside the validated folder; folder re-validated at every run (TOCTOU).

## 10. Errors and edge cases

- DST change: next-run computed in local time with a test for 02:30 gaps.
- Engine killed mid-run: temp swept next start, catch-up runs.
- Clock jump backward: no duplicate run for the same day.

## 11. Acceptance criteria

- [ ] Fake clock tests: normal, catch-up, disabled, DST.
- [ ] Concurrent runs rejected.
- [ ] Runs while paused.
- [ ] Failed run keeps previous backups and emits `backup.failed` once.

## 12. Test plan

Unit with fake clock and in-memory fakes plus one integration: `scheduler.test.ts`, `job-pipeline.test.ts`, `single-flight.test.ts`. Command: `pnpm vitest run packages/application/src/backup/scheduler packages/adapters/backup/src/job`.

## 13. Parallelization notes

After BACKUP002-005.

## 14. Open questions and assumptions

- ASSUMPTION: no `powermetrics`/wake hooks; catch-up on timer drift detection is enough.
