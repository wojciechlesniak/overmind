---
id: OVE_PAUSE014
title: "Show Workspace pause state on the dashboard cards and expose useWorkspacePause"
area: PAUSE
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS059, OVE_PAUSE007, OVE_PAUSE010]
soft_depends_on: []
provides: ["lib:use-workspace-pause"]
needs: ["ui:WorkspaceCard", "api:pause.workspace", "lib:use-pause"]
owns: ["apps/desktop/src/features/pause/workspace/**"]
reads: []
design: design.png
design_source: "Pulpit#dash/workspace-card-paused (crop 100,546,489,252)"
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 12"]
adr_refs: [5, 28]
---

# OVE_PAUSE014: Show Workspace pause state on the dashboard cards and expose useWorkspacePause

## 1. Summary

Maps engine pause state to the `ui:WorkspaceCard` variants: the individually paused card ('wstrzymany przez Ciebie', 'nikt nie pracuje') and the card state while Global Pause is active (every card shows 'wstrzymane (Global Pause)'). Also exports `useWorkspacePause(workspaceId)` for Workspace settings and other callers.

## 2. Context

The Workspaces dashboard card 'Research rynku' in the mock is paused by the Owner: grey dot, summary kept ('Raport konkurencji w połowie. Czeka, aż wznowisz.'), counts, 'nikt nie pracuje', 'wstrzymany przez Ciebie'. The mock does not show the Global Pause case ('all cards paused banner' listed in VIEWS as a missing state). `ui:WorkspaceCard` (OVE_DS059) already supports the `paused` state with `pausedLabel`; this task provides the data mapping so the WSPACE dashboard task only renders.

## 3. Scope (in)

- `selectCardPauseProps(snapshot, workspaceId)` returning `{ state?: "paused"; pausedLabel?: string; idleLabel?: string }` overrides.
- `useWorkspacePause(workspaceId)` hook with `pause()` and `resume()` (confirmation-free for resume of a single Workspace).
- Unit tests and stories with the card.

## 4. Out of scope

- The dashboard layout and card data (counts, summary): WSPACE. Workspace settings page placement of a pause button: WSPACE (it may use the hook). Banner: OVE_PAUSE011.

## 5. Detailed requirements

1. `selectCardPauseProps` rules: Workspace individually paused -> `state: 'paused'`, `pausedLabel: 'wstrzymany przez Ciebie'`, `idleLabel: 'nikt nie pracuje'`; Global Pause active (phase paused or pausing) and Workspace not individually paused -> `state: 'paused'`, `pausedLabel: 'wstrzymany (Global Pause)'`, `idleLabel: 'nikt nie pracuje'` (during `pausing`: `pausedLabel: 'wstrzymywanie…'` and idleLabel unchanged because Agents are still finishing); both -> the individual label (it survives a global resume). Otherwise `{}` (no override). The Workspace's own summary text is never replaced.
2. Labels are i18n keys in `pause.json`: `card.pausedByOwner` ('wstrzymany przez Ciebie'), `card.pausedGlobal` ('wstrzymany (Global Pause)'), `card.pausing` ('wstrzymywanie…'), `card.nobodyWorking` ('nikt nie pracuje').
3. `useWorkspacePause(workspaceId)` returns `{ paused: boolean; by: 'global'|'workspace'|null; pending: boolean; pause(): Promise<void>; resume(): Promise<void> }` using the shared snapshot store; `pause()` applies immediately (toast 'Workspace wstrzymany'), `resume()` immediately (toast 'Workspace wznowiony'); when `by === 'global'`, `resume()` is a no-op returning a `pause.paused` hint toast 'Najpierw wznów wszystko'.
4. A card in the paused state keeps its pending Approvals pill if any (Approvals remain visible, actions blocked by OVE_PAUSE012).
5. The card's magenta working border/glow is removed in the paused state (DS `paused` variant); pausing a card never changes the Chief summary sentence.

## 6. Design notes

`design.png` shows the paused card exactly as drawn: 10px grey dot, name 'Research rynku' 18/700, mono path '~/Documents/research-hotele', summary 'Raport konkurencji w połowie. Czeka, aż wznowisz.', segmented bar (grey todo, mint done) with the counts line '3 do zrobienia · 0 w toku · 0 review · 2 gotowe z 5', footer 'nikt nie pracuje' and mono 'wstrzymany przez Ciebie'. The component already implements it (OVE_DS059); this task only supplies props. NOT in the mock: the Global Pause variant (derived: identical shape, footer text 'wstrzymany (Global Pause)'; the grey dot is used for all cards while globally paused, but cards keep their own border; no extra banner on the cards because the top bar banner already says it), the pausing variant (text 'wstrzymywanie…' with the working dot still magenta because Agents are finishing).

## 7. Reuse

- `ui:WorkspaceCard` `paused` variant and `pausedLabel` prop (OVE_DS059), shared pause store (OVE_PAUSE010), `setWorkspacePause` (OVE_PAUSE007).

## 8. Architecture and code placement

`apps/desktop/src/features/pause/workspace/{select-card-pause-props.ts,use-workspace-pause.ts}`; pure selector plus thin hook; exported through the barrel. WSPACE imports; no reverse dependency.

## 9. Security and safety

- All pause state comes from the gateway; the UI never stores 'paused' in localStorage or decides authority itself (the engine enforces; the UI only reflects).
- All strings are rendered as React text nodes; no HTML injection; labels come from i18n keys with only numeric and Workspace-name params (Workspace names are untrusted text, truncated with ellipsis).
- A failed pause call is shown as an error and the button returns to its previous state; the UI never shows 'paused' before the engine confirmed (no optimistic state), because a false sense of safety is worse than a delay.
- Visibility rules (ADR 0028): the dashboard lists only Workspaces the Owner has; isolated Workspaces behave as every other card; nothing about them leaves the card.

## 10. Errors and edge cases

- Workspace deleted: selector gets no row, hook returns `paused:false` and `pause()` fails with a toast.
- Global Pause lifted while the Workspace was individually paused: card stays paused with the individual label.
- Snapshot unavailable: no overrides (card shows data from the Workspaces list; a stale 'paused' is never invented).
- Two cards updated by one `pause.changed` event: React store updates both in one render.

## 11. Acceptance criteria

- [ ] Given Workspace B individually paused, Then its card receives `state:'paused'` with the labels 'wstrzymany przez Ciebie' and 'nikt nie pracuje'.
- [ ] Given Global Pause, Then every card receives the Global label; Workspace summaries unchanged.
- [ ] Given pausing, Then the label is 'wstrzymywanie…'.
- [ ] `useWorkspacePause().resume()` under Global Pause does nothing harmful and shows the hint.
- [ ] Visual test: the paused story renders like `design.png` within tolerance.
- [ ] Selector table tests pass.

## 12. Test plan

Unit: `select-card-pause-props.test.ts`, `use-workspace-pause.test.tsx`; Storybook story `WorkspaceCard/Paused` and `WorkspaceGrid/GlobalPause`; visual comparison against `design.png`. Commands: `pnpm --filter desktop test pause`.

## 13. Parallelization notes

Parallel with the other UI tasks after OVE_PAUSE010. WSPACE's dashboard task consumes the selector; it must not duplicate the label logic.

## 14. Open questions and assumptions

- OPEN: where does the Owner pause an individual Workspace in the main window? Mocks only show the tray. DEFAULT: Workspace settings (WSPACE) may add a button using `useWorkspacePause`; not specified here.
- DESIGN GAP: Global Pause card variant not drawn (VIEWS 'states NOT shown'); derived as described.
