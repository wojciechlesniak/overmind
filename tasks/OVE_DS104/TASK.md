---
id: OVE_DS104
title: Accessibility pass over the whole kit (focus ring, roles, contrast, motion, keyboard)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS039, OVE_DS048, OVE_DS052, OVE_DS058, OVE_DS068, OVE_DS072, OVE_DS074, OVE_DS076, OVE_DS079, OVE_DS081, OVE_DS084, OVE_DS085, OVE_DS086, OVE_DS087, OVE_DS096, OVE_DS101, OVE_DS103]
soft_depends_on: []
provides: ["lib:a11yChecklist", "ui:a11yAudit"]
needs: ["ui:tokens", "ui:Text", "ui:Icon"]
owns: ["packages/ui-kit/src/a11y/**", "packages/ui-kit/.storybook/a11y/**"]
reads: ["OVE_TEST005"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [17]
---

# OVE_DS104: Accessibility pass over the whole kit (focus ring, roles, contrast, motion, keyboard)

## 1. Summary

Audits and fixes every part 2 composite for accessibility: global `:focus-visible` ring (E19), roles and names (switch, tab, radio, listbox, dialog, menu, toolbar, log), 3:1 control borders (E18), 10px text minimum (E17), reduced motion, keyboard maps, and adds an automated axe gate plus a keyboard-map document for the canvas.

## 2. Context

Closing task of the design-system area. The inventory (E17, E18, E19, E21, E22, E23) lists defects of the mock that individual tasks normalise locally; this task verifies the result across the whole kit and fixes what slipped through. It adds no new component. Prerequisite reading: `COMPONENT-INVENTORY.md` section E and the G4 rule repeated in every task.

## 3. Scope (in)

- A checklist (`a11yChecklist`) with one row per composite: role/name/state, tab order, key map, focus ring visible on `bg-app` and on every surface token, contrast pairs, reduced motion, hit target >= 24px (WCAG 2.5.8), forced-colours sanity.
- Automated gate: `@storybook/addon-a11y` axe config for ALL stories in dark theme failing CI on `serious`/`critical`; per-rule waivers must be listed with a reason.
- Fixes in any file of part 2 are made through small patches in THIS task only for confirmed defects (list in the PR), otherwise a defect is reported back to the owning task.
- Docs: `docs/a11y.md` MDX page with the keyboard maps (canvas, menu, tray, wizard).

## 4. Out of scope

- New features, screen-reader testing of apps/desktop (features own that).
- Light theme.

## 5. Detailed requirements

1. Global ring: one rule `:where(a, button, input, select, textarea, summary, [tabindex], [role=button],[role=menuitem],[role=tab],[role=switch],[role=radio],[role=option]):focus-visible { outline: 2px solid var(--om-focus); outline-offset: 2px }` (token `--om-focus` #9B7BFF) in the part 1 base CSS; the audit verifies no component sets `outline: none` without an equivalent `box-shadow` ring (lint rule `no-bare-outline-none` written here as a stylelint plugin config).
2. Contrast table (automated with `culori`/`wcag-contrast` in a unit test over the token file): body text >= 4.5:1 on every surface (`bg-app`, `bg-surface`, `bg-code`, `bg-wizard-sidebar`, card tones), large text >= 3:1, control borders `line-control` >= 3:1 on `#140F20` (E18), focus ring >= 3:1 against both adjacent colours, state colours used as text (mint, amber, magenta, error, lavender) >= 4.5:1 on the surface they appear on; the test prints a matrix and fails with the offending pair. Known low pairs must be fixed by token tweak proposals recorded in section 14 (this task may NOT change token values, it files them to part 1).
3. Roles/names audit (per component, each verified by a Testing Library test using `getByRole` with name): Switch `role=switch aria-checked`; Tabs `tablist/tab/tabpanel` with roving tabindex (arrows, Home/End); RadioCardGroup `radiogroup`; FolderPicker `radiogroup`; ConversationList/RunList/SkillPalette listbox or list as specified; Menu/TrayMenu `menu/menuitem` with Esc; Dialog focus trap and return focus; Toolbar `toolbar` with roving; DataTable/RunTrace table semantics; MessageThread and DiscussionThread `role=log`; NumberStepper `spinbutton`; Minimap pointer + keyboard; canvas stage `application` with `aria-roledescription` and documented shortcuts; status words present for every colour-coded state (E21).
4. Keyboard coverage matrix: every pointer-only affordance has a keyboard path: Skill drag -> `Przypisz do…` menu; palette node drag -> `Enter` add; reorder drag -> Alt+Arrows; node move -> arrows; connection -> `C` flow; hover-only controls (move buttons, remove chips) become visible on `:focus-within`. A Playwright keyboard-only script performs: add node, attach skill, connect, reorder fallback, approve (button only) and passes without a pointer.
5. Motion: single `prefersReducedMotion` CSS layer and a `useReducedMotion` hook (part 1) verified: pulsing glows, edge dash flow, shimmer, toolbar zoom animation, auto-pan, caret blink are disabled or static.
6. Target sizes: interactive elements >= 24x24 CSS px (WCAG 2.5.8) excluding inline text links; canvas ports have 24px hit areas (checked by test); Telegram preview buttons 40/44.
7. Forced colours / high contrast (`@media (forced-colors: active)`): glow-only states (node working/waiting, selected rings) also get a `border`/`outline` fallback using `Highlight`/`CanvasText` so state remains visible; test via Playwright `forcedColors: 'active'` screenshots (smoke, not pixel compared).
8. CI integration: the axe gate runs in `pnpm --filter @overmind/ui-kit test:storybook` (test-runner `postVisit` hook), results saved as a report artefact; a failing rule fails the job unless listed in `a11y-waivers.json` (each entry needs `rule`, `story`, `reason`, `expires`).
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

No design image: the task is a cross-cutting verification. The reference is the inventory section E and the states checklist in `VIEWS.md` (hover, focus, pressed, disabled, loading, error, empty for every view).

## 7. Reuse

Uses the part 1 token file and base CSS; adds only test utilities and docs. Does not duplicate component logic. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Folder `src/a11y/` holds test utilities and the checklist data only; it is not exported from the barrel (dev/test only).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Accessibility fixes must not weaken security UX: focus order must never skip a decision button or place a destructive action before the safe one in a dialog/Approval card (safe action first: Deny/Cancel precedes Allow in tab order only when visually first; otherwise primary first per design), and screen-reader names for approval actions must include the scope (`Zezwól tylko ten Run`, ADR 0003). Reports must not contain real user data.

## 10. Errors and edge cases

- A rule fails only in one browser (WebKit vs Chromium) -> test in both Playwright engines used by OVE_TEST005; waiver requires proof.
- A story is non-deterministic -> fixed with fixtures first.
- Third-party (React Flow) markup violating axe -> wrapped/overridden in the adapter or waived with an expiry.

## 11. Acceptance criteria

- [ ] `test:storybook` runs axe on every story and passes with the waiver list empty or fully justified.
- [ ] Contrast test passes for the full token matrix.
- [ ] Keyboard-only Playwright script completes the five canvas/wizard actions.
- [ ] Under `prefers-reduced-motion: reduce`, no CSS animation or transition longer than 1ms is computed on any story (automated check).
- [ ] No component sets `outline: none` without replacement (lint passes).
- [ ] `docs/a11y.md` published in Storybook with the keyboard maps.

## 12. Test plan

Vitest contrast and role tests, Storybook test-runner with axe, Playwright keyboard-only and forced-colors smoke tests. Commands: `pnpm --filter @overmind/ui-kit test`, `test:storybook`, `test:a11y`.

## 13. Parallelization notes

Runs after the composites are merged; touches only `src/a11y/**` and docs, plus minimal patches listed in the PR. Parallel with OVE_DS105 .. OVE_DS108.

## 14. Open questions and assumptions

- OPEN: WCAG target level (default AA 2.2 for the desktop app).
- ASSUMPTION: screen-reader manual testing (VoiceOver) is done once per release by the Owner/QA, outside this task.
