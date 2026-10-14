---
id: OVE_WFED069
title: "Build the node config form framework: registry, controlled config hook and field errors"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS026, OVE_DS031, OVE_DS040, OVE_WFED002, OVE_WFED007, OVE_WFED061, OVE_WFED063, OVE_WFRT003, OVE_WFRT005, OVE_WFRT010]
soft_depends_on: []
provides: ["feature:wfed-form-framework", "lib:wfed-node-forms"]
needs: ["lib:node-registry", "lib:define-node-config", "contract:ValidationIssue", "lib:editor-commands", "lib:editor-document-model", "lib:wfed-live-validation", "ui:Field", "ui:Card", "ui:InfoNote", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/forms/framework/**", "apps/desktop/src/locales/en/wfed-forms.json", "apps/desktop/src/locales/pl/wfed-forms.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED069: Build the node config form framework: registry, controlled config hook and field errors

## 1. Summary

The shared machinery behind all Node config forms in the Inspector: a registry keyed by Node type, a `useNodeConfigForm` hook (draft state, debounced commit through editor commands, undo-friendly), mapping of validator issues to fields by JSON pointer, and the common Node fields (label, description). Each Node type form is a separate task that only registers itself.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). WFRT003: `NodeDef.config` is validated by a per-type strict zod schema registered with `defineNodeConfig`; WFRT010 reports `config.invalid` issues with zod paths and rule issues with JSON pointers into the definition. The editor must show errors next to the field they concern and must never let a form write keys the schema does not define.

## 3. Scope (in)

- `registerNodeForm({ nodeType, component })` + glob discovery `forms/*/*.form.tsx`.
- `useNodeConfigForm(nodeKey, schema)` returning `{ value, set(path, v), errors(path), commit, reset }`.
- Field-error mapping: `issuesForPath(issueIndex, nodeKey, path)`.
- `ConfigFieldRow` (label, help, error, optional 'domyślnie: X'), `LimitInput` (number + unit) and `ExpressionSlot` placeholder contract used by `OVE_WFED070`.
- Common header fields: Node label (1-60 chars), description.

## 4. Out of scope

- Concrete forms (`OVE_WFED071`, `OVE_WFED072`, `OVE_WFED073`, `OVE_WFED074`, `OVE_WFED075`, `OVE_WFED076`, `OVE_WFED077`).
- Expression editor (`OVE_WFED070`).

## 5. Detailed requirements

1. Registry is a plain Map filled by `import.meta.glob` (eager) at module init; duplicates for one `nodeType` throw in dev and log an error in prod (the first wins).
2. `useNodeConfigForm`: local state is initialised from the document Node config merged over `defaults` from the registered schema; edits are applied locally immediately and committed to the document through `lib:editor-commands.updateNodeConfig(nodeKey, patch)` after 300 ms of quiet or on blur; one commit = one undo step; rapid typing in one field is coalesced into a single undo entry (command `coalesceKey = nodeKey+path`).
3. Before commit the value is parsed with `parseNodeConfig(type, value)` (contracts); on failure the field error comes from the zod issue path, the commit is withheld and the last valid config stays in the document (the invalid text stays in the input so the Owner can fix it).
4. Errors: combine zod errors (local, immediate) with server validator issues (`byNode[nodeKey]`, matched by `target.path` prefix `/nodes/<i>/config/...`); a field shows at most one message at a time (local first), the rest are summarised in the section header.
5. Read-only mode: all inputs `aria-disabled`, tooltip 'Tryb tylko do odczytu'.
6. `ConfigFieldRow`: label 13/600, help 12 muted, error 12 error tone with ✗ glyph, `aria-describedby` for help+error, `aria-invalid`.
7. `LimitInput`: number input with unit suffix, min/max from schema, step, shows 'domyślnie: 5' and a reset link; typed value clamped on blur with a visible note when clamped.
8. Common header fields: label input bound to `NodeDef.label` (not config) via `updateNodeLabel`; description is part of config where the type supports it.
9. Unknown Node type (registry has no form): generic read-only JSON view of config + note 'Brak edytora dla typu <type>' (never an editable raw JSON box: avoids bypassing typed forms).
10. Keyboard: Tab order follows visual order; `Esc` on a field reverts the uncommitted edit; Ctrl/Cmd+Z/Y are handled by the editor history, not by inputs, unless an input is focused (native text undo).

## 6. Design notes

Not in the mock. Visual rules from DS: sections as `InspectorSection` with `SectionLabel` (mono 11 +0.1em muted), fields 13px on `#140F20` inputs radius 12 with `line-control` border; error text `#FF8FA3` with ✗; helper 12/1.4 `text-muted`. Panel width 290 means one column; two-up grids only for short numeric inputs (limits).

## 7. Reuse

- `ui:Field`, `ui:TextField`, `ui:Select`, `ui:NumberStepper`, `ui:Switch`, `ui:InfoNote` (DS); `parseNodeConfig`, `defineNodeConfig` registry (WFRT003/005); part 1 `lib:editor-commands`.

## 8. Architecture and code placement

`@WF/forms/framework/` (`registry.ts`, `use-node-config-form.ts`, `field-errors.ts`, `ConfigFieldRow.tsx`, `LimitInput.tsx`, `UnknownNodeForm.tsx`). Forms import the framework through its barrel only.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text. The unknown-type view is read-only on purpose (no raw JSON editing of `config`).

## 10. Errors and edge cases

- Config parse fails while typing: commit withheld, field error shown, document unchanged.
- Server validator reports an error on a field the local schema accepts (cross-Node rule): shown from the issue index.
- Two forms registered for one type: dev error.
- Node deleted while its form is open: framework unmounts without committing.
- Undo while a field has uncommitted edits: edits are committed first, then undo applies.

## 11. Acceptance criteria

- [ ] Given a new section file `forms/foo/foo.form.tsx`, then it is discovered without editing the framework.
- [ ] Given typing in one field for 2 seconds, then one undo step is created.
- [ ] Given an invalid value, then the document keeps the last valid config and the field shows the zod message.
- [ ] Given a server issue with a config path, then it is shown on that field.
- [ ] Given an unknown type, then a read-only view is shown (no editable JSON).
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`use-node-config-form.test.ts` (coalescing, commit withholding), `field-errors.test.ts`, registry glob test, stories for `ConfigFieldRow`/`LimitInput`, axe. `pnpm --filter desktop vitest run src/features/workflow-editor/forms/framework`.

## 13. Parallelization notes

Blocks every concrete form task; define the public types first. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: part 1 `lib:editor-commands` exposes `updateNodeConfig(nodeKey, patch, {coalesceKey})` and `updateNodeLabel`; flagged to the linker.
