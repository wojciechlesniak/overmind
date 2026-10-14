---
id: OVE_PROV018
title: Detect exhausted limits, switch Agents to a fallback model and escalate when none exists
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_CHIEF015, OVE_DATA001, OVE_DATA003, OVE_DATA007, OVE_ENGINE016, OVE_ENGINE029, OVE_NOTIF004, OVE_PROV001, OVE_PROV003, OVE_PROV006, OVE_PROV009, OVE_PROV017, OVE_PROV019, OVE_PROV020]
soft_depends_on: [OVE_PROV009, OVE_PROV014, OVE_PROV025, OVE_PROV029]
provides: ["event:provider.limit_reached", "event:provider.limit_reset", "event:provider.model_switched", "usecase:SwitchAgentModel", "usecase:HandleProviderLimit", "usecase:ListFallbackCandidates", "port:FallbackRepository", "table:prov_fallbacks", "lib:limit-detector"]
needs: ["contract:ModelSelection", "port:ConnectionRepository", "usecase:RaiseEscalation", "usecase:CreateNotification", "port:JobScheduler", "port:Clock", "port:IdGenerator", "port:EventBus", "port:AuditSink", "lib:define-event", "port:SqliteDatabase", "lib:repository-base", "lib:migration-runner", "port:AgentSessionGateway", "contract:ProvConfig"]
owns:
  - packages/application/src/prov/limits/**
  - packages/domain/src/prov/fallback/**
  - packages/application/src/ports/FallbackRepository.ts
  - packages/contracts/src/events/provider.limit_reached.event.ts
  - packages/contracts/src/events/provider.limit_reset.event.ts
  - packages/contracts/src/events/provider.model_switched.event.ts
  - packages/adapters/sqlite/src/prov/fallbacks/**
  - packages/adapters/sqlite/migrations/V202610150120__OVE_PROV018__prov_fallbacks.sql
reads: ["docs/SPECIFICATION.md", "tasks/OVE_CHIEF018/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 16", "SPECIFICATION 17"]
adr_refs: [7, 15, 22]
---

# OVE_PROV018: Detect exhausted limits, switch Agents to a fallback model and escalate when none exists

## 1. Summary

When a CLI subscription limit is reached, the affected Agents continue on a fallback model (the other CLI or Ollama) and the Owner is notified; when no usable fallback exists the work waits and an Escalation is raised (Spec 9, acceptance criterion 12). This task detects the limit once, publishes the event, applies Run-level model overrides without changing saved Agent configurations, restores the primary model after the reset, and provides the safety net if Chief does not act.

## 2. Context

ADR 0022: the limit is shared by all Agents on a CLI; Chief switches Agents to the fallback and notifies, else Escalation. CHIEF018 (the decision side) subscribes to `provider.limit_reached` with payload `{ providerId, modelId?, resetAt?, source: 'cli_reported', affectedAgentIds, runIds }`, picks the fallback (`AgentConfig.fallbackModel`, else `ChiefConfig.fallbackModel`), checks autonomy and health through `ProviderHealthReader` (PROV025), then calls `SwitchAgentModel({ agentId, runId, to, reason: 'limit', temporary: true })`; the Agent's saved config is not changed; switching back happens at the next safe point (node boundary) on `provider.limit_reset` or when `resetAt` passes. Limit text and reset times come from the CLI (PROV017), never from Overmind's own estimates. A limit signal can be forged by CLI output (prompt injection), so switching is visible, audited and reversible.

## 3. Scope (in)

- `LimitDetector`: turns provider errors and `rate_limited` observations into one deduplicated limit event per `(providerId, resetAt|window)`.
- Events `provider.limit_reached`, `provider.limit_reset`, `provider.model_switched`.
- `SwitchAgentModel` use case and `FallbackRepository` (table `prov_fallbacks`).
- `ListFallbackCandidates` (capability- and health-aware ordering).
- `HandleProviderLimit`: default handler used when Chief does not decide (`fallbackDecidedBy: 'provider'`) plus the watchdog safety net.
- Switch-back on reset.

## 4. Out of scope

- Chief's autonomy decision, Owner-facing Chief message and Run waiting (CHIEF018, WFRT), model resolution output shape (PROV003/PROV025), usage parsing (PROV017), UI.

## 5. Detailed requirements

1. **Detection:** inputs: `provider.limit_reached` errors from providers (PROV010/011), `rate_limited` observations via the gateway hook, parsed reset info from PROV017. `LimitDetector.ingest(signal)` identifies the Connection and computes a window key `provider:resetAtIso|bucket(15min)`; the first signal for a key within its validity publishes the event, later ones are counted and ignored (idempotent). Required evidence: a `rate_limited` observation needs a second confirming sample or a provider error to avoid a single stray screen flipping the Connection (config `limitConfirmSamples` default 2).
2. **Event `provider.limit_reached` (persisted, workspace-agnostic, ARCH010):** `{ connectionId, providerId, modelId?, resetAt?: IsoDateTime, resetsAtText?: string(<=200, verbatim from the CLI, sanitised), source: 'cli_reported', affectedAgentIds: AgentId[], runIds: RunId[] }`; `affectedAgentIds` = Agents with live or recent sessions on that Connection (from the registry) plus Agents configured on it that have an active Run. Connection status becomes `limit_reached` (PROV020) with `limitResetText`.
3. **Event `provider.limit_reset`:** published when the CLI reports availability again (usage probe, successful turn) or when `resetAt` has passed (JobScheduler timer via `Clock`; the Connection is probed before declaring reset); Connection status back to `ready`. For unknown reset time no timer is set; the periodic usage probe and the Owner's manual `connections.test` clear it.
4. **`SwitchAgentModel.execute({ agentId, runId?, to: ModelRef, reason: 'limit'|'owner_request', temporary: boolean })`:** validates `to` through `ResolveModelSelection` (PROV003: Connection ready, model offered, capability requirements of the Agent's role/node); writes `FallbackRecord { id, agentId, runId?, from, to, reason, since, validUntilText?, active: true }`; ends live sessions of that Agent on the limited Connection with `AgentSessionGateway.stop` (the Environment stays; the next `StartAgentSession` resolves to the fallback); publishes `provider.model_switched { agentId, runId?, from, to, temporary, reason }` and audit `provider.model_switched`. The Agent definition and pinned version are untouched (the record is a Run-level override read by `ResolveModelForAgent`, PROV025). Idempotent per `(agentId, runId, to)`.
5. **Capability rule:** a candidate is eligible only if it satisfies the Agent's required capabilities (`shell`, `fileEdit`, `tools`) as stored in the Agent role/node requirements; Ollama is therefore never eligible for tool-needing work (PROV016) and `ListFallbackCandidates` explains why (`excluded: [{ model, missing: ['shell'] }]`).
6. **Candidates order:** Agent-level `fallbackModel`, then Chief-level `fallbackModel`, then `ProvConfig.fallbackChain` (default `['other_cli', 'ollama']`), each filtered by Connection health (`ready`, not `limit_reached`). No candidate -> empty list.
7. **Who decides (`ProvConfig.fallbackDecidedBy`, default `'chief'`):** with `chief`, this task only publishes events and serves `SwitchAgentModel`/`ListFallbackCandidates`. With `provider` (tests, headless mode, Chief disabled) `HandleProviderLimit` runs the default policy itself: per affected Agent switch to the first candidate and create ONE notification per provider event (`kind: model_switched`: counts, fallback name, "until about <resetsAtText>, according to the CLI"), or, with no candidate, create ONE Escalation (`RaiseEscalation`, reason `no_fallback_model`, listing Agents, options wait / choose another model / pause Runs) and let Runs wait.
8. **Watchdog (safety net in both modes):** 60 s after a limit event, if an affected Agent with an active Run has neither a `FallbackRecord` nor an open Escalation for the window, raise the Escalation and notification with the dedupe key `limit:<providerId>:<windowKey>` (the same key Chief uses, so duplicates collapse, CHIEF018 requirement 5). The watchdog never switches models by itself in `chief` mode.
9. **Switch back:** on `provider.limit_reset` all active records for that `from` provider become `active: false` with `endedAt`; `ResolveModelForAgent` then returns the primary model at the next resolution (node boundary), running turns are not moved; `ProvConfig.autoSwitchBack` default true (ASSUMPTION shared with CHIEF018); when false records stay until the Owner or Chief ends them (`SwitchAgentModel` with `to = from`).
10. **Persistence:** table `prov_fallbacks(id PK, agent_id, run_id NULL, from_provider, from_model, to_provider, to_model, reason, active INT, since, ended_at NULL, valid_until_text NULL)` with indexes on `(agent_id, active)` and `(run_id)`; records of finished Runs are purged after 30 days.
11. **No blind replay:** switching never resends a prompt; the in-flight invocation already failed with `provider.limit_reached` and its non-idempotent node handling is WFRT's (Spec 12).
12. **Rate limiting:** at most one `limit_reached` event per Connection per 5 minutes unless the window key changes.

## 6. Design notes

N/A, functionality only. Notification copy keys: `notif.model_switched`, `notif.limit_no_fallback` (EN + PL in the NOTIF namespace through the proposal mechanism, text from CHIEF018: "Claude limit reached; 3 Agents switched to Codex until about 14:30, according to the CLI").

## 7. Reuse

`ResolveModelSelection` (PROV003), `checkRequirements` (PROV001), `ConnectionRepository` (PROV020), parsed limits (PROV017), `RaiseEscalation` (CHIEF015), `CreateNotification` (NOTIF004), `defineEvent` (ARCH010), `JobScheduler`, repository base and migration runner. Do not duplicate Chief's autonomy logic.

## 8. Architecture and code placement

Pure ordering and eligibility in `packages/domain/src/prov/fallback/{candidates.ts,eligibility.ts,window-key.ts}`; use cases in `packages/application/src/prov/limits/{limit-detector.ts,switch-agent-model.ts,handle-provider-limit.ts,watchdog.ts,switch-back.ts}`; ports and adapter as listed. Application layer over ports; events in contracts, one file each (ARCH009).

## 9. Security and safety

A forged limit screen could try to push Agents to a weaker or more expensive model or to Ollama. Controls: confirmation sample or provider error before the event; capability filter (a weak model never receives work it cannot do); switching is a Run-level override, audited, notified and reversible; the saved Agent configuration and Owner's explicit model choice are untouched; only providers with a ready Connection are eligible; no secret or prompt text is in events; the limit text is sanitised and bounded. Cost and autonomy decisions stay with Chief (ADR 0015). Switching to another CLI changes which provider sees the work, so the Owner message names the target.

## 10. Errors and edge cases

- Both CLIs limited: no candidate (Ollama excluded for tool work) -> Escalation, Runs wait.
- Reset time unknown: no timer; probe-based reset only; notification says "reset time unknown".
- Fallback Connection becomes `needs_login` right after the switch: session start fails with `provider.needs_login`; the next watchdog tick escalates.
- Limit event arrives while Global Pause is on: records and notification are created, no session starts (paused), resolution continues after release.
- Duplicate signals from several Agents on one CLI: one event (window key).
- Owner changes the Agent's model during a switch: record kept only if still limit-related; Owner choice wins at next resolution (PROV025 rule: explicit Owner override beats fallback record).
- Engine restart: active records persist; timers are rebuilt from `valid_until` or probes.

## 11. Acceptance criteria

- [ ] Two `rate_limited` samples (or one provider error) publish exactly one `provider.limit_reached` with the CHIEF018 payload; a third signal with the same window key does not.
- [ ] `SwitchAgentModel` writes a record, stops the old session, publishes `provider.model_switched`, and `ResolveModelForAgent` returns `source: 'fallback'` while active; the Agent config is unchanged (repository spy).
- [ ] Ollama is excluded for an Agent requiring `shell`; with no other candidate the Escalation is raised once with the dedupe key.
- [ ] In `provider` mode the full flow produces one notification per event and switches all affected Agents; in `chief` mode nothing switches without a `SwitchAgentModel` call, but the watchdog escalates after 60 s.
- [ ] On `limit_reset` records deactivate and the next resolution returns the primary model; running turns are not interrupted.
- [ ] No prompt is resent by any path (fake gateway records zero sends).
- [ ] Migration idempotent; purge job removes old records.

## 12. Test plan

Domain table tests for eligibility and ordering; use-case tests with fakes and `FakeClock` for windows, watchdog and switch-back; integration with `fake-claude` (`rate_limit` scenario) + `fake-codex`; repository tests on the SQLite harness. Commands: `pnpm vitest run packages/domain/src/prov/fallback packages/application/src/prov/limits packages/adapters/sqlite/src/prov/fallbacks`.

## 13. Parallelization notes

Needs PROV003, PROV017, PROV020 interfaces. CHIEF018 depends on this task's event and use case names (stable). Event files are one per event (ARCH009). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Chief decides by default (`fallbackDecidedBy: 'chief'`); this task covers the mechanism and the safety net. The overlap with CHIEF018 (notification, Escalation) is resolved by the shared dedupe key `limit:<providerId>:<windowKey>`.
- ASSUMPTION: `autoSwitchBack` default true, shared with CHIEF018.
- Open: should switching to an Ollama model for judgement-only roles (for example Review) need an explicit Owner opt-in? Default: allowed when capability requirements are met and Chief's autonomy allows.
