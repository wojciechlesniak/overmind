---
id: OVE_WFED070
title: "Build the safe expression editor with live validation and sample-data preview"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS017, OVE_DS026, OVE_DS028, OVE_DS040, OVE_WFED069, OVE_WFRT015, OVE_WFRT016, OVE_WFRT049]
soft_depends_on: []
provides: ["feature:wfed-expression-editor"]
needs: ["api:workflows.expression.check", "contract:ExpressionScope", "contract:ExpressionAst", "doc:expression-grammar", "ui:Textarea", "ui:Popover", "ui:Pill", "ui:InfoNote", "lib:wfed-node-forms", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/forms/expression/**", "apps/desktop/src/locales/en/wfed-expression.json", "apps/desktop/src/locales/pl/wfed-expression.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 11"]
adr_refs: [2, 19, 28]
---

# OVE_WFED070: Build the safe expression editor with live validation and sample-data preview

## 1. Summary

A reusable editor field for expressions (IF condition, Edge mappings, Quality Gate conditions) that highlights tokens, lists the variables in scope with their types, validates on every pause via the engine's safe evaluator, and previews the result against editable sample data. It never evaluates anything in the browser.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). SPEC 7 and CONVENTIONS section 7: conditions are evaluated by a safe evaluator (never `eval`); WFRT015-017 define the grammar, parser, type-checker and a function whitelist with resource limits. The desktop app may not import domain packages, so parsing, type-checking and evaluation for the editor go through a gateway route `expression.check` (assumed owned by WFRT; flagged). Expressions operate on structured data: `input.testsPassed >= 100 and run.iteration < 3`.

## 3. Scope (in)

- `ExpressionEditor` component (single- and multi-line, max 1 000 chars for IF per WFRT022).
- Scope panel: variables with types for the site (from the response).
- Live check (debounce 350 ms, cancel stale) with error underline and message.
- Sample data editor (JSON, per Node, kept in session/local UI state, never saved into the Workflow) and result preview.
- Insert helpers: click a variable or function to insert at the caret.

## 4. Out of scope

- The grammar, parser and evaluator (WFRT015-017).
- Where the expression sits (IF/Gate/Edge forms).

## 5. Detailed requirements

1. Props: `{ value, onChange, site: {nodeKey, kind: 'if.condition'|'edge.mapping'|'gate.condition', field?: string}, expect: 'boolean'|'any', readOnly, labels }`.
2. Check request: `expression.check { definition (current document mapped), nodeKey, site, expression, sample? }` -> `{ ok, errors: [{code, start, end, messageKey, params}], tokens: [{start,end,kind: 'number'|'string'|'ident'|'op'|'keyword'|'func'|'path'}], resultType?, scope: [{name, type, description?}], preview?: {value: Shown, truncated} }`. The client trusts only this response for highlight and validity; it contains no parser.
3. Highlighting: render an overlay of `<span class=tok-kind>` over a transparent textarea (single source text, no contentEditable), mono 13; colours from tokens (path/ident violet-light, op muted, number mint, string amber, error underline `#FF8FA3`); highlighting is purely decorative and never changes the text.
4. Errors: first error shown below as '✗ <message> (znak 14)' and the range underlined; the full list in a popover when more than one; messages come from `messageKey` (no server prose).
5. Scope panel: collapsible list `input.testsPassed: number`, `input.files: array<string>`, `run.iteration: integer`, `loop.feedback: object|null`; click inserts the path; arrays/objects expandable one level.
6. Sample data: JSON textarea prefilled by the server with an example value generated from the incoming edge schema (`exampleValue`); editing is allowed; invalid JSON -> inline error, preview disabled; sample size limit 16 KiB; sample is sent only in the check request (not stored in the Workflow).
7. Preview: 'Wynik dla danych przykładowych: true' (boolean as word 'prawda/fałsz' plus the raw value), or the evaluator error code; clear note 'To tylko podgląd. Podczas Runu wartości pochodzą z wyników Agentów.'.
8. Type mismatch for `expect:'boolean'` shows 'Warunek musi zwracać prawda/fałsz' (code `expr.type_mismatch`).
9. Insert helper functions list shows only whitelisted functions from the response (`functions: [{name, signature}]`).
10. Keyboard: `Ctrl/Cmd+Space` opens the scope/functions popover; `Tab` moves focus out of the editor (no tab character insertion); errors announced via `aria-live=polite` after the debounce; the textarea has `aria-describedby` for the error and scope help.
11. Hostile input: expressions longer than the cap are rejected before sending; the editor never inserts HTML; the highlight overlay escapes all text.

## 6. Design notes

Not in the mock. Editor: `ui:Textarea` mono 13 on `#140F20`, radius 12, min 2 rows, height grows to 6 rows; token overlay as described; status line under it (✓ 'Wyrażenie poprawne' mint / ✗ error). Scope panel is a disclosure 'Dostępne dane' under the editor. Preview is a muted card.

## 7. Reuse

- `ui:Textarea`, `ui:Popover`, `ui:Pill`, `ui:InfoNote`; framework `ConfigFieldRow` from `OVE_WFED069`; shared types `ExpressionScope` from contracts.

## 8. Architecture and code placement

`@WF/forms/expression/` (`ExpressionEditor.tsx`, `TokenOverlay.tsx`, `use-expression-check.ts` (debounce/cancel, pure scheduler shared with `OVE_WFED061` scheduler utilities by import), `ScopePanel.tsx`, `SamplePanel.tsx`). No parser or evaluator code anywhere in `apps/desktop`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text. Never evaluate in the browser (no `eval`, no `Function`, no dynamic code). Sample data may contain hostile strings: they are only displayed as text. The check route is read-only and rate-limited (ENGINE014); the editor backs off on 429.

## 10. Errors and edge cases

- Engine unreachable: editor still edits; status shows 'Nie można sprawdzić (silnik niedostępny)' and the Node validation will flag it later (stale, fail closed at publish).
- Expression refers to a path not in scope: `expr.unknown_path` with a suggestion list (top 3 closest names from the response).
- Very long sample JSON: rejected at 16 KiB.
- Pasted text with newlines in a single-line site: newlines replaced by spaces.
- Response for an older text arrives late: dropped.

## 11. Acceptance criteria

- [ ] Given a syntax error at position 14, then the range is underlined and the message references position 14.
- [ ] Given a valid boolean expression and sample data, then the preview shows the result and the preview note.
- [ ] Given `expect:'boolean'` and an expression returning a number, then the type-mismatch message shows.
- [ ] Given no engine, then the status shows the unavailable message and the text remains editable.
- [ ] Given hostile characters `<img onerror=...>` in the text, then they render as text in the overlay.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`use-expression-check.test.ts` (debounce/cancel), overlay escaping test (XSS corpus from `lib:injection-corpus`), stories (`Valid`, `SyntaxError`, `TypeMismatch`, `Unavailable`, `LongText`), axe, e2e in `OVE_WFED089` for IF.

## 13. Parallelization notes

Parallel with the concrete forms after `OVE_WFED069`; IF and Gate forms depend on this. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `api:workflows.expression.check` (read-only, Owner scope) is provided by WFRT around WFRT017/047; flagged as an unowned capability in the final report.
- ASSUMPTION: highlighting tokens are returned by the server (no client lexer) to keep a single grammar implementation.
