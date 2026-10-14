---
id: OVE_WFED077
title: "Build the Agent node form: prompt template, output contract, timeout, retry and overrides"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS023, OVE_DS026, OVE_DS030, OVE_DS031, OVE_DS080, OVE_WFED002, OVE_WFED007, OVE_WFED061, OVE_WFED069, OVE_WFRT003, OVE_WFRT004, OVE_WFRT005, OVE_WFRT010, OVE_WFRT019]
soft_depends_on: []
provides: ["feature:wfed-form-agent", "feature:wfed-schema-field-editor"]
needs: ["lib:node-registry", "lib:define-node-config", "contract:ValidationIssue", "lib:wfed-live-validation", "lib:editor-commands", "lib:editor-document-model", "ui:Field", "ui:TextField", "ui:Select", "ui:Switch", "ui:NumberStepper", "ui:Card", "lib:i18n-ui", "node:agent", "node:agent", "contract:PortSchema"]
owns: ["apps/desktop/src/features/workflow-editor/forms/agent/**", "apps/desktop/src/locales/en/wfed-form-agent.json", "apps/desktop/src/locales/pl/wfed-form-agent.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED077: Build the Agent node form: prompt template, output contract, timeout, retry and overrides

## 1. Summary

The Inspector section for the Agent Node's own config (`promptTemplate`, input/output schemas, `timeoutMs`, `retry`, `onOutputInvalid`, `artifacts`). Model, Skills and visibility keep their dedicated sections; this form completes the Node.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). WFRT019 config: `agentRef`, `promptTemplate` (<= 8 000, placeholders `{{input.<path>}}` only), `inputSchema?`, `outputSchema?`, `overrides?` (model, prompt appended <= 8 000, skills add/remove), `timeoutMs` (default 30 min, cap 4 h), `retry` (0..5, default 2, baseDelay 5 s, factor 2, max 5 min), `onOutputInvalid` ('repair_once'|'fail'), `lane?` (see `OVE_WFED078`), `artifacts?`. A Node cannot change the Agent's permission profile. Structured output matters because IF and Quality Gate operate on structured data.

## 3. Scope (in)

- `AgentNodeForm` sections: Prompt, Wejście i wynik (schemas), Czas i ponawianie, Dodatkowe instrukcje (override prompt), Artefakty.
- Prompt template editor with placeholder insertion from the input schema (checked by the validator rule `agent.prompt_placeholder`).
- Schema editors reusing the compact `PortSchema` field editor (shared with the Loop feedback schema).

## 4. Out of scope

- The form framework, registry and shared inputs (`OVE_WFED069`).
- Runtime behaviour of the Node (WFRT).
- Lane binding (`OVE_WFED078`).

## 5. Detailed requirements

1. Prompt template textarea (mono 13) max 8 000 with counter; placeholder chips from `inputSchema` paths insert `{{input.path}}`; unknown placeholders are flagged by the validator and displayed under the field.
2. Input/output schema: compact field-list editor (name, type string/number/integer/boolean/enum/array<string>, required) producing the `PortSchema` subset; 'Pokaż JSON Schema' read-only; an Agent whose output feeds an IF/Gate without `outputSchema` shows the amber note 'Wynik sterujący przepływem wymaga schematu' (validator `agent.output_contract_required_for_control_flow`).
3. Timeout: minutes (1..240, default 30); retry: maxRetries stepper 0..5, base delay seconds, factor; show the resulting schedule 'Ponowienia po 5 s, 10 s' computed locally for display only.
4. `onOutputInvalid` radio: 'Popraw raz' (default) / 'Zakończ błędem'.
5. Overrides prompt: textarea 'Dodatkowe instrukcje w tym Węźle' (<= 8 000) with the note 'Instrukcje Węzła nie zmieniają uprawnień.'.
6. Artifacts: multi-select of expected Artifact kinds (test_report, scan_report, diff, doc, ...) from the contract enum; help 'Quality Gate czyta dowody z Artefaktów, nie z tekstu Agenta'.
7. Lane binding is rendered by `OVE_WFED078` in the same panel (this form leaves a slot).
8. No field for permissions, tools, paths or secrets exists in this form (and the strict schema would reject them).

## 6. Design notes

Not in the mock. Use `InspectorSection` per group, collapsed by default except Prompt.

## 7. Reuse

- Form framework `OVE_WFED069` (`registerNodeForm`, `useNodeConfigForm`, `ConfigFieldRow`).
- `ui` form primitives listed in `needs`; config schema from `contracts` (`parseNodeConfig`).

## 8. Architecture and code placement

One folder `@WF/forms/agent/` with `agent.form.tsx` (registered via the glob in `OVE_WFED069`), `agent-form-model.ts` (pure defaults, normalisation, field-error mapping) and stories. Depends on the framework, ui-kit and contracts.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text.

## 10. Errors and edge cases

- Prompt contains `{{input.missing}}`: validator error listed with the placeholder.
- Schema with duplicate names: field error.
- Timeout above cap: clamped with a note.
- Prompt includes text that looks like an instruction to widen permissions: stored as data; nothing special (the server never interprets prompts as policy).

## 11. Acceptance criteria

- [ ] Given a placeholder chip click, then `{{input.x}}` is inserted at the caret.
- [ ] Given an IF after this Node and no output schema, then the amber note shows.
- [ ] Given retry 3 and base 5 s factor 2, then the schedule preview reads 5 s, 10 s, 20 s.
- [ ] Given a try to type a permission key, then no such field exists (test asserts the form's field list).
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Form tests, schema editor tests (round trip with `PortSchema` validator via fixtures), stories.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the compact schema editor is built here (first user) and exported as `SchemaFieldListEditor` for the Loop form to reuse; if `OVE_WFED072` lands first it imports from here (dependency added by the linker).
- ASSUMPTION: `lane` slot is filled by `OVE_WFED078`.
