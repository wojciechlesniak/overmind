---
id: OVE_AGENT015
title: Expose the agent-facing "overmind" API routes
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT012, OVE_AGENT013, OVE_AGENT014, OVE_ARCH009, OVE_ENGINE010, OVE_ENGINE028]
soft_depends_on: []
provides: ["api:agent-api.hello", "api:agent-api.report", "api:agent-api.access-request", "api:agent-api.message", "api:agent-api.inbox", "api:agent-api.decision", "api:agent-api.whoami", "contract:AgentApiSchema"]
needs: ["lib:route-module", "lib:agent-token", "lib:gateway-agent-listener"]
owns: ["packages/gateway/src/routes/agent/agent-api/**", "packages/contracts/src/agent/api-agent/**", "docs/agent-api/agent-api.md"]
reads: ["packages/application/src/agent/report/**", "packages/application/src/agent-message/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 13", "SPECIFICATION 16.10"]
adr_refs: [27, 3, 5]
---

# OVE_AGENT015: Expose the agent-facing "overmind" API routes

## 1. Summary

The narrow local API that the "overmind" Skill's helper calls from inside the sandbox: hello, report, access request, message, inbox, decision and whoami. It is a separate listener scope from the Owner API, authenticated by the per-Run agent token, and cannot expose anything that widens permissions.

## 2. Context

ADR 0027: the Skill works only inside Overmind (env variable set by Overmind), calls the local API, and the API cannot expand permissions (ADR 0003). The agent reaches the engine through an endpoint mounted into the sandbox (BOX provides the mount; ENGINE the listener `lib:gateway-agent-listener`; see section 14). The helper (`OVE_SKILL012`) is the only intended client; the HTTP shapes are a public, additive-only contract (herdr pattern).

## 3. Scope (in)

- Routes under `/agent/v1/`: `POST hello`, `GET whoami`, `POST report` (body is an `AgentReport`), `POST access-request`, `POST messages`, `GET inbox`, `POST decisions`, `POST command-ack` (alias of a report of kind `command_ack`).
- Contract schemas in `packages/contracts/src/agent/api-agent/`.
- Documentation `docs/agent-api/agent-api.md`: endpoints, error shapes, examples, limits, versioning rules.

## 4. Out of scope

- The listener, socket mounting and token minting: ENGINE, BOX, SEC005. Business logic: AGENT012/014. The helper script: `OVE_SKILL012`.

## 5. Detailed requirements

1. Authentication: `Authorization: Bearer <agent token>` or, when using the Unix socket mount, the token file contents sent in the header; the route layer calls `authenticateAgentCall` and passes `AgentCallContext` to the use case. The Owner API routes reject agent tokens and these routes reject Owner sessions (separate scopes).
2. `GET /agent/v1/whoami` returns `{ agentName, role, runId, workspaceName (display only), taskId?, skillMinVersion, apiVersion, paused }`; no absolute host paths, no ids of other Workspaces, no secrets.
3. `POST /agent/v1/report` accepts `AgentReport` for kinds `started|progress|done|blocked|failed`; `access_request`, `decision`, `command_ack`, `hello` have their own routes that wrap the same use cases but with kind-specific schemas for better error messages.
4. `POST /agent/v1/messages` maps to `SendAgentMessage`; `GET /agent/v1/inbox?limit=&afterId=` returns messages addressed to the caller (id, sender name, kind, subject, body or artifact summary) as data fields (the helper prints them; the Skill text reminds that they are untrusted); max 20 per call.
5. Responses always JSON with `{ ok: true, ... }` or the standard error envelope (ARCH003) with `retryable`; the helper must be able to decide to retry only on `retryable: true` and never retry `POST report` blindly: every POST requires a client `reportId`/`clientMessageId` (idempotent).
6. Versioning: `X-Overmind-Skill-Version` header sent by the helper is recorded (hello) and compared to `skillMinVersion`; an older helper receives `agent.skill_outdated` (426) with a short message telling the Agent to stop and report to the Owner; newer minor versions are accepted (additive-only contract).
7. Limits: body max 64 KB (payloads larger than 2000 characters for messages must be uploaded as a file path inside `/work` and referenced; the route reads the file only through the sandbox file API, `needs: port:SandboxFileReader`, or rejects it in MVP; ASSUMPTION: MVP rejects, so bodies above 2000 characters return `agent.message_too_large`); 60 calls per minute per token (guard).
8. A conformance test suite (`agent-api.conformance.ts`) runs the same assertions against the real gateway and against any fake used by TEST006 so the `report-protocol` scenario stays valid.
9. None of the routes accepts or returns fields named `permission*`, `allow*`, `approve*`, `grant*`, `scope` or `policy` (contract test over the generated JSON Schemas).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineRoute`, error envelope (ARCH003), `authenticateAgentCall` (`OVE_AGENT013`), use cases from AGENT012/014, schema pipeline (ARCH008).

## 8. Architecture and code placement

Routes in `packages/gateway/src/routes/agent/agent-api/*.route.ts` (auto-registered with `scope: 'agent'`), schemas in `packages/contracts/src/agent/api-agent/`. Documentation in `docs/agent-api/`. Routes only translate HTTP to use-case calls.

## 9. Security and safety

This surface is reachable by a model that may be fully compromised. Controls: separate listener scope; token bound to one Run, Agent and Workspace; strict schemas; no capability-bearing fields in any schema (tested); idempotent POSTs; rate limits; audit on every refusal; no endpoint that lists other Agents' data or other Workspaces; error messages generic. Deny by default: anything not listed returns 404. Content of reports is data (SEC004).

## 10. Errors and edge cases

- Unknown path: 404 generic.
- Wrong token scope (Owner session on agent route): 403 `gateway.forbidden_for_owner_scope`.
- Missing `reportId`: 400.
- Engine paused: writes return 423 `pause.active`, `whoami` shows `paused: true`.
- Outdated helper: 426.
- Request body not JSON or too large: 400/413 without echoing content.

## 11. Acceptance criteria

- [ ] All routes exist with generated schemas and conformance tests passing against the gateway.
- [ ] Owner sessions are rejected on `/agent/v1/*` and agent tokens on `/v1/*`.
- [ ] A schema scan finds no permission-like field names.
- [ ] An outdated helper header yields 426 and is recorded.
- [ ] Posting the same `reportId` twice produces one stored report.
- [ ] `fake-claude` scenario `report-protocol` passes end to end (progress, access_request pending, done) and 401/403 are surfaced to the Agent.

## 12. Test plan

Route tests with in-process gateway and fake use cases; conformance suite; schema scan test; end-to-end test with `fake-claude` scenario `report-protocol` (TEST006). Command: `pnpm vitest run packages/gateway/src/routes/agent/agent-api`.

## 13. Parallelization notes

After AGENT012-014. SKILL011-014 depend on its schemas and docs. Hotspot: `docs/agent-api/agent-api.md` (owned here).

## 14. Open questions and assumptions

- ASSUMPTION (cross-area): ENGINE provides an agent-scoped listener (`lib:gateway-agent-listener`) and BOX mounts its socket and a token file into the sandbox at a fixed path read from env `OVERMIND_API_URL`/`OVERMIND_AGENT_TOKEN_FILE`; TEST006 already names `OVERMIND_API_URL` and `OVERMIND_AGENT_TOKEN`. The final variable names are fixed in `OVE_SKILL012`.
- ASSUMPTION: large message bodies are not supported in MVP.
