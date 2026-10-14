---
id: OVE_AGUI015
title: "Agents states and live updates: empty, loading, error, announcements and archived state"
area: AGUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI002, OVE_AGUI003, OVE_AGUI004, OVE_AGUI005, OVE_DS032, OVE_DS109]
soft_depends_on: []
provides: ["lib:agent-states-live"]
needs: ["ui:EmptyState", "ui:ErrorState", "ui:LiveRegion", "lib:use-agent-list", "lib:use-agent-detail", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/live/agents-live.region.tsx", "apps/desktop/src/features/agents/components/AgentStates.tsx", "apps/desktop/src/locales/en/agents-states.json", "apps/desktop/src/locales/pl/agents-states.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9"]
adr_refs: [5]
---

# OVE_AGUI015: Agents states and live updates: empty, loading, error, announcements and archived state

## 1. Summary

Cross-cutting states of the Agents view: engine unreachable, empty Workspace, no selection, archived Agent, Global Pause note and screen reader announcements for the events that change what the Owner sees.

## 2. Context

The list, profile and memory regions render their own loading and empty states; this task adds the shared pieces that none of them owns: the engine-offline banner, the selection-empty state, the archived read-only banner and the live announcer region (auto-discovered through `../live/*.region.tsx`).

## 3. Scope (in)

- `AgentStates` components (no selection, archived, offline).
- `agents-live.region.tsx`: announcer for `agent.created`, `agent.archived`, `agent.config_changed` (by other session), dynamic proposals.

## 4. Out of scope

- State machines of regions (their own tasks).

## 5. Detailed requirements

1. No selection: `EmptyState` `Wybierz Agenta z listy` with the `Nowy` shortcut button.
2. Offline/engine unreachable (from the shell connection state): a non-blocking banner `Brak połączenia z silnikiem` and all mutations disabled; the displayed data stays (read-only) with the word `nieaktualne`.
3. Archived Agent opened by URL: read-only profile with the banner and no save.
4. Global Pause: a muted line `Pauza: Agenci nie pracują, konfigurację nadal możesz edytować` (ADR: edits stay possible, work halts); states in the list show the paused word from the state view (`paused: true` -> `wstrzymany`).
5. Announcements (`aria-live=polite`): `Nowy Agent: {name}`, `Agent {name} został zarchiwizowany`, `Konfiguracja {name} zmieniona w wersji v{n}` (only for events not caused by this window's own save), `Chief proponuje zachować Agenta {name}`; batched (max one announcement per 2 s, burst summarised `+N zmian`).
6. Names inside announcements are plain text, truncated to 60 chars.
7. A dynamic proposal arriving while the Owner is editing a draft never steals focus.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:EmptyState`, `ui:ErrorState`, `ui:LiveRegion` (or the shell announcer).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `live/agents-live.region.tsx`, `components/AgentStates.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Event flood: batching.
- Own save echoed by an event: suppressed by comparing the saved version number.
- Locale change: announcements re-render in the new language.

## 11. Acceptance criteria

- [ ] Given an `agent.archived` event for a non-selected Agent, Then one polite announcement is made.
- [ ] Given the engine offline, Then mutations are disabled and the banner is shown.
- [ ] Given Global Pause, Then the muted line appears and edits remain possible.
- [ ] Given own save, Then no `zmieniona` announcement.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `AgentStates.test.tsx`, `agents-live.test.tsx` (batching, own-save suppression). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: a shared announcer helper may exist in SHELL; if so this task uses it instead of its own `LiveRegion`. Duplicated batching with BOARDUI013 and DECUI013 is a candidate for one shared helper (reported).
