---
id: OVE_AGUI004
title: "Agent list region: Nowy, permanent rows and dynamic Agent cards"
area: AGUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI001, OVE_AGUI002, OVE_AGUI003, OVE_DS032, OVE_DS066]
soft_depends_on: []
provides: ["lib:agent-list-region"]
needs: ["ui:AgentList", "ui:AgentRow", "ui:DynamicAgentCard", "ui:EmptyState", "lib:use-agent-list", "lib:agent-view-models", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/regions/list.region.tsx", "apps/desktop/src/features/agents/components/AgentListPanel.tsx", "apps/desktop/src/locales/en/agents-list.json", "apps/desktop/src/locales/pl/agents-list.json"]
reads: []
design: design.png
design_source: "Agenci#agents/list (crop 72,162,290,738 CSS px) (crop 72,162,290,738 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [28]
---

# OVE_AGUI004: Agent list region: Nowy, permanent rows and dynamic Agent cards

## 1. Summary

Renders the left Agents column with `ui:AgentList`: title `Agenci`, `Nowy`, `STALI · 7` rows with visibility word, model and state word, and the dashed `DYNAMICZNI · CZEKAJĄ NA AKCEPTACJĘ` cards with `Zachowaj jako stałego` and `Usuń`.

## 2. Context

Mock regions `agents/list`, `agents/list-row-selected` (PUBLICZNY outlined, `Claude · Opus 5.5`, `skończył`), `agents/list-row-private` (PRYWATNY, amber `Zgoda`), `agents/dynamic-agent-card` (dashed magenta). `design-dynamic.png` is clipped by the 900 px mock viewport (the card overflows). The component logic is in the ui-kit (OVE_DS066); this task only maps and wires.

## 3. Scope (in)

- Region file that renders `AgentList` from the list hook and mappers.
- Loading, empty, error states.
- Wiring of `Nowy` to `openCreate`, row select to `select(id)`, `Zachowaj jako stałego` to `openAccept(id)`, `Usuń` to `openDecline(id)`.

## 4. Out of scope

- Create dialog (OVE_AGUI013), accept/decline dialogs (OVE_AGUI012).

## 5. Detailed requirements

1. Props come only from the mappers (OVE_AGUI001): no styling, no copy in this file; labels via `useT('agents-list')`.
2. `selectedId` from the provider; `onSelect` goes through the unsaved-changes guard of OVE_AGUI003.
3. `busy` on a dynamic card while its accept/decline mutation is running; both buttons disabled.
4. Visibility word, model and state word are always present on a permanent row (DS066 contract); tests assert the word, not the colour.
5. Loading shows `loading` of `AgentList` (skeleton rows); empty shows `Brak Agentów. Utwórz pierwszego przyciskiem Nowy.` with the `Nowy` button still visible.
6. Error: `EmptyState` with `Spróbuj ponownie` calling `reload`; the message uses `renderMessage` for `agent.*` or `gateway.*` codes.
7. `aria-live=polite` region announces `Developer: pracuje` style changes only for the selected Agent (not the whole list, to avoid noise).
8. Agent names and reasons are untrusted text rendered by ui-kit as text nodes; this file never builds HTML or links from them.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

All visuals from OVE_DS066 (`AgentList`, `AgentRow`, `DynamicAgentCard`).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/list.region.tsx`, `components/AgentListPanel.tsx` (connected component), locale files.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- 20+ Agents: list scrolls inside the panel.
- Agent name 60 chars: ellipsis with title (ui-kit).
- Dynamic card with unknown Task: reason sentence without Task label.
- Rapid double click on `Zachowaj jako stałego`: second ignored via `busy`.

## 11. Acceptance criteria

- [ ] Given the Developer/Codex/Security/PO/Designer/SR/Researcher fixture, Then the region matches `design.png` within tolerance.
- [ ] Given Security (private, waiting approval), Then the word `PRYWATNY` and `Zgoda` are present.
- [ ] Given a dynamic proposal, Then both buttons are present and `Usuń` opens the decline flow, not a delete.
- [ ] Given the unsaved guard is active, Then a row click asks first.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `AgentListPanel.test.tsx` (grouping, words, busy, empty, error), story-based visual test vs `design.png`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to DS066): the mock dynamic card shows the outline word `PRYWATNY` next to the name but `DynamicAgentCardProps` has no visibility prop; the word must be added (dynamic Agents are always private) or the card would break ADR 0028.
- ASSUMPTION: the dynamic card is not selectable; its configuration can be inspected in a P1 follow-up.
