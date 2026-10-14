---
id: OVE_WSPACE006
title: Paused and isolated Workspace card variants including Global Pause
area: WSPACE
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS059, OVE_PAUSE007, OVE_PAUSE014, OVE_WSPACE005]
soft_depends_on: ["OVE_PAUSE014"]
provides: []
needs: ["ui:WorkspaceCard", "lib:use-workspace-pause", "api:pause.state"]
owns: ["apps/desktop/src/features/workspaces/components/variants/**"]
reads: []
design: design.png
design_source: "Pulpit#dash/workspace-card-paused + workspace-card-isolated (crop 88,536,1016,270 CSS px)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 12"]
adr_refs: [28, 5]
---

# OVE_WSPACE006: Paused and isolated Workspace card variants including Global Pause

## 1. Summary

Adds the data and presentation rules for the paused card ('wstrzymany przez Ciebie', 'nikt nie pracuje'), the isolated card (lock pill 'izolowany', explanation line, 'bez aktywnego Runu') and the card state while Global Pause is active, using `lib:use-workspace-pause` and the card variants registry.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Mock regions `dash/workspace-card-paused` ('Research rynku': grey dot, summary kept 'Raport konkurencji w połowie. Czeka, aż wznowisz.', 'nikt nie pracuje', 'wstrzymany przez Ciebie') and `dash/workspace-card-isolated` ('Projekt klienta (NDA)': 'izolowany' pill, 'Nic nie wychodzi poza ten Workspace, Chief nie przeszukuje jego Decyzji.', 'bez aktywnego Runu'). Pause data comes from PAUSE014; ADR 0028: in an isolated Workspace everything is private and cannot be changed.

## 3. Scope (in)

- `components/variants/paused.variant.ts` and `isolated.variant.ts` registered in `CARD_VARIANTS` (OVE_WSPACE005).
- Global Pause rendering: every card `paused` with `pausedGlobal` text.
- A resume affordance on the paused card? NO: resume lives on the Workspace settings and tray (see out of scope).
- Lock pill label, isolation note and `bez aktywnego Runu` strings.

## 4. Out of scope

- Pause/resume controls on the card (`useWorkspacePause` is used by Workspace settings OVE_WSPACE017 and the tray, not the card).
- Global Pause banner in the top bar (OVE_PAUSE011).

## 5. Detailed requirements

1. Paused variant: `state='paused'` (grey dot, no glow), `pausedLabel = t('card.pausedByYou')` ('paused by you' / PL 'wstrzymany przez Ciebie'), `idleLabel = t('card.nobodyWorking')` ('nobody is working' / 'nikt nie pracuje'); the Chief summary sentence is unchanged (the engine already says 'waiting for you to resume'). Counts and bar unchanged.
2. Global Pause: for every card `state='paused'`, `pausedLabel = t('card.pausedGlobal')` ('paused (Global Pause)' / 'wstrzymane (Global Pause)'); individual-pause label is replaced, not combined; when both apply, global wins.
3. Isolated variant: `isolated=true`, `labels.isolated = t('card.isolated')` ('isolated'), `isolatedNote = t('card.isolatedNote')`, `idleLabel = t('card.noActiveRun')` when no Run; a running Run still shows its run line. The lock pill and the WORD 'izolowany' are always present (state never colour only, ADR 0028). Isolated + paused combine (paused label + lock pill).
4. Isolated Workspace summary: the note replaces any summary text (OVE_WSPACE001 requirement 5); the engine does not provide a Chief summary for it.
5. Mapping uses `selectCardPauseProps(snapshot, workspaceId)` of OVE_PAUSE014 verbatim (its output `{state?, pausedLabel?, idleLabel?}` are KEYS not text; this task translates them) so pause logic exists once.
6. The card for a Workspace whose pause call is in flight shows the previous state (no optimistic flip on the dashboard; pause is initiated elsewhere); the push event updates it.
7. Accessibility: the aria name includes 'paused' / 'isolated' words; the lock icon is decorative (`aria-hidden`).

## 6. Design notes

`design.png` bottom row: paused card (grey dot, 'Run' replaced by 'nikt nie pracuje' + 'wstrzymany przez Ciebie'), isolated card (lavender lock pill with 'izolowany', extra 12px line, 'bez aktywnego Runu'). Not in the mock: Global Pause on every card (use the paused variant with the global label), paused + isolated, hover/focus.

## 7. Reuse

- `ui:WorkspaceCard` `paused`/`isolated` props (OVE_DS059).
- `selectCardPauseProps` / `useWorkspacePause` (OVE_PAUSE014).
- Registry of OVE_WSPACE005.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: an isolated Workspace card must never be rendered in any list that Chief or another Workspace's context reads (this dashboard is the Owner's local view; the card exposes nothing new). Paused state is displayed fail-safe: when pause data is unavailable, the card shows no 'running' claim beyond Agent-state evidence and the section is marked stale.

## 10. Errors and edge cases

- Pause snapshot missing: cards are derived from workspace.paused only and the header shows the stale marker.
- Workspace paused AND running Run (drain in progress): paused wins; the run line shows 'finishing current step' from `drain` (`card.draining`).
- Isolated flag toggled while the page is open: push event updates the card, no reload.
- Very long isolation note: 3-line clamp.

## 11. Acceptance criteria

- [ ] Given the paused and isolated fixtures, Then both match `design.png` within tolerance.
- [ ] Given Global Pause active, Then all cards show the global label and a grey dot.
- [ ] Given paused + isolated, Then both the lock pill and the paused label are present.
- [ ] Given pause snapshot error, Then no card claims 'working' without Agent-state evidence.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `paused.variant.test.ts`, `isolated.variant.test.ts` (matrix paused x isolated x global x running), story `Grid/Paused|Isolated|GlobalPause|PausedIsolated`, visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test components/variants`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/components/variants/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: draining text uses `pause.drain` from the snapshot (PAUSE001).
