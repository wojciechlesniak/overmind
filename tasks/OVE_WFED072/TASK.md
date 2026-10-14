---
id: OVE_WFED072
title: "Build the Loop node form: iteration, time and cost limits, feedback schema, exit"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS023, OVE_DS026, OVE_DS030, OVE_DS031, OVE_DS080, OVE_WFED002, OVE_WFED007, OVE_WFED061, OVE_WFED069, OVE_WFRT003, OVE_WFRT005, OVE_WFRT010, OVE_WFRT023]
soft_depends_on: []
provides: ["feature:wfed-form-loop", "lib:wfed-loop-frame-label"]
needs: ["lib:node-registry", "lib:define-node-config", "contract:ValidationIssue", "lib:wfed-live-validation", "lib:editor-commands", "lib:editor-document-model", "ui:Field", "ui:TextField", "ui:Select", "ui:Switch", "ui:NumberStepper", "ui:Card", "lib:i18n-ui", "node:loop"]
owns: ["apps/desktop/src/features/workflow-editor/forms/loop/**", "apps/desktop/src/locales/en/wfed-form-loop.json", "apps/desktop/src/locales/pl/wfed-form-loop.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED072: Build the Loop node form: iteration, time and cost limits, feedback schema, exit

## 1. Summary

The Inspector form for a Loop Node: the three mandatory limits (iterations, duration, cost), the optional feedback schema, and a view of the `exhausted` exit. Limits are required in stored configs and the form pre-fills defaults.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). WFRT023: config `{ limits: { maxIterations 1..50 (default 5), maxDurationMs 1000..86400000 (default 5 400 000 = 90 min), maxCost { unit 'tokens'|'usd', amount>0 } (default 2 000 000 tokens) }, feedbackSchema? }`; ports `enter`, `continue` (multi), `body`, `exhausted` (required). A raw back-edge is a validation error; cycles exist only as Loop. The mock group frame says 'Pętla jakości · Build → QA → Review · iteracja 2 z 5' and 'limit 90 min · 5 iteracji'; the Loop frame label is derived from these limits.

## 3. Scope (in)

- `LoopForm` with `LimitInput`s: iterations (number), duration (minutes input converted to ms, shows '90 min'), cost (amount + unit select).
- Feedback schema: compact editor (field list: name, type, required) mapped to the `PortSchema` subset; advanced JSON toggle limited to the subset validator.
- `exhausted` exit panel: shows where the exit goes ('Eskalacja' if unconnected is an ERROR from `cycle.loop_exhausted_unconnected`).
- Group frame sync: shows the frame label/limit text preview ('limit 90 min · 5 iteracji') that the canvas draws.

## 4. Out of scope

- The form framework, registry and shared inputs (`OVE_WFED069`).
- Runtime behaviour of the Node (WFRT).

## 5. Detailed requirements

1. Defaults pre-filled on creation: 5 iterations, 90 min, 2 000 000 tokens; a missing limit is an error `cycle.loop_limits_missing`.
2. Duration shown and edited in minutes (1..1440); stored as ms; values below 1 min rejected with the schema message.
3. Cost unit `usd` is offered only when a connected provider reports money (assumption: CLI subscriptions report tokens); otherwise the unit select shows tokens only with help 'Subskrypcje CLI raportują tokeny'.
4. Raising a limit by more than 2x versus the base Version is flagged later in the publish diff as `safety` (information, here a small note 'Zwiększasz limit względem v7').
5. Feedback schema editor supports string, number, integer, boolean, array of string, enum; nesting depth 2; max 20 fields; invalid names rejected (`^[a-z][a-z0-9_]{0,31}$`).
6. `exhausted` panel: lists the connected target or error; button 'Pokaż port' focuses the Node's port on canvas.
7. Group label derivation uses the shared `loopFrameLabel(limits)` helper exported for the canvas (this task owns it in `@WF/forms/loop/loop-frame-label.ts`; the run overlay uses it to append 'iteracja N z M').
8. Nested Loop depth > 3 error is a validator message listed in the issue section (no form logic).

## 6. Design notes

Not in the mock except the group frame texts. Two-up grid for iterations and minutes; cost row full width; feedback schema as a list of rows with remove buttons; exhaustion panel as a muted card.

## 7. Reuse

- Form framework `OVE_WFED069` (`registerNodeForm`, `useNodeConfigForm`, `ConfigFieldRow`).
- `ui` form primitives listed in `needs`; config schema from `contracts` (`parseNodeConfig`).

## 8. Architecture and code placement

One folder `@WF/forms/loop/` with `loop.form.tsx` (registered via the glob in `OVE_WFED069`), `loop-form-model.ts` (pure defaults, normalisation, field-error mapping) and stories. Depends on the framework, ui-kit and contracts.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text.

## 10. Errors and edge cases

- Duration typed as '0': rejected with message.
- Switching cost unit resets the amount with confirmation only when amount was edited.
- Body has no Agent: validator warning shown (`loop.body_has_no_agent`).
- Feedback field name duplicate: field error.

## 11. Acceptance criteria

- [ ] Given a new Loop, then defaults 5 / 90 min / 2 000 000 tokens are present in the config.
- [ ] Given 90 minutes typed, then config stores 5 400 000 ms.
- [ ] Given an unconnected `exhausted` port, then an error with 'Pokaż port' shows.
- [ ] Given limits raised above 2x of base, then the note is displayed.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Form tests, `loop-frame-label.test.ts`, stories `Default`, `Raised`, `NoExit`, `ReadOnly`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: duration input granularity is minutes in the UI.
- ASSUMPTION: `loopFrameLabel` text format: 'limit {minutes} min · {n} iteracji' (matches the mock).
