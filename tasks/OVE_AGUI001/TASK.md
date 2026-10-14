---
id: OVE_AGUI001
title: "Agent view-model mappers and the agents i18n namespace"
area: AGUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_AGENT010, OVE_AGENT016, OVE_ARCH011, OVE_BOARDUI002, OVE_DS040, OVE_MEM001, OVE_PERM005, OVE_SKILL001]
soft_depends_on: []
provides: ["lib:agent-view-models"]
needs: ["contract:Agent", "contract:AgentConfig", "contract:AgentSummary", "contract:AgentState", "contract:AgentStateView", "contract:EffectivePermissions", "contract:MemoryEntryView", "contract:Skill", "ui:UiDomainTypes", "ui:stateMaps", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/agents/model/**", "apps/desktop/src/locales/en/agents.json", "apps/desktop/src/locales/pl/agents.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9"]
adr_refs: [7, 14, 28]
---

# OVE_AGUI001: Agent view-model mappers and the agents i18n namespace

## 1. Summary

Pure mappers between the Agent contracts and the ui-kit props (`AgentRow`, `DynamicAgentCard`, `AgentProfileHeader`, `AgentConfigForm`, `ToolsTable`, `MemoryPanel`), the form draft type with dirty detection, and the shared EN/PL strings of the `agents` namespace.

## 2. Context

Contracts (OVE_AGENT001): `AgentSummary {id,name,role,visibility,lifecycle,ownerWorkspaceId?,providerId,modelId,currentVersion,state?}`, `Agent = identity + AgentConfig`, `AgentState = working|waiting_approval|needs_login|idle|finished_unread`. The mock (Agenci.dc.html) fixes the Polish copy: `STALI · 7`, `DYNAMICZNI · CZEKAJĄ NA AKCEPTACJĘ`, `PUBLICZNY`/`PRYWATNY`, state words `skończył`, `pracuje`, `wolny`, `czeka`, `Zgoda`, `Agent stały · konfiguracja v3 · utworzył Właściciel`, `Zapisz jako v4`. ADR 0028: visibility is always shown as a word (`PUBLICZNY`/`PRYWATNY`), never only by colour. Memory stays per Workspace whatever the visibility (ADR 0014).

## 3. Scope (in)

- `agentSummaryToRow(summary, state, t)`, `dynamicToCard(agent, handlers, t)`, `agentToHeader(agent, t)`, `agentToDraft(agent)` / `draftToPatch(base, draft)`, `isDirty(base, draft)`, `toolsToRows(effective, t)`, `memoryToPanel(view, t)`, `modelOptionKey()`.
- The `agents` namespace (EN source, PL from the mock): list, header, form labels, state words, errors for `agent.*` codes.

## 4. Out of scope

- Fetching (OVE_AGUI002, 005, 011), rendering (later tasks).

## 5. Detailed requirements

1. Row: `AgentRowProps` from the summary: `name`, `initials` (first two letters of the words of the name, uppercase), `hue = hueForAgentId(id)` (OVE_DS040), `visibility`, `visibilityLabel` = word key `agents:visibility.public|private`, `model` = `${providerLabel} · ${modelLabel}` (provider display name from the Connections list; unknown provider shows the raw id), `state` and `stateLabel` through the DS040 `agentStateTone`/label maps: `working` `pracuje`, `idle` `wolny`, `finished_unread` `skończył`, `waiting_approval` amber `Zgoda`, `needs_login` amber `zaloguj CLI`. A missing state (`state` undefined, no presence yet) maps to `idle`/`wolny` with `title` `brak sesji`.
2. Section labels: `STALI · {n}` counts persistent Agents; `DYNAMICZNI · CZEKAJĄ NA AKCEPTACJĘ` counts `lifecycle==='dynamic' && dynamicStatus==='proposed_for_keep'` (see OVE_AGUI012). Counts are words plus number (`STALI · 7`).
3. Dynamic card reason text (`Chief stworzył go do Zadania T-22, prywatnie w tym Workspace. Po akceptacji wybierzesz, czy ma być publiczny.`) is composed by the client from the template key `agents:dynamic.reason` with `{taskLabel}` (`T-22`) taken from `createdBy.taskId` display seq; it is NEVER taken from model text. If the Task label is unknown the sentence omits the Task.
4. Header subtitle: `Agent stały · konfiguracja v3 · utworzył Właściciel` from `lifecycle`, `currentVersion`, `createdBy.kind` (`owner` -> `Właściciel`, `chief` -> `Chief`); Save label `Zapisz jako v{currentVersion+1}`.
5. Draft: `AgentConfigValue { visibility, instructions, model, fallbackModel?, budget:{minutes,retries}, skills }` (DS068). Mapping: `minutes = timeoutSeconds / 60` (rounded up), `retries = retryPolicy.maxRetries`, `model = providerId + '::' + modelId`; `budget.maxMinutesPerTask` and `budget.maxIterations` are NOT editable here and are carried over unchanged. `draftToPatch` returns ONLY the changed keys of `AgentConfig` (never `visibility` or `ownerWorkspaceId`: they change through their own route, OVE_AGUI008), so a save cannot widen visibility.
6. `isDirty` compares the normalised draft with the base (instructions compared after trim of trailing whitespace only; skills as sets of `skillId+pinnedVersion`).
7. Tools rows: only mapping of data the engine returned (`EffectivePermissions`): `Terminal w kontenerze` `tak`/`brak`, `Zapis plików` the directory list with write right (display paths, `src/, tests/`), `Sieć` `tak`/`brak · Prośba o dostęp`, `git commit` `tak, we własnym worktree`, `git push` `wymaga Zgody` (when the action class is in the effective Approval list). Status `allowed|denied|needs-approval|request`. The mapper never invents access: an absent field maps to `denied`.
8. Memory: `MemoryEntryView` -> `{id,title,workspace: workspaceTag.name,text}`; `withheld[]` -> one `isolatedNote` per isolated Workspace (`Workspace „{name}” jest izolowany, więc jego pamięci tu nie widać.`); quarantined entries are shown with the word `w kwarantannie` appended to the title and their text replaced by the key `agents:memory.quarantined` (the Owner never reads unreleased content here).
9. Unknown enum values map to a neutral chip with the raw word; no mapper throws.
10. Namespace keys complete in EN and PL for everything above plus `errors.*` for `agent.not_found|name_taken|version_conflict|invalid_config|visibility_in_use|private_requires_workspace|archived|skill_not_visible|profile_not_found|lifecycle_transition_invalid|not_dynamic|scope_violation`.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

DS040 maps and `hueForAgentId`, `plainText` (OVE_BOARDUI002), formatting helpers (OVE_ARCH011).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `model/{labels.ts,agent-row.ts,agent-header.ts,agent-draft.ts,tools.ts,memory.ts,models.ts,index.ts}`; locale files owned here.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Agent name with 1 word: initials are 1 letter; empty name shows `—`.
- Provider not connected (CLI logged out): the model label gets the word `niedostępny`.
- Two draft skills with the same id: de-duplicated.
- Pinned Skill version missing from the library: chip text `{name} v?`.
- `timeoutSeconds` not a multiple of 60: rounded up and the exact value kept in the title.

## 11. Acceptance criteria

- [ ] Given every `AgentState`, Then tone and PL word match the table (exhaustive type-level test).
- [ ] Given the Developer fixture, Then `agentToHeader` yields `Agent stały · konfiguracja v3 · utworzył Właściciel` and `Zapisz jako v4`.
- [ ] Given a draft that only changes instructions, Then `draftToPatch` contains only `instructions`.
- [ ] Given a draft whose visibility was changed in the form state, Then `draftToPatch` does not contain `visibility`.
- [ ] Given an absent capability in effective permissions, Then the tools row is `denied`.
- [ ] `pnpm i18n:check` passes.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): table tests `agent-row.test.ts`, `agent-draft.test.ts`, `tools.test.ts`, `memory.test.ts`; fixtures typed against contracts. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Locale files owned here only; later tasks use `agents-<topic>.json`.

## 14. Open questions and assumptions

- ASSUMPTION: the editable budget minutes map to `timeoutSeconds` (mock: 45 min = 2700 s); `maxMinutesPerTask` stays API-only. Reported to AGENT.
- GAP (reported to PERM): the exact `EffectivePermissions` field names for terminal, network, git and directories are not fixed in a contract summary; this task codes against `contract:EffectivePermissions` and isolates the reading in `tools.ts`.
- GAP: the DS `AgentList` has two sections only; `lifecycle=dynamic, dynamicStatus=active` Agents (working on their Task) are not listed in MVP.
