---
id: OVE_PROV003
title: Implement per-Agent and per-Node model selection resolution
area: PROV
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_ARCH007, OVE_PROV001, OVE_PROV002, OVE_PROV020]
soft_depends_on: [OVE_PROV018]
provides: ["usecase:ResolveModelSelection", "contract:ModelSelection"]
needs: ["contract:Agent", "port:ConnectionRepository", "port:Clock"]
owns:
  - packages/domain/src/prov/model-selection/**
  - packages/application/src/prov/model-selection/**
  - packages/contracts/src/provider/model-selection.schema.ts
reads: ["docs/SPECIFICATION.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 9", "SPECIFICATION 16"]
adr_refs: [3, 7]
---

# OVE_PROV003: Implement per-Agent and per-Node model selection resolution

## 1. Summary

Resolve which provider and model a given Agent running a given Node must use: the Agent has a default `providerId`/`modelId`, a Workflow Node may override model (ADR 0007), and a runtime fallback (PROV018) may temporarily replace both. A Node can never change permissions, only the model.

## 2. Context

ADR 0007: model per Agent and per Node, mixed Providers, a Senior Reviewer on a stronger model while a Developer uses a cheaper one. SPEC 9: the Owner assigns Agents models that are available in the connected CLIs. Criterion 2: at least three Agents with different models from connected CLIs. A selection that refers to a disconnected provider must give a clear error or the configured fallback, not a silent change.

## 3. Scope (in)

- Pure resolution function and the `ResolveModelSelection` use case.
- Validation that the chosen model is in the provider's reported model list and that capabilities satisfy the node requirements.
- Result type that explains where each value came from (for Activity and replay).

## 4. Out of scope

- Switching on exhausted limits (PROV018), storing Agent definitions (AGENT), Node editor UI (WFED).

## 5. Detailed requirements

1. **Contract:** `ModelSelection = { providerId; modelId; source: 'agent'|'node'|'fallback'|'override_by_owner_chat'; reasonCode?: string; connectionId; resolvedAt }`.
2. **Inputs:** `{ agent: { providerId, modelId }, node?: { modelOverride?: ModelRef }, requires: CapabilityRequirement[], activeFallback?: FallbackRecord | null }`. Node override wins over the Agent default; an active fallback record (PROV018) wins over both while it is valid and is reported with `source: 'fallback'`.
3. **Algorithm (pure, domain):** pick the preferred `ModelRef` by the order above; look up the Connection for its provider (via `ConnectionRepository`); fail with `provider.not_found` if no Connection exists, `provider.unavailable` if status is `not_installed`/`error`/`disabled`, `provider.needs_login` if `needs_login`, `provider.limit_reached` if `limit_reached` and no fallback record exists; check the model is in `connection.models` (case-sensitive id); check `checkRequirements` from PROV001; return `ModelSelection`.
4. **Permissions untouched:** the use case has no access to permission data and the output type has no permission fields; a lint/architecture test asserts the module does not import PERM packages.
5. **Determinism and replay:** `resolvedAt` comes from the injected `Clock`; the full inputs and output are recorded by the caller on the NodeExecution so a Run can be replayed with the same models (SPEC 15).
6. **Bulk helper:** `resolveForAgents(agents[])` returns per-Agent results without short-circuiting so the UI can show problems for all Agents at once.
7. **Mixed providers in one Run** are allowed; no global model state exists.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`checkRequirements` (PROV001), `ConnectionRepository` (PROV020), `Agent` contract (AGENT), `Clock`.

## 8. Architecture and code placement

Domain `packages/domain/src/prov/model-selection/resolve.ts` (pure), use case in `packages/application/src/prov/model-selection/resolve-model-selection.usecase.ts`, schema in contracts. No I/O in domain.

## 9. Security and safety

Selection must not be a back door for permission changes (ADR 0007: a Node may override model, prompt and Skills but not permissions): output has no such fields. Model ids come from stored definitions, validated against the provider-reported list, so a prompt-injected string cannot select an arbitrary model name that a CLI would interpret as a flag (ids are validated by regex and never placed in a shell string; PROV010 passes them as a single argv element after the flag). Fail closed: unresolvable selection blocks the Node with a clear reason.

## 10. Errors and edge cases

- Agent model removed by a CLI update: `provider.capability_missing`-style `provider.not_found` with `reasonCode: model_removed`; Chief gets an Escalation.
- Node override refers to a different provider that is `needs_login`: error names the provider; no automatic fallback unless PROV018 rules allow it.
- Two Connections of the same provider (not planned): the first `ready` one by creation date is used; documented.
- Fallback record expired: ignored; primary selection used.
- Empty model list (not yet detected): `provider.unavailable` with `reasonCode: not_detected`.

## 11. Acceptance criteria

- [ ] Table tests cover agent-only, node-override, fallback-active and each error status.
- [ ] The output contains no permission-related fields; the architecture test passes.
- [ ] The same inputs and clock always give the same output (property test).
- [ ] `resolveForAgents` reports all failures.
- [ ] Capability mismatch returns `provider.capability_missing` listing missing flags.

## 12. Test plan

Unit tests for the pure resolver with in-memory connections; use case tests with fakes. Commands: `pnpm vitest run packages/domain/src/prov/model-selection packages/application/src/prov/model-selection`.

## 13. Parallelization notes

Small; parallel with PROV004 onwards. WFRT and AGENT consume `usecase:ResolveModelSelection`.

## 14. Open questions and assumptions

- ASSUMPTION: an Owner chat instruction like "use the stronger model" is recorded as a normal Agent update by AGENT, not as `override_by_owner_chat` at runtime; the enum value is reserved.
