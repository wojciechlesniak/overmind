---
id: OVE_WFED023
title: "Build the Agent directory for the editor (info per node, caching, live updates)"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_AGENT005, OVE_AGENT016, OVE_ENGINE027, OVE_SHELL011, OVE_VIS001, OVE_WFED014, OVE_WFED019]
soft_depends_on: []
provides: ["lib:editor-agent-directory"]
needs: ["lib:editor-node-descriptor", "lib:editor-agent-info", "lib:editor-session", "lib:api-client-agents", "lib:api-client-events", "api:agents.list", "api:agents.get", "contract:AgentSummary", "contract:Agent", "contract:Visibility", "lib:active-workspace"]
owns: ["apps/desktop/src/features/workflow-editor/agents/directory.ts", "apps/desktop/src/features/workflow-editor/agents/react/useAgentDirectory.ts", "apps/desktop/src/features/workflow-editor/agents/react/useAgentInfo.ts", "apps/desktop/src/features/workflow-editor/gateway/agents.ts", "apps/desktop/src/features/workflow-editor/agents/*.test.ts", "apps/desktop/src/features/workflow-editor/agents/react/*.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED023: Build the Agent directory for the editor (info per node, caching, live updates)

## 1. Summary

Supplies `AgentInfo` for the Agents referenced by the document: name, visibility, model, Skill ids, version, archived flag. It lists the Agents visible in the current Workspace, fetches details on demand through a small bounded pool, caches by version and refreshes on Agent events.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. Tiles show visibility, Skills count and model for the Agent bound to the node (WFED014). ADR 0028: a private Agent of another Workspace is not visible here, so a node pointing to it must show "Agent niedostępny". `AgentSummary = { id, name, role, visibility, lifecycle, ownerWorkspaceId?, providerId, modelId, currentVersion, state? }` (AGENT001); Skill ids live in the full `Agent.config.skills` (`GET /v1/agents/{id}`). Live events: `agent.created`, `agent.config_changed`, `agent.archived`, `agent.state.changed` (AGENT005). The Workspace id comes from the app shell.

## 3. Scope (in)

- Framework-free `AgentDirectory` (cache, loader, subscribe).
- `gateway/agents.ts` adapter over `lib:api-client-agents` and the events subscription.
- Hooks `useAgentDirectory`, `useAgentInfo(id)`.
- Model label formatting.

## 4. Out of scope

- Agent state chips and the Chief strip (PART 2 uses `api:agents.states` itself).
- Skill assignment writes (WFED043).
- Agent picker UI (PART 2 uses `list()`).

## 5. Detailed requirements

1. ```ts
interface AgentDirectory {
  lookup(id: string, o?: { withoutLocalPatches?: boolean }): AgentLookup | "loading" | undefined;      // sync, for describeNode; the option returns server data without the optimistic overlay (WFED043)
  list(): readonly AgentInfo[];                                  // visible Agents of the Workspace (for pickers)
  ensure(ids: readonly string[]): Promise<void>;                  // fetch missing details, pool of 4
  subscribe(l: () => void): () => void;
  refresh(id?: string): Promise<void>; dispose(): void;
  applyLocalPatch(id: string, patch: { addSkillId?: string; removeSkillId?: string }): () => void;   // optimistic overlay (WFED043), returns the revert function
}
createAgentDirectory(deps: { gateway: AgentsGateway; events: EventsClient; workspaceId: string }): AgentDirectory
```
2. Loading: on creation fetch `GET /agents?workspaceId=` pages (limit 200) into summaries (cheap, one call); `ensure(ids)` fetches `GET /agents/{id}` for referenced ids that are missing or whose `currentVersion` differs from the summary, with a concurrency pool of 4 and request de-duplication; results cached by `(id, version)`. A document change that references new Agent ids triggers `ensure` through `session.subscribeDocument` (debounced 100 ms, diffing referenced ids).
3. `lookup` states: `"loading"` while the id is being fetched, `{found:false}` when the id is absent from the visible list after the list loaded (deleted, or private in another Workspace: the directory cannot and MUST NOT distinguish the two reasons, avoiding leaking the existence of other Workspaces' private Agents), else `AgentInfo`. `archived` true when `lifecycle === "archived"`.
4. Model label: `modelLabel` from the Agent summary (`modelId` human name when the connection catalogue provides it, else `modelId` raw); never fetch the connections catalogue here (YAGNI).
5. Live updates: subscribe through `lib:api-client-events` to the four Agent events (ids only); `agent.config_changed` and `agent.created` invalidate that id (refetch lazily if referenced), `agent.archived` marks archived, `agent.state.changed` is ignored here (PART 2 strip). Reconnection: on reconnect `refresh()` everything once. Backoff owned by the events client.
6. `applyLocalPatch`: keeps an in-memory overlay of pending Skill changes on top of the cached `AgentInfo` (`skillIds` plus or minus the id) so the tile Skills count changes before the server answers; the overlay is dropped by the returned revert function, by a successful `refresh(id)` (server data wins) and after a safety timeout of 15 s; it never touches other fields and is never persisted.
7. Hooks: `useAgentInfo(id)` subscribes to one id (no re-render for other Agents); `useAgentDirectory()` returns `{ status, list, byId }`. Both memoise by version.
8. Errors: list failure -> `status: "error"` with retry; tiles then show attention `AGENT NIEDOSTĘPNY`? NO: while status is error or loading the descriptor receives `"loading"`/`undefined` and shows a neutral status line (`statusKey: "agentsUnavailable"`) so a transient failure never looks like data loss; a single failed detail fetch retries with backoff 2 s, 5 s, 15 s then stays `undefined`.
9. Limits: at most 200 summaries (pagination guard 5 pages), at most 100 detail fetches per document load (more Agents than that in one Workflow: the rest are `loading`-then-`undefined`, warn once).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `AgentInfo`, `avatarFor` (WFED014), `lib:api-client-agents` (typed functions from AGENT005), `lib:api-client-events`, contract types; `lib:active-workspace` for the workspace id (SHELL).

## 8. Architecture and code placement

Layer: framework-free `agents/directory.ts`; adapter `gateway/agents.ts`; React in `agents/react/`. DIP: the directory depends on `AgentsGateway` (interface in the same file) not on the client.

## 9. Security and safety

Visibility is decided by the server per Workspace (ADR 0028, VIS); the directory shows only what the list returns and never probes ids of other Workspaces. Agent names and roles are untrusted text. Instructions of Agents are NOT requested here (the detail response includes `instructions` per AGENT005; the adapter drops that field immediately so prompts never enter editor memory or logs). No secrets involved.

## 10. Errors and edge cases

- Agent renamed while the editor is open: event -> refresh -> tiles update.
- Agent deleted/archived: tile shows the archived attention or the missing tab.
- Workspace switched: the directory is recreated (new workspaceId).
- Events connection down: data stays, refresh on reconnect.
- 200+ Agents: first 200 listed, a warning (`list_truncated`) in the hook result.

## 11. Acceptance criteria

- [ ] Given a document with 5 distinct Agents, Then at most 5 detail requests and at most 4 at once.
- [ ] Given an `agent.config_changed` event for a referenced Agent, Then its tile data updates without a full reload.
- [ ] Given an Agent id not in the visible list, Then `{found:false}` and no extra request for it.
- [ ] Given `instructions` in a detail response, Then they are not present in the cache (test).
- [ ] Given 100 re-renders of a tile of Agent A while B changes, Then no re-render (hook granularity test).

## 12. Test plan

Unit tests with a fake `AgentsGateway` and fake events; hook render-count tests. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/agents`.

## 13. Parallelization notes

Parallel with WFED021/WFED022/WFED024 (needs only `AgentInfo`).

## 14. Open questions and assumptions

- GAP: a bulk detail endpoint (`GET /agents?ids=...` returning skill ids) would avoid N requests; default is the pool of 4; propose to AGENT005.
- ASSUMPTION: `AgentSummary` has no skill ids; if AGENT adds `skillCount` to the summary, `ensure` becomes unnecessary for tiles.
