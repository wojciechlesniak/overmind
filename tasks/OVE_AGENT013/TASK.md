---
id: OVE_AGENT013
title: Enforce Workspace scope for Agents with the Agent scope guard and agent tokens
area: AGENT
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_AGENT018, OVE_ENGINE028, OVE_PERM020, OVE_VIS002]
soft_depends_on: [OVE_AGENT004]
provides: ["lib:agent-scope-guard", "usecase:AuthenticateAgentCall", "contract:AgentCallContext"]
needs: ["lib:agent-token", "port:RunReader", "lib:visibility-rules", "usecase:AppendAudit"]
owns: ["packages/application/src/agent/scope/**", "packages/contracts/src/agent/call-context.ts"]
reads: ["packages/domain/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [14, 3, 27, 28]
---

# OVE_AGENT013: Enforce Workspace scope for Agents with the Agent scope guard and agent tokens

## 1. Summary

Everything an Agent (a CLI session) calls through the "overmind" API runs inside an `AgentCallContext` derived from its token: which Agent, Run, Workspace and Node. The scope guard makes "Agent sees only the Workspace it currently works in" a single, testable rule that every agent-facing use case calls first.

## 2. Context

ADR 0014: "Agenci widzą tylko Workspace, w którym aktualnie pracują. Do innych Workspace'ów i ich Decyzji sięga wyłącznie Chief." A public Agent works in several Workspaces over time, each with separate memory. The token is minted per Run and Agent when the session starts (SEC005 / ENGINE own minting and gateway authentication; this task consumes the verified claims). ADR 0027: the API available to the Skill cannot widen permissions.

## 3. Scope (in)

- `AgentCallContext = { agentId, agentVersion, runId, workspaceId, nodeExecutionId?, sessionId, tokenId, issuedAt, expiresAt }` contract.
- `authenticateAgentCall(claims): Result<AgentCallContext>`: checks the Run is active, the Agent participates, the Workspace matches, the Agent still exists, Global Pause state is known.
- `agentScopeGuard` helpers: `requireSameWorkspace(ctx, entityWorkspaceId)`, `requireRunParticipant`, `scopedQuery(ctx)`.
- A static dependency test: agent-facing use cases take `AgentCallContext`, never a raw `workspaceId` from the request body.

## 4. Out of scope

- Token minting, rotation and gateway verification: ENGINE/SEC005 (`lib:agent-token`). Permissions of what the Agent may do: PERM. The routes: `OVE_AGENT015`.

## 5. Detailed requirements

1. All workspace and run identifiers in agent-facing request bodies or paths are IGNORED for authorization; the context's identifiers are used. If a body carries a different `workspaceId` or `runId`, the call is rejected with `agent.scope_violation` and audited (SR attempt of cross-Workspace access).
2. `authenticateAgentCall` verifies: token not expired and not revoked, `runId` is `running` or `waiting`, not `cancelled/finished`; the Agent's configuration version equals the pinned one for the Run (`ResolvedAgent`, `OVE_AGENT008`); the Agent is visible in the Workspace (VIS). Failure returns `gateway.unauthenticated` (401) or `agent.scope_violation` (403).
3. Reads available to Agents (via later tasks) are filtered by `scopedQuery(ctx)`: Workspace = `ctx.workspaceId`, never a list across Workspaces. Chief calls use a different context type (`ChiefCallContext`), and a compile-time brand prevents passing a `ChiefCallContext` where `AgentCallContext` is required and vice versa.
4. Token claims are not trusted data: the guard re-reads the Run and Agent from storage on every call (cache max 2 s), so a revoked or archived Agent loses access immediately.
5. On Global Pause (`PauseReader.isPaused`), the guard still authenticates but marks `paused: true`; write use cases return `pause.active` (423) so reports and messages are refused during a pause, except read-only calls.
6. Rate limit: 60 agent API calls per minute per token (ASSUMPTION), counted by the guard (in-memory counter via Clock); exceeding returns `gateway.rate_limited` with `retryAfterSeconds`.
7. The guard writes an audit event for each refusal (`agent.scope_violation`, `gateway.unauthenticated` with reason) with ids only.
8. A lint-style architecture test (`agent-facing.arch.test.ts`) scans `packages/application/src/agent*/` for use cases listed in `AGENT_FACING_USE_CASES` and asserts their input type does not contain `workspaceId` or `agentId` fields.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`lib:agent-token` (verification of signature and claims), `RunReader` (WFRT), visibility rules (VIS), audit (PERM). Test helper `makeAgentCallContext()` is exported from this task for other areas' tests.

## 8. Architecture and code placement

`packages/application/src/agent/scope/{authenticate-agent-call.ts,guard.ts,rate-limit.ts}`, contract in `packages/contracts/src/agent/call-context.ts`. No I/O except through ports.

## 9. Security and safety

This is the choke point for a malicious or prompt-injected CLI trying to read or write across Workspaces or Runs (SR cross-workspace). Principles: identity from the token only, re-validation against the live state, fail closed on any lookup failure, no listing endpoints across Workspaces, audit of every refusal. The token grants no permissions by itself; effective permissions come from PERM at action time.

## 10. Errors and edge cases

- Token valid but Run finished a moment ago: 403 `agent.scope_violation` reason `run_not_active`.
- Agent edited (new version) mid-Run: the pinned version still matches the Run; no error.
- Agent archived mid-Run: calls rejected, Run supervisor notified by WFRT.
- Clock skew on token times: `Clock` from the engine, tolerance 30 s.
- Many parallel calls: counter is race-safe in a single-threaded engine; documented.

## 11. Acceptance criteria

- [ ] A call with a body `workspaceId` different from the token's is rejected and audited.
- [ ] A call after the Run is cancelled is rejected.
- [ ] A revoked or archived Agent is rejected within 2 s.
- [ ] `ChiefCallContext` cannot be passed to an agent-facing use case (type test).
- [ ] The architecture test fails if an agent-facing use case input includes `workspaceId`.
- [ ] Rate limiting returns the documented code after 60 calls per minute.

## 12. Test plan

Unit tests with fake RunReader and fake token verifier; negative tests per refusal reason; type tests (`expectTypeOf`); architecture test. Command: `pnpm vitest run packages/application/src/agent/scope`.

## 13. Parallelization notes

Early in the AGENT area (needs only AGENT001); AGENT012, 014, 015 and SKILL tests depend on `makeAgentCallContext`. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: tokens are per (Run, Agent, session) and are minted by ENGINE/SEC005; the claim names are fixed here in `AgentCallContext`.
- ASSUMPTION: 60 calls per minute per token default.
