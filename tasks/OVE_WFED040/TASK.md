---
id: OVE_WFED040
title: "Build the Skills panel: installed Skills with search, visibility filter, drag source"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS025, OVE_DS026, OVE_DS032, OVE_DS034, OVE_DS067, OVE_DS097, OVE_SHELL011, OVE_SKILL001, OVE_SKILL011, OVE_WFED018, OVE_WFED019, OVE_WFED023]
soft_depends_on: []
provides: ["ui:SkillsPanel", "lib:editor-skills-data", "lib:editor-skill-drop-state"]
needs: ["lib:editor-gateway", "lib:editor-agent-directory", "lib:active-workspace", "api:skills.list", "lib:api-client-skills", "contract:SkillPushEvents", "contract:Skill", "ui:SkillPalette", "ui:SkillPaletteItem", "ui:SkillDnd", "ui:SearchField", "ui:SegmentedControl", "ui:Skeleton", "ui:EmptyState", "ui:Button", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/skills/SkillsPanel.tsx", "apps/desktop/src/features/workflow-editor/skills/useInstalledSkills.ts", "apps/desktop/src/features/workflow-editor/skills/skill-view-models.ts", "apps/desktop/src/features/workflow-editor/skills/skill-filter.ts", "apps/desktop/src/features/workflow-editor/skills/drop-state.ts", "apps/desktop/src/features/workflow-editor/skills/skills-filter-store.ts", "apps/desktop/src/features/workflow-editor/gateway/skills.ts", "apps/desktop/src/features/workflow-editor/skills/*.test.ts", "apps/desktop/src/features/workflow-editor/skills/*.test.tsx", "apps/desktop/src/features/workflow-editor/skills/SkillsPanel.stories.tsx", "apps/desktop/src/locales/en/wfc-skills.json", "apps/desktop/src/locales/pl/wfc-skills.json"]
reads: []
design: design.png
design_source: "Main#canvas/skills-panel-header,skills-search,skills-hint,skills-list (crop 72,168,240,588 CSS px: heading with count, search, hint, rows, the row being dragged)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED040: Build the Skills panel: installed Skills with search, visibility filter, drag source

## 1. Summary

The upper half of the left panel, "Zainstalowane Skille": the Skills installed for this Workspace as draggable rows (name and version, visibility word, how many Agents use it), a search field, a visibility filter and the hint how to use them. It also owns the data hook for Skills and the small store that tells the panel which Agent a dragged Skill hovers.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. ADR 0028: a Skill is PUBLICZNY or PRYWATNY; public Skills are shared by all Workspaces, private ones belong to one Workspace, and the word is always shown. ADR 0012: Skills from the internet only come from the Owner, so this panel never installs anything. ADR 0027: the system Skill `overmind` is attached automatically and is not assignable. The kit provides the presentation (`ui:SkillPalette` and `ui:SkillPaletteItem`, DS097: header, `SearchField`, hint, rows 53 px, dragging look, keyboard `Przypisz do…`) and the drag layer (`ui:SkillDnd`, DS067: payload, module store). This task feeds them from `GET /skills` and wires the drag state. The panel is also visible in `view` mode (a published Workflow): the mock shows the drop target on the published v7 view because Skill assignment changes the Agent, not the draft.

## 3. Scope (in)

- `gateway/skills.ts`: `SkillsGateway.list(workspaceId)` over `lib:api-client-skills`.
- `useInstalledSkills()`: loading, error, refresh, live invalidation, `byId`.
- Mapping `SkillSummary` to `SkillPaletteItemProps["skill"]` with copy and plurals.
- Search and visibility filter with per-viewer persistence.
- `SkillsPanel` composition, drag state and the `przeciągasz na {Agent}` note.
- `lib:editor-skill-drop-state` (a tiny external store).

## 4. Out of scope

- Rules of who may receive a Skill (WFED041), drop on tiles and the keyboard targets (WFED042), writing the assignment (WFED043).
- Creating, importing, reviewing or versioning Skills (SKILL area, Skills view).
- The panel layout and the Nodes section (WFED044).

## 5. Detailed requirements

1. ```ts
interface SkillSummary { id: string; name: string; displayName?: string; description: string; visibility: "public" | "private"; ownerWorkspaceId?: string; builtin: boolean; currentVersion: number; archived: boolean; assignedAgentCount?: number }
interface SkillsGateway { list(workspaceId: string, signal?: AbortSignal): Promise<Result<readonly SkillSummary[], GatewayError>> }
interface InstalledSkills { status: "loading" | "ready" | "error"; skills: readonly SkillSummary[]; byId(id: string): SkillSummary | undefined; refresh(): void; truncated: boolean }
```
2. Data: `GET /skills?workspaceId=<active>` (SKILL011) returns the Skills visible in the Workspace (all public plus the private ones of this Workspace; the SERVER decides visibility, ADR 0028); pages of 100 are followed up to 5 pages (500 Skills, then `truncated: true` with a notice). Archived Skills are dropped; the adapter keeps only the fields of `SkillSummary` (no content, no versions). Responses are parsed with the contract schema; a bad item is skipped and counted (logged without content).
3. Live updates: subscribe to `contract:SkillPushEvents` (ids only) through the events client: `skill.created|version_added|visibility_changed|archived` invalidate the list (refetch once, coalesced within 500 ms); on reconnect refetch once. A refresh never resets the search text, the filter or the scroll position, and never interrupts a drag in progress (the update is applied after `dragend`).
4. Row view-model (`toRow(skill)`): `name` = `skill.name` (mono slug, the mock shows `grill-me`, `TypeScript`; `displayName` is a tooltip only), `version` = `v{currentVersion}`, `visibility`, `usedBy` = plural string from `assignedAgentCount` in Polish: `1 agent`, `2 agenty`, `5 agentów`, `0` shows `nieużywany` (the mock prints `2 agentów`, which is not correct Polish for 2..4; this deviation is intentional and noted in the Storybook story), absent count shows nothing. A private Skill gets `scopeNote` `Tylko ten Workspace` shown as a title/tooltip, never the only carrier of the visibility (the word PRYWATNY is rendered by the kit badge).
5. System Skill (`builtin === true`, `overmind`): listed last with the lock icon and no badge, not draggable, tooltip `Dołączany automatycznie`; it counts in the header number.
6. Header: `heading` `Zainstalowane Skille`, `count` = number of Skills after the filters (mock `7`); hint `Upuść na zakładkę ze Skillami w prawym górnym rogu kafelka.` (mock text; in `view` mode the same, because dropping stays allowed).
7. Search (`ui:SearchField`, `Szukaj Skilla`): case and diacritics insensitive substring over `name`, `displayName` and `description`; no debounce needed; the clear button restores the list; the text is local state kept while the panel is mounted. Visibility filter (not in the mock, added compactly under the search as `ui:SegmentedControl` of 3 options `Wszystkie`, `Publiczne`, `Prywatne`, 32 px high): applies together with the search; the choice is persisted per viewer in `localStorage` key `overmind.wfc.skillfilter` (wrapped in try/catch, default `Wszystkie`; never used for anything that must persist reliably).
8. Drag source: the kit item builds the payload with `lib:skillDragPayload` (`{ v: 1, skillId, version, name, visibility, ownerWorkspaceId }`); this task passes `draggingId` from the kit drag store (`useSkillDrag`) and `draggingNote` = `przeciągasz na {AgentName}` while the drag hovers an accepting tile (from `drop-state`), `{AgentName}: {short reason}` while it hovers a refusing tile, empty otherwise (the mock shows `przeciągasz na Senior Reviewera`). The note text is plain text, clamped to 60 characters.
9. `drop-state.ts` (`lib:editor-skill-drop-state`): a framework-free external store `{ over: { nodeId, agentName, accepting: "valid" | "invalid", reasonShort? } | null }` with `reportOver(...)`, `clear()` and `useSkillDropHover()` built on `useSyncExternalStore`; WFED042 is the only writer, this panel and the pane are readers; it is cleared on `dragend`, `drop`, `Escape` and window `blur`.
10. Loading shows 5 `ui:Skeleton` rows of 53 px; error shows a compact `ui:EmptyState` in error tone `Nie udało się wczytać Skilli` with a `ui:Button` `Spróbuj ponownie` (calls `refresh`); no Skills installed shows `ui:EmptyState` `Brak zainstalowanych Skilli` with a link `Otwórz bibliotekę Skilli` (route of the Skills view, through the route-links helper of the shell); no match shows `Brak Skilli pasujących do wyszukiwania`.
11. Keyboard alternative: the kit row exposes `Przypisz do…` (Enter or Space on a focused row opens a menu of Agent nodes); the targets and their disabled reasons are supplied by WFED042 through `assignTargets`; this panel only forwards them.
12. Messages (`wfc-skills`, EN default, PL as the mock): `heading`, `search`, `hint`, `filter.all|public|private`, `used.one|few|many|other|none`, `note.dragging`, `note.refused`, `system.tooltip`, `scope.private`, `error`, `retry`, `empty`, `noMatch`, `openLibrary`, `truncated`.

## 6. Design notes

`design.png` (crop of the left panel top, 240x588): heading `Zainstalowane Skille` 18/700 `text-primary` with the count `7` mono 12 `#8C80A6` at the right; search field 40 px, radius 14, `bg-surface`, `1px line`, placeholder `Szukaj Skilla`; hint 13/1.45 `text-secondary` (two lines); rows 53 px, radius 14, padding 10 14, name mono 14/500 plus version mono `text-muted`, outline `PUBLICZNY` (blue `#6FA8FF`) or `PRYWATNY` (violet `#9B7BFF`) badge and `N agentów` 12; the last row is the dragged item: dashed `1.5px #F25FC4` border, `rgba(242,95,196,.06)` fill, text `#FFB3E6`, two lines `review-rubric v1` and `przeciągasz na Senior Reviewera`. All of it comes from the kit (DS097); this task passes data and labels. Added by this task (not in the mock): the visibility filter row, loading, error, empty and truncated states, the system Skill row.

## 7. Reuse

- `ui:SkillPalette`, `ui:SkillPaletteItem` (DS097), `ui:SkillDnd` and `lib:skillDragPayload` (DS067), `ui:SearchField`, `ui:SegmentedControl`, `ui:Skeleton`, `ui:EmptyState`, `ui:Button`; `lib:api-client-skills` (SKILL011) only inside `gateway/skills.ts`; the Agent directory for names (WFED023).

## 8. Architecture and code placement

Layer: `gateway/skills.ts` (adapter, the only API import), `skills/skill-view-models.ts` and `skill-filter.ts` (pure), `drop-state.ts` (framework-free store), React in `SkillsPanel.tsx` and `useInstalledSkills.ts`. DIP: the hook depends on `SkillsGateway`.

## 9. Security and safety

All node labels, Agent names, Skill names, lane names and edge labels are untrusted text (they may come from Chief or from Agents): render them as React text nodes only, clamp lengths, never `dangerouslySetInnerHTML`, never interpolate them into i18n keys or selectors. A graph that looks valid in the browser is never trusted: the engine validates on save and on publish (fail closed). The payload put on the drag is ids and display strings only; it is never trusted for authorisation (WFED041/WFED043 re-check by id against real data and the engine re-checks). Private Skills of another Workspace never reach this list (server filtering); the panel must not try to fetch them by id. Skill descriptions are untrusted text (a Skill can come from the internet via the Owner): shown only in the search index and a tooltip, rendered as text. No Skill content is requested.

## 10. Errors and edge cases

- Skill renamed or archived by another view while listed: event, refetch, row disappears; a drag of an archived Skill ends refused by WFED041.
- Two Skills with the same name in different Workspaces (public vs private): both listed, ids are the keys, the visibility word disambiguates.
- 500+ Skills: first 500 and a notice.
- Storage blocked: the filter is not persisted, the panel works.
- Engine unreachable: error state with retry, the rest of the editor keeps working.
- Count unknown (`assignedAgentCount` absent): no usage text.
- The window is narrower than 240 px: the kit rows truncate with ellipsis and a title.
- Skills loading while a drag from a stale list ends: the drop is checked by WFED041 against fresh data.

## 11. Acceptance criteria

- [ ] Given the mock fixture of 7 Skills, Then the panel shows heading `Zainstalowane Skille`, count 7, search, hint and rows with name, version, word and usage as in `design.png`.
- [ ] Given `assignedAgentCount` 2, Then the row text is `2 agenty`; given 5 then `5 agentów`; given 1 then `1 agent`.
- [ ] Given the filter `Prywatne`, Then only private Skills show and the count updates.
- [ ] Given the search text `lanc` and a Skill `łańcuch`, Then it matches.
- [ ] Given `dragstart` on a row, Then the kit payload is valid and the row shows the dragging look; given a hover over an accepting tile named `Senior Reviewer` the note reads `przeciągasz na Senior Reviewer`.
- [ ] Given a `skill.version_added` event, Then the list refetches once and the search text is preserved.
- [ ] Given the system Skill, Then it has a lock icon and cannot be dragged.
- [ ] Given `view` mode, Then the panel is fully usable.

## 12. Test plan

Unit tests for `toRow`, plural table, filter and search (pure), adapter tests with a fake api-client, hook tests with fake events (coalescing, mid-drag deferral), RTL tests of the panel, Storybook (`SkillsPanel/Default`, `Dragging`, `Loading`, `Error`, `Empty`, `NoMatch`, `System`, `Truncated`) with play functions, visual test vs `design.png`, axe. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/skills src/features/workflow-editor/gateway/skills`.

## 13. Parallelization notes

Provides data and drag state used by WFED041..WFED043; can start as soon as the kit DS097 and DS067 exist. WFED044 composes the panel.

## 14. Open questions and assumptions

- GAP: `SkillSummary.assignedAgentCount` (the mock shows `3 agentów`) is not in `contract:Skill` (SKILL001); `contract:SkillUsage` may provide it. Without it the usage text is hidden. Proposal to SKILL011: add `assignedAgentCount` to the list response.
- GAP: `GET /skills` filtering by `workspaceId` is assumed (SKILL011 lists the routes but not the query parameters).
- ASSUMPTION: the visibility filter is an addition to the mock; remove the `SegmentedControl` if the Owner prefers the mock exactly.
- OPEN (DS): the kit has no `ErrorState` component (the Agents tasks also need one); this task uses `EmptyState` in an error tone until DS adds it.
- ASSUMPTION: Polish plural `2 agenty` is correct and the mock `2 agentów` is a copy slip.
