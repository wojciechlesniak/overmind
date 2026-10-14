---
id: OVE_TEST011
title: Build the crash and restart recovery test harness with fault injection
area: TEST
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_ARCH010, OVE_DATA005, OVE_ENGINE002, OVE_TEST002, OVE_TEST006, OVE_WFRT052]
soft_depends_on: [OVE_TEST009, OVE_TEST003]
provides: ["lib:recovery-harness", "lib:fault-injection"]
needs: ["lib:engine-entry", "table:event_log", "usecase:StartRun"]
owns: ["apps/engine/test/recovery/**", "packages/testing/src/recovery/**", "apps/engine/src/faults/**", "docs/testing/recovery.md"]
reads: ["docs/architecture/data-directory.md", "docs/architecture/events.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 19, 26]
---

# OVE_TEST011: Build the crash and restart recovery test harness with fault injection

## 1. Summary

A harness that kills and restarts the real engine at precise points while a Run is executing and then proves the guarantees of SPEC 16 criterion 7: the window can close, a restart resumes Runs from the event log, no non-idempotent action is repeated, no event is lost or duplicated, and the database is intact. It adds a compile-time-removable fault injection mechanism to the engine.

## 2. Context

ADR 0005/0019: Run state is an append-only event stream in SQLite (WAL); after restart the engine rebuilds checkpoints and resumes; non-idempotent actions (sending messages, commits, payments, `git push`, typing a command into a CLI) are never blindly repeated. Prototype: herdr restores sessions after `kill -9`, but a prompt sent right before the crash may or may not have been delivered. The engine must therefore record intent and outcome separately (`action.started` before, `action.completed` after) and on recovery treat "started without completed" for non-idempotent actions as `needs_decision`/Escalation instead of re-running.

## 3. Scope (in)

- Fault-injection facility in the engine: named crash points and error points enabled by `OVERMIND_FAULTS` (non-release builds only).
- Harness to spawn the engine as a child process on a temp data directory with fake CLIs/herdr, drive a scripted Run, crash at a point, restart and assert.
- Reusable invariant checkers (event log gaps/duplicates, SQLite integrity, side-effect counters, idempotency).
- Scenario catalogue and docs.

## 4. Out of scope

- Implementing recovery in the runtime (WFRT/DATA/ENGINE). herdr session restore (herdr itself). Power-loss testing beyond process kill (documented gap).

## 5. Detailed requirements

1. **Fault injection (engine side, `apps/engine/src/faults/`):** `faultPoint(name: FaultPointName)` calls placed by owning areas at defined places; behaviour configured by `OVERMIND_FAULTS="after_event_append:run.node.succeeded:3=crash,before_action_complete:send_message=throw:ECONNRESET,delay:before_commit=200ms"`. Actions: `crash` (immediate `process.kill(process.pid, 'SIGKILL')`, no cleanup), `exit(code)`, `throw(code)`, `delay(ms)`, `hang`. The module is compiled out of release builds by a build-time constant `__RELEASE__` (dead-code elimination) and a CI assertion greps the release bundle for `OVERMIND_FAULTS`; in non-release builds it only activates when the env var is set AND `OVERMIND_DEV=1`. Fault point registry `FaultPointName` is a union kept in `apps/engine/src/faults/points.ts`; areas add points via proposal (list in docs). Mandatory points (provided by the engine core): `before_event_append`, `after_event_append`, `before_commit`, `after_commit_before_publish`, `after_publish`, `before_action_start`, `after_action_start_before_effect`, `after_effect_before_action_complete`, `after_action_complete`, `during_checkpoint_write`, `on_startup_recovery_step`, `before_cli_prompt_send`, `after_cli_prompt_send`.
2. **Harness (`packages/testing/src/recovery/`):** `EngineProcess.start({ dataDir, faults?, env, cliBin: 'fake-claude' })` spawns the engine entry (`apps/engine/dist/main.js` or `tsx` source in dev) with `OVERMIND_DATA_DIR` temp, ready-wait on the gateway socket (path rules ARCH005), exposes `client` (api-client over the socket with the session token read from the file), `kill9()`, `terminate()` (SIGTERM graceful), `waitExit()`, `logs()` (redacted). A `RecoveryScenario` helper: `given(workspace, workflow, fake-cli scenario) -> startRun -> runUntil(condition) -> crashAt(point) -> restart -> expect(...)`. Fake CLIs run via TEST006 and (optionally) fake herdr (TEST009) or real herdr is NOT used.
3. **Side-effect ledger:** non-idempotent actions in test workflows are implemented by a test-only tool `effect-recorder` (a fake `Tool` that appends `{ actionId, runId, attempt }` lines to a file outside the engine, e.g. simulating "send message", "git commit", "git push"): the ledger is the ground truth for duplicates. Also the fake CLI effects log records prompts received (to detect a re-sent command).
4. **Invariant checkers (each reusable assertion):** `expectEventLogConsistent(db)` (no gaps in per-run sequence numbers, ULIDs strictly increasing per run, every `node.started` has a terminal event or is the current resumable frontier, no duplicate ids), `expectSqliteHealthy(db)` (`PRAGMA integrity_check`, `foreign_key_check`, WAL checkpointable), `expectNoDuplicateEffects(ledger)`, `expectRunState(runId, status)`, `expectResumed(runId)` (Run continues without re-executing completed nodes: node execution counters from the events), `expectEscalatedForAmbiguousAction(runId, actionId)` (an action with `started` but no `completed` and non-idempotent produces a pending decision/Escalation and is not re-run), `expectAuditComplete()` (audit events for approvals exist exactly once), `expectNoSecretsInLogs`.
5. **Scenario catalogue (each a named test, matrix over crash points where noted):**
   - R-01 Window closed: UI client disconnects (no engine crash); Run completes (criterion 7 first half).
   - R-02 Graceful restart (SIGTERM) mid-Run: Run checkpoints, resumes after start, finishes; completed nodes not re-run.
   - R-03 Hard crash (`kill -9`) at every mandatory fault point during a node with an idempotent action: Run resumes and finishes; ledger shows at-least-once allowed only for idempotent actions.
   - R-04 Hard crash at `after_effect_before_action_complete` for a NON-idempotent action: after restart ledger count is exactly 1; Run enters waiting/escalation for that action; Owner decision `confirmed_done`/`retry` is honoured exactly once.
   - R-05 Crash at `before_cli_prompt_send` vs `after_cli_prompt_send`: prompt delivered at most once; ambiguity surfaced when unknown.
   - R-06 Crash during Parallel/Join: branches that completed are not repeated; Join waits correctly; quorum policy honoured.
   - R-07 Crash in Loop: iteration counter and budget (iterations/time/cost) preserved; `onExhausted` still works.
   - R-08 Crash while waiting for an Approval: Approval request persists; resolution after restart resumes the Run; expired approvals expire.
   - R-09 Crash during a Discussion round: completed rounds retained; no duplicate agent messages.
   - R-10 Double restart quickly (crash during recovery at `on_startup_recovery_step`): recovery is idempotent.
   - R-11 Corrupt/truncated latest WAL tail (simulate by truncating the last frame after kill): engine starts with integrity check; reports data recovery event; no silent data loss beyond uncommitted tail.
   - R-12 Data directory permissions broken by external action between runs: engine refuses to start (fail closed, ARCH005) or repairs per policy.
   - R-13 Clock jump backwards between runs: Run timers (timeouts, budgets) use monotonic/elapsed data, no negative durations; ids/ordering intact.
   - R-14 Global Pause active at crash: after restart still paused; no Run resumes executing until resume (SR-30).
   - R-15 Concurrent engine start (second process): second exits cleanly, first unaffected (lock).
   - R-16 Stale socket/pid files after crash are cleaned and not mistaken for a live engine; live engine socket never removed.
   - R-17 Telegram `update_id` high-water mark survives crash; replayed update ignored.
   - R-18 Backup/DB snapshot restore: restoring the last snapshot then replay works (BACKUP area plugs in).
6. **Time control:** the engine runs on real time in these tests, with `OVERMIND_TIME_SCALE` honoured only in non-release builds for timeouts/budgets so scenarios finish quickly; the fake CLIs honour `FAKE_CLI_TIME_SCALE`.
7. **CI:** job `recovery` (Linux, Node, no container needed) runs the catalogue; per scenario timeout 60 s; total under 6 min; matrix over fault points runs nightly in full, a representative subset on PRs touching `packages/workflow-runtime`, `adapters/sqlite`, `apps/engine`. Evidence goes into the bundle (TEST008) tagged `[SPEC16.7]`.
8. **Build assertions:** (a) release bundle does not contain `OVERMIND_FAULTS`, `faultPoint` bodies or the testing package; (b) fault points are zero-cost in release (compiled to no-ops).
9. **Documentation:** `docs/testing/recovery.md` explains how an area adds a fault point and a scenario, how to read failures (event log dump helper `dumpRun(runId)` with redaction), and the list of guarantees being proven.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Fake CLIs (TEST006), optional fake herdr (TEST009), api-client over the real gateway (ENGINE), `withTempDir` (TEST002), event semantics and ids (ARCH010, ARCH007), data-dir layout (ARCH005), `expectNoSecrets` (SEC003), contract of `StartRun` use case (WFRT).

## 8. Architecture and code placement

Engine: `apps/engine/src/faults/{fault-point.ts,points.ts,parse-faults.ts}` (tiny, no dependencies, release-stripped). Harness: `packages/testing/src/recovery/{engine-process.ts,scenario.ts,invariants.ts,effect-recorder.ts}`. Tests: `apps/engine/test/recovery/*.recovery.test.ts` (Vitest `integration` project, serial per file). Production code depends only on `faultPoint(name)`.

## 9. Security and safety

Fault injection is a deliberate backdoor and MUST be unreachable in release: compile-time stripping, double gating (`OVERMIND_DEV=1`), CI bundle assertion, and the env var is documented in ARCH005's table as non-release only. Tests run on temp data dirs only, never the Owner's. The effect-recorder writes into a temp directory outside the engine data dir. Crash tests also verify that secrets do not appear in crash logs.

## 10. Errors and edge cases

- Engine fails to start in harness: harness prints redacted logs tail and fails fast.
- Crash point never reached (scenario mismatch): `runUntil` times out with a clear message listing reached points (engine reports `fault_point_reached` debug events in test mode).
- Zombie child processes (fake CLIs) after `kill -9`: harness kills the whole process group and verifies none remain.
- SQLite file locked by a dying process: harness waits for exit before restart.
- Port/socket reuse: unique temp paths per test.
- Non-determinism: scenario seeds fixed; time scale reduces flakiness; retries disabled (TEST008).

## 11. Acceptance criteria

- [ ] Fault points can be enabled via `OVERMIND_FAULTS` in non-release builds and are absent from the release bundle (assertion passes; planted marker test fails the assertion).
- [ ] Harness can start the engine, drive a Run through the gateway with fake CLI, kill it at a named point, restart it and inspect state.
- [ ] Scenarios R-01..R-18 exist; those whose dependencies are not yet implemented are present as `pending` with a linked task and auto-activate when the capability exists; R-01..R-05, R-08, R-10, R-14 are required for MVP.
- [ ] Invariant checkers fail on crafted corrupt fixtures (gap in sequence, duplicate effect, missing escalation).
- [ ] Exactly-once guarantee for non-idempotent actions is proven in R-04/R-05 using the external ledger.
- [ ] Recovery job defined for CI with PR subset and nightly full matrix; evidence tagged `[SPEC16.7]`.
- [ ] Docs describe adding fault points/scenarios.

## 12. Test plan

Self-tests of invariant checkers with synthetic DBs/ledgers; harness smoke test with a trivial engine stub; the scenario suite itself. Commands: `pnpm vitest run packages/testing/src/recovery`, `pnpm vitest run --project integration apps/engine/test/recovery`, `pnpm test:recovery:full` (nightly).

## 13. Parallelization notes

Build the fault-injection module and harness skeleton early so WFRT/DATA/ENGINE authors can place fault points while implementing; scenarios activate progressively. Hotspot: `points.ts` registry (additive proposals). Depends on engine entry (SETUP011/ENGINE) for the full harness; develop against a stub until then.

## 14. Open questions and assumptions

- ASSUMPTION: engine entry runnable from source via `tsx` for tests, and from the built bundle in the nightly job.
- ASSUMPTION: ambiguous non-idempotent actions become an Escalation/decision rather than an automatic retry (matches SPEC 12 and ADR 0005).
- Open: power-loss durability tests (fsync semantics on macOS) are not covered.
