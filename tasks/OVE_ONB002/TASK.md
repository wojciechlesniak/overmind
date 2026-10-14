---
id: OVE_ONB002
title: "Persist the onboarding state in SQLite with a repository port, migration and fake"
area: ONB
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA001, OVE_DATA002, OVE_DATA003, OVE_DATA007, OVE_ONB001, OVE_TEST003]
soft_depends_on: []
provides: ["port:OnboardingRepository", "table:onboarding_state", "lib:memory-onboarding-repo"]
needs: ["port:SqliteDatabase", "port:UnitOfWork", "lib:repository-base", "lib:migration-runner", "lib:contract-test-harness"]
owns: ["packages/application/src/ports/OnboardingRepository.ts", "packages/adapters/sqlite/src/onboarding/**", "packages/adapters/sqlite/migrations/V202610140010__OVE_ONB002__onboarding_state.sql", "packages/testing/src/fakes/InMemoryOnboardingRepository.ts", "packages/testing/src/builders/onboarding.builder.ts", "packages/testing/src/contracts/OnboardingRepository.contract.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [10]
---

# OVE_ONB002: Persist the onboarding state in SQLite with a repository port, migration and fake

## 1. Summary

Adds the `OnboardingRepository` port, the single-row SQLite table `onboarding_state` with a forward-only migration, an in-memory fake and the contract tests shared by both, so the wizard can resume after a quit or crash.

## 2. Context

The wizard resumes at the stored step (SPEC 16.1 first run). Installation = one Owner (ADR 0010), so the state is one row per installation, not per Workspace. It must survive a crash between steps, be idempotent to repeat writes and not store secrets: the Telegram bot token goes to the Keychain through TG012, never here. DATA infrastructure provides `SqliteDatabase`, the migration runner and repository utilities; this task adds only the onboarding table.

## 3. Scope (in)

- Port `OnboardingRepository` (`packages/application/src/ports/OnboardingRepository.ts`).
- SQLite adapter `packages/adapters/sqlite/src/onboarding/**` and migration `V202610140010__OVE_ONB002__onboarding_state.sql`.
- In-memory fake and builder, and a shared contract test suite.
- Row-to-domain mapping with zod validation on read.

## 4. Out of scope

- Use cases and rules (ONB003).
- Backup/restore handling of this table (BACKUP area reads via its participant interface).
- Deleting the row (no reset feature in MVP).

## 5. Detailed requirements

1. **Table** `onboarding_state(id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('not_started','in_progress','completed')), current_step INTEGER NOT NULL CHECK (current_step BETWEEN 1 AND 4), steps_json TEXT NOT NULL, started_at TEXT, completed_at TEXT, updated_at TEXT NOT NULL, row_version INTEGER NOT NULL DEFAULT 1)`. `steps_json` holds the step results validated by the contract schema (max 4 KiB, CHECK `length(steps_json) <= 4096`).
2. **Port.** `get(): Promise<OnboardingState | null>` (null = never started), `save(state, expectedRowVersion?): Promise<Result<OnboardingState>>` with optimistic concurrency (`data.version_conflict` on mismatch), `markCompleted(at): Promise<Result<OnboardingState>>` (single transaction, refuses unless invariants hold). No delete method.
3. **Initialisation.** The first `get()` returns `null`; ONB003 creates the row on first progress; the table is never pre-seeded by the migration (so 'not_started' = no row, avoiding a fake started timestamp).
4. **Integrity.** On read, `steps_json` that fails the schema returns `data.corrupt_record` with the row kept; ONB003 decides repair (reset step data but keep `completed` flag if present). The reader never throws raw parse errors.
5. **Transactions.** Writes use the `UnitOfWork` (DATA002); `save` and the outbox event `onboarding.state_changed` publish atomically.
6. **Fake.** `InMemoryOnboardingRepository` implements the same optimistic concurrency; both adapters run the shared contract suite (`OnboardingRepository.contract.ts`).
7. **Migration naming** follows the ARCH009 pattern; the migration is additive and idempotent in CI (apply twice test via runner checksum).
8. **No secrets.** A test greps the schema and the builder for fields named token, secret, password, code (must not exist).

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `SqliteDatabase`, `UnitOfWork`, `repository-base`, migration runner (DATA001..003, DATA007), contract-test harness (TEST003).

## 8. Architecture and code placement

Port in `packages/application/src/ports/OnboardingRepository.ts`; adapter in `packages/adapters/sqlite/src/onboarding/`; fake in `packages/testing/src/fakes/InMemoryOnboardingRepository.ts`; builder in `packages/testing/src/builders/onboarding.builder.ts`; contract suite in `packages/testing/src/contracts/OnboardingRepository.contract.ts`.

## 9. Security and safety

- No secrets or paths beyond the display path stored in `steps_json.folder.displayPath` (already display form with `~`).
- The table is covered by the backup participant (BACKUP) as ordinary data; restored state is sanitised by ONB003 rules so a restore cannot mark a fresh machine as completed without folder and isolation (the completion gate is re-evaluated at app start).
- Size CHECK prevents the row from becoming a data sink.

## 10. Errors and edge cases

- Concurrent saves from two windows (main and tray should not write, but dev tools might): the second gets a version conflict.
- Process killed between steps: row reflects the last committed step.
- Corrupt JSON after manual edit: `data.corrupt_record`.
- Clock goes backwards: `updated_at` still monotonic by ONB003 (uses `Clock` port), not enforced here.
- Database locked: surfaced as `data.busy` per DATA001 conventions.

## 11. Acceptance criteria

- [ ] Given no row then `get()` returns null.
- [ ] Given two saves with the same expected row version then the second fails with a version conflict.
- [ ] Given `markCompleted` with incomplete steps then it is refused.
- [ ] Given corrupt JSON then `get()` returns `data.corrupt_record`.
- [ ] Given the shared suite then both the SQLite adapter and the fake pass it.

## 12. Test plan

- Contract suite run against both implementations; migration test on a fresh database and on a database with prior migrations.
- Commands: `pnpm vitest run packages/adapters/sqlite/src/onboarding packages/testing/src/contracts/OnboardingRepository`.

## 13. Parallelization notes

After ONB001 and DATA001..003. Parallel with ONB004 and ONB006.

## 14. Open questions and assumptions

- ASSUMPTION: single-row table; per-Workspace onboarding does not exist in the MVP.
- OPEN: BACKUP policy for this table (include in backups: yes by default).
