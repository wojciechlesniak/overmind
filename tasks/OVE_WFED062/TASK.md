---
id: OVE_WFED062
title: "Build the validation badge wiring and the issue panel with click-to-focus"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS028, OVE_DS087, OVE_DS099, OVE_WFED061]
soft_depends_on: []
provides: ["feature:wfed-validation-panel"]
needs: ["ui:ValidationBadge", "ui:Popover", "ui:CanvasViewportController", "lib:wfed-live-validation", "feature:editor-canvas-controller", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/validation/ValidationBadgeContainer.tsx", "apps/desktop/src/features/workflow-editor/validation/IssueList.tsx", "apps/desktop/src/features/workflow-editor/validation/index.ts", "apps/desktop/src/locales/en/wfed-validation.json", "apps/desktop/src/locales/pl/wfed-validation.json"]
reads: []
design: design.png
design_source: "Main#canvas/validation-badge (crop 940,390,190,40)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED062: Build the validation badge wiring and the issue panel with click-to-focus

## 1. Summary

Feeds `ui:ValidationBadge` ('Walidacja: 0 błędów') from live validation, shows the issue list in a popover and focuses the offending Node, Edge or group on the canvas when an issue is clicked. Also supports keyboard navigation through issues (F8 / Shift+F8).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). Mock region `canvas/validation-badge` (949,397,171x28), mint pill 'Walidacja: 0 błędów' at the stage's top right. Error and warning states are not drawn; DS099 defines `ValidationBadge` with `issues[]` and `onFocusNode`.

## 3. Scope (in)

- Container mapping `IssueIndex` to badge props, with i18n messages.
- Popover `IssueList` with severity icon, message, target label and 'Pokaż'.
- Focus action: pan/zoom to the Node, select it, open the Inspector, flash the border 600 ms (respect reduced motion).
- Keyboard: `F8` next issue, `Shift+F8` previous, announced to screen readers.

## 4. Out of scope

- Computation of issues (`OVE_WFED061`).
- Canvas error styling on tiles (DS089 `error` state, set by `OVE_WFED082` from the index).

## 5. Detailed requirements

1. Badge status mapping: `valid` + 0 warnings -> 'Walidacja: 0 błędów' (mint); warnings -> 'Walidacja: 2 ostrzeżenia' (amber); errors -> 'Walidacja: 3 błędy' (error tone, glyph); `checking` -> 'Sprawdzanie…' (grey spinner); `stale` -> 'Walidacja niedostępna' (grey, button 'Spróbuj ponownie'). Polish plural rules via i18n plural keys (`błąd/błędy/błędów`).
2. The badge is a button only when issues exist; with 0 issues it is a plain status (`role=status`).
3. Popover list height max 320 px, scrolls; each item: glyph + message + muted target ('Węzeł: Developer', 'Krawędź: e-12', 'Port: QA.in'); click or Enter calls `focusIssue` and keeps the popover open for the next one; `Esc` closes.
4. Focus action uses `feature:editor-canvas-controller` (`focusNode(key)`, `focusEdge(id)`, `selectNode(key)`); for issues without a target (global, `path` only) it opens the Workflow-level section of the Inspector (`inputSchema`, limits).
5. Issue `fixHintKey` shown as a second muted line 'Podpowiedź: ...' when present.
6. Truncated reports show '+N więcej błędów' line with note 'Pokazano pierwsze 100'.
7. While `viewing_old` or `published` the badge shows the stored report summary with the label 'Zapisany raport'.
8. Announcements: when the error count changes, a polite live region says 'Walidacja: 3 błędy' (throttled 2 s).

## 6. Design notes

`design.png` shows the valid badge at the stage top right: mint dot with glow, mono 12 text, pill radius 999 on `#140F20` with 1px line. States not in the mock: warning, error (with ✗ glyph and error text colour `#FF8FA3`), checking, stale, popover open with list. Placement: stage slot `topRight` (top 10, right 10) from DS099; must not overlap the legend card, which sits below it in the mock (legend at y=423); on narrow stages the legend collapses (see `OVE_WFED084`).

## 7. Reuse

- `ui:ValidationBadge` (OVE_DS099), `ui:Popover`, `ui:StatusText`; canvas controller from part 1 (`feature:editor-canvas-controller`).

## 8. Architecture and code placement

`@WF/validation/` UI layer; depends on the issue index and the part 1 controller interface; no direct canvas internals.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Issue messages derive from keys and bounded params; node labels in params are escaped text.

## 10. Errors and edge cases

- Issue targets a Node that was just deleted locally: 'Pokaż' is disabled with 'Węzeł już nie istnieje'.
- Hundreds of errors from a hostile import: list virtualised, count capped at '99+'.
- Reduced motion: no flash animation, a static outline for 1.5 s instead.

## 11. Acceptance criteria

- [ ] Given a report with one error on node 'qa', when 'Pokaż' is clicked, then the canvas centres and selects the Node and the Inspector opens.
- [ ] Given 0 issues, then the badge equals `design.png` ('Walidacja: 0 błędów').
- [ ] Given F8, then focus moves to the next error in order and it is announced.
- [ ] Given stale validation, then the badge says 'Walidacja niedostępna' and offers retry.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Stories for every status; interaction test with a fake controller; axe; visual crop vs `design.png`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: part 1 canvas controller exposes `focusNode`, `focusEdge`, `selectNode` (flagged).
