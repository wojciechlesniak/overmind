---
id: OVE_WFED053
title: "Implement Pause, Resume and Cancel Run controls with confirmation and Global Pause rules"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS036, OVE_DS037, OVE_PAUSE010, OVE_PAUSE012, OVE_WFED050, OVE_WFED052, OVE_WFRT052]
soft_depends_on: []
provides: ["feature:wfed-run-controls"]
needs: ["api:runs.pause", "api:runs.resume", "api:runs.cancel", "lib:use-pause", "lib:use-pause-guard", "ui:ConfirmDialog", "ui:useToast", "lib:wfed-data-hooks"]
owns: ["apps/desktop/src/features/workflow-editor/run-controls/**", "apps/desktop/src/locales/en/wfed-run.json", "apps/desktop/src/locales/pl/wfed-run.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [2, 19, 28]
---

# OVE_WFED053: Implement Pause, Resume and Cancel Run controls with confirmation and Global Pause rules

## 1. Summary

Intent handlers for 'Pauza runu' / 'Wznów run' and 'Anuluj Run' used by the workflow header and by Activity. Pause is immediate and reversible, Cancel needs a confirmation that explains what happens to running Agents and non-idempotent actions.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). SPEC 7: checkpoint, resume, pause, cancel. SPEC 16 criterion 14: pause, cancel, limits are enforced by the engine. Cancelling is final: running Nodes get a cancel request, Agent turns are stopped, non-idempotent actions in flight are marked ambiguous (WFRT action ledger) and are never blindly repeated. Global Pause (PAUSE area) blocks resuming single Runs.

## 3. Scope (in)

- `useRunControls(runId)` returning `{pause, resume, cancel, state}`; shared with `OVE_RUNUI004` (Activity).
- Cancel confirmation dialog with consequence text and the count of running Nodes.
- Optimistic status 'cancelling' until `run.cancelled` arrives.
- Toasts and error mapping for `wfrt.run_paused`, `wfrt.run_already_terminal`, `wfrt.run_not_active`.

## 4. Out of scope

- Header rendering (`OVE_WFED052`).
- Engine behaviour of pause/cancel (WFRT).
- Global Pause controls (PAUSE010).

## 5. Detailed requirements

1. `pause(runId)` calls `api:runs.pause` with an idempotency key; success shows no toast (the pill changes), failure toast with the mapped message.
2. `resume(runId)`: if Global Pause is active (from `lib:use-pause`), the handler does not call the gateway and shows the reason 'Wszystko wstrzymane. Wznów najpierw Global Pause.' (`wfed.run.resume_blocked_global`). If the Run is paused for `chief_discussion` or `escalation` reasons (`pauseReasons[]`), Resume is hidden and the pill links to the Approval/Discussion that holds it.
3. Cancel dialog (`ConfirmDialog`, destructive tone): title 'Anulować Run #14?', body 'Agenci przestaną pracować. Wykonane zmiany w worktree zostają. Akcje, których nie da się bezpiecznie powtórzyć, zostaną oznaczone jako niepewne.', list '2 Węzły pracują, 1 czeka na Zgodę' (counts from `NodeExecution` data), buttons 'Anuluj Run' (danger) and 'Wróć'. Default focus on 'Wróć'.
4. While the request is in flight both buttons are disabled; on `409 wfrt.run_already_terminal` the dialog closes and the pill refreshes without an error toast.
5. After `run.cancel_requested` the pill shows 'anulowanie…' (status `cancelling`) until `run.cancelled`.
6. `useRunControls` MUST be the only place in the app that calls pause/resume/cancel; Activity reuses it (DRY).
7. Registers handlers on the header intent registry (`registerHeaderIntent('pause'|'resume'|'cancel')`).
8. Keyboard: dialog traps focus, Esc cancels the dialog (not the Run).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `ui:ConfirmDialog`, `ui:useToast`, `lib:use-pause`, `lib:use-pause-guard`, `lib:wfed-data-hooks`.

## 8. Architecture and code placement

`@WF/run-controls/use-run-controls.ts`, `CancelRunDialog.tsx`, `register.ts`. Exported to Activity through the barrel `@WF/run-controls` and consumed as capability `feature:wfed-run-controls` (RUNUI depends on it; shared hook, not duplicated).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Cancel and pause are state-changing and audited by the engine (`ENGINE016`); the UI never sends a `principal` or channel field. The dialog text never includes Agent output. Double clicks cannot double-cancel (idempotency key per dialog open).

## 10. Errors and edge cases

- Run finishes while the dialog is open: dialog shows 'Run już zakończony' and closes on confirm.
- Resume while the engine is shutting down: error toast 'Silnik się zatrzymuje'.
- Cancel requested but engine crashes: after restart the Run recovers in `cancelling` (WFRT) and the pill follows the events.
- Pause of a Run waiting for Approval: allowed; Approval stays open.

## 11. Acceptance criteria

- [ ] Given Global Pause, when the Owner clicks Wznów run, then no gateway call is made and the reason is shown.
- [ ] Given a running Run, when the Owner confirms Anuluj Run, then exactly one `api:runs.cancel` call with an idempotency key is made and the pill shows 'anulowanie…'.
- [ ] Given `409 wfrt.run_already_terminal`, then no error toast appears.
- [ ] Given pauseReason `escalation`, then Resume is not offered.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Hook tests with the fake gateway; component tests for the dialog (focus, default button, counts); e2e step in `OVE_WFED089`. `pnpm --filter desktop vitest run src/features/workflow-editor/run-controls`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: cancelling a Run does not delete worktrees or branches (never auto-deleted, SPEC 13).
