---
id: OVE_WSPACE005
title: "Workspace card grid wiring: working, done and idle cards with progress and agents"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS016, OVE_DS059, OVE_WSPACE001, OVE_WSPACE002, OVE_WSPACE003]
soft_depends_on: ["OVE_DS059"]
provides: ["ui:WorkspaceCardItem"]
needs: ["ui:WorkspaceCard", "ui:WorkspaceGrid", "ui:AvatarStack", "lib:ws-dashboard-slots"]
owns: ["apps/desktop/src/features/workspaces/components/slots/Grid.slot.tsx", "apps/desktop/src/features/workspaces/components/WorkspaceCardItem.tsx", "apps/desktop/src/features/workspaces/components/card-variants.ts"]
reads: []
design: design.png
design_source: "Pulpit#dash/workspace-grid top row (crop 88,272,1016,275 CSS px)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 12"]
adr_refs: [28]
---

# OVE_WSPACE005: Workspace card grid wiring: working, done and idle cards with progress and agents

## 1. Summary

Renders the Workspace grid: one `ui:WorkspaceCard` per Workspace from the view-model with name, path, Chief one-liner, segmented progress bar, counts caption, approvals pill, agent avatar stack and Run line, for the working, done and idle states.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Mock regions: `dash/workspace-grid` (100,284,992x511), `dash/workspace-card-active` (working, magenta border + glow, '3 Zgody czekają', 'Run #14 · pętla jakości 2 z 5'), `dash/workspace-card-running` ('Strona fundacji', done-ish, 'Run #13 · board'). Paused and isolated variants are OVE_WSPACE006; click behaviour is OVE_WSPACE007.

## 3. Scope (in)

- `components/slots/Grid.slot.tsx` (slot id `grid`): `ui:WorkspaceGrid` with `WorkspaceCard` items.
- `components/WorkspaceCardItem.tsx`: maps one `WorkspaceCardVm` to `WorkspaceCardProps` (labels from `t()`), memoised.
- Card `labels`, plural captions and aria summaries in the namespace (`card.*`).
- Grid `aria-label` and live count.

## 4. Out of scope

- Paused and isolated visual treatment and data (OVE_WSPACE006).
- Navigation on click (OVE_WSPACE007).
- Empty, loading, error states of the whole grid (OVE_WSPACE010).

## 5. Detailed requirements

1. `WorkspaceCardItem` passes to `ui:WorkspaceCard`: `name`, `path`, `summary`, `state` (`working|done|idle` here), `approvals={{count,label}}`, `lanes`, `countsCaption` (`t('card.counts',{...})`), `agents` (max 4 + `+N` is the component's job, pass all), `runLabel`, `idleLabel`, `labels={{isolated, lanes}}`. No colour, radius or spacing is set in this task (all in ui-kit).
2. Counts: `lanes` from `WorkspaceProgress.segments`; the component draws `flex: N` segments, so this task passes raw counts only (no ratios, no widths).
3. Agents: `AvatarStackItem = { id, initials, hue, status:'working'|'idle', label: agent name }`; order: working first, then by name; hue and initials from the Agent summary (AGENT contract `avatarInitials`, `avatarColorToken`). Agents of other Workspaces never appear (the query is Workspace-scoped; test).
4. Approvals pill text: `t('card.approvals',{count})` plural; the card's accessible name (component builds it) is name + state word + approvals, supplied via `labels` (`card.aria` with params `{name,state,approvals}`).
5. State word is always text (design rule: state is never colour only): `working` 'working', `done` 'done', `idle` 'idle', `paused` 'paused' (keys `card.state.*`), used in the aria label and in the run line fallback when no `runLabel` exists.
6. Grid: `minCardWidth` default 380, `aria-label` `t('grid.label')` ('Workspaces'), `<ul>` semantics come from the ui-kit grid.
7. Re-render budget: with 50 cards a single event (progress of one Workspace) re-renders only that card (`React.memo` with a structural equality on the vm slice; test with a render counter).
8. Order exactly as OVE_WSPACE001 returns; no re-sorting in the component.
9. Cards are plain links/buttons; the component receives `href` from the vm (route builder `routes.workspace(id)`), see OVE_WSPACE007 for the behaviour.

## 6. Design notes

`design.png` (top row) shows working card: magenta 1px border (45%), `glow-card-working`, amber pill '3 Zgody czekają', progress `4 do zrobienia · 5 w toku · 1 review · 7 gotowe z 17`, avatars, mono run line; and the 'done' card with mint dot. Inventory E14: the mock's avatars collapse; the kit adds the 2px ring and overlap, do not replicate the mock bug. States not in the mock: hover/focus (kit), card skeleton (OVE_WSPACE010), 1 and 10 Workspaces, very long name (ellipsis in kit), zero Tasks.

## 7. Reuse

- `ui:WorkspaceGrid`, `ui:WorkspaceCard`, `ui:AvatarStack` (inside the card)  from OVE_DS059.
- View-model and card-state rules of OVE_WSPACE001; hook of OVE_WSPACE002.
- `useT('workspaces')`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: Workspace names/paths/summaries are untrusted text; a path shown is the display form from the engine, never a value typed by an Agent. An isolated Workspace card never reveals its summary to other surfaces (this slot only reads what the Owner may see locally).

## 10. Errors and edge cases

- Name that looks like markup (`<b>x</b>`): rendered literally.
- Path missing: `card.noFolder` text.
- Agents list empty: footer shows run text only.
- `runLabel` and `idleLabel` both null: footer shows the state word.
- Progress route failed for one Workspace: caption `card.progressUnavailable` and an empty track, other cards unaffected.
- 200 agents in a Workspace: only the first 12 are passed (stack shows 4 + '+N' with N from the full count param).

## 11. Acceptance criteria

- [ ] Given the working and done fixtures, Then the rendered grid matches `design.png` within tolerance (borders, glow, dots, caption, pill).
- [ ] Given counts 4/5/1/7, Then the card receives `lanes` 4/5/1/7 and the caption string from the mock (PL).
- [ ] Given one progress event, Then only that card re-renders.
- [ ] Given a name with markup, Then it is shown as text.
- [ ] Keyboard: each card is one tab stop with a visible ring; its accessible name contains name, state and approvals.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `WorkspaceCardItem.test.tsx` (props mapping, labels, plural), `Grid.slot.test.tsx` (order, aria-label, memo render count), stories `Grid/Working`, `Grid/Done`, `Grid/Many` (50), visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test components/slots/Grid`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/components/slots/Grid.slot.tsx`, `apps/desktop/src/features/workspaces/components/WorkspaceCardItem.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. OVE_WSPACE006 extends the card item through a documented optional field of the vm (no edit of this file): it supplies `components/card-variants.ts` consumed here via a registry (OCP). Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the `card-variants` registry file is created by this task as an empty typed registry `CARD_VARIANTS: Record<string,(vm)=>Partial<WorkspaceCardProps>>` and OVE_WSPACE006 registers its overrides in a separate file `components/variants/*.variant.ts` collected by glob, so neither task edits the other's files.
- OPEN: 'done' wording in PL 'gotowy'.
