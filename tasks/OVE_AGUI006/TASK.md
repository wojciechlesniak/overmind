---
id: OVE_AGUI006
title: "Agent profile header region: avatar, version line, Czat link and Zapisz jako vN"
area: AGUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI003, OVE_AGUI005, OVE_DS035, OVE_DS066, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:agent-header-region"]
needs: ["ui:AgentProfileHeader", "ui:Tabs", "lib:use-agent-detail", "lib:use-agent-draft", "lib:route-links", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/regions/profile.region.tsx", "apps/desktop/src/features/agents/components/AgentProfileFrame.tsx", "apps/desktop/src/locales/en/agents-header.json", "apps/desktop/src/locales/pl/agents-header.json"]
reads: []
design: design.png
design_source: "Agenci#agents/profile-header + agents/profile-tabs (crop 380,176,732,130 CSS px) (crop 380,176,732,130 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [23]
---

# OVE_AGUI006: Agent profile header region: avatar, version line, Czat link and Zapisz jako vN

## 1. Summary

The profile column frame: `AgentProfileHeader` (avatar 56, name, `Agent stały · konfiguracja v3 · utworzył Właściciel`, `Czat` link, `Zapisz jako v4` with its dirty/saving/saved/error states) and the profile tab strip `Konfiguracja | Pamięć agenta | Historia Runów | Wersje`.

## 2. Context

Mock regions `agents/profile-header` (390,184,712,56) and `agents/profile-tabs` (390,258,712,41). The save button follows the five states of DS066. `Czat` opens the direct chat with this Agent (ADR 0023). The tab content slots are filled by other tasks (config OVE_AGUI007, memory OVE_AGUI011, versions OVE_AGUI014).

## 3. Scope (in)

- `profile.region.tsx`: header, tabs and a `TabContent` slot keyed by tab id; empty state when nothing is selected.
- Chat link and save button wiring.

## 4. Out of scope

- Tab contents (other tasks).

## 5. Detailed requirements

1. Header from `agentToHeader`; `save.state` from `useAgentDraft.saveState`, `save.onClick = draft.save`; `stateLabel` = `Brak zmian` (clean title), `Zapisano` (saved), the short error message (error, `role=alert` in ui-kit).
2. `chat.href` = `routeLinks.agentChat(agentId)` (the chat feature owns the route); the link is an in-app route, never an external URL.
3. Tabs from `ui:Tabs variant=profile` driven by the URL `tab`; the `Historia Runów` tab is rendered disabled with `aria-disabled` and the title `Wkrótce` until the capability `api:runs.list-by-agent` exists (see Open questions); `Pamięć agenta` tab content is the memory panel on narrow widths, on wide widths the tab scrolls the memory column into view / focuses it.
4. Tab changes while dirty do not lose the draft (the draft lives in the provider, not per tab).
5. Save is also available with `Cmd+S` while focus is inside the profile (handled here, scoped to the region, `preventDefault`).
6. Read-only mode (archived Agent or dynamic Agent): save button absent, banner key `agents:readonly`.
7. For a dynamic Agent in state `proposed_for_keep` the subtitle reads `Agent dynamiczny · czeka na akceptację · utworzył Chief`.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:AgentProfileHeader`, `ui:Tabs`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/profile.region.tsx` (registers the profile column), `components/AgentProfileFrame.tsx`, locale files.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Name 60 chars: ellipsis in the header (ui-kit).
- Save pressed with validation errors: stays `dirty` and focus moves to the first invalid control.
- Chat route unavailable (chat feature disabled): the link is hidden, not broken.

## 11. Acceptance criteria

- [ ] Given the Developer fixture, Then header and tabs match `design.png` within tolerance.
- [ ] Given an edit, Then the button becomes `Zapisz jako v4` enabled; with no edit it is disabled with title `Brak zmian`.
- [ ] Given Cmd+S in the instructions field, Then the save runs once.
- [ ] Given `Historia Runów`, Then it is disabled with an accessible reason.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `AgentProfileFrame.test.tsx` (states, shortcut, tabs, read-only). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to RUNUI/WFRT): there is no api to list Runs of an Agent (`GET /v1/runs?agentId=`); the `Historia Runów` tab stays disabled until `api:runs.list-by-agent` exists.
- ASSUMPTION: `Cmd+S` is acceptable because it saves a new Agent version, which is the Owner's explicit action.
