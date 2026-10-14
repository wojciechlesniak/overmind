---
id: OVE_SKUI014
title: "Skills states and live updates: empty, errors, offline, announcements"
area: SKUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS032, OVE_DS109, OVE_SKUI002, OVE_SKUI003, OVE_SKUI005, OVE_SKUI006]
soft_depends_on: []
provides: ["lib:skills-states-live"]
needs: ["ui:EmptyState", "ui:ErrorState", "ui:LiveRegion", "lib:use-skill-library", "lib:use-skill-detail", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/live/skills-live.region.tsx", "apps/desktop/src/features/skills/components/SkillStates.tsx", "apps/desktop/src/locales/en/skills-states.json", "apps/desktop/src/locales/pl/skills-states.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8"]
adr_refs: [5]
---

# OVE_SKUI014: Skills states and live updates: empty, errors, offline, announcements

## 1. Summary

Cross-cutting states and announcements of the Skills view: engine offline banner, selection-empty state, archived Skill, Global Pause note, and polite announcements for events that change the library.

## 2. Context

Regions render their own loading and empty states; this task adds shared pieces no region owns and the live announcer region (auto-discovered through `../live/*.region.tsx`). Skill events carry ids only (`skill.created`, `skill.version_added`, `skill.version_decided`, `skill.visibility_changed`).

## 3. Scope (in)

- `SkillStates` components, `skills-live.region.tsx`.

## 4. Out of scope

- Region-level states.

## 5. Detailed requirements

1. Offline: banner `Brak połączenia z silnikiem`, mutations and dialogs' submit disabled, data kept with the word `nieaktualne`.
2. Archived Skill opened by URL: read-only inspector with banner.
3. Global Pause: muted line `Pauza wstrzymuje pracę Agentów; Skille możesz nadal edytować`.
4. Announcements (`aria-live=polite`, max one per 2 s, bursts `+N zmian`): `Nowy Skill: {name}` (from a refetch diff, because events carry ids only), `Nowa wersja Skilla {name}: v{n}`, `Skill {name} jest teraz PUBLICZNY|PRYWATNY`, `Chief proponuje Skill {name}`; own actions are not announced twice.
5. Names are plain text truncated to 60 chars.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:EmptyState`, `ui:ErrorState`, shell announcer.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `live/skills-live.region.tsx`, `components/SkillStates.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Event for an unknown id: refetch then announce from the diff.
- Locale change: announcements re-render.

## 11. Acceptance criteria

- [ ] Given a `skill.version_added` event from another session, Then one announcement is made after the refetch.
- [ ] Given offline, Then submit buttons are disabled.
- [ ] Given a burst of 10 events, Then one summary announcement is made.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `SkillStates.test.tsx`, `skills-live.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- Duplicated batching with BOARDUI013/DECUI013/AGUI015 (reported: candidate for one shared helper).
