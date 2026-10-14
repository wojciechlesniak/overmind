---
id: OVE_WFED060
title: "Show Runs pinned to older Versions while editing (running Runs keep their Version)"
area: WFED
kind: ui
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS040, OVE_WFED050, OVE_WFED059]
soft_depends_on: []
provides: ["feature:wfed-pinned-run-notice"]
needs: ["lib:wfed-data-hooks", "ui:InfoNote", "ui:RunLink"]
owns: ["apps/desktop/src/features/workflow-editor/pinned-run/**", "apps/desktop/src/locales/en/wfed-pinned.json", "apps/desktop/src/locales/pl/wfed-pinned.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED060: Show Runs pinned to older Versions while editing (running Runs keep their Version)

## 1. Summary

A small notice shown in edit mode when a Run is active on a Version other than the one being edited: 'Run #14 działa na v7. Twoje zmiany dotyczą v8 i nie zmienią tego Runu.' with a link to view v7.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). ADR 0002 consequence: a plan change during a Run needs a new Version and a new Run or a continuation from a checkpoint. The Owner must not believe that editing the canvas changes the live Run.

## 3. Scope (in)

- `PinnedRunNotice` placed above the canvas stage (slot from `OVE_WFED085`).
- Data: active non-terminal Runs and their `versionNo`.

## 4. Out of scope

- Starting a new Run from the draft (`OVE_WFED054` only dry-runs; live Run start is Chief/trigger).

## 5. Detailed requirements

1. Visible only in `draft` mode and when at least one non-terminal Run exists (every such Run is pinned to a Version older than the Draft's next Version number).
2. Text keys `wfed.pinned.one` / `wfed.pinned.many` with params `{number, versionNo}`; for many Runs show the first two and '+N'.
3. Link 'Zobacz v7' calls the version viewer (`OVE_WFED059`); link 'Run #14' navigates to Activity.
4. Dismissible per session (state in memory, reappears when a new Run starts).
5. Uses `ui:InfoNote` tone `info`, role `status`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `ui:InfoNote`, `ui:RunLink`.

## 8. Architecture and code placement

One small component and a selector in `@WF/pinned-run/`.

## 9. Security and safety

Informational only; no actions beyond navigation.

## 10. Errors and edge cases

- Run finishes while notice is visible: disappears on the next event.
- Draft base equals the Run's Version (editing the same graph the Run uses): text still says changes do not affect the Run.

## 11. Acceptance criteria

- [ ] Given Run #14 on v7 and a v8 Draft, then the notice names both.
- [ ] Given no active Run, then no notice renders.
- [ ] Given dismissal, then it stays hidden until a different Run starts.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component test and story; no e2e of its own.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- None.
