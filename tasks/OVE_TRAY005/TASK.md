---
id: OVE_TRAY005
title: "Provide the tray view model: header, Agent rows, pending line, items, pause"
area: TRAY
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS085, OVE_PAUSE013, OVE_SHELL005, OVE_SHELL006, OVE_SHELL024, OVE_TRAY002, OVE_TRAY003, OVE_TRAY004]
soft_depends_on: ["OVE_SHELL024"]
provides: ["lib:use-tray-model", "lib:tray-mappers"]
needs: ["lib:use-tray-pause-model", "ui:TrayMenu", "lib:format-shortcut", "lib:use-gateway-query", "lib:use-invalidate-on-events", "lib:tray-invalidating-events"]
owns: ["apps/desktop/src/features/tray/model/**", "apps/desktop/src/locales/en/tray.json", "apps/desktop/src/locales/pl/tray.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 15]
---

# OVE_TRAY005: Provide the tray view model: header, Agent rows, pending line, items, pause

## 1. Summary

Implements `useTrayModel()` in the tray webview: reads `tray.summary`, keeps it fresh through the event hub, merges it with the pause model of PAUSE013 and produces exactly the props of `ui:TrayMenu` (status line, Agent rows, pending-items row, menu items, Global Pause, footer) plus the icon status for TRAY002.

## 2. Context

`ui:TrayMenu` (DS085) is presentational: it takes `status`, `workspaces` with `agents`, `items`, `globalPause` and `footer`. The mock texts are 'pracuje · 3 z 3 Agentów', agent rows 'QA / Aplikacja rezerwacji / pracuje', '3 sprawy czekają na Ciebie' with hint 'Zgody', 'Napisz do Chiefa…', 'Wstrzymaj „Aplikacja rezerwacji”', 'Wznów „Research rynku”', 'Global Pause', 'Otwórz Overmind ⌘O', 'Zamknij okno, pracuj dalej', 'Zakończ Overmind…'. Something must turn engine data into these props without logic leaking into JSX. PAUSE013 already provides the pause part (`useTrayPauseModel`); this task composes it.

## 3. Scope (in)

- `useTraySummary()` query (`tray.summary`) with invalidation by `TRAY_INVALIDATING_EVENTS`.
- Pure mappers: `toTrayHeader`, `toTrayAgentRows`, `toPendingRow`, `toTrayItems`, `toTrayFooter`, `toTrayIconStatus`.
- `useTrayModel()` returning `{ props: TrayMenuProps; iconStatus; status: 'loading'|'ready'|'error'|'stale' }`.
- Merge with `useTrayPauseModel()` (PAUSE013) for pause items, Global Pause and paused status.
- `locales/{en,pl}/tray.json` catalogue (owned here, below).

## 4. Out of scope

- The component rendering (TRAY006) and the action handlers (TRAY008): the model returns handler ids; TRAY008 supplies the `onSelect` functions through a registry.
- Engine-down and overflow behaviour (TRAY009).
- The pause logic itself (PAUSE013).

## 5. Detailed requirements

1. **Header.** `status.label`: working: `t('status.working', { working, limit })` -> 'pracuje · 3 z 3 Agentów' (EN 'working · 3 of 3 Agents'); idle: 'bezczynny' / 'idle'; paused: 'wstrzymane' (from PAUSE013); pausing: 'wstrzymywanie · {{count}} Agentów' (PAUSE013); error: 'silnik nie odpowiada'. `tone` per phase: working, idle, paused, error. Numbers carry word units ('Agentów').
2. **Agent rows.** From `summary.agents` joined with workspace names: `{ id, name, hue, initials, subtitle: workspaceName, stateLabel, state }`; PL state words: working 'pracuje' (magenta), waiting_approval 'Zgoda' (amber), finished 'gotowe', error 'błąd', idle not shown. Agents in other Workspaces are listed in the same flat list (the mock shows 'Researcher / Strona fundacji'); `TrayWorkspaceGroup` is used only if the DS decides grouping when more than one Workspace is active (TRAY006 decides by the DS prop, default flat as in the mock).
3. **Pending row.** When `pendingTotal > 0`: `{ count, label: t('pending.label', { count }) , actionLabel: t('pending.action') }` -> '3 sprawy czekają na Ciebie' with the hint 'Zgody'. PL plural: one '{{count}} sprawa czeka na Ciebie', few '{{count}} sprawy czekają na Ciebie', many '{{count}} spraw czeka na Ciebie', other as many; EN '{{count}} item waiting for you' / 'items waiting for you'. Row hidden when 0 (the mock does not show it).
4. **Items.** `items` = [ `{ id: 'chief', label: t('items.chief') 'Napisz do Chiefa…', icon: 'message-square' }` ] followed by the pause items from `useTrayPauseModel().items` (order and truncation per PAUSE013: max 6 Workspaces, 28 chars). Item ids are stable strings used by TRAY008 (`chief`, `pause-ws:<id>`, `resume-ws:<id>`, `more-workspaces`).
5. **Global Pause.** Directly from the pause model (`label`, `active`, `onToggle`); the resume confirmation row is part of PAUSE013/TRAY009.
6. **Footer.** `[ { id: 'open-app', label: 'Otwórz Overmind', kbd: '⌘O' }, { id: 'close-window', label: 'Zamknij okno, pracuj dalej' }, { id: 'quit', label: 'Zakończ Overmind…', tone: 'muted' } ]`; `kbd` is built with `formatShortcut('Mod+O')` (SHELL024) so it stays consistent. 'close-window' is disabled when the main window is not open (platform query `desktopShell.isMainWindowVisible()`, optional) .
7. **Icon status.** `toTrayIconStatus(vm)` priority error > paused > waiting > working > idle with tooltip text equal to the header status (TRAY002).
8. **Stale and error.** `status: 'stale'` when summary older than 60 s and the hub is disconnected; `'error'` when the query fails; the UI states are TRAY009.
9. **Catalogue (EN | PL):** `status.working` working · {{working}} of {{limit}} Agents | pracuje · {{working}} z {{limit}} Agentów; `status.idle` idle | bezczynny; `status.error` Engine not responding | Silnik nie odpowiada; `state.working` working | pracuje; `state.waiting_approval` Approval | Zgoda; `state.finished` done | gotowe; `state.error` error | błąd; `pending.label` plural; `pending.action` Approvals | Zgody; `items.chief` Message Chief… | Napisz do Chiefa…; `items.openApp` Open Overmind | Otwórz Overmind; `items.closeWindow` Close window, keep working | Zamknij okno, pracuj dalej; `items.quit` Quit Overmind… | Zakończ Overmind…; `items.moreWorkspaces` More Workspaces… | Więcej Workspace'ów…; `a11y.menu` Overmind menu | Menu Overmind; `loading` Loading… | Wczytywanie…; plus keys for TRAY009 (`engine.*`, `quit.*`, `error.*`).

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `useGatewayQuery`, `useInvalidateOnEvents` (SHELL005/006), `useTrayPauseModel` (PAUSE013), `formatShortcut` (SHELL024), `TrayMenuProps` types (DS085), `api-client-tray` (TRAY004).

## 8. Architecture and code placement

`apps/desktop/src/features/tray/model/{use-tray-summary.ts,map-header.ts,map-agents.ts,map-pending.ts,map-items.ts,map-footer.ts,to-icon-status.ts,use-tray-model.ts,testing.ts}` and `apps/desktop/src/locales/{en,pl}/tray.json`. Pure mappers plus one hook; no JSX.

## 9. Security and safety

- Names and labels are rendered as plain text, truncated; no HTML.
- The model exposes handler ids, not functions with side effects; TRAY008 owns what each id does (single place to review actions).
- No data other than counts, names and states reaches the popover.

## 10. Errors and edge cases

- More than 6 Workspaces: 'Więcej Workspace'ów…' item (PAUSE013).
- Agent name very long: ellipsis in the DS row; the mapper trims to 40 chars.
- Two Workspaces with the same name: items look identical but the ids keep them distinct; the tooltip of each item shows the display path.
- `summary.agents` empty and no pending: header idle, rows hidden, menu still lists the actions.
- Locale plural for 0: row hidden, never '0 spraw'.

## 11. Acceptance criteria

- [ ] Given the mock fixture then props equal the mock texts exactly in PL.
- [ ] Given global pause then header 'wstrzymane', tone paused and the Global Pause label 'Wznów wszystko'.
- [ ] Given pendingTotal 1, 3, 5 then PL labels use the correct plural form.
- [ ] Given an event burst then one refetch.
- [ ] Given engine error then `iconStatus` is `error` and the tooltip says so.

## 12. Test plan

- Vitest on mappers (table tests, both locales) and hook tests with fake client and `FakeEventSource`.
- i18n coverage test: every key in EN and PL.
- Commands: `pnpm --filter @overmind/desktop test features/tray/model`.

## 13. Parallelization notes

After TRAY002 (slot), TRAY004 (client), PAUSE013, SHELL024. Parallel with TRAY006 (props type is the DS contract).

## 14. Open questions and assumptions

- ASSUMPTION: PL plural 'many' for sprawa: '5 spraw czeka na Ciebie' (translator to confirm).
- OPEN: grouping by Workspace is not in the mock; flat list as drawn.
