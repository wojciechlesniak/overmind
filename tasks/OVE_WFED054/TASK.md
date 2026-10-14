---
id: OVE_WFED054
title: "Implement Dry-run: input dialog, dry-run Run start and the dry-run mode banner"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS026, OVE_DS036, OVE_WFED050, OVE_WFED052, OVE_WFRT004, OVE_WFRT006, OVE_WFRT010, OVE_WFRT052]
soft_depends_on: []
provides: ["feature:wfed-dry-run"]
needs: ["api:runs.start", "contract:WorkflowRun", "contract:PortSchema", "lib:port-schema-validator", "ui:Dialog", "ui:Field", "ui:Textarea", "lib:wfed-data-hooks", "lib:workflow-validator"]
owns: ["apps/desktop/src/features/workflow-editor/dry-run/**", "apps/desktop/src/locales/en/wfed-dryrun.json", "apps/desktop/src/locales/pl/wfed-dryrun.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED054: Implement Dry-run: input dialog, dry-run Run start and the dry-run mode banner

## 1. Summary

The 'Dry-run' button flow: validate, ask for Run input (from the Workflow `inputSchema`) and optional branch choices, start a Run with `mode: 'dry_run'`, and show a persistent 'DRY-RUN' banner while the canvas animates it. A dry-run never calls Agents, tools or the network.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). SPEC 7 lists dry-run next to trace and replay. WFRT044 defines the semantics: Agent nodes return deterministic example data, IF nodes evaluate on example data or take the declared `dryRunBranch`, no actions with side effects run. A dry-run still pins a Version and writes events, so it appears in the Run list with a 'dry-run' label.

## 3. Scope (in)

- Dry-run dialog with input form generated from `inputSchema` (JSON editor fallback).
- Branch override list for IF nodes that cannot be decided from example data (`dryRunBranches: Record<nodeKey,'then'|'else'>`).
- Start call, navigation of focus to the new Run on the canvas overlay, banner component.
- Which Version runs: the published Version (published mode) or the saved Draft (draft mode, the draft is saved and validated first, run is pinned to a temporary draft-snapshot Version marked `ephemeral`).

## 4. Out of scope

- Run overlay rendering (`OVE_WFED082`).
- Dry-run semantics in the engine (WFRT044).
- Live Runs (started by Chief or triggers).

## 5. Detailed requirements

1. Pre-check with `useValidateDefinition`: errors block the dialog's Start button with the first three issue messages and a 'Pokaż błędy' link that focuses the validation panel (`OVE_WFED062`).
2. Input form: `inputSchema` primitives map to `ui:Field` + `ui:TextField`/`Checkbox`/`Select` (enum); objects/arrays beyond depth 2 fall back to a JSON `ui:Textarea` validated by `lib:port-schema-validator` before enabling Start. Default values are example values from the schema.
3. Dialog copy (PL): title 'Dry-run bez wywołań Agentów', helper 'Nic nie zostanie zapisane w repozytorium ani wysłane. Węzły Agentów zwrócą przykładowe dane.', buttons 'Uruchom dry-run' (primary) and 'Anuluj'.
4. IF branches: only listed for IF Nodes that the dry-run preflight (`runs.start` with `preflight:true`, WFRT044) reports in `needsBranch: NodeKey[]` because example data cannot decide them; each gets a segmented control 'then / else'.
5. Start: `POST runs.start { workflowId, versionNo|draftRevision, mode:'dry_run', input, dryRunBranches }` with idempotency key; response `WorkflowRun`.
6. Banner (`DryRunBanner`) above the canvas while `activeRun.mode==='dry_run'`: 'DRY-RUN · dane przykładowe, brak skutków ubocznych' with a 'Zatrzymaj' button (calls cancel through `feature:wfed-run-controls`); the header pill reads 'Dry-run #15 · działa'.
7. Only one dry-run per Workflow at a time; Start is disabled with reason when another dry-run is active.
8. Disabled during Global Pause (reason shown); dry-run does not consume Agent slots.

## 6. Design notes

Not in the mock. Derive from DS: `ui:Dialog` form variant 560 px, fields from `ui:Field`; banner uses amber-neutral `InfoNote` tone (not magenta, magenta means a real Agent is working). Text must make clear that nothing is executed.

## 7. Reuse

- `ui:Dialog`, `ui:Field`, `ui:TextField`, `ui:Textarea`, `ui:Select`, `ui:InfoNote`, `lib:port-schema-validator`, `OVE_WFED053` for stopping.

## 8. Architecture and code placement

`@WF/dry-run/DryRunDialog.tsx`, `build-input-form.ts` (pure: schema -> field descriptors, unit tested), `DryRunBanner.tsx`, `register.ts` (header intent `dryRun`). Depends on data hooks and ui-kit.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. The input JSON is untrusted: parsed with the dependency-free `parseJsonStrict` (rejects `__proto__`, `constructor`, depth > 20, size > 256 KiB) before sending. A dry-run request cannot choose a different Workspace or permissions. Example data is never stored as real Artifacts.

## 10. Errors and edge cases

- Schema with `$ref` or unsupported keywords: Port schema subset forbids them; the form falls back to JSON.
- Input invalid: Start disabled, inline errors with JSON pointers.
- Draft changed while the dialog is open: dialog shows 'Wersja robocza zmieniła się' and re-validates.
- Run start returns `wfrt.run_paused` (423): dialog stays open and shows the pause reason.

## 11. Acceptance criteria

- [ ] Given validation errors, then Start is disabled and the first errors are listed.
- [ ] Given an `inputSchema` with a string and an enum, then two fields are rendered with example defaults and Start sends them.
- [ ] Given a dry-run is active, then the banner shows and the Start button is disabled with a reason.
- [ ] Given hostile JSON with `__proto__`, then it is rejected before the request.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`build-input-form.test.ts` (table-driven), dialog component tests, banner story, hostile-input test. Command `pnpm --filter desktop vitest run src/features/workflow-editor/dry-run`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: a draft dry-run uses `runs.start` with `draftRevision`; WFRT044/048 must accept it (flagged in the final report).
- ASSUMPTION: dry-runs older than 24 h are hidden by default in the Runs list (RUNUI filter).
