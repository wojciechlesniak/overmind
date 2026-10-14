---
id: OVE_WFED075
title: "Build the Review node form: reviewer, criteria, rubric Skill and rework target"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_ARCH011, OVE_DS023, OVE_DS026, OVE_DS030, OVE_DS031, OVE_DS080, OVE_WFED002, OVE_WFED007, OVE_WFED061, OVE_WFED069, OVE_WFRT003, OVE_WFRT005, OVE_WFRT010, OVE_WFRT055]
soft_depends_on: []
provides: ["feature:wfed-form-review"]
needs: ["lib:node-registry", "lib:define-node-config", "contract:ValidationIssue", "lib:wfed-live-validation", "lib:editor-commands", "lib:editor-document-model", "ui:Field", "ui:TextField", "ui:Select", "ui:Switch", "ui:NumberStepper", "ui:Card", "lib:i18n-ui", "node:review", "node:review", "api:agents.list"]
owns: ["apps/desktop/src/features/workflow-editor/forms/review/**", "apps/desktop/src/locales/en/wfed-form-review.json", "apps/desktop/src/locales/pl/wfed-form-review.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED075: Build the Review node form: reviewer, criteria, rubric Skill and rework target

## 1. Summary

The Inspector form for a Review Node (mock tile 'Senior Reviewer', TOR · REVIEW, 'review-rubric' Skill): reviewer Agent, review criteria list, outcome mapping (approved / changes requested / rejected) and the Node that receives rework.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). SPEC 3: after Quality Gate passes, Senior Reviewer (possibly on a stronger model) reviews; failures return work to the Developer with a report; the loop exits only on approval or exhaustion (Eskalacja). The Review node config comes from the WFRT review node task; fields below follow the SPEC and mock, and the contract `parseNodeConfig('review')` is authoritative. A review verdict is an opinion; the Quality Gate uses real evidence (ADR 0026).

## 3. Scope (in)

- `ReviewForm`: reviewer Agent select, criteria rows (text + weight? no: text + `required` flag), rubric Skill hint, verdict outcomes and their targets.
- Display of which ports carry 'approved' and 'changes_requested' with 'Pokaż' to the targets.
- Note on evidence vs opinion.

## 4. Out of scope

- The form framework, registry and shared inputs (`OVE_WFED069`).
- Runtime behaviour of the Node (WFRT).

## 5. Detailed requirements

1. Reviewer: Agent select limited to Agents visible here (same listing as Discussion); the Node's `agentRef` is the reviewer (an Agent Node variant); model override shortcut link opens the Inspector model section.
2. Criteria: ordered list of up to 12 short statements (1..200 chars) such as 'Testy pokrywają krytyczne ścieżki'; `required` toggle per criterion; the verdict `approved` requires all required criteria satisfied (enforced by the Agent's structured output schema, shown to the Owner as 'Wynik: pass/fail per kryterium').
3. Outputs: ports `approved`, `changes_requested` (+ `rejected` optional): the form shows targets; `changes_requested` must connect to a Loop `continue` or a rework Node: otherwise validator error is displayed (no UI logic).
4. Rubric Skill: hint chip 'review-rubric v1' (the Skill is assigned to the Agent via the normal Skill drop; the form only shows whether the reviewer has it and offers 'Przypisz' which opens the Skills section).
5. Evidence note: 'Opinia recenzenta nie zastępuje dowodów. Quality Gate sprawdza testy i skany.' always visible.
6. One reviewer per Review Node; several independent reviews are modelled with Parallel + Join (a help text in the form says so).
7. Read-only in view mode.

## 6. Design notes

Not in the mock except the tile. Same field styling as other forms; criteria as a reorderable list with up/down buttons.

## 7. Reuse

- Form framework `OVE_WFED069` (`registerNodeForm`, `useNodeConfigForm`, `ConfigFieldRow`).
- `ui` form primitives listed in `needs`; config schema from `contracts` (`parseNodeConfig`).

## 8. Architecture and code placement

One folder `@WF/forms/review/` with `review.form.tsx` (registered via the glob in `OVE_WFED069`), `review-form-model.ts` (pure defaults, normalisation, field-error mapping) and stories. Depends on the framework, ui-kit and contracts.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text.

## 10. Errors and edge cases

- Reviewer Agent equals the Developer Agent of the loop: amber hint 'Recenzent powinien być innym Agentem' (advisory warning from validator if provided).
- No criteria: allowed with a warning 'Brak kryteriów: recenzja będzie ogólna'.
- Criterion text with only whitespace: rejected.

## 11. Acceptance criteria

- [ ] Given 13 criteria, then the 13th is refused with the limit message.
- [ ] Given `changes_requested` unconnected, then the validator message appears with 'Pokaż port'.
- [ ] Given reviewer without the rubric Skill, then the hint with 'Przypisz' shows.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Form tests, stories.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the Review node config fields (`reviewerRef`, `criteria[]`, outputs) are defined by the WFRT review node task which is not yet written; this task adapts to the registered schema and must be re-checked when it lands (flagged).
- ASSUMPTION: one reviewer per Review Node.
