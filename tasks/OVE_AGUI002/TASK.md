---
id: OVE_AGUI002
title: "Agent list data hook: Agents of the Workspace, live states and grouping"
area: AGUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGENT010, OVE_AGUI001, OVE_BOARDUI001, OVE_PROV002, OVE_PROV021, OVE_SHELL011, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:use-agent-list"]
needs: ["api:agents.list", "api:agents.states", "api:connections.list", "lib:api-client-agents", "lib:api-client-connections", "lib:use-gateway-resource", "lib:use-current-workspace-id", "lib:route-links"]
owns: ["apps/desktop/src/features/agents/state/use-agent-list.ts", "apps/desktop/src/features/agents/state/use-selected-agent.ts", "apps/desktop/src/features/agents/state/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9"]
adr_refs: [28]
---

# OVE_AGUI002: Agent list data hook: Agents of the Workspace, live states and grouping

## 1. Summary

Hooks that load the Agents visible in the current Workspace (public ones plus this Workspace's private ones), merge live Agent states, group them into permanent and dynamic and keep the selected Agent and the profile tab in the URL.

## 2. Context

`GET /v1/agents?workspaceId=` (workspaceId REQUIRED) returns `AgentSummary` rows (instructions are not in list rows). `GET /v1/agents/states?workspaceId=` returns `AgentStateView[]`; the live event `agent.state.changed` (ephemeral) updates it. VIS guarantees that private Agents of other Workspaces never come back. ADR 0028: visibility is always shown as a word (`PUBLICZNY`/`PRYWATNY`), never only by colour. Memory stays per Workspace whatever the visibility (ADR 0014).

## 3. Scope (in)

- `useAgentList()` returning `{ permanent, dynamic, status, reload }`.
- `useSelectedAgent()` URL state `?id=&tab=`.

## 4. Out of scope

- Rendering (OVE_AGUI004), the profile (OVE_AGUI005).

## 5. Detailed requirements

1. `useAgentList()` uses `useGatewayResource(['agents', workspaceId], ...)` and a second resource for states; rows are joined by `agentId`. Subscribes with `AGENT_EVENT_TYPES` (`agent.created`, `agent.config_changed`, `agent.archived`, `agent.state.changed`); state events patch the state resource locally, the others invalidate the list.
2. Grouping: `permanent = lifecycle==='persistent'` sorted by name (locale compare); `dynamic = lifecycle==='dynamic' && dynamicStatus==='proposed_for_keep'` sorted by creation time; archived Agents are not returned by the list.
3. `status` values `loading|ready|error|refreshing|empty` (`empty` when no persistent Agent exists).
4. Provider display names come from `connections.list` (cached 60 s); a failure of that call degrades to raw ids, it never blocks the list.
5. `useSelectedAgent()`: `id` and `tab` in the URL (`tab` in `config|memory|runs|versions`, default `config`); an unknown id (not in the list after load) clears the selection and shows the empty detail state; selection is `replace` navigation; on first load without `id` the first permanent Agent is selected on widths >= 1280.
6. Switching Workspace (`use-current-workspace-id` changes) resets selection and cached rows; the previous Workspace's private Agents never flash.
7. The hook never sends `workspaceId` from the URL or any user-editable field: only the current Workspace id.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource` (OVE_BOARDUI001), api-client agents and connections.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-agent-list.ts`, `state/use-selected-agent.ts`, `state/index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- State event for an Agent not in the list: ignored (list refetch follows).
- Agent archived while selected: selection cleared, toast key `agents:toast.archived`.
- States endpoint fails: rows show `wolny` with a muted `stan nieznany` title, list still works.
- Workspace without Agents but with public ones: not empty.

## 11. Acceptance criteria

- [ ] Given a state event `working` for Developer, Then its row word becomes `pracuje` without refetching the list.
- [ ] Given a dynamic Agent `proposed_for_keep`, Then it is in `dynamic` and not in `permanent`.
- [ ] Given a private Agent of another Workspace in a fixture, Then it is absent (engine filter; the hook adds no client-side widening).
- [ ] Given a Workspace switch, Then selection resets.
- [ ] Given `?tab=bogus`, Then `config` is used.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-agent-list.test.tsx` (grouping, events, switch), `use-selected-agent.test.tsx` (URL). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: first-row auto-select only at widths >= 1280, as in Decisions.
