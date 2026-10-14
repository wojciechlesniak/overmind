---
id: OVE_SKUI002
title: "Skill library data hook: list, filters in the URL and live refresh"
area: SKUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_SHELL011, OVE_SKILL011, OVE_SKUI001]
soft_depends_on: []
provides: ["lib:use-skill-library"]
needs: ["api:skills.list", "lib:api-client-skills", "lib:use-gateway-resource", "lib:use-current-workspace-id"]
owns: ["apps/desktop/src/features/skills/state/use-skill-library.ts", "apps/desktop/src/features/skills/state/use-skill-filters.ts", "apps/desktop/src/features/skills/state/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8"]
adr_refs: [28]
---

# OVE_SKUI002: Skill library data hook: list, filters in the URL and live refresh

## 1. Summary

Hooks that load the Skill library of the current Workspace (public Skills plus this Workspace's private ones), keep the visibility and origin filters in the URL, compute counts and refresh on Skill events.

## 2. Context

`GET /v1/skills` is scoped by the session Workspace (never by a body field, SKILL011); private Skills of other Workspaces are not returned. Events `skill.created`, `skill.version_added`, `skill.version_decided`, `skill.visibility_changed` carry ids only; the client refetches (SKILL011). Skill text is instructions that will later steer an Agent, so it is the most sensitive untrusted text in the product (ADR 0012: Skills from the internet come only from the Owner and are untrusted until accepted). The UI shows it only as plain text (no Markdown-to-HTML, no links made clickable inside the text), never includes it in any prompt or request other than the explicit Owner action, and a Skill chip or `requiredTools` list is metadata, never a permission.

## 3. Scope (in)

- `useSkillFilters()` (URL `?vis=&src=&id=`).
- `useSkillLibrary()` returning items, counts, filtered items, status.

## 4. Out of scope

- Rendering (OVE_SKUI005), inspector (OVE_SKUI006).

## 5. Detailed requirements

1. `useSkillFilters()` exposes `{ visibility, origins, selectedId, setVisibility, toggleOrigin, select, clear }` with defaults `all`/`[]`; tampered URL values reset to defaults; `select` uses `replace`.
2. `useSkillLibrary()` = `useGatewayResource(['skills', workspaceId])`, `invalidateOn` the four Skill events; returns `{ all, visible (filtered), counts, status }` with status `loading|ready|error|refreshing|empty|noResults`.
3. Filtering and counting are done client-side over the loaded list (the library is small: tens of Skills); if the response carries `nextCursor`, the hook loads all pages up to 500 items and then shows the note `Pokazano 500 Skilli`.
4. Selection: an `id` not in the list clears the selection; the inspector shows `Wybierz Skill` when nothing is selected; the mock shows a selected card, so on widths >= 1280 the first non-system card is auto-selected once per route visit.
5. The hook never sends a Workspace id: the gateway derives it from the session.
6. `archived` Skills are not in the library (archive is soft).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource` (OVE_BOARDUI001), filters/counts (OVE_SKUI001).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-skill-library.ts`, `state/use-skill-filters.ts`, `state/index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Switch Workspace: cache key changes, private Skills of the old Workspace disappear immediately.
- Skill archived while selected: selection cleared with a toast.
- Event burst: refetch coalesced (max 1 per 500 ms).

## 11. Acceptance criteria

- [ ] Given `?vis=private&src=chief`, Then only private Chief Skills are listed and counts stay for the whole library.
- [ ] Given a `skill.version_added` event, Then one refetch occurs.
- [ ] Given tampered `vis=admin`, Then `all` is used.
- [ ] Given a Workspace switch, Then the previous Workspace's private Skills are gone.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-skill-filters.test.tsx`, `use-skill-library.test.tsx` (counts, events, switch). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: library size is small enough for client-side filtering.
