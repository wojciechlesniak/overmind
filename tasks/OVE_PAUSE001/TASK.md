---
id: OVE_PAUSE001
title: "Define PauseState, the pause events, error codes and the PauseRepository port"
area: PAUSE
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH003", "OVE_ARCH007", "OVE_ARCH010"]
soft_depends_on: ["OVE_ARCH008"]
provides: ["contract:PauseState", "contract:PauseSnapshot", "event:pause.changed", "port:PauseRepository", "lib:pause-domain", "lib:pause-errors"]
needs: ["contract:EntityId"]
owns: ["packages/contracts/src/pause/**", "packages/contracts/src/errors/pause.errors.ts", "packages/contracts/src/events/pause.changed.event.ts", "packages/domain/src/pause/**", "packages/application/src/ports/PauseRepository.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14", "SPECIFICATION 16"]
adr_refs: [3, 5, 6]
---

# OVE_PAUSE001: Define PauseState, the pause events, error codes and the PauseRepository port

## 1. Summary

Defines the single source of truth for pausing: the `PauseState` entity (global and per-Workspace), the derived `PauseSnapshot` that every consumer reads, the `pause.changed` event, the `pause.*` error codes and the `PauseRepository` port. Pure contracts and pure domain functions; no I/O.

## 2. Context

Global Pause is the Owner's emergency brake (SPEC 12, 16.14: 'Pause, cancel, limit 3 parallel agents, Budgets and timeouts are enforced by the engine'). The mocks also show a per-Workspace pause ('Wstrzymaj Workspace', 'Wznów', the 'wstrzymany przez Ciebie' dashboard card, SPEC 3 dashboard). Both are modelled as the same entity with a scope. Everything else in the PAUSE area (use cases, gate, coordinator, gateway, UI, tray, Telegram rules) depends on this contract, so it is delivered first and kept small. Glossary: **Global Pause** = instant stop of all Runs by the Owner (not 'kill switch'); **Run**, **Workspace**, **Owner**, **Channel**, **Local Approval** as in `GLOSSARY.md`.

## 3. Scope (in)

- `PauseScope`, `PauseState`, `PauseSnapshot`, `PausePhase` zod schemas and types.
- Pure domain functions `effectivePause(snapshot, workspaceId)`, `nextState(current, command)` (idempotent transitions).
- `pause.changed` event definition (`defineEvent`, persisted, audit).
- Error codes `pause.*` registered with `defineErrors`.
- `PauseRepository` port (interface + token) with value types.
- Contract unit tests for the schemas and the pure functions.

## 4. Out of scope

- Persistence (SQLite): OVE_PAUSE002.
- Use cases and authority rules: OVE_PAUSE003, OVE_PAUSE004.
- Runtime gate: OVE_PAUSE005. Coordinator: OVE_PAUSE006.
- Gateway routes and api-client: OVE_PAUSE007.

## 5. Detailed requirements

1. **Scope and state (zod, strict).**
   ```ts
   PauseScope = { kind: 'global' } | { kind: 'workspace', workspaceId: EntityId<'ws'> }
   PauseVia   = 'desktop' | 'tray' | 'telegram' | 'system'          // channel that caused the transition (never trusted from a request body)
   PauseState = {
     scope: PauseScope,
     paused: boolean,
     since: IsoDateTime | null,           // when the current paused period started; null when running
     via: PauseVia | null,                // who caused the last transition
     version: int >= 0,                   // monotonic per scope, +1 on every effective change
     updatedAt: IsoDateTime
   }
   ```
   The initial state of every scope is `{ paused: false, since: null, via: null, version: 0 }`. A missing row means not paused.
2. **Snapshot (what consumers read).**
   ```ts
   PausePhase = 'running' | 'pausing' | 'paused'
   PauseSnapshot = {
     global: PauseState,
     workspaces: PauseState[],            // ONLY the paused ones, sorted by workspaceId
     phase: PausePhase,                   // 'pausing' = paused requested but PauseParticipants still drain in-flight steps (OVE_PAUSE006)
     drain: { inFlightSteps: int, agents: int }    // 0/0 when phase != 'pausing'
   }
   ```
   `phase` is `running` when no scope is paused, `pausing` while `drain.inFlightSteps > 0`, otherwise `paused`.
3. **Pure rules** in `packages/domain/src/pause/`: `effectivePause(snapshot, workspaceId): { paused: boolean; by: 'global'|'workspace'|null }` (global wins for reporting; either scope pauses the Workspace); `nextState(current, { paused, via }, now): { state: PauseState; changed: boolean }` returns `changed:false` and the same object when `current.paused === paused` (idempotency: a repeated pause or resume produces no new version, no event, no audit).
4. **Event** `pause.changed` (`defineEvent('pause.changed', schema, { schemaVersion: 1, persisted: true, scope: 'global', visibleTo: ['owner','agent','channel'], audit: true })`) with payload `{ scope: PauseScope, paused: boolean, via: PauseVia, version: int, snapshot: PauseSnapshot }`. The snapshot in the payload lets subscribers (desktop push, tray, Telegram) update without a second read. `visibleTo: agent` carries only `{ paused }` after a payload filter (agents learn that work is paused, never who paused it or from where).
5. **Error codes** (file `pause.errors.ts`, `defineErrors('pause', ...)`): `paused` (http 409, retryable true, 'Work is paused. Resume at the computer to continue.', details `{ scope: 'global'|'workspace' }`), `resume_requires_desktop` (403, not retryable), `workspace_not_found` (404), `forbidden_actor` (403; agents and Chief may never pause or resume), `state_unreadable` (500, used by boot recovery to fail closed). Every code has `messageKey: 'errors:pause.<code>'` with EN and PL strings added to `apps/desktop/src/locales/*/errors.json` by this task's i18n follow-up (listed in section 14).
6. **Port** `packages/application/src/ports/PauseRepository.ts`: `load(): Promise<Result<PauseSnapshotRows>>` (all rows), `save(state: PauseState, expectedVersion: number): Promise<Result<void>>` (optimistic concurrency; `data.conflict` when versions differ), `remove(scope)` (Workspace deleted). Token `PauseRepositoryToken = token<PauseRepository>('port:PauseRepository')`.
7. Schemas are exported from the generated `packages/contracts` barrel; the additive-only contract check (ARCH008) passes. No field named `reason` free text is allowed (prevents untrusted text from entering the state).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Result`, `AppError`, `defineErrors` (ARCH003), `defineEvent` and the envelope (ARCH010), `EntityId` and ULID helpers (ARCH007).

## 8. Architecture and code placement

Contracts in `packages/contracts/src/pause/` (`pause-state.ts`, `pause-snapshot.ts`, `index.ts` generated barrel); pure functions in `packages/domain/src/pause/` (no imports except contracts); port in `packages/application/src/ports/`. Depends on nothing but the foundation; every other PAUSE task depends on this one.

## 9. Security and safety

- Pause state is security-relevant: the transition function never accepts the actor channel from untrusted input; `via` is set by the use case from the authenticated gateway context (OVE_PAUSE003).
- No free-text field exists in the state or the event, so Telegram or agent text cannot be smuggled into the pause banner or audit trail.
- Fail closed: `state_unreadable` is the code boot recovery uses to start paused (OVE_PAUSE008).

## 10. Errors and edge cases

- Pause requested for a scope that is already paused: `changed:false`, same version.
- Resume of a scope that is not paused: `changed:false`.
- Concurrent `save` with a stale `expectedVersion`: `data.conflict`, caller re-reads and retries once.
- Workspace paused and then deleted: `remove(scope)` deletes the row; snapshot no longer lists it.
- Clock goes backwards: `since` is taken from the injected Clock, `updatedAt >= since` is not asserted.

## 11. Acceptance criteria

- [ ] Given a running scope, When `nextState` receives `paused:true`, Then `changed:true`, `version` is +1 and `since` equals the clock time.
- [ ] Given a paused scope, When `nextState` receives `paused:true` again, Then `changed:false` and the object is unchanged.
- [ ] Given global paused and Workspace A not paused, Then `effectivePause(snapshot, A)` is `{paused:true, by:'global'}`.
- [ ] `phase` is `pausing` while `drain.inFlightSteps > 0` and `paused` at 0 (table test).
- [ ] The `pause.changed` registry test passes (naming, uniqueness, persisted, audit flag).
- [ ] All five `pause.*` codes exist with EN and PL message keys; the errors lint passes.
- [ ] Schemas reject unknown keys and a `reason` field.

## 12. Test plan

Unit: `pause-state.test.ts`, `next-state.test.ts` (table-driven), `effective-pause.test.ts`, `snapshot-phase.test.ts`, `pause-errors.test.ts`. Contract test for the schema round trip. Commands: `pnpm vitest run packages/domain/src/pause packages/contracts/src/pause`.

## 13. Parallelization notes

Delivers first inside the area; OVE_PAUSE002, 003, 004, 005 can start in parallel once merged (they only share read access to these contracts). No hotspots: new files only.

## 14. Open questions and assumptions

- ASSUMPTION: there is no 'reason' or 'note' attached to a pause in the MVP (keeps untrusted text out). Revisit if the Owner wants 'back in 1 h' notes.
- ASSUMPTION: `via: 'system'` exists only for boot recovery (fail-closed start) and post-restore start (OVE_BACKUP008).
- The EN and PL strings for the `pause.*` error messages are added to the desktop `errors.json` files by the first UI task that renders them (OVE_PAUSE010); this contract task only registers the keys.
