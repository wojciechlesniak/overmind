---
id: OVE_DATA006
title: Add the event hash chain, integrity verification, checkpoints table and replay reader
area: DATA
kind: infra
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA002, OVE_DATA005]
soft_depends_on: []
provides: ["lib:integrity-chain", "port:CheckpointStore", "table:run_checkpoints", "lib:event-replay"]
needs: ["port:EventStore", "port:UnitOfWork"]
owns: ["packages/adapters/sqlite/src/events/hash-chain.ts", "packages/adapters/sqlite/src/events/integrity-verifier.ts", "packages/adapters/sqlite/src/events/checkpoint-repository.ts", "packages/adapters/sqlite/src/events/replay.ts", "packages/application/src/ports/CheckpointStore.ts", "packages/adapters/sqlite/migrations/V202610130011__OVE_DATA006__create_run_checkpoints.sql"]
reads: ["packages/application/src/ports/EventStore.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 12", "SPECIFICATION 15"]
adr_refs: [5, 8, 19]
---

# OVE_DATA006: Add the event hash chain, integrity verification, checkpoints and replay

## 1. Summary

Make tampering and corruption of the event log detectable (hash chain), give Runs durable checkpoints, and provide the replay reader that rebuilds Run state from events plus the latest checkpoint.

## 2. Context

SR-17 wants security-relevant decisions in append-only records. A hash chain does not stop a local attacker with file access (they can recompute), so it is documented as tamper-EVIDENCE against accidental corruption and naive edits, not a security boundary. It is cheap, so we do it. Checkpoints (SPEC 7, 12) let recovery start from a snapshot instead of replaying a long Run. WFRT defines checkpoint content; this task stores it opaquely.

## 3. Scope (in)

- Chain fields in `event_log` (`prev_hash`, `hash`) computed on append.
- `verifyChain({ fromSeq, toSeq })` and a startup quick-verify of the last N events.
- `CheckpointStore` port + `run_checkpoints` table.
- `replayRun(runId, reducer)` helper.
- Reusable `integrity-chain` utility for the PERM audit table.

## 4. Out of scope

- The semantics of checkpoint payloads and the reducer: WFRT. Recovery orchestration at start: `OVE_ENGINE005`. Audit table: PERM (may adopt the chain utility).

## 5. Detailed requirements

1. Hash: `hash = sha256(prevHash || '\n' || canonicalJson({ id, type, schemaVersion, occurredAt, workspaceId, runId, runSeq, actor, correlationId, causationId, payload }))`, canonical JSON = sorted keys, no whitespace, UTF-8. `prev_hash` of the first row is 64 zeros. Computation happens inside `append` in the same transaction (reads the previous hash from an in-memory cache of the writer, refreshed from the DB when empty).
2. Chain scope: ONE global chain ordered by `seq`. Because deletion by Workspace cascade breaks a global chain, the cascade writes a `chain.reanchored` tombstone event whose payload carries `{ removedSeqRange, lastHashBefore, firstHashAfter }` and subsequent rows link to the tombstone (documented algorithm; verifier honours tombstones).
3. `verifyChain` streams rows in batches of 5000 and returns `{ ok, checked, firstBad?: { seq, expected, found } }`. Startup quick verify: last 1000 events plus the checkpoint heads; a failure marks the engine `degraded` (ENGINE health) and writes a `system.integrity_failed` event to a side table `integrity_findings` (NOT the chain); it does not stop the engine by itself.
4. Full verify is available as `pnpm`-free engine command via the diagnostics API (`api:system.diagnostics`, ENGINE019) and nightly in BACKUP verification.
5. Table `run_checkpoints(run_id TEXT NOT NULL, checkpoint_seq INTEGER NOT NULL, at_event_seq INTEGER NOT NULL, schema_version INTEGER NOT NULL, state_json TEXT NOT NULL CHECK(json_valid(state_json)), created_at TEXT NOT NULL, PRIMARY KEY(run_id, checkpoint_seq))`; max 256 KiB per row; keep the newest 5 per Run (older deleted by `prune`, the only delete path besides cascade).
6. Port `CheckpointStore`: `save(tx, { runId, atEventSeq, schemaVersion, state }) -> Result<void>` (checkpoint_seq auto-increments; `at_event_seq` must be the current head of that Run, else `data.version_conflict`), `latest(runId)`, `prune(runId)`.
7. `replayRun(runId, { reducer, initial })`: loads the latest checkpoint (if its `schema_version` is understood by the reducer's `canLoad`), then streams events with `run_seq > checkpoint's run_seq` in order, folding them; returns `{ state, lastRunSeq }`. Gap detection: a missing `run_seq` returns `data.event_gap` (fail closed; recovery escalates).
8. Event idempotency aid: `hasEvent({ runId, type, keyFields })` helper for "was this action started" lookups used by recovery (indexed by correlation id).
9. The chain utility is exported as a pure function `computeChainHash(prev, canonicalPayload)` for PERM.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Canonical JSON helper `canonicalJson()` from `packages/adapters/sqlite/src/core/canonical-json.ts` (owned by OVE_DATA007), `EventStore` (DATA005), UnitOfWork.

## 8. Architecture and code placement

`packages/adapters/sqlite/src/events/` (adapter). `CheckpointStore` port in application so WFRT depends on the port only. Replay helper is pure over `EventStore` + reducer, so it also works on the in-memory fake.

## 9. Security and safety

Documented limits: the chain detects accidental corruption and non-recomputing edits; it is not proof against an attacker who can write the file (they can recompute). Backups include the chain so a restore can be verified. A failed verification never auto-repairs; the Owner is informed via diagnostics. Checkpoints contain run state only: no secrets (WFRT rule), size-capped.

## 10. Errors and edge cases

- Row edited out of band: verifier reports the first bad `seq`; engine degraded, runs continue (reads only), writes still allowed unless the Owner chooses otherwise (open question).
- Checkpoint saved with stale `at_event_seq`: rejected.
- Upcast failure during replay: `validation.event_upcast_failed`, Run escalated.
- Millions of events: verify is streaming, memory constant.

## 11. Acceptance criteria

- [ ] Given appended events, then each row's `hash` verifies; changing one payload byte in the DB makes `verifyChain` report that `seq`.
- [ ] Given a Workspace cascade, then the tombstone keeps the chain verifiable.
- [ ] Given a checkpoint and later events, then `replayRun` yields the same state as a full replay (property test).
- [ ] Given a missing `run_seq`, then `data.event_gap`.
- [ ] Given six checkpoints, then only the newest five remain after `prune`.

## 12. Test plan

Unit: canonical JSON stability, hash vectors (golden). Integration: tamper tests via raw SQL on a temp DB (bypassing triggers by dropping them in the test only), property test replay equivalence with fast-check, large-run benchmark. Commands: `pnpm vitest run packages/adapters/sqlite/src/events`.

## 13. Parallelization notes

After DATA005. ENGINE005 (recovery) and WFRT persistence use `CheckpointStore`/`replayRun`.

## 14. Open questions and assumptions

- ASSUMPTION: one global chain; per-workspace chains would simplify cascade but lose global ordering proof.
- Open: on chain failure should writes be blocked? Default no (degraded, visible in diagnostics).
