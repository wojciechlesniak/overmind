---
id: OVE_AGUI011
title: "Agent Memory panel region: read-only entries with Workspace tags and isolation note"
area: AGUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI001, OVE_AGUI003, OVE_BOARDUI001, OVE_DS070, OVE_MEM012]
soft_depends_on: []
provides: ["lib:agent-memory-region"]
needs: ["ui:MemoryPanel", "api:memory.list", "client:memory", "lib:use-gateway-resource", "lib:agent-view-models", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/regions/memory.region.tsx", "apps/desktop/src/features/agents/state/use-agent-memory.ts", "apps/desktop/src/locales/en/agents-memory.json", "apps/desktop/src/locales/pl/agents-memory.json"]
reads: []
design: design.png
design_source: "Agenci#agents/memory-panel (crop 1130,162,310,520 CSS px) (crop 1130,162,310,520 CSS px)"
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 13"]
adr_refs: [14]
---

# OVE_AGUI011: Agent Memory panel region: read-only entries with Workspace tags and isolation note

## 1. Summary

The right column: a strictly read-only view of the selected Agent's Memory (`tylko podgląd`) with Workspace tags, the lock note for isolated Workspaces, and no way to edit, add or delete.

## 2. Context

ADR 0014: two memory layers; the Owner sees Agent Memory read-only and corrects behaviour with Owner Rules. Mock: `Pamięci nie edytujesz. Zachowanie Agenta korygujesz Regułami Właściciela.`, three entries with Workspace tags (`rezerwacje`, `fundacja`) and the note `Workspace „Projekt klienta (NDA)” jest izolowany, więc jego pamięci tu nie widać.` MEM012: `GET /agents/{id}/memory?workspaceId=&q=&cursor=` returns `MemoryEntryView[]` plus `withheld[]`; any PUT/PATCH/DELETE/POST returns 405 and is audited. Entries are LLM-written summaries, therefore untrusted text.

## 3. Scope (in)

- `use-agent-memory` resource (list with paging) and the region rendering `MemoryPanel`.
- Refetch on `memory.entry.added`.

## 4. Out of scope

- Memory editing (forbidden), Memory diagnostics (SETUI), full-text view of one entry (P1).

## 5. Detailed requirements

1. No mutation code: the module imports ONLY the list function of the memory client (a lint test asserts the file imports no `post|put|patch|delete` client function); the panel has no buttons or inputs (ui-kit asserts the same).
2. Request: `memory.list({ agentId, workspaceId: currentWorkspaceId })` first page 50; `Pokaż więcej` is not in the mock: the panel scrolls and loads the next page when the last entry enters the viewport (IntersectionObserver in the hook, falling back to a `Pokaż więcej` text button for tests/reduced environments).
3. Each entry shows title, Workspace tag (name only; `isolated` Workspaces show the lock tag) and text clamped to 5 lines with the full text in `title`; text is plain text, never Markdown/HTML.
4. `withheld[]` entries (isolated Workspaces whose memory is hidden in this context) render as the isolation note(s), one per Workspace; the note never reveals the number or titles of hidden entries.
5. Quarantined entries (flag from MEM007) render the title with `w kwarantannie` and no content (text from the mapper key).
6. Empty: `Ten Agent nie ma jeszcze pamięci.`; loading skeleton; error `Nie udało się wczytać pamięci` with retry.
7. The panel header shows `tylko podgląd` (Pill) and the note linking nowhere (no edit path) - a secondary text link `Reguły Właściciela` navigates to the Rules section via `routeLinks.ownerRules(workspaceId)`.
8. Visibility has no effect on this panel: memory is per Workspace even for a public Agent (ADR 0014); the Workspace tag therefore always appears.
9. A search box is NOT included in MVP (reported); `q` stays out of the UI.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:MemoryPanel` (OVE_DS070).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/memory.region.tsx`, `state/use-agent-memory.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Agent without a Workspace session: empty state, no error.
- Entry text with HTML or an RLO character: shown inert (sanitised by ui-kit).
- A memory entry for a Workspace that was deleted: tag `Usunięty Workspace`.
- Quarantine release by MEM changes the entry on refetch.

## 11. Acceptance criteria

- [ ] Given the three fixture entries and one withheld Workspace, Then the panel matches `design.png` within tolerance.
- [ ] Given any state, Then the DOM contains no button or input inside the panel.
- [ ] Given an entry text `<img src=x onerror=...>`, Then it is displayed as text.
- [ ] Given a new `memory.entry.added`, Then the list refetches.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `memory.region.test.tsx` (read-only DOM assertion, withheld, quarantined), a static test that no mutation function is imported. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: client name `client:memory` (MEM012) exposes `list`; the `api:memory.list` path is `/agents/{id}/memory` and is mounted under `/v1`.
- GAP: MEM012 has no search/filter in the Owner panel UI scope; a future P1 task may add `q`.
