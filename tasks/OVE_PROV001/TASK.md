---
id: OVE_PROV001
title: Define the ModelProvider port, capability model and capability errors
area: PROV
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH006, OVE_ARCH007]
soft_depends_on: [OVE_ARCH008]
provides: ["port:ModelProvider", "contract:ProviderCapabilities", "lib:provider-errors"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock"]
owns:
  - packages/application/src/ports/ModelProvider.ts
  - packages/application/src/provider/capabilities/**
  - packages/contracts/src/provider/provider-capabilities.schema.ts
  - packages/contracts/src/provider/provider-id.schema.ts
  - packages/contracts/src/errors/provider.errors.ts
reads: ["docs/SPECIFICATION.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 14"]
adr_refs: [7, 22, 26]
---

# OVE_PROV001: Define the ModelProvider port, capability model and capability errors

## 1. Summary

Define the single abstraction behind which every model source hides (`claude` CLI, `codex` CLI, Ollama, later API keys): `capabilities()`, `invoke()`, `stream()`, `cancel()`, `health()`, `usage()`, with declared capabilities and clear errors when a requested feature is missing (ADR 0007). Workflow nodes and Agents depend on this port, never on a concrete provider.

## 2. Context

SPEC 9 (PROPOSED contract): `capabilities()`, `invoke()`, `stream()`, `cancel()`, `health()`, `usage()`; absence of a function gives a readable error or a configured fallback. CLI providers act on the computer themselves, inside the sandbox, through a terminal (herdr); Ollama is a plain HTTP model with no tools. Both fit one port if the port models a "task invocation" and not a chat-completion call: a CLI provider receives an instruction and works in `/work`; Ollama receives the same instruction and returns text. Which work a provider can do is expressed by capabilities, not by `instanceof` checks.

## 3. Scope (in)

- TypeScript port with zod schemas for requests, events and capabilities.
- Capability flags and a pure helper `checkRequirements(required, caps)`.
- Provider error codes.
- A `ProviderRegistry` interface (lookup by `ProviderId`) in the same port file.

## 4. Out of scope

- Implementations: PROV010/011 (CLI), PROV016 (Ollama). Model selection logic: PROV003. Usage store: PROV017. Fallback switching: PROV018.

## 5. Detailed requirements

1. **Ids:** `ProviderId = 'claude' | 'codex' | 'ollama'` as an open enum (`openEnum`), `ModelRef = { providerId: ProviderId; modelId: string }` (`modelId` 1..100 chars, `^[A-Za-z0-9._:/@-]+$`).
2. **Capabilities** (`ProviderCapabilities`): `{ providerId, kind: 'cli'|'api'|'local', streaming: boolean, tools: boolean, shell: boolean, fileEdit: boolean, structuredOutput: 'none'|'json'|'schema', images: boolean, cancel: 'hard'|'soft'|'none', resume: boolean, models: ModelInfo[], contextTokens?: number, requiresSandbox: boolean, reportsLimits: boolean }`. `ModelInfo = { modelId, displayName, tier?: 'fast'|'balanced'|'strong' }`. Declared statically per provider and refreshed by `health()`/detection (models list comes from what the CLI reports).
3. **Port:**
   ```ts
   interface ModelProvider {
     readonly id: ProviderId;
     capabilities(): ProviderCapabilities;                                   // sync, pure
     invoke(req: InvokeRequest, opts?: { signal?: AbortSignal }): Promise<Result<InvokeResult, AppError>>;
     stream(req: InvokeRequest, opts?: { signal?: AbortSignal }): AsyncIterable<Result<ProviderEvent, AppError>>;
     cancel(handle: InvocationHandle): Promise<Result<void, AppError>>;
     health(): Promise<Result<ProviderHealth, AppError>>;                    // { status, version?, models, needsLogin, detail? }
     usage(q: UsageQuery): Promise<Result<UsageSnapshot, AppError>>;         // reported by the CLI, source-labelled
   }
   InvokeRequest = { invocationId: string; agentId: string; runId?: string; nodeExecutionId?: string; model: ModelRef;
     instruction: string /* already assembled per SEC004, size <= 200 KiB */; requires: CapabilityRequirement[]; workspaceId: string;
     timeoutMs: number; idempotent: boolean; outputSchema?: JsonSchema }
   ProviderEvent = { type:'started'|'output'|'state'|'approval_needed'|'needs_login'|'limit_reached'|'done'|'error'; at; data }
   InvokeResult = { invocationId; status:'completed'|'failed'|'cancelled'; text?: string; structured?: unknown; evidenceRefs: string[]; usageDelta?: ModelUsageDraft; stateHint: AgentStateHint }
   ```
   `instruction` is untrusted-text-assembled by the caller (SEC004 prompt assembly); the provider treats it as opaque bytes and never interprets it.
4. **Requirements check:** `CapabilityRequirement = 'streaming'|'tools'|'shell'|'fileEdit'|'json'|'schema'|'images'|'hardCancel'|'resume'`. `checkRequirements(required, caps): Result<void, ProviderCapabilityError>` lists the missing ones. Callers (nodes) invoke it before `invoke`; providers call it again defensively.
5. **Errors** in `provider.errors.ts`: `provider.capability_missing` (details: missing list, providerId), `provider.not_found`, `provider.unavailable`, `provider.needs_login`, `provider.limit_reached` (details: `resetsAtText?`), `provider.busy`, `provider.timeout`, `provider.cancelled`, `provider.delivery_unknown` (command may or may not have reached the CLI; never auto-retry), `provider.invalid_state` (agent waiting approval/selection prompt), `provider.output_invalid`, `provider.terms_blocked`. HTTP mapping and `telegramSafe` per ARCH003; messages are generic (no CLI output).
6. **Registry interface:** `ProviderRegistry { get(id): Result<ModelProvider>; list(): ModelProvider[]; capabilitiesOf(id) }`; the implementation is composed in PROV026.
7. **Event stream rules:** `stream` yields `started` first, `done`/`error` last, never throws; `output` events contain redacted text chunks (the provider applies the redactor of SEC003 to anything derived from a terminal) and are size-capped (8 KiB per event).
8. **Idempotency flag:** `idempotent: false` (default) marks requests whose replay could repeat side effects; providers never replay them automatically (PROV008).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Result`/`AppError`/`defineErrors` (ARCH003), contracts pipeline (ARCH008) for schemas, `Clock`. Prompt assembly types from SEC004 are referenced, not redefined.

## 8. Architecture and code placement

Port in `packages/application/src/ports/ModelProvider.ts` (interface, token `ModelProviderRegistryToken`, value types); zod in `packages/contracts/src/provider/`; helper in `packages/application/src/provider/capabilities/`. No I/O. ISP: `usage()` could be split, so it is also exposed as the separate `ProviderUsage` port (PROV017); `ModelProvider.usage` delegates to it for convenience.

## 9. Security and safety

The port is the boundary where untrusted text meets CLIs that execute commands. Rules encoded: `instruction` is data already wrapped by SEC004 (the provider does not append Owner Rules or permissions); providers expose no way to change permissions, environment or working directory (`/work` is fixed by BOX); output events are redacted; errors carry no CLI output; `requiresSandbox: true` providers refuse to run without an `IsolationTicket` (PROV008 supplies it). Fail closed on unknown provider ids.

## 10. Errors and edge cases

- Provider declares `tools: true` but is offline: `health()` says `unavailable`, capability stays declared; callers see `provider.unavailable`, not `capability_missing`.
- Request requires `schema` from a provider with `json` only: `provider.capability_missing` listing `schema`; a configured fallback (PROV018) may apply.
- Unknown extra `ProviderEvent.type` from a newer provider: consumers ignore unknown types (open enum).
- Streaming consumer stops reading: `cancel` is invoked by the caller on abort; a provider must not buffer unboundedly (cap 1 MiB then drop with a `truncated` flag).
- `instruction` larger than 200 KiB: rejected by schema validation with `internal.invalid_input` before any provider is called.

## 11. Acceptance criteria

- [ ] Port and schemas compile, appear in the contracts snapshot, and all error codes pass the ARCH003 hostile-error test.
- [ ] `checkRequirements` returns every missing capability and succeeds when none are missing (table tests).
- [ ] A fake provider implementing the port passes the `ModelProvider.contract` suite once PROV024 lands (shape-level tests here).
- [ ] `stream` ordering rules are documented and covered by a helper `assertEventOrder`.
- [ ] No concrete provider type is imported by the application layer (boundary lint).

## 12. Test plan

Unit tests for schemas, `checkRequirements`, event-order helper; type tests for the interface. Commands: `pnpm vitest run packages/application/src/provider packages/contracts/src/provider`.

## 13. Parallelization notes

Merge first in PROV; every other PROV task and WFRT/AGENT depend on it. Contract files are one per concept to avoid conflicts.

## 14. Open questions and assumptions

- ASSUMPTION: `invoke` is task-oriented (the CLI works in `/work` and reports); Ollama returns text only and cannot satisfy `shell`/`fileEdit` requirements, so such nodes escalate rather than run on Ollama (PROV016, PROV018).
- Open: `images` support for CLIs (post-MVP flag stays false).
