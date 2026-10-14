---
id: OVE_TRAY003
title: "Define the TraySummary contract and the tray.summary route contract"
area: TRAY
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH008, OVE_ARCH010]
soft_depends_on: []
provides: ["contract:TraySummary", "contract:TrayRoutes", "lib:tray-invalidating-events"]
needs: ["lib:contract-pipeline", "contract:RouteContract", "lib:define-event", "contract:EntityId"]
owns: ["packages/contracts/src/tray/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 23]
---

# OVE_TRAY003: Define the TraySummary contract and the tray.summary route contract

## 1. Summary

Adds the zod schema `TraySummary` (status, slots, Agents per Workspace with state, pending counts, pause flags, running Run count, engine state) and the route contract `GET /v1/tray/summary`, plus the list of events that invalidate it.

## 2. Context

The popover must open fast and show facts from several areas: working Agents across all Workspaces (AGENT010 states), per-Workspace pause (PAUSE), pending Approvals and Access Requests (PERM, CHIEF), slots (PROV019), and how many Runs are active (for the quit confirmation). Five client round trips from a popover are slow and racy; a single aggregated read model matches the approach of `shell.top-bar` (SHELL001/002). The tray has no per-Workspace filter: it shows every Workspace the Owner has. Names and labels shown are limited to what the mock shows.

## 3. Scope (in)

- `packages/contracts/src/tray/tray-summary.ts` zod schemas and TypeScript types.
- `packages/contracts/src/tray/tray-routes.ts` route contract for `GET /v1/tray/summary`.
- `TRAY_INVALIDATING_EVENTS` constant with a registry test.
- Fixtures `buildTraySummary()` for tests and stories (`@overmind/contracts/testing`).

## 4. Out of scope

- Use case and route implementation (TRAY004).
- UI (TRAY005+).
- Actions: pausing, opening Chief, quit (existing routes of PAUSE and SYSTEM).

## 5. Detailed requirements

1. `TrayAgent` = `{ agentId: string; workspaceId: string; name: string (1..60); initials: string (1..2); hue: AgentHue | null; state: 'working'|'waiting_approval'|'idle'|'finished'|'error'; stateWord?: string (max 20, from a closed key set, never free text) }`. Idle agents are NOT listed (the popover shows who is active; the mock lists three working or waiting Agents).
2. `TrayWorkspace` = `{ id: string; name: string (1..80); paused: boolean; activeRuns: int; pending: { approvals: int; accessRequests: int; escalations: int; total: int } }` for every visible Workspace (max 50, sorted by recent activity).
3. `TraySummary` = `{ generatedAt: ISODateTime; engine: { state: 'ready'|'degraded' }; status: { phase: 'working'|'idle'|'paused'|'pausing'; workingAgents: int; slots: { active: int; limit: int; queued: int } }; pause: { global: boolean; pausingAgents?: int }; agents: TrayAgent[] (max 12); workspaces: TrayWorkspace[]; pendingTotal: int; activeRuns: int }`. `status.phase` is computed by the engine with the precedence paused > pausing > working > idle so the UI does not re-derive it.
4. The mock's per-Agent subtitle is the Workspace name: the UI joins `agent.workspaceId` to `workspaces[].name`; names are not duplicated in `TrayAgent`.
5. Route: `GET /v1/tray/summary`, scope `['owner']`, `idempotency: 'natural'`, errors `gateway.not_ready`; no query parameters.
6. `.strict()` schemas; `stateWord` values come from `TRAY_STATE_WORDS = ['working','waiting_approval','idle','finished','error']` keys, the UI maps to i18n (Polish words 'pracuje', 'Zgoda').
7. `TRAY_INVALIDATING_EVENTS`: `agent.state.changed`, `approval.requested`, `approval.decided`, `approval.expired`, `access_request.requested`, `access_request.decided`, `access_request.expired`, `pause.changed`, `pause.drain.updated`, `provider.concurrency_changed`, `workspace.created`, `workspace.renamed`, `workspace.deleted`, `run.started`, `run.finished`, `system.state_changed`; a registry test asserts each exists.
8. Compatibility: additive-only (ARCH008); consumers ignore unknown keys.
9. Names are plain text and marked `userVisibleVerbatim`.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- Contract pipeline and route contract format (ARCH008), `AgentHue` (DS040) as a string enum re-exported from contracts if present, `ISODateTime`, event registry (ARCH010).

## 8. Architecture and code placement

`packages/contracts/src/tray/**`. Contract layer; no runtime logic beyond zod and constants.

## 9. Security and safety

- Closed enums and caps prevent oversized payloads; no message content, no paths, no ids beyond opaque ids.
- Owner scope only: agents and channels cannot read the tray summary (it lists all Workspaces).
- Isolated Workspaces appear by name for the Owner (the Owner owns all data); nothing leaks to other principals.

## 10. Errors and edge cases

- More than 12 working Agents: the engine returns the first 12 by priority (waiting_approval first) and `workingAgents` carries the true count.
- No Workspaces yet (first run): empty arrays; phase `idle`.
- Contract evolution: an unknown `state` from a newer engine is rejected by zod at the client boundary and shown as the tray error state, not crashed.
- Duplicate Agent in two Workspaces: two rows (key `agentId+workspaceId`).

## 11. Acceptance criteria

- [ ] Given a valid fixture then it parses and round-trips.
- [ ] Given an extra key then parsing fails (strict).
- [ ] Given each invalidating event name then it exists in the registry.
- [ ] Given the route contract then it appears in the generated route table with scope owner.

## 12. Test plan

- Vitest contract tests: parse tables, caps, registry guard; compatibility check job (ARCH008).
- Commands: `pnpm --filter @overmind/contracts test tray`.

## 13. Parallelization notes

First backend TRAY task; TRAY004 and TRAY005 depend on it. Parallel with TRAY001/002.

## 14. Open questions and assumptions

- ASSUMPTION: Agents have a hue and 1-2 letter initials derivable from the name; if the Agent contract lacks `hue`, the UI derives it with the DS helper from `agentId`.
- OPEN: the number of active Runs may come from `RunReader` (AGENT018); confirm it exposes a count.
