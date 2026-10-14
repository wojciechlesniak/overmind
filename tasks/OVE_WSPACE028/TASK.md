---
id: OVE_WSPACE028
title: "Private items in this Workspace: summary and list per ADR 0028"
area: WSPACE
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_AGENT006, OVE_DS019, OVE_DS032, OVE_DS033, OVE_DS036, OVE_DS078, OVE_SHELL027, OVE_SKILL011, OVE_VIS008, OVE_WSPACE018, OVE_WSPACE027]
soft_depends_on: []
provides: []
needs: ["ui:SettingRow", "ui:ListRow", "ui:VisibilityBadge", "ui:ConfirmDialog", "ui:Skeleton", "api:visibility.impact", "api:agents.visibility", "api:skills.visibility", "api:workflows.visibility", "lib:route-builders"]
owns: ["apps/desktop/src/features/workspace-settings/components/PrivateItemsRow.tsx", "apps/desktop/src/features/workspace-settings/components/isolation-rows/private-items.row.tsx", "apps/desktop/src/features/workspace-settings/model/private-items.ts"]
reads: []
design: design.png
design_source: "Workspace#ws/isolation-private-items-row (crop 328,1626,1004,64 CSS px, tall render)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 16.3"]
adr_refs: [28, 14, 3]
---

# OVE_WSPACE028: Private items in this Workspace: summary and list per ADR 0028

## 1. Summary

Implements the 'Prywatne w tym Workspace' row and its expandable list: the Agents, Skills and Workflows that exist only in this Workspace, with the option to make an item public (blocked or confirmed per the visibility impact rules).

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock region `ws/isolation-private-items-row`: 'Prywatne w tym Workspace · Niewidoczne w innych Workspace\'ach. Zmienisz to na kafelku albo w profilu.' and the value '1 Agent · 2 Skille · 3 Workflow'. ADR 0028: private items exist only in their Workspace, only the Owner changes visibility, in an isolated Workspace everything is private and cannot be changed, making an item private is blocked while another Workspace uses it. VIS008: `GET /v1/visibility/{kind}/{id}/impact?to=public|private`; visibility change routes of the areas: `api:agents.visibility`, `api:skills.visibility` (AGENT006, SKILL), workflow visibility route (gap).

## 3. Scope (in)

- `components/PrivateItemsRow.tsx` registered in `components/isolation-rows/private-items.row.tsx`.
- `model/private-items.ts`: counts + list view-model, plural summary.
- Expandable list (`ui:ListRow` with `ui:VisibilityBadge`) and 'Make public' action with impact dialog.

## 4. Out of scope

- Changing visibility from the Agents/Skills/canvas views (their own features).
- Chief visibility proposals (VIS007, APPRUI/CHATUI).

## 5. Detailed requirements

1. Summary value (mono 12, violet `#9B7BFF`-ish per mock): `{{agents}} Agent · {{skills}} Skills · {{workflows}} Workflows` with plural keys per noun (PL: '1 Agent · 2 Skille · 3 Workflow'); `0 items` -> 'nothing private yet'. Source `usePrivateItems(workspaceId)`.
2. Row is expandable (disclosure button 'Show list', `aria-expanded`): list grouped by kind; each item: name, `VisibilityBadge` 'PRIVATE' (word + tone, outline 10px), kind label, and for non-isolated Workspaces a ghost 'Make public' button. Items link to their views via route builders (Agents/Skills/Workflows) when available.
3. Isolated Workspace (`workspace.isolated`): all items are private and the 'Make public' buttons are absent; the row help text becomes 'This Workspace is isolated: everything created here stays private.'
4. Make public: opens `ConfirmDialog`: 'Make "{{name}}" public? It will be available in all Workspaces. Its Memory stays per Workspace.' (ADR 0014/0028) and calls the area route (`PATCH visibility`) with `{ to:'public', expectedVersion }`. Making PUBLIC needs no Local Approval (visibility does not change permissions, ADR 0028), but the impact check `visibility.impact?to=public` is called first to show engine refusals (e.g. a dynamic Agent, `vis.dynamic_cannot_be_public`) before offering confirm.
5. Making private is not offered here (items listed are already private); to make a public item private the Owner uses the item's own view where `409 vis.used_elsewhere` with the usage report is shown (VIS006).
6. Counts update through `visibility.changed` and `agent.*`/`skill.*` events.
7. Loading: skeleton value; error: 'unavailable' text with Retry.

## 6. Design notes

`design.png`: the bordered list's second row: title 14/600, help 12 muted, right mono violet summary. Not in the mock: expanded list, Make public dialog, isolated variant, empty, loading, error.

## 7. Reuse

- `ui:SettingRow`, `ui:ListRow`, `ui:VisibilityBadge` (OVE_DS019), `ui:ConfirmDialog`, `ui:Skeleton`, `usePrivateItems`, route builders.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: visibility never changes permissions (ADR 0028/0003) and the UI must say so; items of an isolated Workspace are never shown outside this page. Names are untrusted text. The list is Owner-local and not sent anywhere.

## 10. Errors and edge cases

- Zero private items.
- Item used by another Workspace is not in this list by definition.
- Impact check returns `allowed:false` with reasons: shown, confirm disabled.
- Workflow list route missing: the Workflow part shows 'unavailable' and the summary omits workflows (no false zero).

## 11. Acceptance criteria

- [ ] Given 1 Agent, 2 Skills, 3 Workflows, Then the summary equals the mock value (PL).
- [ ] Given the list expanded, Then each item shows the word PRIVATE.
- [ ] Given an isolated Workspace, Then no Make-public buttons exist.
- [ ] Given the impact refusal, Then the confirm button is disabled with the reason.
- [ ] Given a public confirm, Then exactly one visibility call is made (no Local Approval).

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `private-items.test.ts` (plural, isolated, unavailable), `PrivateItemsRow.test.tsx` (expand, make public, refusal), visual of the row. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/private, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/PrivateItemsRow.tsx`, `apps/desktop/src/features/workspace-settings/components/isolation-rows/private-items.row.tsx`, `apps/desktop/src/features/workspace-settings/model/private-items.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: `api:workflows.list` and the Workflow visibility route have no owner yet.
- OPEN: whether Chief's visibility proposals are shown here; default no.
