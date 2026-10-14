---
id: OVE_WFED071
title: "Build the IF node form: condition editor, branch labels and dry-run branch"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS023, OVE_DS026, OVE_DS030, OVE_DS031, OVE_DS080, OVE_WFED002, OVE_WFED007, OVE_WFED061, OVE_WFED069, OVE_WFED070, OVE_WFRT003, OVE_WFRT005, OVE_WFRT010, OVE_WFRT022]
soft_depends_on: []
provides: ["feature:wfed-form-if"]
needs: ["lib:node-registry", "lib:define-node-config", "contract:ValidationIssue", "lib:wfed-live-validation", "lib:editor-commands", "lib:editor-document-model", "ui:Field", "ui:TextField", "ui:Select", "ui:Switch", "ui:NumberStepper", "ui:Card", "lib:i18n-ui", "node:if", "feature:wfed-expression-editor"]
owns: ["apps/desktop/src/features/workflow-editor/forms/if/**", "apps/desktop/src/locales/en/wfed-form-if.json", "apps/desktop/src/locales/pl/wfed-form-if.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED071: Build the IF node form: condition editor, branch labels and dry-run branch

## 1. Summary

The Inspector form for an IF Node: a safe-expression condition with live validation and sample data, an optional description, labels for the then/else branches and the dry-run default branch.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). WFRT022: config `{ condition: string (<= 1 000), description?: string (<= 200) }`; ports `in`, `then`, `else` (both required); the condition must be boolean (`if.condition_not_boolean`); dry-run takes `dryRunBranch` from the run request when example data cannot decide. The canvas shows branches on edges; the Owner needs to see which edge is 'then' and 'else'.

## 3. Scope (in)

- `IfForm` using `ExpressionEditor` (`site.kind='if.condition'`, `expect:'boolean'`).
- Description field, port legend ('then → <target label>', 'else → <target label>') derived from the document edges.
- Warning surfacing for `if.same_target`, `if.condition_required`.
- Hint when the incoming edge has no schema (`any_json`): 'Wejście bez schematu: wyrażenia mogą zwracać błąd typów'.

## 4. Out of scope

- The form framework, registry and shared inputs (`OVE_WFED069`).
- Runtime behaviour of the Node (WFRT).

## 5. Detailed requirements

1. Condition: required; empty shows `if.condition_required` inline immediately on blur (and the validator confirms).
2. Branch legend lists the connected targets for ports `then`/`else` with 'Pokaż' that focuses the target Node; an unconnected required port shows an error line 'Port else nie jest podłączony' (from the validator issue `ports.required_unconnected`).
3. Quick insert chips for common comparisons built from the scope's boolean/number fields ('input.<field> == true', '>= 100') inserted through the editor insert helper.
4. Description textarea max 200 chars with counter.
5. `dryRunBranch` default per Node is not stored in the Workflow; it is chosen in the dry-run dialog (`OVE_WFED054`); the form only explains that.

## 6. Design notes

Not in the mock; derive from the framework styling. Order: label, condition editor, 'Dostępne dane', description, branches legend, issues.

## 7. Reuse

- Form framework `OVE_WFED069` (`registerNodeForm`, `useNodeConfigForm`, `ConfigFieldRow`).
- `ui` form primitives listed in `needs`; config schema from `contracts` (`parseNodeConfig`).

## 8. Architecture and code placement

One folder `@WF/forms/if/` with `if.form.tsx` (registered via the glob in `OVE_WFED069`), `if-form-model.ts` (pure defaults, normalisation, field-error mapping) and stories. Depends on the framework, ui-kit and contracts.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text.

## 10. Errors and edge cases

- Both branches point to the same Node: amber warning from the validator is shown.
- Condition refers to a loop variable outside a Loop: `expr.unknown_path` shown.
- Condition is 1 000+ chars: input capped.

## 11. Acceptance criteria

- [ ] Given an invalid condition, then the commit is withheld and the error shows.
- [ ] Given a valid condition, then `updateNodeConfig` is called once after the quiet period.
- [ ] Given an unconnected `else` port, then the legend shows the error with the validator message.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Form tests with fake commands and fake expression check; stories `Valid`, `Invalid`, `UnconnectedElse`, `ReadOnly`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: no UI for `dryRunBranch` per Node beyond the dry-run dialog.
