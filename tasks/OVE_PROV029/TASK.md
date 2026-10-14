---
id: OVE_PROV029
title: Implement the AgentSessionGateway adapter (snapshot, guarded send, replies, stop)
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_PROV005, OVE_PROV008, OVE_PROV009, OVE_PROV027, OVE_PROV028]
soft_depends_on: [OVE_PROV013, OVE_PROV014, OVE_PROV015, OVE_PROV018]
provides: ["adapter:AgentSessionGateway"]
needs: ["port:AgentSessionGateway", "port:TerminalLayer", "lib:delivery-guard", "port:SessionRegistry", "lib:terminal-observer", "usecase:StartAgentSession", "lib:redaction", "port:Clock", "port:EventBus"]
owns:
  - packages/application/src/prov/session/gateway/**
reads: ["packages/application/src/ports/AgentSessionGateway.ts", "packages/application/src/prov/delivery/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15"]
adr_refs: [22, 26, 27]
---

# OVE_PROV029: Implement the AgentSessionGateway adapter (snapshot, guarded send, replies, stop)

## 1. Summary

Compose the guard, the registry, the observer and the terminal layer into the `AgentSessionGateway` that AGENT, CHAT, DISC and the workflow runtime consume. It answers "what is this Agent doing" with a hint, delivers prompts only through the guard, exposes the CLI's reply text as a bounded redacted stream, and stops sessions cleanly.

## 2. Context

AGENT010 reads `snapshot` to seed Agent State; AGENT012/CHAT008 call `sendPrompt` and expect `prov.agent_blocked` when the CLI waits for approval; DISC turns and Chief read `replies`. Reports from the Skill "overmind" arrive via the gateway API (AGENT015), not through this port; replies here are the fallback that also covers Discussions and CLIs that did not report. Screens are untrusted; the observation carries `hint: true`.

## 3. Scope (in)

- The implementation class `DefaultAgentSessionGateway` of the port (PROV009).
- Reply extraction from the screen stream (normalised chunks with cursors).
- Interrupt and stop behaviour.
- Lazy start through `StartAgentSession` when explicitly allowed.

## 4. Out of scope

- Guard internals (PROV008), start pipeline (PROV027), persistence (PROV028), dialog answering (PROV013), completion verification (PROV015), fallback on limits (PROV018).

## 5. Detailed requirements

1. **snapshot(agentId):** reads the registry row and the latest observation from the observer cache (not older than 5 s, else a fresh read through `TerminalLayer`); returns `hasSession: false` when no live row. `titleHint` = terminal title, redacted and cut to 120 chars. `degraded[]` mirrors the registry flags (`no_resume_id`, `rules_not_loaded`).
2. **list(filter):** registry rows plus cached observations; no screen reads (cheap, for dashboards).
3. **sendPrompt(req):** (a) if `hasSession` is false: return `prov.session_not_found` (no hidden start; callers call `StartAgentSession` explicitly, CHAT008/AGENT012 already do); (b) call `DeliveryGuard.deliver` and return its receipt or error unchanged; (c) on success mark the registry `last_seen_at` and begin capturing the reply stream from the cursor at send time.
4. **replies(agentId, { sinceCursor })**: derives reply chunks from observer samples: text that appears after the echoed prompt and before the next prompt line, de-duplicated against the previous screen (line diff using the longest common suffix), redacted, size-capped at 8 KiB per chunk, retained in a ring of 1 MiB per Agent. A chunk is marked `final: true` when the observation moves to `idle` or `done_unclaimed` after having been `working` (still only a hint). Cursor format `<epochMs>-<seq>`. A consumer lagging over 1 MiB gets a `truncated` marker chunk and then continues from the latest.
5. **interrupt(agentId):** allowed only when the observation is `working`; sends the CLI profile's interrupt key (`interruptKey`, for example `esc` for Claude Code, PROV034) through `TerminalLayer.sendKey`; never in other states; with `interruptKey: null` it falls back to `stop`; audited as `provider.session_interrupted`.
6. **stop(agentId, { graceMs }):** `TerminalLayer.stop`, registry `end('stopped')`, release the concurrency slot, revoke the Run token only when no other session uses it; the Environment is left to the idle policy (BOX016/PROV019). Idempotent.
7. **Concurrency:** methods are safe to call in parallel; `sendPrompt` serialisation is inside the guard; registry writes use the unit of work.
8. **Hooks:** the gateway publishes `provider.session_changed` and, on blocked observations, calls the registered `BlockedStateHandler`s (PROV013 for dialogs, PROV014 for login, PROV018 for limits) so those tasks can attach without editing this file.
9. **Errors:** adapter errors are mapped to PROV009 codes (herdr `agent_not_found` becomes `prov.session_not_found`, connection loss becomes `prov.session_unavailable` retryable, etc.); no herdr or CLI text is forwarded.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Guard (PROV008), registry (PROV028), terminal layer and observer (PROV005), start use case (PROV027, called by others), redactor, `Clock`. The reply diffing helper is new but lives in one file (`reply-diff.ts`) so DISC adapters (PROV031) reuse it.

## 8. Architecture and code placement

`packages/application/src/prov/session/gateway/{default-agent-session-gateway.ts,reply-stream.ts,reply-diff.ts,interrupt.ts}`. Application layer composing ports; no adapter imports. Registered in the provider module (PROV026) under `AgentSessionGatewayToken`.

## 9. Security and safety

Replies are CLI output and therefore untrusted: they are redacted (SEC003), size-capped and exposed only as data; consumers must wrap them as untrusted text (SEC004). `interrupt` is the only key this class sends and only in `working`, so the gateway cannot be used to press `Enter`, `1` or `y` in a dialog. `sendPrompt` can only go through the guard (no alternative path in this class; a lint test forbids importing `TerminalLayer.sendText` anywhere in the folder except `interrupt.ts`). Snapshots never include raw screens. Fail closed when the registry or observer is unavailable.

## 10. Errors and edge cases

- Prompt echo not found on screen (CLI redraw): reply capture starts from the cursor at send time and filters lines equal to the first 80 chars of the prompt.
- Very long reply: ring buffer keeps the last 1 MiB, `truncated` flag on the first chunk after the gap.
- Session stops during `replies`: iterator ends with a final chunk (`final: true`, text empty).
- Observer cache stale after sleep: snapshot forces a fresh read.
- Two consumers of `replies`: each has its own cursor, the ring is shared.

## 11. Acceptance criteria

- [ ] Against fakes: snapshot returns `hasSession: false`, then a live session with `hint: true`.
- [ ] `sendPrompt` to a fake CLI showing an approval dialog returns `prov.agent_blocked` and nothing is typed.
- [ ] A fake CLI that prints a reply yields ordered chunks with increasing cursors and a final chunk after `idle`.
- [ ] `interrupt` in `waiting_approval` is refused; in `working` it sends exactly the profile key.
- [ ] `stop` is idempotent, releases the slot and keeps the Environment.
- [ ] Reply text containing a fake token is redacted in chunks.
- [ ] Lint test: no direct `sendText` use outside `interrupt.ts`.

## 12. Test plan

Unit tests for reply diffing (redraws, wrapping, echo), cursors and ring buffer; integration with `FakeHerdr` + `fake-claude` scenarios; contract suite `AgentSessionGateway.contract` (PROV024). Command: `pnpm vitest run packages/application/src/prov/session/gateway`.

## 13. Parallelization notes

Needs PROV027/PROV028 interfaces; can start with fakes. Extension point: `BlockedStateHandler[]` registered from PROV013/014/018 modules. Hotspot: `default-agent-session-gateway.ts` (single owner).

## 14. Open questions and assumptions

- ASSUMPTION: reply extraction by screen diff is good enough for Discussions in the MVP; structured replies via the Skill report are preferred when present (AGENT014).
- Open: per-CLI print modes (JSON output) could give exact replies later (herdr analysis section 5, "combine screen with structured output").
