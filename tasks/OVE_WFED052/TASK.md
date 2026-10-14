---
id: OVE_WFED052
title: "Wire WorkflowHeader into the page: name, visibility tab, version badge, Run pill, actions"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS017, OVE_DS019, OVE_DS102, OVE_WFED050, OVE_WFED051]
soft_depends_on: []
provides: ["feature:wfed-header"]
needs: ["ui:WorkflowHeader", "ui:VersionBadge", "ui:NodeTab", "ui:Pill", "ui:Button", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/header/WorkflowHeaderContainer.tsx", "apps/desktop/src/features/workflow-editor/header/index.ts", "apps/desktop/src/locales/en/wfed-header.json", "apps/desktop/src/locales/pl/wfed-header.json"]
reads: []
design: design.png
design_source: "Main#canvas/workflow-header (crop 330,178,802,95)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED052: Wire WorkflowHeader into the page: name, visibility tab, version badge, Run pill, actions

## 1. Summary

The container that feeds `ui:WorkflowHeader` from the header model and the data hooks, and emits action intents (dry-run, pause, edit, save, discard, open version list, open Run in Activity). It adds the Workflow rename and the visibility word.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). Mock region `canvas/workflow-header` (330,178,802,90): title 'Dostarczanie funkcji' (26px/700), filled PRYWATNY tab, 'v7 · opublikowana' badge, magenta Run pill 'Run #14 · działa · 18 min', 'Dry-run' secondary button, second row 'Pauza runu' and violet 'Edytuj jako v8'. The component is DS102; here it is wired.

## 3. Scope (in)

- `WorkflowHeaderContainer` using `useWorkflow`, `useActiveRun`, draft and pause state -> `buildHeaderModel` -> `<WorkflowHeader>`.
- Inline rename (edit mode only) with validation (1-80 chars, unique per Workspace) calling the Workflow update route.
- Version badge opens the version list popover (`OVE_WFED059`).
- Run pill click navigates to Activity with the Run selected (`lib:app-navigation`).
- i18n namespace `wfed-header` (EN + PL).

## 4. Out of scope

- Executing run controls (`OVE_WFED053`), dry-run (`OVE_WFED054`), publish (`OVE_WFED057`), edit-as-new (`OVE_WFED058`): the container only calls the intent handlers they export through `useHeaderIntents()` registration (see requirement 6).
- Visibility change of a Workflow (VIS flows live in the Workflow settings of WSPACE; the header only displays it).

## 5. Detailed requirements

1. Render `WorkflowHeader` with props from the model; never compute labels in the container.
2. Strings: `t('wfed-header:...')`; Polish copy exactly: 'PRYWATNY'/'PUBLICZNY', 'v7 · opublikowana', 'Run #14 · działa · 18 min', 'Dry-run', 'Pauza runu', 'Wznów run', 'Edytuj jako v8', 'Zapisz jako v8', 'Odrzuć', 'Niezapisane zmiany', 'Wszystko wstrzymane' (disabled reason, reuse PAUSE copy).
3. Rename: double-click or Enter on the title in edit mode turns it into `ui:TextField`; Enter commits, Esc cancels; server error `wfrt.workflow_name_taken` shows an inline error 'Ta nazwa jest już używana w tym Workspace'.
4. The visibility tab is read-only text 'PRYWATNY' / 'PUBLICZNY' with `title` explaining 'tylko w tym Workspace' / 'we wszystkich Workspace'ach' (never colour alone).
5. Intents are exposed through a small registry `header-intents.ts` (`registerHeaderIntent(kind, handler)`) so `OVE_WFED053`, `OVE_WFED054`, `OVE_WFED057`, `OVE_WFED058` plug in without editing this file (OCP). A click on an action without a registered handler is a no-op that logs a dev warning.
6. Disabled buttons expose their reason through `aria-describedby` text and a tooltip.
7. Loading: skeleton for title and badges (`ui:Skeleton`); error: header shows the Workflow name from cache if present plus an inline retry.
8. Responsive: below 700 px the second row wraps under the title; the Run pill never truncates (it ellipsizes inside with `title`).

## 6. Design notes

`design.png` shows the header row exactly as in the mock at 802x95. Tokens: title 26/700/-0.52, NodeTab filled violet for private (`#9B7BFF`) or blue for public (`#6FA8FF`), mono 10/700 +0.1em; version badge mono 12 on `line`; Run pill magenta tint with dot. States NOT in the mock: draft mode (violet badge 'v8 · wersja robocza', 'Zapisz jako v8' primary + 'Odrzuć' ghost + amber 'Niezapisane zmiany' pill), viewing old version (grey badge, all edit actions hidden), Run finished (mint pill 'Run #14 · ukończony · 21 min'), Run escalated (amber), Global Pause (buttons disabled with reason), loading skeleton, error retry. Derive them from DS102 variants.

## 7. Reuse

- `ui:WorkflowHeader` (OVE_DS102), `ui:Skeleton`, `ui:TextField`, `ui:Tooltip`.
- `OVE_WFED051` model, `OVE_WFED050` hooks, `lib:app-navigation` for the Run link.

## 8. Architecture and code placement

UI layer: `@WF/header/WorkflowHeaderContainer.tsx`, `header-intents.ts`, `RenameTitle.tsx`. Depends on ui-kit, the data hooks and the model; no gateway calls except through hooks.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. The Workflow name is user text: rendered as text only, max 80 chars, trimmed, control characters stripped before send.

## 10. Errors and edge cases

- Rename while another editor changed the name: server returns conflict, show current name and keep input.
- Name with only spaces: rejected client-side.
- Run pill for a Run of another Version: shows its own `vN`.
- Workflow archived: header shows an 'zarchiwizowany' badge and disables all actions.

## 11. Acceptance criteria

- [ ] Given the mock data (v7 published, Run #14 running 18 min), the rendered header matches `design.png`.
- [ ] Given draft mode, then 'Zapisz jako v8', 'Odrzuć' and the unsaved pill are shown and 'Edytuj jako v8' is not.
- [ ] Given Global Pause, then Dry-run and Pauza runu are disabled with the reason announced to screen readers.
- [ ] Given a rename conflict, then the inline error is shown and the title does not change.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component tests (Testing Library) with fixtures per mode; Storybook stories `Published`, `Draft`, `OldVersion`, `RunFinished`, `GlobalPause`, `Loading`, `Error`; axe; visual crop test against `design.png`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: rename is allowed only in edit mode (draft) because a rename of a published Workflow is a metadata change without a new Version; server route `api:workflows.update` is assumed provided by WFRT (name only, no Version bump).
