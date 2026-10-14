---
id: OVE_PAUSE006
title: "Implement the PauseCoordinator and the PauseParticipant extension point"
area: PAUSE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_PAUSE001, OVE_PAUSE005]
soft_depends_on: []
provides: ["port:PauseParticipant", "port:DrainReader", "service:PauseCoordinator", "event:pause.drain.updated"]
needs: ["port:EventBus", "port:Clock", "port:Logger"]
owns: ["packages/application/src/ports/PauseParticipant.ts", "packages/application/src/ports/DrainReader.ts", "packages/application/src/pause/coordinator/**", "packages/contracts/src/events/pause.drain.updated.event.ts", "docs/architecture/pause.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16", "SPECIFICATION 9"]
adr_refs: [5, 22, 26]
---

# OVE_PAUSE006: Implement the PauseCoordinator and the PauseParticipant extension point

## 1. Summary

Defines how work actually stops: subsystems (workflow runtime, provider adapters, chat delivery) register a `PauseParticipant`; the `PauseCoordinator` tells all participants to stop at safe points when `pause.changed` fires, tracks how many in-flight steps are still draining (phase `pausing` -> `paused`) and wakes them on resume. Also writes the architecture note of the pause semantics.

## 2. Context

Global Pause is 'instant' for new work and 'at the next safe point' for work already running (Settings copy: 'Zatrzymuje wszystkich Agentów we wszystkich Workspace'ach po bieżącym kroku. Nic nie jest ponawiane na ślepo.'). Terminals driven by the official CLIs cannot be frozen mid tool call without risking corrupted state (prototype notes: herdr state is only a hint; ADR 0026), so the engine withholds the next command and lets the current step finish. WFRT, PROV and CHAT own the mechanics inside their domain; this task owns the contract and the orchestration, so no area needs to know about the others (OCP).

## 3. Scope (in)

- `PauseParticipant` port and `PauseParticipantsToken` (multi-token).
- `PauseCoordinator` service: reacts to events, fans out, aggregates drain, publishes `pause.drain.updated`.
- `DrainReader` implementation used by `GetPauseSnapshot`.
- `docs/architecture/pause.md`: semantics table, guarantees for participants, list of what still works while paused.
- A `FakePauseParticipant` test helper in the coordinator tests.

## 4. Out of scope

- The participants themselves: WFRT (node dispatch and run checkpointing), PROV (command sending, herdr), CHAT (message delivery). They implement this port in their own tasks.
- Gate check inside use cases: OVE_PAUSE005. HTTP: OVE_PAUSE007.

## 5. Detailed requirements

1. **Port** (`packages/application/src/ports/PauseParticipant.ts`):
   ```ts
   export interface PauseParticipant {
     readonly id: string;                                           // 'wfrt' | 'prov' | 'chat' | ...
     onPause(scope: PauseScope, ctx: { since: IsoDateTime }): Promise<void>;   // MUST return quickly (<= 2 s): stop accepting new work, mark in-flight work 'draining'
     onResume(scope: PauseScope, ctx: { pausedMs: number }): Promise<void>;    // re-evaluate waiting work; MUST NOT blindly retry non-idempotent actions
     inFlight(scope?: PauseScope): { steps: number; agents: number };         // current in-flight work, cheap and synchronous
   }
   export const PauseParticipantsToken = multiToken<PauseParticipant>('port:PauseParticipant');
   ```
2. **Participant obligations** (written into `docs/architecture/pause.md` and checked by a reusable contract suite `PauseParticipant.contract.ts` that WFRT/PROV/CHAT run against their implementation): (a) after `onPause` resolves, no new step, command or message delivery starts for the scope (`guard` is also checked at dispatch, defence in depth); (b) an in-flight step may finish, its result is persisted (checkpoint) and the node moves to `waiting` with `waitingReason: 'paused'`, never `failed`; (c) nothing is cancelled and no state is lost; (d) timeouts and Budget time accounting exclude the paused period (`pausedMs` is passed on resume); (e) on resume, waiting work continues from its checkpoint and non-idempotent actions that were interrupted are not re-executed without the existing idempotency checks (SPEC 12).
3. **Coordinator behaviour**: subscribes (name `pause-coordinator`) to `pause.changed`. On `paused:true` it calls every participant's `onPause` in parallel with a 2 s timeout each (a timed-out or throwing participant is logged and counted as draining unknown; the coordinator keeps the phase `pausing` and retries `onPause` every 5 s up to 5 times; the gate already blocks new work, so the system is safe regardless). On `paused:false` it calls `onResume` (parallel, same timeout) after the gate has applied the new snapshot.
4. **Drain tracking**: every 1 s while any scope is paused and `inFlight()` sum > 0 the coordinator computes `drain = sum over participants` and publishes `pause.drain.updated` `{ snapshot }` whenever the numbers change; when the sum reaches 0 it publishes one final event with `phase: 'paused'`. `DrainReader.read()` returns the last computed drain (0/0 when running).
5. `pause.drain.updated` event: `defineEvent`, not persisted (derived), `scope: 'global'`, `visibleTo: ['owner','channel']`.
6. **Agent signalling**: the coordinator does not talk to agents. Participants in PROV are responsible for how a running CLI learns about the pause: the Skill 'overmind' status call returns `paused: true` (ADR 0027, served by the minimal agent read in OVE_PAUSE007) so a cooperating Agent stops at its next step; a hard interrupt of CLI sessions is NOT performed in the MVP (open question 14.1).
7. Registration: participants are provided with `multiToken` in their area modules; the coordinator receives `readonly PauseParticipant[]`. With zero participants (early development) the coordinator immediately reports drain 0.
8. `docs/architecture/pause.md` contains: state table (running/pausing/paused), a sequence diagram (mermaid) of pause and resume, the 'still works while paused' list (status, reads, chat history, deny, cancel, backups, Telegram `/status`, notifications) and the 'blocked while paused' list (start Run, dispatch Node, send to Agent, Chief or Agent chat turns, Discussions, approving requests, triggers).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `multiToken` (ARCH006), `EventBus` (ARCH010), `Clock` timers (ARCH007), `PauseGate` (OVE_PAUSE005), `PauseSnapshot` (OVE_PAUSE001).

## 8. Architecture and code placement

`packages/application/src/pause/coordinator/{pause-coordinator.ts,drain-aggregator.ts,participant-runner.ts}`; ports under `ports/`. The coordinator is a service started by the pause module (OVE_PAUSE008). It depends on interfaces only; participants are discovered through the multi-token, so adding a subsystem never edits this task's files.

## 9. Security and safety

- Safety does not depend on participants being well behaved: the gate blocks new work at the source; participants only add draining and consistency.
- A malicious or buggy participant cannot block the pause (timeouts) and cannot resume work on its own (only `pause.changed` with `paused:false` triggers `onResume`).
- Events visible to agents are filtered to `{ paused }`; drain counters are never sent to agents or Telegram beyond the snapshot the Owner asked for.

## 10. Errors and edge cases

- Participant throws in `onPause`: logged, phase stays `pausing`, retries as described.
- Pause then resume within 1 s: `onResume` is called after `onPause` completed or timed out, never concurrently (per-scope serial queue).
- Resume while a participant is still draining: allowed; `onResume` simply clears draining.
- Engine restarts while paused: on boot the coordinator runs `onPause` once for the loaded state so participants rebuild their 'held' state (restart recovery).
- Participant registered but its `inFlight()` throws: counted as 1 unknown step so the UI keeps saying 'pausing' rather than falsely 'paused'.

## 11. Acceptance criteria

- [ ] Given two fake participants with 2 and 1 in-flight steps, When global pause fires, Then `pause.drain.updated` reports 3 and later 0 with phase `paused`.
- [ ] Given a participant that hangs in `onPause`, Then the coordinator times out at 2 s and the phase stays `pausing` while the gate blocks new work.
- [ ] Given resume, Then every participant receives `onResume` with the correct `pausedMs` (fake clock).
- [ ] Given pause and resume in quick succession, Then calls are serialised per scope.
- [ ] The participant contract suite exists, is exported and passes for the fake participant.
- [ ] `docs/architecture/pause.md` lists both behaviour lists and the diagram.

## 12. Test plan

Unit tests with FakeClock and fake participants: `pause-coordinator.test.ts`, `drain-aggregator.test.ts`, `serial-queue.test.ts`, `participant-timeout.test.ts`; contract suite `PauseParticipant.contract.ts` (exported to WFRT/PROV/CHAT). Commands: `pnpm vitest run packages/application/src/pause/coordinator`.

## 13. Parallelization notes

Parallel with OVE_PAUSE003/004/007. WFRT, PROV and CHAT implement participants after this port merges; their tasks list `port:PauseParticipant` in `needs`. Hotspot: none; `docs/architecture/pause.md` is owned here.

## 14. Open questions and assumptions

- 14.1 OPEN: should Global Pause send a hard interrupt (Escape / SIGINT through herdr) to CLI sessions in the middle of a long turn? DEFAULT: no interrupt in the MVP, because interrupting can corrupt a half-written edit; the Owner sees 'Wstrzymywanie: 2 Agentów kończy bieżący krok'. If the Owner wants a hard stop, add a participant option, not a new core path.
- ASSUMPTION: Budget time and node timeouts exclude paused time (otherwise resume would immediately time out long steps).
- OPEN: maximum acceptable drain time before the UI offers 'Przerwij bieżący krok' (not in the mocks); no UI is built for it in the MVP.
