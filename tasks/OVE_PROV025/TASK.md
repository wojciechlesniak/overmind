---
id: OVE_PROV025
title: Provide ResolveModelForAgent and ProviderHealthReader (model choice, fallback, health)
area: PROV
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT003, OVE_ARCH007, OVE_PROV001, OVE_PROV002, OVE_PROV003, OVE_PROV020, OVE_PROV023]
soft_depends_on: [OVE_PROV018, OVE_PROV023]
provides: ["usecase:ResolveModelForAgent", "port:ProviderHealthReader", "adapter:ConnectionBackedHealthReader"]
needs: ["usecase:ResolveModelSelection", "port:ConnectionRepository", "port:FallbackRepository", "port:TermsStateRepository", "port:AgentRepository", "port:Clock", "contract:ModelSelection"]
owns:
  - packages/application/src/prov/resolve-for-agent/**
  - packages/application/src/ports/ProviderHealthReader.ts
reads: ["packages/application/src/prov/model-selection/", "tasks/OVE_AGENT008/TASK.md", "tasks/OVE_CHIEF018/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 9", "SPECIFICATION 16"]
adr_refs: [3, 7, 22]
---

# OVE_PROV025: Provide ResolveModelForAgent and ProviderHealthReader (model choice, fallback, health)

## 1. Summary

Two small, widely consumed names. `ResolveModelForAgent` is the application-level entry for "which provider and model does this Agent use now" (Agent default, Node override, active fallback record, Owner choice, terms gate) with a validation mode for configuration screens and a strict mode for starting work. `ProviderHealthReader` gives other areas a read-only, cached view of provider health without touching Connections or CLIs.

## 2. Context

AGENT008 resolves Agents for Runs and expects `ResolveModelForAgent` to check that the Connection exists and offers the model, returning `model.degraded = true` (not an error) when the provider is currently unhealthy so the runtime may apply the fallback; CHIEF019 validates the Chief's provider/model pair with it; CHIEF018 verifies the fallback with `ProviderHealthReader` (connected, not itself limited); PROV027 uses it at session start where errors must stop the start. The pure resolution algorithm is PROV003 (`ResolveModelSelection`: Node override beats Agent default, an active fallback record beats both, errors for missing/unavailable/needs_login/limit_reached, capability check). Fallback records come from PROV018, terms status from PROV023.

## 3. Scope (in)

- `ResolveModelForAgent` use case (two modes) layered on `ResolveModelSelection`.
- `ProviderHealthReader` port and the Connection-backed implementation with a short cache.
- Owner-choice precedence rule and terms gate integration.

## 4. Out of scope

- The pure algorithm and `ModelSelection` contract (PROV003), fallback decision and records (PROV018), detection (PROV022), routes (PROV021).

## 5. Detailed requirements

1. **Input:** `{ agent: { id: AgentId } | { providerId: ProviderId; modelId: string }, runId?: RunId, node?: { modelOverride?: ModelRef }, requires?: CapabilityRequirement[], mode: 'config' | 'runtime', ownerChoice?: ModelRef }`. With `agent.id` the Agent is read through `AgentRepository.getById` (read-only; archived Agent -> `agent.not_found` passthrough); the provider/model fields of the pinned or current Agent version are used.
2. **Precedence (highest first):** (1) `ownerChoice` for this turn (explicit Owner command in a direct chat, source `override_by_owner_chat`, PROV003 enum); (2) node override; (3) active `FallbackRecord` for the Agent/Run (source `fallback`); (4) Agent default. The Owner's explicit saved Agent configuration is never changed by this use case.
3. **Terms gate:** if `TermsStateRepository` marks the chosen provider `blocked` (or `review_needed` with `blockOnTermsChange`), `runtime` mode returns `Err(provider.terms_blocked)`; `config` mode returns the selection with `degraded: true`, `degradedReason: 'terms_blocked'`.
4. **Mode `runtime`:** delegates to `ResolveModelSelection` and returns its errors unchanged (`provider.not_found`, `provider.unavailable`, `provider.needs_login`, `provider.limit_reached`, `provider.capability_missing`), with `details.fallbackAvailable: boolean` filled from `ListFallbackCandidates` when PROV018 is wired (optional dependency, absent means `false`).
5. **Mode `config` (validation for AGENT/CHIEF settings):** hard errors only for things that can never work: unknown provider (`provider.not_found`), model not offered by the Connection's last known model list when that list is non-empty, requirement not satisfiable by the provider's static capabilities (`provider.capability_missing`). Temporary problems (`needs_login`, `limit_reached`, `unavailable`, `terms_blocked`) do NOT fail: the result is `{ selection, degraded: true, degradedReason }`.
6. **Output:** `Result<{ selection: ModelSelection; degraded: boolean; degradedReason?: 'needs_login'|'limit_reached'|'unavailable'|'terms_blocked'; connectionStatus: ConnectionStatus }>`; `ModelSelection.reasonCode` carries the winning rule for the Run trace.
7. **Bulk helper:** `resolveForAgents(inputs[])` returns per-Agent results without short-circuiting (PROV003 requirement 6), used by the Agents list to show problems for all Agents at once.
8. **`ProviderHealthReader`:** `get(providerId): Result<ProviderHealthView>` and `list(): ProviderHealthView[]`, `ProviderHealthView = { providerId; connectionId?; status: ConnectionStatus; ready: boolean; limited: boolean; limitResetText?: string; needsLogin: boolean; termsStatus: 'ok'|'review_needed'|'blocked'; modelIds: string[]; checkedAt }`. Implementation reads `ConnectionRepository` and caches for 5 s; invalidated on `connection.status_changed`. `ready` is true only when status is `ready` or `degraded` with no limit and terms not blocked. It never calls a CLI, Ollama or the network.
9. **Determinism:** all inputs for a decision are returned in `selection` and `reasonCode`, so the caller can record them on the NodeExecution for replay (SPEC 15). The use case reads the clock only through `Clock`.
10. **No permission data:** the module must not import PERM packages (architecture test), same rule as PROV003.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ResolveModelSelection`, `ModelSelection`, `checkRequirements` (PROV001/PROV003), `ConnectionRepository` (PROV020), `FallbackRepository` and `ListFallbackCandidates` (PROV018), `TermsStateRepository` (PROV023), `AgentRepository` (AGENT003). No duplicated precedence logic: the order lives in PROV003; this task only adds the owner choice, terms gate and mode handling around it.

## 8. Architecture and code placement

`packages/application/src/prov/resolve-for-agent/{resolve-model-for-agent.ts,config-mode.ts,health-reader.ts,cache.ts}` and `packages/application/src/ports/ProviderHealthReader.ts`. Application layer, ports only; the health reader implementation is registered in PROV026.

## 9. Security and safety

Model choice never touches permissions: neither input nor output carries permission fields and the architecture test forbids PERM imports. A node or Agent cannot select a provider whose terms status is blocked, and a forged Owner choice is only honoured when the caller passes `ownerChoice` from a verified Owner direct-chat command (CHAT/CHIEF decide that; this use case does not accept it from Telegram-scoped callers because the field is set by trusted application code). Model ids are validated by the same regex as PROV003, never interpolated into a shell string. Health views contain no CLI text and no secrets. Fail closed in `runtime` mode when anything is unknown.

## 10. Errors and edge cases

- Agent references a provider with no Connection: `config` mode `provider.not_found`; `runtime` the same.
- Connection list empty during startup (detection not finished): `config` mode returns degraded `unavailable`, `runtime` returns `provider.unavailable`.
- Fallback record exists but its target Connection is now unhealthy: `runtime` returns the target's error; the caller escalates via PROV018/Chief.
- Archived Agent: error passthrough.
- Health cache stale after `connection.status_changed` race: invalidated on the event; worst case 5 s old.
- `requires` includes a capability no provider has: `provider.capability_missing` with the missing list.

## 11. Acceptance criteria

- [ ] Precedence table tests: owner choice > node override > fallback record > Agent default, with the expected `reasonCode` and `source`.
- [ ] `config` mode returns `degraded: true` for `needs_login`, `limit_reached`, `unavailable`, `terms_blocked` and hard errors only for unknown provider/model or unsatisfiable capabilities.
- [ ] `runtime` mode returns the typed errors unchanged and sets `details.fallbackAvailable`.
- [ ] `blocked` terms status blocks `runtime` resolution for that provider.
- [ ] `resolveForAgents` returns one result per input including failures.
- [ ] Health reader caches 5 s and invalidates on `connection.status_changed`; it performs no I/O besides the repository (spy).
- [ ] Architecture test: no import from PERM packages.

## 12. Test plan

Table tests with in-memory Connection, fallback and terms repositories and `FakeClock`; cache invalidation test; architecture test. Command: `pnpm vitest run packages/application/src/prov/resolve-for-agent`.

## 13. Parallelization notes

Small; start as soon as PROV003 and PROV020 interfaces exist. AGENT008, CHIEF018/019 and PROV027 consume it; keep names stable. Fallback and terms repositories can be stubbed until PROV018/PROV023 land.

## 14. Open questions and assumptions

- ASSUMPTION: `ownerChoice` is supplied by trusted application code after a verified Owner command; this task does not parse chat text.
- Open: whether `ProviderHealthReader` should also expose `activeAgents` (kept in the limiter status, PROV019, to avoid coupling).
