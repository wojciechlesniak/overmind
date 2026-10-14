---
id: OVE_AGUI007
title: "Configuration tab: instructions, models and budget"
area: AGUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI001, OVE_AGUI003, OVE_AGUI005, OVE_AGUI006, OVE_DS026, OVE_DS030, OVE_DS068, OVE_PROV002]
soft_depends_on: []
provides: ["lib:agent-config-region"]
needs: ["ui:AgentConfigForm", "ui:Textarea", "ui:ModelPicker", "ui:BudgetField", "api:connections.list", "lib:use-agent-draft", "lib:agent-view-models", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/regions/config.region.tsx", "apps/desktop/src/features/agents/components/ConfigTab.tsx", "apps/desktop/src/features/agents/state/use-model-options.ts", "apps/desktop/src/features/agents/state/config-extensions.tsx", "apps/desktop/src/locales/en/agents-config.json", "apps/desktop/src/locales/pl/agents-config.json"]
reads: []
design: design.png
design_source: "Agenci#agents/instructions + agents/model-row (crop 390,433,712,206 CSS px) (crop 390,433,712,206 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [7]
---

# OVE_AGUI007: Configuration tab: instructions, models and budget

## 1. Summary

Wires `ui:AgentConfigForm` for the Configuration tab: role and instructions textarea, primary and fallback model pickers grouped by CLI with logged-out options disabled, and the budget per Task (`45 min · 2 ponowienia`).

## 2. Context

Mock regions `agents/instructions` (390,433,712,127) and `agents/model-row` (390,578,712,61). The form itself is OVE_DS068; visibility (OVE_AGUI008), Skills (OVE_AGUI009) and tools (OVE_AGUI010) are separate regions that this tab hosts in order (`design-config-full.png` shows the whole stack). Model choice is per Agent version (ADR 0007) and is not a permission.

## 3. Scope (in)

- `ConfigTab` composing the form value/onChange with the draft hook.
- `ConfigExtensions` context (`state/config-extensions.tsx`) through which the visibility, Skills and tools tasks plug into the form without editing this task's files.
- `useModelOptions()` from `connections.list`.
- Validation display.

## 4. Out of scope

- Visibility selector content (OVE_AGUI008), Skill assignment (OVE_AGUI009), tools table (OVE_AGUI010).

## 5. Detailed requirements

1. `value`/`onChange` bound to `useAgentDraft`; `errors` from the hook; `disabled` while saving or read-only.
2. `useModelOptions()` builds `ModelOption[]` grouped by CLI from `connections.list`: each connected CLI lists the models it reports; a CLI that is not logged in is listed with its models disabled and the text `zaloguj w Połączeniach` (a link to the Connections route through `routeLinks.connections`). The currently selected model that is no longer available stays selected with the chip `niedostępny` (never silently replaced).
3. Option text format `Claude Code · Opus 5.5` (provider display name · model display name, plain text).
4. Fallback model optional (`—` clears it); same-as-primary shows the inline warning `Model zapasowy jest taki sam` (ui-kit) and does not block saving.
5. Budget: minutes 1..480 and retries 0..5 with clamping on blur; `retryNonIdempotent` is not shown and never sent (the contract literal is `false`, SPEC 12).
6. Instructions: counter within the last 500 of 20000 chars (ui-kit); pasting more truncates and shows the error. Instructions are Owner-authored text sent to the Agent: shown in a plain textarea, no preview rendering, no Markdown.
7. The accessible name of the textarea is `Instrukcje Agenta`; ARIA live messages for validation come from the form.
8. `ConfigExtensions` = `{ visibility: { onRequestChange(next) }, skills: { canAccept, onAssign, onRemove }, toolsSlot }` with safe defaults (visibility card disabled with title `Niedostępne`, Skills controls disabled, empty tools slot). `ConfigTab` passes `onRequestChange` to the form's visibility callback INSTEAD of writing visibility into the draft, passes the skills handlers, renders `RegionSlot name='config-extensions'` once (extension regions register through `useRegisterConfigExtension`) and `RegionSlot name='config-tools'` as the form `children`.
9. Changing the model never changes permissions or tools: a static `InfoNote` states `Model nie zmienia uprawnień` (key `agents:config.modelNote`).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:AgentConfigForm` (OVE_DS068) with `ui:ModelPicker`, `ui:Textarea`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/config.region.tsx` (tab content registration), `components/ConfigTab.tsx`, `state/use-model-options.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- No connected CLI: model picker shows `Połącz CLI w Połączeniach` and save is blocked by `errors.model`.
- Connections call fails: the current model stays editable as text option; warning toast.
- Instructions with 20000 chars: allowed, counter red at the limit with the word `limit`.
- Minutes typed as `4,5`: rounded up to 5.

## 11. Acceptance criteria

- [ ] Given the Developer fixture, Then the form matches `design.png` within tolerance.
- [ ] Given a logged-out CLI, Then its models are disabled and the Connections link is present.
- [ ] Given fallback equal to primary, Then the warning is shown and save still works.
- [ ] Given retries `7`, Then it clamps to 5 on blur.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `ConfigTab.test.tsx` (draft binding, validation), `use-model-options.test.ts` (grouping, disabled CLI). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: models are read from `connections.list` (PROV). If PROV exposes a dedicated `api:models.list`, `use-model-options.ts` switches without changing consumers.
