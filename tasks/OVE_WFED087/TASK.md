---
id: OVE_WFED087
title: "Accessibility pass for the Workflow page: keyboard map, focus, live regions, contrast"
area: WFED
kind: test
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS012, OVE_DS104, OVE_TEST004, OVE_TEST010, OVE_WFED082, OVE_WFED085, OVE_WFED086]
soft_depends_on: []
provides: ["feature:wfed-a11y", "lib:wfed-live-announcer"]
needs: ["lib:ui-a11y-test", "lib:keyboard-test-helpers", "lib:playwright-harness", "ui:a11yAudit", "lib:a11yChecklist"]
owns: ["apps/desktop/src/features/workflow-editor/__a11y__/**", "apps/desktop/src/features/workflow-editor/page/keyboard-map.ts", "apps/desktop/src/features/workflow-editor/page/live-announcer.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED087: Accessibility pass for the Workflow page: keyboard map, focus, live regions, contrast

## 1. Summary

One focused pass that makes the whole page operable without a mouse and announced correctly: documented keyboard map across regions, a single polite live announcer shared by the strip, overlay and validation, focus management for dialogs and the Inspector, contrast and reduced-motion checks, and automated axe plus keyboard e2e tests.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). CONVENTIONS Definition of Done requires keyboard operation, visible focus, axe clean. The canvas is the hardest area: Nodes, edges, ports, drag and drop must have keyboard paths (part 1 implements editing keys; this task verifies the page-level integration and owns the announcer). DS104 audited the kit; this pass audits the composed page.

## 3. Scope (in)

- `keyboard-map.ts` (documented shortcuts registry shown in a help dialog '?' ).
- `LiveAnnouncer` (single `aria-live=polite` region, queue, 2 s throttle per source).
- Focus rules: dialog return focus, Inspector heading focus, Esc behaviour hierarchy.
- Test suites: axe on all page states, keyboard-only scenario tests, contrast checks on glows and text over the dot grid, reduced-motion snapshot.

## 4. Out of scope

- Kit-level audit (DS104).
- Editing key bindings (part 1).

## 5. Detailed requirements

1. Keyboard map (documented and tested): `Tab` order left panel -> header -> strip -> stage -> Inspector; inside the stage arrows move selection between Nodes by geometry, `Enter` opens the Inspector for the Node, `Esc` returns focus from Inspector to the Node, `F8`/`Shift+F8` next/previous validation issue, `Ctrl/Cmd+F` Node search, `Ctrl/Cmd+Z`/`Shift+Z` undo/redo (edit mode), `+`/`-`/`0` zoom, `?` opens the shortcut help dialog. Conflicts with part 1 bindings are listed in the open questions and resolved by this map being authoritative.
2. Single announcer: events from strip, overlay and validation call `announce(key, params, {source})`; same-source messages throttled to one per 2 s; assertive is never used except for Run failure ('Run #14 zakończony błędem'); messages in the user's locale.
3. Focus management: every dialog traps focus and returns it to the invoking control; opening the publish dialog from the header returns to 'Zapisz jako v8'; closing the version popover returns to the badge.
4. Colour independence: automated check that each state style has glyph or word (grep of state maps in tests); visibility always a word.
5. Contrast: text and glyphs on glows/dot grid meet 4.5:1 (3:1 for large and UI components) using computed styles in Playwright for the state matrix; failures list the token.
6. Reduced motion: with `prefers-reduced-motion` no CSS animation runs on overlay elements (computed `animation-name: none`).
7. Screen reader names: Nodes `aria-label` 'Agent Developer, PRYWATNY, pracuje', edges described by labels ('nie spełnia → wróć do Developera'), ports labelled 'wejście'/'wyjście'.
8. Zoom/text scale 200%: no region becomes unreachable; panels scroll.

## 6. Design notes

N/A, functionality and tests only (the shortcut help dialog uses `ui:Dialog` with a two-column list).

## 7. Reuse

- `lib:ui-a11y-test` (axe wrapper), `lib:keyboard-test-helpers`, Playwright harness (TEST004).

## 8. Architecture and code placement

`keyboard-map.ts` (data), `live-announcer.ts` (service + `useAnnounce`), tests under `@WF/__a11y__/`. Regions call `useAnnounce` (small API) rather than owning live regions.

## 9. Security and safety

Accessibility features must not leak hidden data: announcements contain only names and states already visible to the Owner.

## 10. Errors and edge cases

- Many events at once: queue length capped at 5 (oldest dropped).
- Dialog opened from a dialog: focus stack handled.
- Announcer unmounted during navigation: queue cleared.

## 11. Acceptance criteria

- [ ] axe reports no violations on Published, Draft, Running, ViewingOld, Failed, Empty and Error page states.
- [ ] A keyboard-only scenario completes: select a Node, open Inspector, change visibility (cancel), publish dialog open/close, validation issue jump.
- [ ] Announcer throttling and assertive restrictions covered by unit tests.
- [ ] Contrast matrix test passes for all node/edge states.
- [ ] Reduced-motion test passes.

## 12. Test plan

Unit: announcer, keyboard-map consistency (no duplicate bindings). Playwright: `a11y-page.spec.ts` (axe per state), `keyboard-journey.spec.ts`. Command `pnpm --filter desktop test:e2e -g a11y`.

## 13. Parallelization notes

Run after composition. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: canvas arrow-key geometry navigation is part of part 1's keyboard path; if not, this pass records the gap as a proposal.
