---
id: OVE_WSPACE007
title: "Open a Workspace from its card: current Workspace switch and navigation"
area: WSPACE
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS037, OVE_SHELL011, OVE_WSPACE005]
soft_depends_on: []
provides: []
needs: ["lib:current-workspace", "ui:useToast"]
owns: ["apps/desktop/src/features/workspaces/components/useOpenWorkspace.ts", "apps/desktop/src/features/workspaces/model/open-workspace.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23]
---

# OVE_WSPACE007: Open a Workspace from its card: current Workspace switch and navigation

## 1. Summary

Defines what a click on a Workspace card does: select that Workspace as the current one and navigate to its Chief chat, with keyboard support and a safe behaviour for deleted or isolated Workspaces.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). ADR 0023: the Owner talks to Chief; the top bar Workspace switcher (SHELL) holds the current Workspace. The card is one link (`ui:WorkspaceCard` rule), so this task supplies the click handler and href only.

## 3. Scope (in)

- `model/open-workspace.ts` (pure: target route for a Workspace).
- `components/useOpenWorkspace.ts` hook calling `lib:current-workspace` setter then navigating.
- Middle/modifier click support (`href` real link), Enter/Space activation by the card.

## 4. Out of scope

- The Workspace switcher itself and current-Workspace storage (SHELL, capability `lib:current-workspace`).
- Chief chat (CHATUI).

## 5. Detailed requirements

1. Target route: `routes.chief({ workspaceId })` ('/chief?ws=<id>' or the SHELL convention); default the Chief chat of that Workspace. OPEN: question about opening Workspace settings instead; default Chief chat (see COMPONENT-INVENTORY DS059 open question).
2. On activation: call `setCurrentWorkspace(id)` (capability `lib:current-workspace`, returns synchronously after updating the store) and then `navigate(target)`. If `setCurrentWorkspace` fails (deleted Workspace), show a toast `workspaces:open.gone` ('This Workspace no longer exists') and refetch the list.
3. The `href` on the card is the same route so Cmd-click opens it consistently; a plain click is intercepted to run the setter first (progressive enhancement).
4. Isolated Workspace: opening it is allowed (the Owner is local); the shell then shows the isolated indicator (SHELL). Nothing is copied into other Workspace contexts.
5. Paused Workspace: opening is allowed; the chat composers are guarded by `lib:use-pause-guard` (OVE_PAUSE012), not here.
6. Analytics: none (no telemetry, ADR 0010).
7. Keyboard: Enter on the focused card activates; Space does not scroll the page (kit handles).

## 6. Design notes

N/A, functionality only (behaviour of the card from OVE_WSPACE005).

## 7. Reuse

- `lib:current-workspace` (SHELL), router `navigate` (SHELL), `useToast` (OVE_DS037).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: the id in the route comes from the loaded list; a forged id in the URL is validated by the engine (404 -> redirect to the dashboard with a toast). Switching the current Workspace never changes permissions (Effective Permissions are per Run).

## 10. Errors and edge cases

- Workspace deleted in another window/event: toast + list refetch, no navigation.
- Rapid double click: second activation ignored while navigating.
- `lib:current-workspace` not yet available (SHELL not merged): the hook falls back to navigation only (feature flag in tests).

## 11. Acceptance criteria

- [ ] Given a card click, Then the current Workspace is set before navigation and the Chief route opens.
- [ ] Given Cmd-click, Then the browser-level new-tab/window behaviour uses the same href.
- [ ] Given a deleted Workspace, Then a toast shows and no navigation happens.
- [ ] Given Enter on a focused card, Then it activates.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `useOpenWorkspace.test.tsx` (order of calls, failure toast, double activation), Playwright `open-workspace.e2e.ts` against the mock gateway. Commands: `pnpm --filter @overmind/desktop test components/useOpenWorkspace`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/components/useOpenWorkspace.ts`, `apps/desktop/src/features/workspaces/model/open-workspace.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: default target is the Chief chat.
