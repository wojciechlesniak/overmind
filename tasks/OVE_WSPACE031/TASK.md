---
id: OVE_WSPACE031
title: "Workspace settings states: loading, errors, conflicts, paused and empty"
area: WSPACE
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS032, OVE_DS036, OVE_DS040, OVE_WSPACE017, OVE_WSPACE018]
soft_depends_on: []
provides: []
needs: ["ui:Skeleton", "ui:InfoNote", "ui:ConfirmDialog", "ui:Button"]
owns: ["apps/desktop/src/features/workspace-settings/components/SectionBoundary.tsx", "apps/desktop/src/features/workspace-settings/components/SectionSkeleton.tsx", "apps/desktop/src/features/workspace-settings/components/SectionError.tsx", "apps/desktop/src/features/workspace-settings/components/ConflictNotice.tsx", "apps/desktop/src/features/workspace-settings/components/NoAccessBanner.tsx", "apps/desktop/src/features/workspace-settings/hooks/**", "apps/desktop/src/features/workspace-settings/components/boundary/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3]
---

# OVE_WSPACE031: Workspace settings states: loading, errors, conflicts, paused and empty

## 1. Summary

Implements the states the Workspace settings mock does not draw: per-section loading skeletons and errors, 'changed elsewhere' conflict handling with draft preservation, paused-Workspace banner, no-folder warning, and a dirty-state guard when leaving with an open editor.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). VIEWS lists the missing states: add-folder and remove confirmation, rule edit mode, conflict with documentation, delete dialog, save/dirty (no explicit save button), empty rule list and empty consent exceptions, nav active-on-scroll, plus the default checklist.

## 3. Scope (in)

- `components/SectionBoundary.tsx` (per-section error boundary), `SectionSkeleton.tsx`, `SectionError.tsx`.
- `components/ConflictNotice.tsx` ('Changed elsewhere').
- `components/NoAccessBanner.tsx` (no Allowed Directory yet).
- `hooks/useDirtyGuard.ts` (route-leave guard).

## 4. Out of scope

- Content of sections (their tasks).

## 5. Detailed requirements

1. Boundary: each section is wrapped (route collects `components/boundary/*.boundary.tsx` by glob, same pattern as OVE_WSPACE010). Loading: skeleton with section title + 3 skeleton rows; error: card with message mapped from `error.code`, 'Retry' and 'Details' (`code`, `requestId` only).
2. Conflict: when a mutation returns a version conflict (OVE_WSPACE018 flags `conflict`), `ConflictNotice` shows 'This was changed elsewhere (another window or Chief). Your draft is kept. Review and save again.' with buttons 'Reload' (discard draft) and 'Keep editing'. Drafts live only in component state.
3. No-access banner at the top of the main column when the policy has zero entries: `ui:InfoNote` amber 'This Workspace has no folder yet: Agents cannot read or write any files. Add a folder below.' with a button scrolling to the Directories section.
4. Paused banner: when the Workspace or Global Pause is paused: slim note 'Paused: Agents are not working. Settings can still be changed.' (no second pause UI; OVE_WSPACE017 has the control).
5. Dirty guard: any open editor (rule editor, budget dialog, host list) registers dirty state; navigating away (router blocker) or switching Workspace asks `ConfirmDialog` 'Discard unsaved changes?'; Local Approval dialogs in progress block navigation silently.
6. Engine unavailable: global `InfoNote` 'Engine not reachable. Showing the last loaded data; changes are disabled.' and all mutating controls disabled (fail closed).
7. Empty states: rule list, consent chips, docs, directories are handled in their sections; this task only provides the shared `SectionEmpty` helper used by them if present.

## 6. Design notes

Derived from kit: `ui:Skeleton`, `ui:InfoNote` (amber), `ui:Card`. No mock.

## 7. Reuse

- `ui:Skeleton`, `ui:InfoNote`, `ui:ConfirmDialog`, `ui:Button`, `renderMessage`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: when the engine is unreachable every mutating control is disabled rather than queued, so no stale widening can be replayed later.

## 10. Errors and edge cases

- Conflict while a Local Approval dialog is open: dialog result is discarded, conflict notice shown.
- Router blocker with nested dialogs: only the top-level discard prompt shows.
- Section error after partial data: stale data stays visible with an error line.

## 11. Acceptance criteria

- [ ] Given a throwing section, Then only that section shows the error and others work.
- [ ] Given a conflict, Then the draft is kept and the notice offers Reload/Keep editing.
- [ ] Given zero directories, Then the amber no-access banner shows.
- [ ] Given an open dirty editor, When navigating away, Then a discard prompt appears.
- [ ] Given the engine unreachable, Then all mutating controls are disabled.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `SectionBoundary.test.tsx`, `ConflictNotice.test.tsx`, `useDirtyGuard.test.tsx`, `NoAccessBanner.test.tsx`, stories for each. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/states, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/SectionBoundary.tsx`, `apps/desktop/src/features/workspace-settings/components/SectionSkeleton.tsx`, `apps/desktop/src/features/workspace-settings/components/SectionError.tsx`, `apps/desktop/src/features/workspace-settings/components/ConflictNotice.tsx`, `apps/desktop/src/features/workspace-settings/components/NoAccessBanner.tsx`, `apps/desktop/src/features/workspace-settings/hooks/**`, `apps/desktop/src/features/workspace-settings/components/boundary/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the route collects boundaries by glob; until this merges it renders sections bare.
