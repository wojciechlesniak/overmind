---
id: OVE_WFED051
title: "Derive the workflow header model and action availability (pure logic)"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_PAUSE001, OVE_PAUSE012, OVE_WFED050, OVE_WFRT002, OVE_WFRT006, OVE_WFRT010]
soft_depends_on: []
provides: ["lib:wfed-header-model"]
needs: ["contract:Workflow", "contract:WorkflowVersion", "contract:WorkflowRun", "contract:PauseSnapshot", "contract:ValidationReport", "lib:use-pause-guard"]
owns: ["apps/desktop/src/features/workflow-editor/header/model/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED051: Derive the workflow header model and action availability (pure logic)

## 1. Summary

A pure function that turns Workflow, Version, Draft, active Run, pause snapshot and validation state into the exact `WorkflowHeaderProps` (labels as i18n keys plus params, button states with disabled reasons). Putting the rules in one tested place keeps the header component dumb.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The mock header shows: name, private tab, 'v7 · opublikowana', 'Run #14 · działa · 18 min', buttons 'Dry-run', 'Pauza runu', 'Edytuj jako v8'. DS102 `WorkflowHeader` is props-driven (strings supplied). Draft mode shows 'v8 · wersja robocza', 'Zapisz jako v8', 'Odrzuć', 'Niezapisane zmiany'. Which button is enabled depends on mode, Run state, Global Pause and validation, and these rules must be identical for tests, Storybook and the page.

## 3. Scope (in)

- `buildHeaderModel(input): HeaderModel` and `headerActionRules`.
- Label composition helpers for version badge and Run pill (elapsed formatting rules).
- Disabled-reason keys.

## 4. Out of scope

- Rendering (`OVE_WFED052`).
- Executing actions (`OVE_WFED053`, `OVE_WFED054`, `OVE_WFED057`, `OVE_WFED058`).

## 5. Detailed requirements

1. Input: `{ workflow, publishedVersion?, draft?, activeRun?, runsCount, pause: PauseSnapshot, validation?: {errorCount, warningCount, status}, dirty: boolean, mode: 'published'|'draft'|'viewing_old', viewingVersionNo? }`.
2. Version badge: `published` -> key `wfed.header.version.published` params `{no}` ('v7 · opublikowana'); `draft` -> `wfed.header.version.draft` params `{no: latest+1}` ('v8 · wersja robocza'); `viewing_old` -> `wfed.header.version.old` ('v5 · starsza wersja, tylko do odczytu'). A Workflow never published shows `v1 · wersja robocza`.
3. Run pill: shown only when an active or most recent non-terminal Run exists, else the most recent Run if it ended in the last 10 min, else hidden. Tone by `runStateTone` (`ui:stateMaps`): running magenta, paused grey, escalated amber, succeeded mint, failed error, cancelled grey. Elapsed uses `WorkflowRun.elapsedMs` (excludes paused time): `< 60 s` -> 'N s', `< 60 min` -> 'N min', else 'H h M min'. Run number is `#<number>`.
4. Action rules table (each returns `{visible, enabled, reasonKey?}`):
   - `dryRun`: visible in published and draft; enabled unless validation has errors (reason `wfed.reason.validation_errors`), Global Pause active (`wfed.reason.global_pause`), or a dry-run is already running.
   - `pause`: visible only when `activeRun.status` is `running` or `paused` (toggles label to 'Wznów run'); disabled when Global Pause is on (reason `wfed.reason.global_pause`, because resume of a single Run during Global Pause is not allowed, PAUSE rules) or status is `cancelling`.
   - `cancel`: visible when the Run is non-terminal; always enabled except `cancelling`.
   - `edit` ('Edytuj jako vN+1'): visible in `published`; always enabled (editing is local and works during Global Pause); when a Draft already exists the label becomes 'Kontynuuj wersję roboczą vN+1'.
   - `save`/`discard`: visible in `draft`; `save` ('Zapisz jako vN+1') opens the publish dialog and is enabled whenever the Draft differs from the base Version (the dialog gates the publish itself with validation, `OVE_WFED056`); `discard` is always enabled in draft mode.
5. `unsavedChanges` pill visible when `dirty` (local unsaved edits not yet autosaved to the Draft); autosave state `saved|saving|failed` is passed through.
6. All outputs are plain data (keys + params), no React, no `t()` calls.
7. Total function: never throws on partial input (loading states map to `visible:false` actions).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `runStateTone`, `agentStateTone` from `ui:stateMaps` (OVE_DS040).
- `lib:use-pause-guard` semantics (OVE_PAUSE012) for the Global Pause reason; this task reuses its reason key naming.

## 8. Architecture and code placement

Pure TypeScript in `@WF/header/model/` (`build-header-model.ts`, `action-rules.ts`, `format-elapsed.ts`). No imports from React, ui-kit or api-client; types come from `contracts`.

## 9. Security and safety

Purely presentational logic, but it encodes safety gates: actions that start work are disabled during Global Pause and when validation fails closed (an unknown validation status disables Dry-run). The server re-checks everything.

## 10. Errors and edge cases

- Run `cancelling`: pause and cancel disabled, pill says 'anulowanie'.
- Draft exists but Workflow also has a published Version and the user is in `published` mode: 'Edytuj' becomes 'Kontynuuj wersję roboczą v8'.
- Elapsed negative or NaN: shown as '0 s'.
- Escalated Run: pill amber 'eskalacja', Pause hidden, Cancel visible.
- Run from an older Version while viewing the newest: pill still shown with its own version number in params (`runVersionNo`) so the owner is not misled.

## 11. Acceptance criteria

- [ ] Every row of the action rules table is covered by a table-driven test with expected `{visible,enabled,reasonKey}`.
- [ ] Elapsed formatting boundaries (59 s, 60 s, 59 min, 60 min) are tested.
- [ ] Given Global Pause active, then Dry-run and Pause are disabled with `wfed.reason.global_pause`.
- [ ] Given no Run, then the pill model is absent and Pause/Cancel are not visible.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`build-header-model.test.ts`, `action-rules.test.ts`, `format-elapsed.test.ts`, property test: output never contains functions. `pnpm --filter desktop vitest run src/features/workflow-editor/header/model`.

## 13. Parallelization notes

Can start against the contracts alone. Blocks `OVE_WFED052`. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: during Global Pause the Owner may still edit a draft (local, no work started) but cannot Dry-run or publish-and-run; publishing itself stays allowed (it only creates a Version).
