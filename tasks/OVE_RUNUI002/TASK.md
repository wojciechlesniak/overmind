---
id: OVE_RUNUI002
title: "Derive Run list items: labels, state mapping, sorting and grouping (pure logic)"
area: RUNUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS040, OVE_RUNUI001, OVE_WFRT006]
soft_depends_on: []
provides: ["lib:runs-list-model"]
needs: ["contract:WorkflowRun", "ui:stateMaps", "ui:UiDomainTypes"]
owns: ["apps/desktop/src/features/runs/list/model/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI002: Derive Run list items: labels, state mapping, sorting and grouping (pure logic)

## 1. Summary

Pure mapping from `WorkflowRun` summaries to `RunListItemProps` for the left Runs panel: number, state word, title ('Dostarczanie funkcji v7'), meta line ('18 min · iteracja 2', 'ukończony wczoraj', 'Ty · zmiana zakresu', 'limit 5 iteracji'), tone and ordering.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Mock list: '#14 działa — Dostarczanie funkcji v7 — 18 min · iteracja 2', '#13 ukończony — collect · zgłoszenia — 6 min · 4 Zadania', '#12 anulowany — Dostarczanie funkcji v6 — Ty · zmiana zakresu', '#9 Eskalacja — Strona fundacji · board — limit 5 iteracji'. The meta line depends on the outcome: running shows elapsed and iteration, done shows duration and a result count, cancelled shows who/why, escalated shows the reason.

## 3. Scope (in)

- `toRunListItem(run, labels)` and `sortRuns`.
- State -> label/tone mapping (`runStateTone`).
- Meta line rules per outcome.
- Day grouping helper ('dziś', 'wczoraj', date).

## 4. Out of scope

- Rendering (`OVE_RUNUI003`).

## 5. Detailed requirements

1. `RunState` words (PL keys `runs.state.*`): running 'działa', paused 'wstrzymany', escalated 'Eskalacja', cancelling 'anulowanie', succeeded 'ukończony', failed 'błąd', cancelled 'anulowany', created 'w kolejce'.
2. Title: `<workflow name> v<versionNo>`; dry-run adds the prefix 'dry-run · '.
3. Meta by status: running/paused -> `<elapsed> · iteracja <n>` (iteration from the Run summary `currentIteration` when inside a Loop, else omitted); succeeded -> `<duration> · <k> Zadania` when Tasks were created (from the Run summary `tasksCreated`) else just duration; failed -> `błąd: <failure code word>`; cancelled -> `<by word> · <reason>` where by is 'Ty' (owner), 'Chief', 'limit'; reason from `cancelReason` (bounded 40 chars, plain text), omitted if missing; escalated -> `limit 5 iteracji` or the escalation kind word ('limit kosztu', 'brak zgody').
4. Duration formatting shared with the editor header: `< 60 s` 'N s', `< 60 min` 'N min', else 'H h M min'; finished Runs older than 24 h show 'ukończony 12.10' (date) instead of relative text; yesterday -> 'ukończony wczoraj'.
5. Sorting: running/paused/escalated first (newest first inside), then others by `createdAt` desc; stable.
6. `numberLabel`: `#14` (Run number is per Workflow; when the list mixes Workflows the label becomes `collect #13` — the list in MVP shows one Workspace with several Workflows, so the Workflow name is part of the title; the number remains `#<n>`).
7. Unknown state: neutral tone with the raw state word.
8. Outputs are plain data with i18n keys + params; no React.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `runStateTone` (DS040), duration formatter from `OVE_WFED051` (`format-elapsed.ts`; if WFED is not merged this task implements `@RU/list/model/format-duration.ts` and WFED switches to it via the linker: single implementation exported from `apps/desktop/src/shared/format`).

## 8. Architecture and code placement

Pure TypeScript in `@RU/list/model/`; no React/api-client imports.

## 9. Security and safety

Display-only mapping; cancel reasons are Owner/Chief text rendered as plain text, truncated.

## 10. Errors and edge cases

- Run with no `endedAt` and terminal status: duration from `elapsedMs`.
- Missing iteration info: omitted.
- Very long Workflow name: UI ellipsis (title attr), the model passes the full string.
- Clock skew (future createdAt): treated as 'teraz'.

## 11. Acceptance criteria

- [ ] Each mock row maps to the exact mock copy (table test).
- [ ] Sorting puts running/escalated first, then by time.
- [ ] Unknown state maps to neutral tone.
- [ ] Day grouping boundaries (midnight) tested with fixed clock.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`to-run-list-item.test.ts`, `sort-runs.test.ts`, `format-duration.test.ts`. `pnpm --filter desktop vitest run src/features/runs/list/model`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: Run summary includes `currentIteration`, `tasksCreated`, `cancelReason`, `cancelledBy` (WFRT048 `RunSummary` may need these additive fields; flagged).
