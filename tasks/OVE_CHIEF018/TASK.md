---
id: OVE_CHIEF018
title: Coordinate fallback model switching when a CLI limit is reached
area: CHIEF
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_CHIEF003, OVE_CHIEF015, OVE_NOTIF004, OVE_PROV018, OVE_PROV025]
soft_depends_on: [OVE_CHIEF006]
provides: ["usecase:HandleProviderLimitReached", "service:FallbackCoordinator", "event:provider.fallback_activated"]
needs: ["event:provider.limit_reached", "usecase:SwitchAgentModel", "port:ProviderHealthReader", "usecase:Notify", "usecase:ListAgents"]
owns: ["packages/application/src/chief/fallback/**"]
reads: ["packages/domain/src/chief/autonomy/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 16.12"]
adr_refs: [22, 7, 15]
---

# OVE_CHIEF018: Coordinate fallback model switching when a CLI limit is reached

## 1. Summary

When a CLI subscription limit runs out, Chief switches the affected Agents to their fallback model (the other CLI or Ollama), notifies the Owner, and escalates when no fallback exists. PROV detects the limit and performs the technical switch; this task owns the decision and the Owner-facing coordination.

## 2. Context

ADR 0022 and SPEC 9: the subscription limit is shared by all Agents on a CLI; when it runs out Chief moves the Agents to the fallback model and sends a notification; with no fallback, Escalation. Criterion 12. The limit and reset time are shown "per CLI" (source labelled), never as Overmind's own. Prototype: fake CLI scenario `rate-limit` ("You've hit your usage limit. Resets in 2 hours").

## 3. Scope (in)

- Subscriber to `provider.limit_reached` (PROV) and `provider.limit_reset`.
- Decision per affected Agent: fallback from Agent config (`fallbackModel`), else the Chief default fallback, else escalate.
- Switch requests to PROV (`SwitchAgentModel`), notifications, a Chief message, and switching back after reset (optional per setting).

## 4. Out of scope

- Detecting limits, running Agents on a different model, session management: PROV. Usage display: CONNUI. Cost policy of providers: settings.

## 5. Detailed requirements

1. Event payload (from PROV): `{ providerId, modelId?, resetAt?: IsoDateTime, source: 'cli_reported', affectedAgentIds: [...], runIds: [...] }`.
2. For each affected Agent: choose fallback = `AgentConfig.fallbackModel` else `ChiefConfig.fallbackModel`; verify health through `ProviderHealthReader` (connected, not itself limited). Evaluate `evaluateAutonomy('model_fallback_switch')` with the cost class of the fallback; `decide_alone` -> `SwitchAgentModel({ agentId, runId, to, reason: 'limit', temporary: true })`; the Agent's saved configuration is NOT changed (the switch is a Run-level override recorded on the Run, so pinned versions stay intact); otherwise Escalation.
3. No fallback available for some Agents -> one Escalation per provider (reason `no_fallback_model`) listing the Agents, options: "Wait until reset", "Choose another model" (opens settings, desktop only), "Pause these Runs". Affected Runs go to `waiting` (WFRT) rather than failing, and work in progress is not replayed blindly (non-idempotent steps handled by WFRT).
4. A single notification to the Owner per provider event (not per Agent): kind `model_switched` with counts and reset time ("Claude limit reached; 3 Agents switched to Codex until about 14:30, according to the CLI"); the Chief chat gets the same message with the source label "wg CLI".
5. Idempotency: repeated `limit_reached` for the same `(provider, resetAt)` is ignored after the first.
6. Switch back: on `provider.limit_reset` or when `resetAt` passes (checked by timer with the Clock port), Chief restores primary models for Runs that are still running only at the next safe point (PROV applies at node boundaries); setting `autoSwitchBack` default true (ASSUMPTION).
7. The Owner's explicit model choice for an Agent never gets overridden by Chief outside a limit event; Chief never changes the Agent configuration.
8. Quality note: when the fallback is an Ollama model (weaker), the Owner message mentions it and Quality Gates remain evidence-based; Chief does not relax Gates.
9. Cost: switching to a provider with a higher cost class requires `decide_alone` within Budget, else escalate.
10. Audit `chief.model.switched` with provider ids and counts.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PROV events and `SwitchAgentModel`, autonomy policy, `RaiseEscalation`, `Notify`.

## 8. Architecture and code placement

`packages/application/src/chief/fallback/{fallback-coordinator.ts,choose-fallback.ts}`; `choose-fallback.ts` is pure and tested separately. Module `chief-fallback.module.ts`.

## 9. Security and safety

Switching models changes where the Owner's code and context go (another provider), so it respects the configured fallback only; the Owner configured it. No new provider is ever chosen by Chief on its own. Limit information is taken from the CLI report, not from model text. Escalation when unsure.

## 10. Errors and edge cases

- Fallback also limited: escalate.
- Limit event for a provider no Agent uses: ignored.
- Reset time unknown: no auto switch back until `limit_reset`.
- Two providers hit simultaneously: separate decisions and notifications.
- Agent mid-prompt when switched: PROV handles; unknown outcome escalated by PROV/WFRT, not here.

## 11. Acceptance criteria

- [ ] With fake CLI `rate-limit` and Agents having `fallbackModel`, they switch to the fallback and one notification is sent (criterion 12 e2e).
- [ ] No fallback -> one Escalation `no_fallback_model`, Runs go to waiting.
- [ ] Repeated event for the same reset time causes no second switch.
- [ ] Agent configuration versions are unchanged after switch and switch-back.
- [ ] Higher-cost fallback beyond Budget escalates.
- [ ] Switch back happens after `limit_reset` at a safe point.

## 12. Test plan

Unit tests with fake PROV; `choose-fallback` table tests; e2e with `fake-claude rate-limit` and fake herdr (TEST006/009). Command: `pnpm vitest run packages/application/src/chief/fallback`.

## 13. Parallelization notes

Needs PROV event names (assumed). Parallel with CHIEF013-017. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: `provider.limit_reached`, `provider.limit_reset` and `SwitchAgentModel` exist in PROV (names flagged).
- ASSUMPTION: `autoSwitchBack` default true.
