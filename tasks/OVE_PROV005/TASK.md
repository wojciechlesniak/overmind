---
id: OVE_PROV005
title: Implement the TerminalLayer port, herdr adapter, Agent-to-terminal map and state observer
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_PROV004, OVE_PROV006, OVE_TEST009]
soft_depends_on: [OVE_BOX020]
provides: ["port:TerminalLayer", "adapter:HerdrTerminalLayer", "lib:terminal-observer", "lib:agent-terminal-map"]
needs: ["port:Clock", "port:Logger", "lib:redaction", "port:EventBus", "lib:fake-herdr"]
owns:
  - packages/application/src/ports/TerminalLayer.ts
  - packages/adapters/herdr/src/terminal-layer/**
  - packages/adapters/herdr/src/observer/**
reads: ["docs/research/herdr-analiza.md", "docs/research/prototyp-wnioski.md", "packages/adapters/herdr/src/client/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 13", "SPECIFICATION 15"]
adr_refs: [5, 22, 26]
---

# OVE_PROV005: Implement the TerminalLayer port, herdr adapter, Agent-to-terminal map and state observer

## 1. Summary

Define the Overmind-owned `TerminalLayer` port (the only way the rest of Overmind touches terminals) and implement it over the herdr client: start a named CLI agent, send text, read the screen, stop, and observe a stream of `TerminalObservation`s. Overmind keeps its own Agent to terminal map and never relies on herdr names or auto-detected processes (ADR 0026).

## 2. Context

ADR 0026: herdr is replaceable, so everything above the adapter speaks `TerminalLayer`. Prototype findings: manually started agents have no name in herdr (`agent_not_found`), so Overmind always starts CLIs through `agent.start` with a name it chose; `agent.prompt` works only for agents started that way; herdr has a fifth state `done`; screens are read with `pane.read`; the terminal title carries a short task summary (free source for the "what is it doing" line). The state classifier is PROV006; the wire client is PROV004. herdr runs inside the Environment and is reached through the SandboxSocketBridge (BOX020).

## 3. Scope (in)

- `TerminalLayer` port with request/response types and a `TerminalRef` value.
- `HerdrTerminalLayer` adapter built on `HerdrClient`.
- `AgentTerminalMap` (in-memory, restorable from the session registry of PROV028).
- Observer: event subscription plus polling fallback, ANSI/wide-character normalisation, 2-sample debounce, classification through PROV006, publishing observations.

## 4. Out of scope

- Whether text may be sent (guard: PROV008). Session start orchestration, env injection and resume (PROV027, PROV028). Detection rule files for herdr (PROV007). Turning observations into Approvals or login prompts (PROV013, PROV014). Persisting the map (PROV028).

## 5. Detailed requirements

1. **Port (excerpt):**
   ```ts
   interface TerminalLayer {
     attach(envId: EnvironmentId): Promise<Result<void, AppError>>;       // connects the herdr client through the bridge
     startAgent(req: { envId; agentId; terminalName: string; kind: 'claude'|'codex'; cwd: '/work'|`/work/${string}`;
                       resume?: { sessionId: string }; extraEnv?: never }): Promise<Result<TerminalRef, AppError>>;
     sendText(ref: TerminalRef, text: string, opts: { submit: boolean; viaPrompt: boolean }): Promise<Result<void, AppError>>;
     sendKey(ref: TerminalRef, key: TerminalKey): Promise<Result<void, AppError>>;   // TerminalKey = 'esc'|'ctrl-c'|'enter'|'y'|'n'|'1'..'9' (closed union)
     readScreen(ref: TerminalRef, opts?: { lines?: number }): Promise<Result<ScreenTail, AppError>>;  // default 60, max 200
     rawState(ref: TerminalRef): Promise<Result<HerdrRawState, AppError>>;                           // 'idle'|'working'|'blocked'|'done'|'unknown'
     observe(ref: TerminalRef, opts?: { signal }): AsyncIterable<TerminalObservation>;                // PROV006 type
     stop(ref: TerminalRef, opts?: { graceMs }): Promise<Result<void, AppError>>;
     list(envId): Promise<Result<TerminalRef[], AppError>>;
   }
   TerminalRef = { envId; agentId; terminalName; paneId?: string; sessionId?: string /* CLI session id for resume */ }
   ```
   `extraEnv?: never` documents that environment variables are set by the sandbox exec (PROV027), not by this layer.
2. **Naming:** `terminalName` = `ovm-<agentSlug>-<agent6>` (ASCII, max 48 chars, unique per Environment); the adapter refuses names that collide with an existing herdr agent (`prov.session_exists`). The map key is `agentId`; herdr names are never used as identity.
3. **Start:** `agent.start` with `kind`, `name`, pane created in workspace `overmind` (one herdr workspace per Environment) and `cwd = /work` (anything else is rejected with `internal.invalid_input`; `/work` is fixed by BOX). The resume command passed to herdr MUST be a bare program name from `PATH` (`claude`, `codex`), never a path (prototype 3.2.3); the adapter validates the herdr response to every start/report call and fails with `prov.session_unavailable` if the reply does not confirm the name and pane.
4. **Send:** `viaPrompt: true` uses `agent.prompt` (named, herdr-started agents); `false` uses `pane.send_text` (bracketed paste, then Enter as a separate call after 300 ms when `submit`). The layer itself does NOT decide whether sending is allowed; it is only called by the guard (PROV008). Text is sent as one bracketed paste; control characters other than `\n` and `\t` are rejected here as a second line of defence (`internal.invalid_input`).
4a. **Keys:** `sendKey` accepts only the closed `TerminalKey` union and maps it to the exact byte sequence; it is used only for interrupt (`esc`/`ctrl-c` per CLI profile, PROV029) and for dialog answers (digits, `y`, `n`, `enter`, PROV013). A lint test forbids calling it outside those two modules. Free text can never go through it.
5. **Read:** `pane.read` result is normalised: ANSI/OSC stripped, carriage-return redraws collapsed (last write of a line wins), wide characters kept, lines capped at 400 chars and `lines` at 200; returns `ScreenTail { lines: string[]; title?: string; capturedAt }`. Title comes from the terminal title (OSC) when herdr exposes it.
6. **Observer:** subscribes to `events.subscribe` filtered to the terminal; every event and a 2 s poll (4 s when idle for over 1 min) produce a sample `{ herdrState, screenTail, title, processAlive, lastOutputAt }`. A new `TerminalObservation` is emitted only on change of state or evidence hash. Debounce: a transition into `working` or `idle` needs 2 consecutive samples; transitions into `waiting_approval`, `needs_login`, `selection_prompt`, `rate_limited`, `stopped` are emitted immediately (safe direction, PROV006 requirement 7). On `resync_required` from the client the observer re-reads state with `agent.get` + `pane.read` before emitting.
7. **Process liveness:** `processAlive` from `agent.get` (agent present and pane open). A closed pane yields `stopped`.
8. **Map:** `AgentTerminalMap { set(agentId, ref); get(agentId); byTerminal(envId, name); remove; entries(); restore(entries) }`, in memory only; `restore` is called by PROV028 after an engine restart and verified against `list(envId)` (entries without a live terminal are marked stale, never assumed alive).
9. **Backpressure and limits:** one observer per terminal, max 8 per Environment (matches the concurrency cap), observer queue 100 observations (drop oldest, keep the latest state), screen reads at most 1 per second per terminal.
10. **No state leakage:** observations carry `hint: true` (PROV006); this layer exposes no "is done" boolean.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`HerdrClient` (PROV004), `classify` and `TerminalObservation` (PROV006), `Result` and error catalogue (ARCH003), `Clock` (ARCH007), redactor (ARCH004), `FakeHerdr` (TEST009) with its fault switches. Do not re-implement framing, version pinning or reconnect.

## 8. Architecture and code placement

Port: `packages/application/src/ports/TerminalLayer.ts` (types, token `TerminalLayerToken`). Adapter: `packages/adapters/herdr/src/terminal-layer/{herdr-terminal-layer.ts,agent-terminal-map.ts,screen-normaliser.ts,send.ts}` and `src/observer/{observer.ts,debounce.ts,poller.ts}`. The adapter depends on `HerdrClient` and the domain classifier only; it never imports the sandbox adapter (the bridge arrives as an injected `HerdrTransportFactory`). A future own terminal implementation replaces this adapter without touching callers (OCP/DIP).

## 9. Security and safety

Screens are untrusted text (a malicious repository can make the CLI print anything). Normalisation strips escape sequences so output cannot forge a "dialog" through cursor tricks and cannot inject terminal control into logs; screen text is never logged unredacted and never leaves this layer except as bounded redacted excerpts in observations. `sendText` rejects control characters so an Agent-originated message cannot send Ctrl-C/Ctrl-D, ESC sequences or the bracketed-paste end marker (`ESC[201~`) to break out of the paste. `cwd` is fixed to `/work`. If the herdr reply does not confirm the requested name or pane, the start fails closed. The port has no method that answers CLI dialogs; that is a separate, gated use case (PROV013).

## 10. Errors and edge cases

- herdr restarts and loses panes: observer emits `stopped`, the map entry becomes stale; PROV028 decides on resume.
- Two terminals with the same requested name: `prov.session_exists`, no second start.
- `agent.prompt` returns `stalled` or `blocked`: mapped to `provider.invalid_state` / `provider.delivery_unknown` and never retried here (PROV008 owns the policy).
- Screen read of a pane that disappeared: `prov.session_not_found`.
- Huge output burst: screen tail only; no scrollback is retained.
- Observer subscriber slow: latest-state-wins queue.

## 11. Acceptance criteria

- [ ] Against `FakeHerdr`: start two named agents, observe `idle -> working -> idle`, read a screen, stop one; the map reflects each step.
- [ ] A transition to `working` needs two samples; a `blocked` hint with a dialog on screen is emitted at once as `waiting_approval`.
- [ ] A resume command that is a path is refused; a start whose reply lacks the pane is `prov.session_unavailable`.
- [ ] `sendText` with `\u0003` or `ESC[201~` is rejected; `cwd: '/tmp'` is rejected.
- [ ] After `resync_required` the observer re-reads state before emitting.
- [ ] No screen text appears in logs (`expectNoSecrets` and a length-only assertion).

## 12. Test plan

Unit: screen normaliser (ANSI, CR redraw, wide chars), debounce table, map operations, name generation. Integration with `FakeHerdr` including `restartLoss`, `eventDrop`, `crashServer`. Contract: `TerminalLayer.contract` suite (PROV024). Command: `pnpm vitest run packages/adapters/herdr/src/terminal-layer packages/adapters/herdr/src/observer`.

## 13. Parallelization notes

Starts when PROV004 and PROV006 are in review (stubs). PROV007, PROV008, PROV027 consume the port; edit them through the port only. Hotspot: `TerminalLayer.ts` (additive changes only).

## 14. Open questions and assumptions

- ASSUMPTION: herdr exposes the terminal title in `pane.read` or `agent.get`; if not, title is omitted and the Tablica line falls back to the Task title (the schema snapshot decides, BOX002).
- ASSUMPTION: one herdr workspace per Environment is enough (one Agent per Environment per BOX001).
