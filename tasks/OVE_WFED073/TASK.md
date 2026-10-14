---
id: OVE_WFED073
title: "Build the Join and Parallel node forms: policy, quorum, timeout, partial failure, branches"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS023, OVE_DS026, OVE_DS030, OVE_DS031, OVE_DS080, OVE_WFED002, OVE_WFED007, OVE_WFED061, OVE_WFED069, OVE_WFED080, OVE_WFRT003, OVE_WFRT005, OVE_WFRT010, OVE_WFRT020, OVE_WFRT021]
soft_depends_on: []
provides: ["feature:wfed-form-join", "feature:wfed-form-parallel", "lib:wfed-join-caption"]
needs: ["lib:node-registry", "lib:define-node-config", "contract:ValidationIssue", "lib:wfed-live-validation", "lib:editor-commands", "lib:editor-document-model", "ui:Field", "ui:TextField", "ui:Select", "ui:Switch", "ui:NumberStepper", "ui:Card", "lib:i18n-ui", "node:join", "node:parallel", "node:join", "feature:wfed-run-overlay-model"]
owns: ["apps/desktop/src/features/workflow-editor/forms/join/**", "apps/desktop/src/locales/en/wfed-form-join.json", "apps/desktop/src/locales/pl/wfed-form-join.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED073: Build the Join and Parallel node forms: policy, quorum, timeout, partial failure, branches

## 1. Summary

Inspector forms for the Join Node (policy all/any/quorum, quorum number, timeout, behaviour on partial failure, cancel remaining) and the Parallel Node (named branches, 2 to 16).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). WFRT021 Join config `{ policy, quorum?, timeoutMs (default 3 600 000), onPartialFailure 'fail'|'continue'|'cancel_others', cancelRemainingOnSatisfied }`; WFRT020 Parallel config `{ branches: [{port, label}] }` 2..16 unique ports. The mock Join caption reads 'join · wszyscy' and an edge caption '3 decyzje → 5 Zadań na Tablicy'. Join member states in the Inspector during a Run (delivered/waiting/failed) come from the overlay model.

## 3. Scope (in)

- `JoinForm`: policy segmented control, quorum stepper (only for quorum, max = member count), timeout (minutes), partial-failure select, cancel-remaining switch.
- `ParallelForm`: branch list editor (add, remove, rename label, reorder) mapped to ports.
- Run-time member status list (read-only) when a Run is active (from the overlay model, `OVE_WFED080`).
- Caption derivation 'join · wszyscy|dowolny|kworum 2 z 3' shared with the canvas label.

## 4. Out of scope

- The form framework, registry and shared inputs (`OVE_WFED069`).
- Runtime behaviour of the Node (WFRT).

## 5. Detailed requirements

1. Policy `quorum` shows the stepper with range 1..N where N = connected incoming edges (from the document); N=0 disables with message.
2. Timeout in minutes (1..Run max); default 60 min; below 1 s rejected.
3. `onPartialFailure` options with plain explanations: 'Zakończ błędem', 'Kontynuuj z tym, co dotarło', 'Zakończ błędem i anuluj pozostałe'. `continue` shows the note 'Join przejdzie dalej, jeśli dotarł co najmniej jeden wynik'.
4. `cancelRemainingOnSatisfied` default true for `any`, false otherwise; changing policy updates the default only if the Owner has not touched the field.
5. Parallel branches: add (max 16, ports auto-named with the next free letter `a`..`p`), remove (disabled below 2; removing a connected branch asks to confirm since edges are removed), rename label (<= 40). Port names are not editable after edges exist (they are identifiers).
6. Live member list during a Run: rows 'Product Owner — dostarczono', 'Designer — czeka', 'QA — błąd' with state glyphs.
7. Caption helper `joinCaption(config, memberCount)` exported from `@WF/forms/join/join-caption.ts`; Polish words from i18n.
8. Validator warnings (`join.single_input`, `join.members_not_parallel`, `parallel.no_join`) are rendered in the issue section, not re-implemented.

## 6. Design notes

Not in the mock except captions. Segmented control for policy (`ui:SegmentedControl`), steppers (`ui:NumberStepper`), branch list rows with drag-free reorder via up/down buttons (keyboard friendly).

## 7. Reuse

- Form framework `OVE_WFED069` (`registerNodeForm`, `useNodeConfigForm`, `ConfigFieldRow`).
- `ui` form primitives listed in `needs`; config schema from `contracts` (`parseNodeConfig`).

## 8. Architecture and code placement

One folder `@WF/forms/join/` with `join.form.tsx` (registered via the glob in `OVE_WFED069`), `join-form-model.ts` (pure defaults, normalisation, field-error mapping) and stories. Depends on the framework, ui-kit and contracts.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text.

## 10. Errors and edge cases

- Changing a Parallel to fewer branches than connected edges: confirmation lists the edges to be removed.
- Quorum larger than connected inputs after an edge removal: field error appears reactively.
- Join with a single input: warning shown.

## 11. Acceptance criteria

- [ ] Given policy quorum with 3 members, then the stepper range is 1..3 and the caption reads 'kworum 2 z 3' for 2.
- [ ] Given removal of a connected Parallel branch, then a confirmation precedes the command.
- [ ] Given an active Run, then member states appear live.
- [ ] Given a new Join, then defaults are all / 60 min / fail.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Form tests with fixtures for Join and Parallel, `join-caption.test.ts`, stories.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: Parallel and Join share one task because both are small and one folder; both register through the registry (two files).
- ASSUMPTION: branch port naming scheme letters a..p (16).
