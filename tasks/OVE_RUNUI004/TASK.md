---
id: OVE_RUNUI004
title: "Wire the Run header: title, state pill, Replay, Export and Cancel actions"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS017, OVE_DS040, OVE_DS045, OVE_RUNUI001, OVE_RUNUI002, OVE_WFED053]
soft_depends_on: []
provides: ["feature:runs-header"]
needs: ["ui:PageHeader", "ui:Pill", "ui:Button", "feature:wfed-run-controls", "lib:runs-data-hooks", "lib:runs-list-model", "ui:RunLink", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/header/**", "apps/desktop/src/locales/en/runs-header.json", "apps/desktop/src/locales/pl/runs-header.json"]
reads: []
design: design.png
design_source: "Activity#activity/run-header (crop 346,184,770,90)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI004: Wire the Run header: title, state pill, Replay, Export and Cancel actions

## 1. Summary

The header of the selected Run: 'Run #14 · Dostarczanie funkcji', state pill 'działa · 18 min', buttons 'Replay zdarzeń', 'Eksportuj raport' and 'Anuluj Run' (destructive tone), plus 'Otwórz na Canvas' and the pinned Version link.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Mock region `activity/run-header` (346,184,770x90): title 26px, magenta state pill (142x28), 'Replay zdarzeń' secondary at the right, second row 'Eksportuj raport' and 'Anuluj Run' (red-tinted). Cancel behaviour and confirmation are owned by the shared `useRunControls` (editor area) so both views behave identically.

## 3. Scope (in)

- `RunHeaderContainer` for the selected Run.
- Action availability by status (cancel only for non-terminal; replay for any Run with events; export always).
- Links to the Canvas (opens the Workflow page with `?run=`) and the Version viewer.

## 4. Out of scope

- Cancel dialog and logic (`feature:wfed-run-controls`).
- Replay UI (`OVE_RUNUI014`), export dialog (`OVE_RUNUI017`).

## 5. Detailed requirements

1. Title `Run #14 · Dostarczanie funkcji` (name + `v7` in a separate version badge 'v7 · przypięta'); pill by `runStateTone` with elapsed ('działa · 18 min').
2. Buttons: 'Replay zdarzeń' (secondary) toggles replay mode, label becomes 'Zakończ replay' while active; 'Eksportuj raport' (secondary) opens the export dialog; 'Anuluj Run' (danger-tinted secondary) visible when the Run is non-terminal and calls `useRunControls(runId).cancel` (confirmation dialog shared); for paused Runs also 'Wznów' via the same hook (respecting Global Pause reason).
3. Second line (muted mono): `start 14:03 · uruchomił: Chief · kanał: desktop` from `startedBy`; Telegram-started shows 'Telegram'; dry-run shows the grey 'dry-run' chip.
4. Links: 'Otwórz na Canvas' (secondary text link) -> `/workflow/:id?run=<id>`; version badge links to the Version viewer.
5. Escalated/failed Runs show the escalation banner `OVE_RUNUI018` below the header (slot).
6. Global Pause active: Cancel stays enabled, Wznów disabled with reason 'Wszystko wstrzymane'.
7. Loading skeleton; error: inline.
8. Responsive: below 760 px buttons wrap under the title.

## 6. Design notes

`design.png` shows title row and two buttons rows exactly as in the mock; 'Anuluj Run' uses the danger-tinted secondary variant (`ui:ButtonTones` danger). Other states derive from DS102 header rules: terminal Runs hide Cancel and show outcome-coloured pill ('ukończony · 21 min' mint, 'anulowany' grey, 'błąd' error, 'Eskalacja' amber).

## 7. Reuse

- `ui:PageHeader`, `ui:Button` tones, `ui:Pill`, `useRunControls` from `feature:wfed-run-controls`.

## 8. Architecture and code placement

`@RU/header/RunHeaderContainer.tsx`, `header-model.ts` (pure, unit tested).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason.

## 10. Errors and edge cases

- Run without events (cancelled before start): Replay disabled with 'Brak zdarzeń'.
- Cancel clicked on a Run that just finished: shared hook handles `409` silently.
- Long Workflow name: ellipsis with title.

## 11. Acceptance criteria

- [ ] Given the mock Run, then the header equals `design.png`.
- [ ] Given a terminal Run, then Cancel is hidden.
- [ ] Given Global Pause and a paused Run, then 'Wznów' is disabled with the reason.
- [ ] Given Cancel, then the shared confirmation dialog opens (no second implementation).
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`header-model.test.ts`, component tests with fake `useRunControls`, stories per state, axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `feature:wfed-run-controls` exports `useRunControls` and `CancelRunDialog`; RUNUI depends on it by capability.
