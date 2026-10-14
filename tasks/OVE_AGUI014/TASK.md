---
id: OVE_AGUI014
title: "Versions tab: configuration history, read-only version view and restore as a new version"
area: AGUI
kind: ui
size: M
priority: P1
mvp: false
status: todo
depends_on: [OVE_AGENT005, OVE_AGUI003, OVE_AGUI005, OVE_AGUI006, OVE_BOARDUI001, OVE_DS036, OVE_DS051]
soft_depends_on: []
provides: ["lib:agent-versions-tab"]
needs: ["api:agents.versions", "api:agents.update", "lib:api-client-agents", "ui:KeyValueList", "ui:ConfirmDialog", "lib:use-gateway-resource", "lib:use-agent-detail", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/regions/versions.region.tsx", "apps/desktop/src/features/agents/components/VersionsTab.tsx", "apps/desktop/src/features/agents/state/use-agent-versions.ts", "apps/desktop/src/locales/en/agents-versions.json", "apps/desktop/src/locales/pl/agents-versions.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9"]
adr_refs: [2, 7]
---

# OVE_AGUI014: Versions tab: configuration history, read-only version view and restore as a new version

## 1. Summary

The `Wersje` tab: list of immutable configuration versions (who, when, changed fields, `changeNote`), a read-only view of one version, and `Przywróć jako nową wersję` that re-applies an old configuration as a NEW version (history is never rewritten).

## 2. Context

`GET /v1/agents/{id}/versions` returns `AgentVersionRecord[]` (`version`, `config`, `createdAt`, `createdBy`, `changeNote?`, `configHash`). Runs pin an Agent version (ADR 0002/0007), which is why versions are immutable. The tab is not drawn in the mock; it is designed from the design-system rules (list rows + KeyValue facts).

## 3. Scope (in)

- Versions list and detail view.
- Restore action via `PATCH` with the old values.

## 4. Out of scope

- Diff between versions (P2), Run history (blocked, see OVE_AGUI006).

## 5. Detailed requirements

1. List newest first: `v3 · 2026-10-02 · Właściciel · instrukcje, Skille` (changed fields derived by comparing consecutive versions client-side, never from model text); the current version carries the word `aktualna`.
2. Detail: read-only `KeyValueList` with instructions excerpt (plain text, 600 chars + `pokaż całość` expands in place), model, fallback, budget, Skills (names and versions), visibility word and profile name; `configHash` first 8 chars in mono.
3. `Przywróć jako nową wersję` (not on the current version): confirm dialog `Zapisać konfigurację v2 jako nową wersję v4?`; sends `PATCH` with the allowed patch keys (OVE_AGUI005 allow-list) so visibility, profile and tools are NOT restored (they have their own flows); the dialog states which fields will be restored.
4. A version whose Skills are no longer visible or archived shows a warning and the engine decides on restore (`agent.skill_not_visible`).
5. Active Runs keep their pinned version: note `Uruchomione Runy zostają przy swojej wersji`.
6. Pagination: first 50 versions, `Pokaż starsze`.
7. Refetch on `agent.config_changed`.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:KeyValueList`, `ui:ConfirmDialog`; draft/save from OVE_AGUI005 for the restore PATCH.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/versions.region.tsx`, `components/VersionsTab.tsx`, `state/use-agent-versions.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Version 1 only: list of one, no restore.
- Restore produces a config equal to current: `unchanged`, info toast.
- Very long instructions: excerpt only.

## 11. Acceptance criteria

- [ ] Given three versions, Then the list shows them newest first with changed fields.
- [ ] Given restore of v2, Then one PATCH with the allowed keys is sent and a new version appears.
- [ ] Given the current version, Then no restore button.
- [ ] Given a restore conflict, Then the reload prompt appears.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `VersionsTab.test.tsx`, `use-agent-versions.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: P1; the MVP profile shows the version number in the header only.
