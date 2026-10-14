---
id: OVE_WFED076
title: "Build the Quality Gate node form: conditions on evidence and failure route"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS023, OVE_DS026, OVE_DS030, OVE_DS031, OVE_DS080, OVE_WFED002, OVE_WFED007, OVE_WFED061, OVE_WFED069, OVE_WFED070, OVE_WFRT003, OVE_WFRT005, OVE_WFRT010, OVE_WFRT048, OVE_WFRT056]
soft_depends_on: []
provides: ["feature:wfed-form-quality_gate", "lib:wfed-gate-serialiser"]
needs: ["lib:node-registry", "lib:define-node-config", "contract:ValidationIssue", "lib:wfed-live-validation", "lib:editor-commands", "lib:editor-document-model", "ui:Field", "ui:TextField", "ui:Select", "ui:Switch", "ui:NumberStepper", "ui:Card", "lib:i18n-ui", "node:quality_gate", "node:quality_gate", "api:workflows.evidence-catalog", "feature:wfed-expression-editor"]
owns: ["apps/desktop/src/features/workflow-editor/forms/quality_gate/**", "apps/desktop/src/locales/en/wfed-form-quality_gate.json", "apps/desktop/src/locales/pl/wfed-form-quality_gate.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED076: Build the Quality Gate node form: conditions on evidence and failure route

## 1. Summary

The Inspector form for a Quality Gate Node (amber diamond 'testy 100% · 0 krytycznych'): evidence-based conditions such as `testsPassed = 100% AND criticalVulnerabilities = 0 AND seniorReview = approved`, with the evidence sources they rely on and the route back ('nie spełnia → wróć do Developera z raportem').

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). SPEC 7: Quality Gate is a configurable condition on evidence; test and scan reports are stored as Artifacts; AI assessment is an opinion, not security proof (ADR 0026, SPEC 16 criterion 5). WFRT026/027 define Evidence and the gate config and note that `100%` means the number 100 on a 0-100 scale for `testsPassed`. The Gate evaluates the safe expression over `evidence.*` values that the engine derived from Artifacts (test report parsers), never from Agent text.

## 3. Scope (in)

- `GateForm`: condition builder (rows) with a switch to the raw safe expression (`ExpressionEditor`, `site.kind='gate.condition'`).
- Evidence catalogue: list of evidence names available (testsPassed, criticalVulnerabilities, seniorReview, ...), each with unit, source (which Artifact kind) and whether it is 'dowód' (verified) or 'opinia'.
- Failure route display ('nie spełnia → wróć do Developera') and edge label field.
- Gate label shown on the diamond ('testy 100% · 0 krytycznych') generated from the rows.

## 4. Out of scope

- The form framework, registry and shared inputs (`OVE_WFED069`).
- Runtime behaviour of the Node (WFRT).

## 5. Detailed requirements

1. Row model: `{ evidence: name, op: '='|'>='|'<='|'>'|'<'|'!=', value }` joined by AND (ANY/OR available only in the expression mode); the builder serialises to the safe expression and parses back only for its own canonical form; anything else switches the form to expression mode with a note.
2. Evidence catalogue comes from the engine (`api:workflows.evidence-catalog` assumed, part of WFRT026) with `kind: 'evidence'|'opinion'`; opinion rows (for example `seniorReview`) carry the badge 'opinia' and a hint that approvals of AI reviewers do not replace tests; at least one row of kind `evidence` is required (the validator enforces `gate.requires_evidence`; the form shows it).
3. Value units: percent rows show '100 %' and store 100; counts show integers; booleans show 'tak/nie'.
4. Label field (<= 43 chars) for the diamond caption, default generated 'testy 100% · 0 krytycznych'; manual override allowed.
5. `onFail` route: form shows which port leads back (e.g. to the Loop `continue`); unconnected -> validator error with 'Pokaż port'.
6. Evidence preview during/after a Run: current values from `run.gate.evaluated` events (read-only table 'testsPassed: 96% (wymagane 100%)') linking to the Artifact.
7. No UI affordance can mark a Gate as passed; manual override is not offered (an Owner override would be an Approval flow in APPR, not here).
8. Read-only in view mode.

## 6. Design notes

Not in the mock except the diamond and label. Rows as compact selects in a column; evidence rows with 'dowód'/'opinia' pill words.

## 7. Reuse

- Form framework `OVE_WFED069` (`registerNodeForm`, `useNodeConfigForm`, `ConfigFieldRow`).
- `ui` form primitives listed in `needs`; config schema from `contracts` (`parseNodeConfig`).

## 8. Architecture and code placement

One folder `@WF/forms/quality_gate/` with `quality_gate.form.tsx` (registered via the glob in `OVE_WFED069`), `quality_gate-form-model.ts` (pure defaults, normalisation, field-error mapping) and stories. Depends on the framework, ui-kit and contracts.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text.

## 10. Errors and edge cases

- Evidence name removed from the catalogue after an engine update: row error 'Nieznany dowód'.
- Expression mode with unsupported construct: stays in expression mode, builder disabled.
- Gate with only opinion rows: blocking validator error shown.
- Percent value outside 0..100: field error.

## 11. Acceptance criteria

- [ ] Given rows testsPassed = 100 and criticalVulnerabilities = 0, then the serialised expression is `evidence.testsPassed == 100 and evidence.criticalVulnerabilities == 0` (exact canonical form from the shared helper).
- [ ] Given only an opinion row, then the validator error shows.
- [ ] Given a Run evaluation event, then the evidence preview shows the measured values.
- [ ] Given a non-canonical expression, then the form switches to expression mode.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Builder serialisation tests (round trip), form tests, stories.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: Quality Gate node type key is `quality_gate` (from WFRT003 list); config schema and `evidence` catalogue route come from the WFRT026/027 tasks (not yet written; flagged).
- ASSUMPTION: the canonical expression form uses `evidence.<name>` as the scope root.
