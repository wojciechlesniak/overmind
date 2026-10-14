---
id: OVE_WSPACE029
title: "Run budget row: view and edit Run budget limits"
area: WSPACE
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA011, OVE_DS026, OVE_DS030, OVE_DS036, OVE_DS040, OVE_DS078, OVE_WSPACE018, OVE_WSPACE027]
soft_depends_on: []
provides: []
needs: ["ui:SettingRow", "ui:Dialog", "ui:Field", "ui:TextField", "ui:Select", "ui:InfoNote", "api:workspaces.update"]
owns: ["apps/desktop/src/features/workspace-settings/components/BudgetRow.tsx", "apps/desktop/src/features/workspace-settings/components/BudgetDialog.tsx", "apps/desktop/src/features/workspace-settings/components/isolation-rows/budget.row.tsx", "apps/desktop/src/features/workspace-settings/model/budget.ts"]
reads: []
design: design.png
design_source: "Workspace#ws/isolation-section budget row (crop 328,1688,1004,54 CSS px, tall render)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [21]
---

# OVE_WSPACE029: Run budget row: view and edit Run budget limits

## 1. Summary

Implements the 'Budżet Runu' row ('90 min · 5 iteracji pętli') with an edit dialog for the Workspace Run budget (time and loop iterations), validating limits and showing that exceeding a Budget needs the Owner's Approval.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock region: row 'Budżet Runu' with mono value '90 min · 5 iteracji pętli'. Spec glossary: Budget = cost, time or iteration limit on a Run, Agent or Workspace; spec 12: budgets, timeouts and retries are enforced by the engine; ADR 0021: exceeding the Budget needs an Approval. DATA009: `WorkspaceBudget { maxCostUsd|null, maxTokens|null, window, onExceed:'ask_owner' }` via `PATCH /v1/workspaces/{id} {budget, expectedVersion}`. The mock's 'minutes and loop iterations' fields are NOT in `WorkspaceBudget` (gap: Run time/iteration limits are workflow/Run settings, WFRT).

## 3. Scope (in)

- `components/BudgetRow.tsx` registered at `components/isolation-rows/budget.row.tsx`.
- `BudgetDialog.tsx` with fields and validation.
- `model/budget.ts` (formatting, validation using contracts).

## 4. Out of scope

- Enforcement (PERM/WFRT), per-Agent budgets (AGUI).

## 5. Detailed requirements

1. Value text: built from the Workspace's effective Run limits `{ runMinutes, loopIterations }` (ASSUMPTION: provided by `GET /v1/workspaces/{id}` as `runLimits` or by WFRT settings; if absent the row shows the Workspace `WorkspaceBudget` summary: 'no cost limit' / '$20 per run') with word units: '90 min · 5 loop iterations'.
2. Edit: ghost 'Edit' button opens `ui:Dialog`: fields Run time limit (minutes, 1..1440, default 90), Loop iterations (1..50, default 5), optional cost limit USD (>=0, <=1,000,000, blank = none), optional token limit (int), window select (per Run / per day / per month / total). Help: 'When a Run would exceed this, Chief asks for your Approval (it never continues silently).'
3. Save: `PATCH /v1/workspaces/{id}` with `{budget, expectedVersion}` (and the Run limits route if it exists). Narrowing a budget needs no proof; RAISING limits is a widening of spend: ASSUMPTION: no Local Approval is required by the contracts (budget raise is not in the OwnerOperation table) but the dialog shows an `InfoNote` when any limit increases, and the change is audited by the engine. Flag to PERM (section 14).
4. Validation messages inline; Save disabled until valid; all numbers with word units.
5. The row is read-only text for isolated Workspaces? No: budgets are editable in any Workspace.

## 6. Design notes

`design.png`: the third row of the bordered list: label 14/600 and mono value 13 right. Not in the mock: edit dialog, empty budget, errors.

## 7. Reuse

- `ui:SettingRow`, `ui:Dialog`, `ui:Field`, `ui:TextField`, `ui:Select`, `ui:InfoNote`, `WorkspaceBudget` zod (contracts), `useVersionedMutation`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: budgets are a safety control (runaway cost); the UI never offers 'unlimited' beyond the contract bounds and surfaces increases visibly. Numbers are parsed strictly (no exponent, no negatives).

## 10. Errors and edge cases

- Empty cost field: `null`.
- Value above max: field error.
- Version conflict: refetch.
- Run limits route absent: only the cost/token part is editable and the minutes/iterations fields are hidden.

## 11. Acceptance criteria

- [ ] Given the mock values, Then the row shows '90 min · 5 iteracji pętli' in PL.
- [ ] Given invalid input, Then Save is disabled with inline errors.
- [ ] Given a raise of any limit, Then the InfoNote shows before saving.
- [ ] Given Save, Then one PATCH with `expectedVersion` is sent.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `budget.test.ts` (bounds table), `BudgetDialog.test.tsx`, visual of the row. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/budget, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/BudgetRow.tsx`, `apps/desktop/src/features/workspace-settings/components/BudgetDialog.tsx`, `apps/desktop/src/features/workspace-settings/components/isolation-rows/budget.row.tsx`, `apps/desktop/src/features/workspace-settings/model/budget.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: where Run time and loop-iteration limits live (WFRT).
- ASSUMPTION: no Local Approval for budget changes.
