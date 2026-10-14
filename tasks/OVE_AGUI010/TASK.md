---
id: OVE_AGUI010
title: "Tools table region: effective tools of the Agent (intersection with the Workspace policy)"
area: AGUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI003, OVE_AGUI005, OVE_AGUI007, OVE_DS040, OVE_DS070, OVE_PERM026, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:agent-tools-region"]
needs: ["ui:ToolsTable", "ui:InfoNote", "api:perm.effective", "lib:api-client-perm", "lib:use-agent-detail", "lib:route-links", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/regions/tools.region.tsx", "apps/desktop/src/features/agents/components/AgentToolsTable.tsx", "apps/desktop/src/locales/en/agents-tools.json", "apps/desktop/src/locales/pl/agents-tools.json"]
reads: []
design: design.png
design_source: "Agenci#agents/tools-table (crop 390,746,712,154 CSS px; the table overflows the 900 px mock viewport, bottom rows clipped) (crop 390,746,712,154 CSS px)"
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 14"]
adr_refs: [3, 21]
---

# OVE_AGUI010: Tools table region: effective tools of the Agent (intersection with the Workspace policy)

## 1. Summary

Renders `NARZĘDZIA AGENTA · PRZECINANE Z POLITYKĄ WORKSPACE'U`: a read-only table of what the Agent can actually do (the result of the policy intersection), with `brak · Prośba o dostęp` and `wymaga Zgody` states and a link to the Workspace permissions.

## 2. Context

ADR 0003: effective access is the intersection of Owner, Workspace, Agent, Workflow and Tool policies; deny by default; `AgentConfig.tools` is metadata and never grants anything. The engine supplies the intersection (`GET /v1/permissions/effective?workspaceId=&agentId=`); this view never computes it. The mock shows Terminal w kontenerze `tak`, Zapis plików `src/, tests/`, Sieć `brak · Prośba o dostęp`, git commit `tak, we własnym worktree`, git push `wymaga Zgody`; ADR 0021 default Approval list explains `wymaga Zgody`.

## 3. Scope (in)

- Connected component mapping effective permissions to `ToolsTable`.
- Footnote link to the Workspace permissions settings.

## 4. Out of scope

- Editing permissions (WSPACE/SETUI Workspace permissions), Approvals (APPRUI).

## 5. Detailed requirements

1. Rows come from `toolsToRows(effective)` (OVE_AGUI001); the table is read-only: no toggle, no `Zezwól` button (the ToolsTable has no mutation callbacks).
2. `Prośba o dostęp` text is informational: the Agent files the request during a Run, the Owner answers in Zgody. The row never offers to grant.
3. Footnote `Wynik przecięcia polityk. Zmiany robisz w Uprawnieniach Workspace'u.` with the link to the Workspace settings permissions section (`routeLinks.workspacePermissions(workspaceId)`).
4. Loading shows skeleton rows; error shows `Nie udało się wczytać uprawnień` with retry and NEVER falls back to showing tools as allowed.
5. When the Agent is paused or Global Pause is on, the table is unchanged (permissions do not depend on pause); a muted line `Pauza wstrzymuje pracę, nie zmienia uprawnień` appears only while paused (key `agents:tools.pauseNote`).
6. Refetches on `policy.changed`, `override.changed` and `agent.config_changed` events.
7. Directory lists show display paths (Workspace-relative or `~`-relative as the engine returns them); absolute host paths outside the Workspace are not rendered.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:ToolsTable` (OVE_DS070), `ui:InfoNote`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/tools.region.tsx` (renders into the slot `config-tools` of OVE_AGUI007), `components/AgentToolsTable.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Effective permissions all denied: table hidden, `EmptyState` `Brak narzędzi (zablokowane polityką)` (ui-kit).
- Unknown capability keys from a newer engine are ignored (not shown as allowed).
- Agent from a deleted Workspace: not reachable (route guard).

## 11. Acceptance criteria

- [ ] Given the Developer fixture, Then rows and glyphs match `design.png` within tolerance.
- [ ] Given `git push` in the Approval list, Then the row says `wymaga Zgody` with the amber `◆` glyph and the word.
- [ ] Given a failed request, Then no row shows `tak`.
- [ ] Given `policy.changed`, Then the table refetches.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `AgentToolsTable.test.tsx` (states, fail closed, events). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to PERM): an Agent-level preview of `perm.effective.preview` per Agent exists (`?agentId=`) but its `explain` payload shape is not fixed; this task shows values only (no explain) in MVP.
