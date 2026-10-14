---
id: OVE_AGUI005
title: "Agent detail data hook and the unsaved configuration draft"
area: AGUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGUI001, OVE_AGUI002, OVE_BOARDUI001, OVE_PERM026, OVE_SKILL011]
soft_depends_on: []
provides: ["lib:use-agent-detail", "lib:use-agent-draft"]
needs: ["api:agents.get", "api:agents.update", "api:perm.effective", "api:skills.list", "lib:api-client-agents", "lib:api-client-perm", "lib:api-client-skills", "lib:use-gateway-resource", "lib:use-gateway-mutation"]
owns: ["apps/desktop/src/features/agents/state/use-agent-detail.ts", "apps/desktop/src/features/agents/state/use-agent-draft.ts", "apps/desktop/src/features/agents/state/save-state.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9"]
adr_refs: [7, 28]
---

# OVE_AGUI005: Agent detail data hook and the unsaved configuration draft

## 1. Summary

Loads one Agent with its effective permissions and Skill names, keeps the editable draft of the configuration, computes dirty state and performs the `Zapisz jako vN` save with version-conflict handling.

## 2. Context

`GET /v1/agents/{id}` returns the Agent with `instructions` (only here); `PATCH /v1/agents/{id}` takes `{ expectedVersion, patch, changeNote? }` and returns the new `Agent`, `{ unchanged: true }` for a no-op, or 409 `agent.version_conflict` with `currentVersion`. Every saved change is a NEW immutable version (ADR 0007: model/instructions/Skills are per Agent version; permissions are not in this form).

## 3. Scope (in)

- `useAgentDetail(agentId)` resource: Agent, Skills lookup, effective permissions.
- `useAgentDraft(agent)` draft state machine and `save()`.
- Header save-button state `clean|dirty|saving|saved|error`.

## 4. Out of scope

- Visibility change (OVE_AGUI008), rendering (OVE_AGUI006, 007).

## 5. Detailed requirements

1. `useAgentDetail(id)` = `useGatewayResource(['agent', id])` + `['agent-effective', workspaceId, id]` (`GET /v1/permissions/effective?workspaceId=&agentId=`) + the Skills lookup (`skills.list` cached, joined by `skillId` for name, version and visibility). Invalidated by `agent.config_changed` for this id.
2. `useAgentDraft(agent)` returns `{ draft, setDraft, dirty, errors, saveState, save, reset }`. The draft is initialised from the `Agent` (mapper `agentToDraft`); a new `Agent.currentVersion` from a refetch while the draft is clean replaces the draft; while dirty a banner key `agents:conflict.newer` offers `Załaduj nowszą wersję` (discard) or `Zachowaj moje zmiany` (rebase on the new version number, never silently overwriting).
3. Client-side validation mirrors the contract: name unchanged here; instructions <= 20000; minutes 1..480; retries 0..5; model required; fallback differs from primary (warning, not error); skills <= 32. Errors are keyed (`instructions|model|budget`) for `AgentConfigForm.errors`.
4. `save()`: builds `patch = draftToPatch(base, draft)`; if empty nothing is sent; else `PATCH /v1/agents/{id}` with `expectedVersion = base.currentVersion` and optional `changeNote` (not asked in MVP; reserved). While saving `saveState='saving'` and all form controls are `disabled`; on success `saved` for 1.5 s then `clean` (the ui-kit button flips on the state the hook gives); on `unchanged` returns to `clean`; on `agent.version_conflict` -> conflict banner, draft kept; on `agent.invalid_config` -> map `issues[].path` to field errors (path and code only, never echo server text); other errors -> `error` with `renderMessage`.
5. The patch NEVER contains `visibility`, `ownerWorkspaceId`, `lifecycle`, `permissionProfileId`, `tools` or `name`: a unit test enumerates the allowed key set `['instructions','providerId','modelId','fallbackModel','timeoutSeconds','retryPolicy','skills']`.
6. No optimistic update: the displayed Agent changes only after the engine answered with the new version.
7. Dirty state is published to the provider (OVE_AGUI003) for the unsaved-changes guard; `beforeunload` is NOT used (Tauri), the route guard is.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource`/`useGatewayMutation` (OVE_BOARDUI001), mappers (OVE_AGUI001).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-agent-detail.ts`, `state/use-agent-draft.ts`, `state/save-state.ts` (pure reducer).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Agent archived while editing: `agent.archived` event -> read-only state and banner `Ten Agent został zarchiwizowany`.
- Double click on Save: the second call is ignored while `saving`.
- Skills lookup misses a skill id (archived Skill): chip `{id} (archiwum)`, assignment kept until the Owner removes it.
- Draft equal to base after edits (typed and reverted): `clean`.

## 11. Acceptance criteria

- [ ] Given only instructions edited, Then PATCH body is `{ expectedVersion:3, patch:{instructions} }`.
- [ ] Given 409 `version_conflict`, Then the draft is kept and the banner offers reload or rebase.
- [ ] Given `invalid_config` with path `retryPolicy.maxRetries`, Then the budget error is shown.
- [ ] Given visibility toggled in some other task, Then no patch key `visibility` is ever produced.
- [ ] Given a successful save, Then the new version label is `v4` and state `saved` then `clean`.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-agent-draft.test.tsx` (dirty, save, conflict, key allow-list), `use-agent-detail.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: `changeNote` is not requested in MVP (a short note field may be added with the Versions tab, OVE_AGUI014).
