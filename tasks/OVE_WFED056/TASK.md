---
id: OVE_WFED056
title: "Build the publish dialog: diff summary, validation gate and change note"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS017, OVE_DS018, OVE_DS026, OVE_DS031, OVE_DS032, OVE_DS036, OVE_WFED050, OVE_WFED055]
soft_depends_on: []
provides: ["feature:wfed-publish-dialog"]
needs: ["lib:wfed-definition-diff", "lib:wfed-data-hooks", "ui:Dialog", "ui:Card", "ui:Pill", "ui:Textarea", "ui:Button", "ui:Field", "ui:EmptyState", "ui:ValidationPill", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/publish/PublishDialog.tsx", "apps/desktop/src/features/workflow-editor/publish/DiffList.tsx", "apps/desktop/src/features/workflow-editor/publish/ValidationGate.tsx", "apps/desktop/src/features/workflow-editor/publish/index.ts", "apps/desktop/src/locales/en/wfed-publish.json", "apps/desktop/src/locales/pl/wfed-publish.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED056: Build the publish dialog: diff summary, validation gate and change note

## 1. Summary

The dialog opened by 'Zapisz jako v8': it shows what changes against v7 (grouped and risk-ranked), the validation result as a gate (errors block publishing, warnings do not), an optional change note and the consequence text 'Działające Runy zostają przy v7'.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). ADR 0002 and SPEC 7: edit creates a new Version, running Runs keep their pinned Version. The Owner confirms a publish knowing the changes. WFRT002 `PublishRequest { expectedRevision, changeNote? }`; the server validates again (`wfrt.publish_invalid`, 422). The dialog is presentational plus local state; the call itself is in `OVE_WFED057`.

## 3. Scope (in)

- `PublishDialog` (props-driven), `DiffList`, `ValidationGate`, local note field state.
- States: computing, ready, blocked by errors, publishing, failed, identical (nothing to publish).
- Active-Run consequence block: lists Runs that keep their Version (count and numbers).

## 4. Out of scope

- Executing the publish call and conflict handling (`OVE_WFED057`).
- Diff computation (`OVE_WFED055`).
- Validation computation (`OVE_WFED061`).

## 5. Detailed requirements

1. Props: `{ open, baseVersionNo, nextVersionNo, diff: DefinitionDiff, validation: {status:'checking'|'valid'|'warning'|'error', errors, warnings}, activeRuns: {number, versionNo}[], visibility, busy, error?: AppErrorView, onConfirm(note), onCancel(), onFocusIssue(issue) }`.
2. Header: 'Opublikować jako v8?'; subline 'Zmiany względem v7'. Counters row as `ui:Pill`s: 'dodane 2', 'usunięte 1', 'zmienione 3' (word units, never colour alone).
3. `DiffList`: entries grouped under three headings 'Bezpieczeństwo' (risk `safety`, amber `Card` tone), 'Zachowanie' and 'Informacje'; each entry shows kind glyph + node label + field changes `before -> after` in mono (bounded). `safety` entries have the extra line 'Ta zmiana wpływa na limity lub uprawnienia przyszłych Runów.' and an acknowledgement checkbox 'Rozumiem' required before Publish is enabled (one checkbox per safety group, not per entry).
4. `ValidationGate`: valid -> mint line 'Walidacja: 0 błędów'; warnings -> amber 'Walidacja: 2 ostrzeżenia' (publish allowed); errors -> error tone with the first 5 issues, each a button 'Pokaż' that closes the dialog and focuses the Node (`onFocusIssue`). Publish button disabled while errors exist, with reason text 'Popraw błędy walidacji'.
5. Layout-only state: when `diff.layoutOnly` is true the dialog says 'Brak zmian w logice. Zmieniono tylko układ.', the primary button reads 'Zapisz układ' and calls `onSaveLayoutOnly` (saves the Draft, creates no Version, because publishing a layout-only change is pointless); when `diff.identical` and nothing changed at all, the primary button is disabled.
6. Consequence block: 'Działające Runy zostają przy swojej Wersji: #14 (v7).' and 'Nowe Runy użyją v8.'; for a private Workflow the line 'Wersja jest prywatna w tym Workspace.' is added.
7. Consequence block: 'Działające Runy zostają przy swojej Wersji: #14 (v7).' and 'Nowe Runy użyją v8.'; for visibility private the line 'Wersja jest prywatna w tym Workspace.'.
8. Change note: `ui:Textarea` max 500 chars with counter; trimmed; optional.
9. Buttons: 'Opublikuj v8' (primary violet, busy spinner), 'Anuluj'. Initial focus on the dialog title; `Enter` in the textarea does not submit; `Ctrl/Cmd+Enter` submits when enabled.
10. Server error mapping shown inline above the buttons: `wfrt.publish_invalid` -> 'Serwer znalazł błędy walidacji' (and the list refreshes), `wfrt.draft_revision_conflict` -> handled by `OVE_WFED057` (the dialog receives `error.code` and shows the conflict banner).

## 6. Design notes

Not in the mock. Use `ui:Dialog` form variant (width 640, max-height 80vh, body scrolls). Layout: title, counters, scrollable diff, validation gate, consequence card, note, footer. Tokens: safety group on amber `Card` tone, behaviour on default card, info collapsed by default (disclosure). Empty diff and loading (skeleton rows) states are required.

## 7. Reuse

- `ui:Dialog`, `ui:Card`, `ui:Pill`, `ui:Checkbox`, `ui:Textarea`, `ui:ValidationPill`, `ui:EmptyState`, `ui:Skeleton`.

## 8. Architecture and code placement

`@WF/publish/` components, props-driven; depends on `DefinitionDiff` type and ui-kit only; the container that supplies data is `OVE_WFED057`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Diff values are shown as plain text; expressions and prompts may contain hostile text and are never interpreted. The safety acknowledgement is a UI aid only; the server enforces validation regardless.

## 10. Errors and edge cases

- Very long diff: list virtualised after 50 entries.
- Validation still 'checking': Publish disabled with 'Sprawdzanie…'.
- Active Runs list longer than 5: '+N więcej'.
- Base version missing (first publish): header 'Opublikować jako v1?' and diff shows 'Pierwsza wersja' with node counts only.

## 11. Acceptance criteria

- [ ] Given errors, then Publish is disabled and each error has a Pokaż action that returns the Node id.
- [ ] Given a `safety` group, then Publish stays disabled until it is acknowledged.
- [ ] Given a layout-only diff, then the button reads 'Zapisz układ' and no version number is claimed.
- [ ] Given warnings only, then Publish is enabled and the warnings are listed.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Stories per state (computing, ready, blocked, publishing, failed, identical, layout-only, first publish); interaction tests for acknowledgement and keyboard submit; axe. `pnpm --filter desktop vitest run src/features/workflow-editor/publish`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: layout-only drafts are saved without creating a Version ('Zapisz układ'); if the Owner wants layout to be versioned this changes with WFRT003 canonicalisation (positions are excluded from the hash).
