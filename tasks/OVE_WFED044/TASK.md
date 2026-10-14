---
id: OVE_WFED044
title: "Compose the editor left panel: Skills above the Nodes palette with one scroll model"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS022, OVE_DS044, OVE_WFED001, OVE_WFED019, OVE_WFED024, OVE_WFED030, OVE_WFED038, OVE_WFED040, OVE_WFED042, OVE_WFED043]
soft_depends_on: []
provides: ["ui:EditorSideRail", "lib:editor-provider"]
needs: ["ui:SkillsPanel", "ui:NodesPalettePanel", "ui:CanvasKeyboardInstructions", "lib:editor-skill-drop", "lib:editor-skill-assignment", "lib:editor-skill-drop-context", "lib:editor-session", "lib:editor-feature-layout", "ui:SidePanel", "ui:SectionLabel", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/side-rail/EditorSideRail.tsx", "apps/desktop/src/features/workflow-editor/side-rail/EditorProvider.tsx", "apps/desktop/src/features/workflow-editor/side-rail/useRailLayout.ts", "apps/desktop/src/features/workflow-editor/side-rail/*.test.tsx", "apps/desktop/src/features/workflow-editor/side-rail/EditorSideRail.stories.tsx", "apps/desktop/src/locales/en/wfc-rail.json", "apps/desktop/src/locales/pl/wfc-rail.json"]
reads: []
design: design.png
design_source: "Main#canvas/side-panel (crop 72,162,240,738: the whole left panel, Skills on top, Nodes below; the mock panel is clipped by the viewport and scrolls)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED044: Compose the editor left panel: Skills above the Nodes palette with one scroll model

## 1. Summary

Assembles the 240 px left column of the Workflow canvas: the Skills panel on top, the Nodes palette below, one scroll container, and the `EditorProvider` that wires session, gateways, directory, skill drop and the action bus for the whole editor. PART 2 mounts the rail and the canvas pane inside this provider.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. VIEWS.md `canvas/side-panel` (240 px, installed Skills then the node palette, the palette overflows the viewport and scrolls). The components are built elsewhere (WFED030 palette, WFED040 Skills panel); this task only arranges them and provides the context they need so PART 2 has a single entry point: `EditorProvider` (session + gateway + directory + skill data + drop + action bus + announcer) and `EditorSideRail`.

## 3. Scope (in)

- `EditorSideRail` layout and scroll behaviour.
- `EditorProvider` composition order and props.
- `useRailLayout` (sticky headings, height budget).
- `wfc-rail` strings (landmark labels).

## 4. Out of scope

- The palette and Skills content (WFED030, WFED040).
- Collapsing the rail or a resizable width (not in the mock, not planned).
- The page route, header and Inspector (PART 2).

## 5. Detailed requirements

1. ```ts
interface EditorProviderProps { workflowId: string; target: { kind: "draft" } | { kind: "version"; versionNo: number } | { kind: "published" }; gateway: EditorGateway; children: ReactNode }
function EditorProvider(p: EditorProviderProps): JSX.Element     // creates the session (WFED019) through the loader (WFED020), the Agent directory (WFED023), providers for skills data (WFED040), skill drop (WFED042), assignment (WFED043), actions (WFED038), announcer (WFED024)
function EditorSideRail(p: { className?: string }): JSX.Element
```
2. Provider order (outermost first, documented in the file header and covered by a test that renders the real tree): `EditorGatewayProvider` -> loader gate (`ui:EditorLoadGate`, WFED020, renders the skeleton or error and the children only when a document exists) -> `EditorSessionProvider` -> `AgentDirectoryProvider` -> `InstalledSkillsProvider` -> `SkillAssignmentProvider` -> `SkillDropProvider` -> `ActionBusProvider` -> `Announcer`. Each provider is created by its own task; this task only composes. Unmounting disposes the directory, the autosave and the session subscriptions (leak test).
3. Layout: the rail is a column 240 px wide (`flex: 0 0 240px`) with `padding 18 14` as in the mock (content left edge 86 px = 72 + 14), `gap 24` between the sections, `overflow-y: auto` on the RAIL only (the Skills list does not scroll on its own: the whole rail scrolls so the user reaches the palette without nested scroll traps; `scrollbar-gutter: stable`). The Nodes heading stays reachable by a `Przejdź do Węzłów` skip link visible on focus (two sections, so a small convenience).
4. Height budget: when the viewport is tall enough for both, no scroll; the Skills list never takes more than 60 % of the rail height before it starts to scroll inside itself (`max-height: calc(60% - 48px)`), so the palette always stays at least partly visible without scrolling the rail (the mock clips the palette; this is the documented improvement).
5. Landmark and names: the rail is `<aside aria-label="Panel Workflow">`; the Skills section has `aria-labelledby` of its heading, the Nodes section likewise; tab order is Skills search, filter, rows, then palette chips (a single Tab stop per list with arrow navigation is provided by the kit components).
6. View mode: both sections remain rendered; the palette is disabled by its own rule, the Skills panel stays enabled (WFED040). A read-only chip is not shown here (the canvas pane shows it, WFED029).
7. Loading and error: the loader gate decides; while the catalogue or Skills load the sections show their own skeletons (their tasks), the rail never shows a blank column.
8. Keyboard instructions: the rail renders `<CanvasKeyboardInstructions />` (WFED046) once, visually hidden, so the pane `aria-describedby="wfc-canvas-instructions"` resolves; it is rendered even when the rail is scrolled or the Skills panel is empty.
9. Messages (`wfc-rail`): `aria` `Panel Workflow`, `skipToNodes` `Przejdź do Węzłów`.

## 6. Design notes

`design.png` is the full left panel crop (240x738): the heading `Zainstalowane Skille` at the top (panel top padding 18), the list, the dragging row, then the heading `Węzły` 18/700 and the wrapping chips; the rail background is the page background `#0C0814` with a right border `1px line` (the shell owns the border; check against the crop). Section gap 24 (the heading `Węzły` sits 42 px below the last Skill row in the mock because the dragging row is taller). No colours are defined here.

## 7. Reuse

- `ui:SidePanel` (kit panel shell, scroll and border), `ui:SectionLabel`; `ui:SkillsPanel` and `ui:NodesPalettePanel`; the providers of the other tasks.

## 8. Architecture and code placement

Layer: UI composition in `side-rail/`. No logic beyond ordering; the provider file is the only place that knows all contexts (SRP) so PART 2 imports one symbol. Public exports are re-exported by the capability barrel for PART 2.

## 9. Security and safety

Composition only. The provider must not create more than one session or directory per mounted editor (a duplicated provider would double-save drafts): the test asserts a single autosave per workflow id. Nothing from other Workspaces is loaded: the Workspace id comes from `lib:active-workspace` and changes recreate the whole tree (`key={workspaceId}`).

## 10. Errors and edge cases

- Workspace switched while open: provider remounts with the new Workspace, unsaved draft changes are handled by the dirty guard (WFED021) before navigation.
- Very short window (height 400): the rail scrolls, nothing is clipped.
- Left panel in a narrow window (< 1100 px wide): fixed 240, the canvas shrinks (shell decides).
- Both sections loading: two skeletons.
- Provider mounted twice by StrictMode in development: effects are idempotent (test with double render).

## 11. Acceptance criteria

- [ ] Given the full provider tree and a fixture workflow, Then the rail renders the Skills panel above the Nodes palette with the structure of `design.png` (heading, search, hint, rows, `Węzły`, chips).
- [ ] Given a 600 px high window, Then the rail scrolls as one container and the Nodes heading is reachable with the skip link.
- [ ] Given StrictMode, Then exactly one session, one directory and one autosave exist.
- [ ] Given unmount, Then all subscriptions and timers are disposed (leak test).
- [ ] Given `view` mode, Then the palette chips are disabled and the Skills rows are draggable.

## 12. Test plan

RTL tests with the fake gateway (WFED018) covering the provider tree, layout classes, a11y roles and the leak check; Storybook (`SideRail/Default`, `View`, `Loading`, `Short`) with a visual test against `design.png`; axe. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/side-rail`.

## 13. Parallelization notes

Last composition task of the left panel; PART 2 consumes `EditorProvider` and `EditorSideRail`. Conflict hotspot: none (own folder).

## 14. Open questions and assumptions

- ASSUMPTION: PART 2 mounts `EditorProvider` once per route and renders `EditorSideRail` and `WorkflowCanvasPane` inside it.
- OPEN (Owner): the mock panel is not resizable or collapsible; keep it so in MVP.
