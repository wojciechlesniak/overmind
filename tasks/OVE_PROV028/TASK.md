---
id: OVE_PROV028
title: Persist the session registry and delivery journal and resume CLI sessions after restart
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_BOX016, OVE_BOX019, OVE_DATA001, OVE_DATA003, OVE_DATA007, OVE_ENGINE005, OVE_ENGINE016, OVE_ENGINE028, OVE_PROV005, OVE_PROV008, OVE_PROV009, OVE_PROV027]
soft_depends_on: [OVE_PROV014]
provides: ["port:SessionRegistry", "table:prov_sessions", "table:prov_deliveries", "usecase:RecoverAgentSessions", "adapter:SqliteSessionRegistry"]
needs: ["port:SqliteDatabase", "lib:repository-base", "lib:migration-runner", "port:RecoveryParticipant", "port:Clock", "port:AuditSink", "port:EventBus", "usecase:RequireIsolation", "port:Sandbox", "port:AgentTokenIssuer", "lib:sandbox-reaper"]
owns:
  - packages/application/src/prov/session/recover/**
  - packages/application/src/ports/SessionRegistry.ts
  - packages/adapters/sqlite/src/prov/session-registry/**
  - packages/adapters/sqlite/migrations/V202610150100__OVE_PROV028__prov_sessions.sql
reads: ["docs/research/herdr-analiza.md", "packages/application/src/prov/session/start/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 14"]
adr_refs: [5, 22, 26]
---

# OVE_PROV028: Persist the session registry and delivery journal and resume CLI sessions after restart

## 1. Summary

Store which Agent has which Environment, terminal and CLI session id, plus the delivery journal of PROV008, and after an engine restart or crash reconcile with reality and resume sessions with the CLI's own resume command, without ever repeating a non-idempotent send. The work continues after the window closes and after a restart (ADR 0005, Spec 12), but not blindly.

## 2. Context

herdr persists layout and CLI session ids and writes the resume command (`claude --resume <id>`, `codex resume <id>`) into the terminal after a restart; the prototype confirmed that agents survive window close and crash. The Environment may or may not exist (BOX016 reaper sweeps orphans at startup and does not resume agents; "PROV009 decides about resuming" in the BOX016 text refers to this task). A running CLI cannot receive a new environment, so a resumed CLI needs a new process with a freshly minted token (BOX020 requirement 4). ENGINE005 defines `RecoveryParticipant` for startup recovery.

## 3. Scope (in)

- `SessionRegistry` port and SQLite adapter (tables `prov_sessions`, `prov_deliveries`) with migration.
- `PersistingDeliveryJournal` implementing `DeliveryJournal` (PROV008) on the same tables.
- `RecoverAgentSessions` use case and its `RecoveryParticipant` registration.
- The registry commit step (`SessionCommitStep`) for PROV027.

## 4. Out of scope

- Start pipeline (PROV027), guard (PROV008), reaper (BOX016), Run-level recovery and replay (WFRT, ENGINE005), re-login (PROV014), resolving unknown deliveries (PROV015 / Owner).

## 5. Detailed requirements

1. **Tables (migration `V202610150100__OVE_PROV028__prov_sessions.sql`):**
   - `prov_sessions(agent_id PK, workspace_id, run_id, env_id, terminal_name, pane_id, cli_session_id, provider_id, model_id, connection_id, status, started_at, last_seen_at, ended_at, degraded_json)`; `status` in `starting|live|stale|resuming|ended|failed`; indexes on `workspace_id`, `status`, `run_id`.
   - `prov_deliveries(delivery_id PK, agent_id, run_id, idempotency_key, text_hash, state_before, outcome, created_at, completed_at, resolution)` with unique `(agent_id, idempotency_key)`; `outcome` in `intent|sent|sent_unverified|unknown|resolved_delivered|resolved_not_delivered`.
   - No prompt text, no tokens, no screen text in any column. Only the CLI session id (opaque, not a secret credential) is stored.
2. **Port `SessionRegistry`:** `upsert(session)`, `get(agentId)`, `list(filter)`, `markStale(agentId, reason)`, `end(agentId, reason)`, `forEnvironment(envId)`. Writes go through `UnitOfWork`; every state change also publishes `provider.session_changed` (non-persisted event).
3. **Commit step:** after PROV027 step 11 succeeds, the registry row is written with `status: 'live'`. The CLI session id comes from herdr (`agent.get` session field, source `herdr:claude` in the prototype) or the CLI profile's reader; if unavailable the row stores `null` and resume falls back to a fresh start (documented degraded flag `no_resume_id`).
4. **Heartbeat:** `last_seen_at` is updated by the observer (debounced 30 s) so a stale row can be told from a live one.
5. **Recovery at engine start (`RecoverAgentSessions`, after BOX016 `sweepCompleted` and the isolation gate):**
   1. load rows with status `starting|live|resuming`;
   2. for each, check the Environment through `Sandbox.listEnvironments` and, if present, the terminal through `TerminalLayer.list`;
   3. Environment gone: row `stale` (`env_missing`); herdr gone or pane gone: `stale` (`terminal_missing`);
   4. pane present: re-attach the observer and map (`AgentTerminalMap.restore`), classify the screen: a CLI that herdr already resumed shows an `idle`/`working` observation and the row stays `live`; a CLI that is still printing a login or dialog stays as observed (PROV013/PROV014 handle it);
   5. `stale` rows with `cli_session_id` and an active Run (Run is `running` or `waiting`, asked through `RunReader`) are resumed: new token minted, `StartAgentSession` with `resume: { sessionId }`, which starts the CLI with its resume command (`claude --resume <id>`, `codex resume <id>`; the bare program name from `PATH`, PROV005 requirement 3). A resumed CLI never receives the previous prompt again;
   6. rows whose Run is finished or cancelled are marked `ended`; Environments of ended rows are left to the idle policy.
6. **Unresolved deliveries:** rows in `prov_deliveries` with outcome `intent` after a restart are converted to `unknown` (the engine cannot know whether the text was typed) and published (`provider.delivery_unknown`) so PROV015 or the Owner resolves them; nothing is resent. Recovery never calls `sendPrompt`.
7. **Ordering and limits:** resumes are rate limited to the concurrency limit (PROV019 slots) and run sequentially with a 5 s spacing; the number of resumed sessions never exceeds `maxParallelAgents`; extra ones stay `stale` until slots free up.
8. **Pause:** if Global Pause is on at start, recovery only reconciles (no resume); resume happens on Pause release by the same use case (subscribed to `pause.released`).
9. **Idempotency:** running `RecoverAgentSessions` twice does not start duplicates (per-Agent mutex and status check). A row `resuming` older than 2 minutes is reset to `stale`.
10. **Retention:** `ended` rows older than 30 days and resolved deliveries older than 90 days are purged by a daily job (via `JobScheduler`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`repository-base` and `UnitOfWork` (DATA), migration naming (ARCH009), `RecoveryParticipant` (ENGINE005), `DeliveryJournal` port (PROV008), `StartAgentSession` (PROV027), `TerminalLayer` (PROV005), BOX registry reconciliation (BOX008/BOX016).

## 8. Architecture and code placement

Port `packages/application/src/ports/SessionRegistry.ts`; use case `packages/application/src/prov/session/recover/{recover-agent-sessions.ts,reconcile.ts,resume-plan.ts}`; SQLite adapter `packages/adapters/sqlite/src/prov/session-registry/{session-registry.sqlite.ts,delivery-journal.sqlite.ts}`; one migration file. The application code depends on ports only; SQL stays in the adapter (Clean Architecture).

## 9. Security and safety

Recovery restarts processes that run commands, so it re-enters through the same gates as a fresh start (isolation ticket, mount plan re-verification, new token, Pause check). A forged or tampered registry row cannot widen anything: mounts and permissions are recomputed from PERM, not read from the row. No prompt text is stored. A crash between intent and send never resends. A resumed session id is passed as a single argv element validated against `^[A-Za-z0-9_-]{8,128}$`. Audit: `provider.session_recovered`, `provider.session_stale`, `provider.session_resume_failed`.

## 10. Errors and edge cases

- CLI resume fails (unknown session id, expired login): row `failed`, state `needs_login` routed to PROV014 when the screen says so; otherwise an Escalation through the caller (Run keeps `waiting`).
- Database restore from backup (older rows): rows refer to missing Environments, so they go `stale` and are re-resumed or ended.
- Two engines racing: prevented by the instance lock (ENGINE003).
- Machine slept: heartbeat gap alone does not mark a row stale; the terminal check decides.
- Agent archived while stale: row `ended`.

## 11. Acceptance criteria

- [ ] Migration applies on a fresh and an existing database and is idempotent in the migration runner test.
- [ ] Given a live row and a surviving pane, recovery re-attaches without starting a process.
- [ ] Given a stale row with a CLI session id and a running Run, recovery starts the CLI with the bare resume command and a new token, and never sends a prompt.
- [ ] An `intent` delivery row becomes `unknown` and is published; no send occurs during recovery.
- [ ] Resumes never exceed the concurrency limit; extra rows stay `stale`.
- [ ] With Global Pause on, no process is started; after release recovery resumes.
- [ ] No table contains prompt text or token strings (schema scan test).

## 12. Test plan

Repository tests on the SQLite harness (DATA008); recovery scenarios with `FakeSandbox`, `FakeHerdr` (`restartLoss`, `crashServer`), fake token issuer, fake Run reader; crash tests using the recovery harness (TEST011): kill after intent, kill during resume. Commands: `pnpm vitest run packages/application/src/prov/session/recover packages/adapters/sqlite/src/prov`.

## 13. Parallelization notes

Migration file owned here (unique timestamped name). PROV027 exposes `SessionCommitStep`; implement against its declared hook. PROV029 reads the registry through the port.

## 14. Open questions and assumptions

- ASSUMPTION: the CLI session id is available from herdr's `agent_session` field (prototype showed it for Claude); Codex may need the CLI profile reader (PROV011).
- ASSUMPTION: resume is attempted only for Runs still active; idle persistent Agents get a fresh session on demand (lazy), not at startup.
