---
id: OVE_PROV036
title: "Expose Agent terminal and control through gateway routes"
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_ARCH009, OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE017, OVE_ENGINE019, OVE_PAUSE005, OVE_PROV005, OVE_PROV006, OVE_PROV009, OVE_PROV029]
soft_depends_on: []
provides: ["api:agents.terminal", "api:agents.control", "lib:api-client-agent-terminal"]
needs: ["lib:route-module", "lib:gateway-principal", "lib:gateway-push", "lib:api-client", "port:TerminalLayer", "port:AgentSessionGateway", "port:PauseGate"]
owns: ["packages/gateway/src/routes/prov/agent-terminal.route.ts", "packages/gateway/src/routes/prov/agent-control.route.ts", "packages/api-client/src/prov/agent-terminal/**", "packages/contracts/src/terminal/api/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [23, 26]
---

# OVE_PROV036: Expose Agent terminal and control through gateway routes

## 1. Summary

Adds the owner-only routes behind the read-only Agent terminal preview and the Agent controls (pause, resume, stop, restart session) and the matching api-client functions. The terminal stream is read-only output; input to the CLI never goes through this route.

## 2. Context

The Agent chat side panel (OVE_CHATUI027, OVE_CHATUI029, OVE_CHATUI030) shows a live terminal and control buttons. herdr state is a hint, not proof (ADR 0026); the terminal text is untrusted content. `api:agents.states` is owned by OVE_AGENT010.

## 3. Scope (in)

- `GET /agents/{id}/terminal` snapshot (last N lines, sanitised) and `agents.terminal.subscribe` over the SSE hub with replay.
- `POST /agents/{id}/control` with `{action: "pause"|"resume"|"stop"|"restart"}`.
- api-client functions `getAgentTerminal`, `subscribeAgentTerminal`, `controlAgent`.
- zod schemas and generated types.

## 4. Out of scope

- Rendering and sanitising in the UI: OVE_DS052, OVE_CHATUI029.
- Starting sessions: OVE_PROV027.
- Sending chat messages to Agents: OVE_CHAT area.

## 5. Detailed requirements

1. Each route lives in its own `*.route.ts` module under the owned path and is auto-registered through `lib:route-module` (OVE_ARCH009) and `lib:route-registrar` (OVE_ENGINE013). The task MUST NOT edit any shared registry file.
2. Request and response schemas are zod objects in `packages/contracts/src/<entity>/api/`; the route table, JSON Schema and api-client types are generated from them (OVE_ARCH008). Changes are additive only.
3. Handlers are thin: parse input, read the caller from `GatewayCaller` (OVE_ENGINE011), call exactly one use case, map `Result<T, AppError>` to the envelope with the error catalogue (OVE_ARCH003). No business logic, no SQL and no file access in a handler.
4. Route scope is `owner` unless stated otherwise (`RouteScope`, OVE_ENGINE013). Agent and channel callers get `403 forbidden` without reaching the use case. Channel-limited views are out of scope here.
5. List endpoints use cursor pagination (`cursor`, `limit` default 50, max 200) from `lib:cursor-pagination` (OVE_DATA007). Unknown query parameters are rejected with `validation_failed`.
6. Mutating routes require an `Idempotency-Key` header handled by `lib:gateway-idempotency` (OVE_ENGINE015) and write an audit event through the gateway audit hook (OVE_ENGINE016).
7. The terminal snapshot is capped at 400 lines and 64 KiB, passed through the redactor (OVE_ARCH004) and control-character stripping before leaving the engine; ANSI escape sequences are removed server side as defence in depth.
8. `control` maps to existing use cases (pause uses OVE_PAUSE004 semantics for one Agent, stop uses `AgentSessionGateway.stop`); unknown actions are rejected by the zod enum.
9. There is no route that writes to the terminal; the contract has no `input` field and a test asserts it stays that way.
10. `restart` requires a stopped session and is idempotent per `Idempotency-Key`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:route-module` and `lib:route-registrar` (OVE_ARCH009, OVE_ENGINE013) for registration; do not hand-edit registries.
- `lib:gateway-pipeline` envelope, correlation ids and error mapping (OVE_ENGINE011); `lib:result` and `lib:error-catalogue` (OVE_ARCH003).
- `lib:cursor-pagination` (OVE_DATA007), `lib:gateway-idempotency` (OVE_ENGINE015), `lib:gateway-audit` (OVE_ENGINE016).

## 8. Architecture and code placement

Layer: adapter (gateway). Dependency direction: `routes/<area>` -> `application` use cases -> ports; contracts are shared with the api-client. Route modules never import another area's route module or any adapter. New behaviour is added by adding a route module (OCP); the registrar discovers it. Handlers contain no branching on business state (SRP).

## 9. Security and safety

- Trust boundary: the desktop UI over the Unix socket (owner token, OVE_ENGINE012). Deny by default: every route declares its scope; a route without a scope fails the registrar check at startup.
- All input is untrusted. Ids are validated as ULIDs; free text (names, comments) is length-capped and never interpolated into prompts, shell commands or file paths here.
- Workflow, Run and Activity content may contain text produced by agents or repositories. It is returned as data only; no route interprets it.
- Fail closed: if the use case or its policy check is unavailable the route returns `service_unavailable` and writes a denial audit event.
- Terminal output may contain prompt-injection text or secrets: redact, strip control sequences, and mark the payload `untrusted: true` so the UI never renders it as markup.
- Agent callers can never call these routes (scope `owner`).

## 10. Errors and edge cases

- Unknown id -> `404 not_found` with the typed error code from the owning contract; never a stack trace.
- Invalid body or query -> `400 validation_failed` with field paths and no echo of secret-looking values (redactor, OVE_ARCH004).
- Caller is an agent or a channel -> `403 forbidden`; the denial is audited.
- Global Pause active: read routes keep working; mutating routes that start work return `409 paused` (OVE_PAUSE005).
- Retried mutation with the same `Idempotency-Key` returns the stored response; with a different body it returns `409 idempotency_conflict`.
- Agent has no live session -> `409 agent_not_running` with an empty snapshot option `allowEmpty=true`.
- Terminal layer unreachable -> `503 terminal_unavailable`; the UI falls back to the state hint.

## 11. Acceptance criteria

- [ ] Given an owner token, when requesting a terminal snapshot, then at most 400 sanitised lines are returned.
- [ ] Given an agent token, then every route returns 403.
- [ ] Given `{action: "stop"}` twice with the same key, then one stop happens.
- [ ] Given a snapshot containing a secret-like token, then it is redacted.
- [ ] Given the generated contract, then no input-to-terminal field exists.

## 12. Test plan

- Contract tests (`createGatewayUnderTest`, OVE_ENGINE018): one per route covering success, validation failure, 404, scope denial with agent and channel principals.
- Schema tests: generated JSON Schema matches the zod source and the additive-only check (OVE_ARCH008) passes.
- Hostile-client tests: oversized body, wrong content type, unknown query parameter, repeated idempotency key.
- Commands: `pnpm --filter @overmind/gateway test`, `pnpm --filter @overmind/contracts test`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Independent of the other WFRT route tasks except through the contracts they import. Conflict hotspot: none if each route keeps its own `*.route.ts` file and its own `contracts/<entity>/api/` file. Use the generators from OVE_ARCH009 to create the files.

## 14. Open questions and assumptions

- ASSUMPTION: snapshot limits 400 lines and 64 KiB; adjust with the UI task if the panel needs more.
