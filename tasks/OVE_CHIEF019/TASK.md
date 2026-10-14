---
id: OVE_CHIEF019
title: Expose Chief state through gateway routes, api-client and push events
area: CHIEF
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_ARCH009, OVE_CHIEF007, OVE_CHIEF014, OVE_CHIEF015, OVE_ENGINE012, OVE_ENGINE019]
soft_depends_on: []
provides: ["api:chief.config", "api:chief.turns", "lib:api-client-chief", "contract:ChiefPushEvents"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:api-client-core", "port:ConfigStore"]
owns: ["packages/gateway/src/routes/chief/chief-config.route.ts", "packages/gateway/src/routes/chief/chief-turns.route.ts", "packages/contracts/src/chief/api/config.ts", "packages/api-client/src/chief/**"]
reads: ["packages/gateway/src/routes/chief/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 16.13", "SPECIFICATION 15"]
adr_refs: [5, 7]
---

# OVE_CHIEF019: Expose Chief state through gateway routes, api-client and push events

## 1. Summary

Complete the Chief API surface: read and update `ChiefConfig` (model and fallback), read recent turns for the Activity view, and provide one typed `api-client` module covering summary, proposals and escalations (their routes are owned by CHIEF007/014/015) plus push event mapping.

## 2. Context

The Settings and Connections views let the Owner pick Chief's model (mock "Claude Code · Opus 5.5"). Activity shows what Chief did and why (SPEC 15). Desktop, Telegram and future CLI use `api-client`.

## 3. Scope (in)

- `GET/PUT /v1/chief/config`, `GET /v1/chief/turns?limit=&cursor=` (trace summaries), `GET /v1/chief/turns/{id}` (details without prompt text).
- `api-client` module `chief` wrapping summary, proposals, escalations and the two routes above.
- Push event contract `ChiefPushEvents` (`chief.proposal.*`, `chief.escalation.*`, `chief.summary.updated`).

## 4. Out of scope

- The routes owned by CHIEF007, 014, 015. The Connections UI: CONNUI. Model validity checks: PROV.

## 5. Detailed requirements

1. `PUT /v1/chief/config` accepts `ChiefConfig` fields `providerId`, `modelId`, `fallbackModel`, `autonomy.maxDecisionCostUnits`, `autonomy.allowHowGapDecisions`; Owner desktop only (`perm.local_only` otherwise); the provider/model pair is validated by `ResolveModelForAgent`; changes are audited and take effect on the next turn.
2. `autonomy` changes that make Chief more autonomous (raise cost units, enable how-gap decisions) require a desktop session; lowering is allowed anywhere on desktop only (simple rule: the whole route is desktop-only).
3. `GET /v1/chief/turns` returns summaries (`id, trigger, startedAt, durationMs, model, actionTypes, outcome, findingsCount`) and details (`actions with outcomes`, `provenance ids`, `usage`) but never prompts, raw model output or Owner text.
4. Push mapping: `chief.escalation.raised` and `chief.proposal.created` map to the top bar counter and notification centre; payloads contain ids and enums.
5. api-client exposes typed functions and `subscribeChief(handler)`; resync logic shared with the chat client (`lib:api-client-core`).
6. All routes Owner-only; agent tokens rejected; schemas generated and snapshot-tested.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ConfigStore` (ARCH005), route and client infrastructure (ENGINE), contracts from CHIEF001.

## 8. Architecture and code placement

`packages/gateway/src/routes/chief/*.route.ts`, `packages/contracts/src/chief/api/config.ts`, `packages/api-client/src/chief/`.

## 9. Security and safety

Chief's model choice decides where the Owner's context goes, so config changes are desktop-only and audited. Turn traces hide prompts and outputs to avoid leaking documentation or secrets through the API. Agent tokens are rejected.

## 10. Errors and edge cases

- Invalid model for provider: 422 `chief.model_unavailable`.
- Config write during a running turn: applies from the next turn; the response says so.
- Missing config on first run: defaults from the onboarding result (ONB) or `unconfigured` state with a clear error from `RunChiefTurn`.
- Large turn history: cursor pagination, max 100.

## 11. Acceptance criteria

- [ ] `PUT /v1/chief/config` from a non-desktop session is rejected.
- [ ] Turn details never contain prompt or raw output fields (schema scan).
- [ ] An invalid provider/model pair is rejected with 422.
- [ ] api-client compiles against generated types and covers the CHIEF007/014/015 routes.
- [ ] Config change is audited and effective at the next turn.

## 12. Test plan

Route tests; schema scan; client tests with mock transport. Command: `pnpm vitest run packages/gateway/src/routes/chief packages/api-client/src/chief`.

## 13. Parallelization notes

After CHIEF007/014/015 contracts exist (can start earlier against schemas). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: `ChiefConfig` lives in the app config store (ARCH005), not in a Chief table.
