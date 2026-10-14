---
id: OVE_MEM002
title: "Enforce Memory Scope as a typed query-layer policy library"
area: MEM
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_DATA010, OVE_MEM001, OVE_PERM020]
soft_depends_on: []
provides: ["lib:memory-scope-policy", "lib:authorised-scope", "lib:authorised-workspace-set"]
needs: ["contract:MemoryScope", "port:WorkspaceRepository", "lib:result", "lib:error-catalogue", "port:AuditLog"]
owns: ["packages/domain/src/memory/scope/**", "packages/application/src/memory/scope/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [8, 14, 28]
---

# OVE_MEM002: Enforce Memory Scope as a typed query-layer policy library

## 1. Summary

Implement the single place that decides who may read which memory and shared knowledge: a pure decision matrix over caller kind, scope and Workspace isolation, and an application service that turns an allowed request into an unforgeable branded `AuthorisedScope` / `AuthorisedWorkspaceSet` that every repository and index query REQUIRES. This makes isolation a compile-time and test-time property instead of a convention.

## 2. Context

ADR 0014: Agents see only the Workspace they work in; only Chief reaches other Workspaces' Decisions, except isolated Workspaces; Agent Memory is separate per Workspace, also for public Agents; Owner views but does not edit. ADR 0028: Visibility (public/private) does not change memory boundaries. SPEC 10: isolated Workspace shares nothing outward. Glossary Memory Scope: conversation, Agent, Team, Workspace, whole installation. DEC003/DEC007/DEC008, BOARD011 and MEM003 queries depend on this library.

## 3. Scope (in)

- Domain: scope matrix as data and the `decide()` function.
- Application: `authorise(caller, request)` producing branded values, audit of widening reads, caching rules.
- Test helpers: `forTest.authorisedScope(...)` guarded to the testing package.

## 4. Out of scope

- Using the sets in specific repositories: DEC, BOARD, MEM003/004. Chief behaviour: CHIEF.

## 5. Detailed requirements

1. **Caller** (`ScopeCaller`): `{ kind: 'owner' | 'chief' | 'agent' | 'system' | 'channel', agentId?, teamIds?, currentWorkspaceId?, conversationId?, jobScope?: { workspaceId, agentId? } }`; built from the authenticated session by the gateway/engine, never from request data. `channel` (Telegram) inherits the Owner or Chief context it acts through, with `via: 'telegram'` recorded and summary-only flag.
2. **Matrix** (rows: scope; columns: caller) producing an allowed set, `deny` otherwise:
   | Scope | agent | chief | owner | system job |
   |---|---|---|---|---|
   | `conversation` | the conversation it participates in (id check by CHAT/DISC) | conversations it moderates or is in | any | none |
   | `agent` (Agent Memory) | own `agentId` in `currentWorkspaceId` only | agent memory in `currentWorkspaceId` only (never cross-Workspace, ASSUMPTION) | all agents; Workspaces: non-isolated always, isolated only when it equals `currentWorkspaceId` (UI context) | exactly the job's `(agentId, workspaceId)` |
   | `team` | team memory of its teams in current Workspace (no data in MVP: returns empty set, scope declared) | same | same | none |
   | `workspace` (Shared Memory: Board + Decisions of one Workspace) | `currentWorkspaceId` | `currentWorkspaceId` or any non-isolated Workspace | any Workspace | the job's Workspace |
   | `installation` (cross-Workspace Decisions) | DENY | all non-isolated Workspaces + `currentWorkspaceId` | all Workspaces | DENY (jobs are per Workspace) |
3. **Isolation rule:** a Workspace with `isolated = true` (or unknown flag: fail closed) is excluded from every set except where the caller's own current Workspace equals it, or the caller is the Owner viewing in that Workspace for `agent`/`workspace` scopes or the Owner's all-Workspaces Decision view (Owner `installation` includes isolated: the Owner owns everything).
4. **Branded values:** `AuthorisedScope = { readonly scope: MemoryScope; readonly workspaceIds: ReadonlySet<WorkspaceId>; readonly agentId?: AgentId; readonly conversationId?: ...; readonly [brand]: 'AuthorisedScope' }`, `AuthorisedWorkspaceSet = ReadonlySet<WorkspaceId> & { [brand]: 'AuthorisedWorkspaceSet' }`; constructors are module-private; the only exported way is `authorise()` (returns `Result`); `forTest` helpers are exported only from `packages/testing` and tagged so a lint rule forbids importing them from non-test code.
5. **authorise(caller, request, deps)** is async because it reads Workspace `isolated` flags from `WorkspaceRepository` fresh per call (cache TTL 5 s, invalidated on `workspace.changed` events) ; returns `mem.scope_denied` (audited) for forbidden combinations; `team` returns an empty set with `scope_not_supported` note only in `diagnostics`.
6. **Audit:** every authorised set wider than a single Workspace (`installation`, chief `workspace` on another Workspace, Owner reads of isolated Workspace data) writes `memory.scope_widened` (caller, scope, number of Workspaces, purpose; no content, no query text).
7. **Defence against confused deputy:** requests carry `purpose`; `purpose: 'agent_context'` is only allowed for `agent`/`system` callers and ONLY with scope `agent` or `workspace` of the current Workspace; Chief's prompts for other Agents never include memory of other Workspaces.
8. **Static guard:** a lint-style test scans `packages/adapters/**/src` and `packages/application/src` to assert that every exported function that reads memory, Decisions or Tasks across Workspaces takes `AuthorisedScope | AuthorisedWorkspaceSet` as a parameter (list maintained as a registry file `scoped-readers.json` that areas extend through their own entries; a test fails when a registered port method lacks the parameter).
9. **Docs:** `docs/architecture/memory-scope.md` with the matrix and examples (owned here).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`WorkspaceRepository` (DATA), `AuditLog`. This library is the only implementation of the matrix: DEC008, BOARD011-style queries and MEM008 must import it.

## 8. Architecture and code placement

Pure `packages/domain/src/memory/scope/{matrix.ts,decide.ts,types.ts}`; application `packages/application/src/memory/scope/{authorise.ts,workspace-flags.ts,branding.ts,scoped-readers.ts}`; docs file. Depends on ports only.

## 9. Security and safety

This task is the privacy enforcement point: nothing reads memory without an authorised value; unknown or missing isolation state fails closed; Agents can never widen scope; Chief cannot read other Workspaces' Agent Memory; Owner-only exceptions are explicit and audited; caller identity comes only from the authenticated session; the registry test prevents new readers from skipping the policy; TTL cache is short and invalidated by events so isolation toggles take effect promptly. Limitation: results already shown to a model cannot be recalled.

## 10. Errors and edge cases

- Agent without `currentWorkspaceId` (should not happen): deny.
- Workspace deleted between authorise and query: the query returns nothing for it.
- Owner in isolated Workspace Z requests `agent` memory of Agent X: Z's entries visible, other isolated Workspaces still withheld.
- Flag lookup failure: deny with `internal.unavailable` (fail closed).
- Telegram caller: reduced summary flag, same sets as the underlying principal.

## 11. Acceptance criteria

- [ ] Matrix test covers every (scope x caller kind x isolation state x current Workspace) combination with the expected allow/deny table committed as a snapshot.
- [ ] Branded values cannot be constructed outside `authorise` (type tests with `@ts-expect-error`).
- [ ] Unknown isolation flag excludes the Workspace.
- [ ] Widening reads are audited without content.
- [ ] The registry test fails when a reader port lacks the scoped parameter.
- [ ] Isolation toggled via event takes effect within the cache TTL or immediately on event.

## 12. Test plan

- `matrix.test.ts` (generated), `authorise.test.ts` with fake `WorkspaceRepository` and `FakeClock`, `branding.type-test.ts`, `scoped-readers.registry.test.ts`. Commands: `pnpm vitest run packages/domain/src/memory packages/application/src/memory/scope`.

## 13. Parallelization notes

Blocks DEC003/007/008/011 type usage and MEM003+: publish early (a first merge with the types and matrix unblocks the others). Hotspot: `scoped-readers.json` is append-only by proposal entries from other areas.

## 14. Open questions and assumptions

- ASSUMPTION: Chief never reads another Workspace's Agent Memory; Chief inside an isolated Workspace may read that Workspace's memory.
- ASSUMPTION: `team` scope is declared but empty in MVP.
