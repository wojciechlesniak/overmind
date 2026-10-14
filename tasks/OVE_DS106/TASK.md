---
id: OVE_DS106
title: Visual regression part 2 for Agents, Skills, Approvals, Activity and settings pages
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS039, OVE_DS041, OVE_DS043, OVE_DS044, OVE_DS045, OVE_DS056, OVE_DS057, OVE_DS058, OVE_DS066, OVE_DS068, OVE_DS069, OVE_DS070, OVE_DS071, OVE_DS072, OVE_DS075, OVE_DS076, OVE_DS077, OVE_DS078, OVE_DS079, OVE_DS080, OVE_DS081, OVE_DS082]
soft_depends_on: []
provides: ["lib:visualPagesB"]
needs: ["ui:tokens", "ui:Text", "ui:Icon"]
owns: ["packages/ui-kit/src/pages/b/**", "packages/ui-kit/tests/visual/b/**"]
reads: ["OVE_TEST005"]
design: design.png
design_source: "Agenci#all/agenci+skille+zgody+activity+workspace+polaczenia+ustawienia (crop 0,0,1440,900 CSS px); design-skille.png = Skille (crop 0,0,1440,900); design-zgody.png = Zgody (crop 0,0,1440,900); design-activity.png = Activity (crop 0,0,1440,900); design-workspace.png = Workspace (crop 0,0,1440,900); design-polaczenia.png = Polaczenia (crop 0,0,1440,900); design-ustawienia.png = Ustawienia (crop 0,0,1440,900)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [17]
---

# OVE_DS106: Visual regression part 2 for Agents, Skills, Approvals, Activity and settings pages

## 1. Summary

Assembles and visually verifies page stories for Agenci (profile + memory), Skille, Zgody (Approvals and Access Requests), Activity (Runs + trace + usage), Workspace settings, Polaczenia (Connections) and Ustawienia (App settings) against their 1440x900 PNGs.

## 2. Context

Same purpose and method as OVE_DS105 for the second group of views. Content below the fold in the mocks (Workspace settings 1842px, Agents, Activity events, Connections 960px) is verified by scrolling the INNER panel to fixed offsets (`@scroll` screenshots) in addition to the first viewport.

## 3. Scope (in)

- Seven page stories + fixtures; viewport shot and scrolled shots (inner panel scrollTop 0 and a documented offset) per long page.
- Documented exceptions per E-number.
- Discrepancy fixes in page composition, component defects reported to owners.

## 4. Out of scope

- Pages in OVE_DS105 and OVE_DS107.

## 5. Detailed requirements

1. Pages: Agenci (list 290 with STALI/DYNAMICZNI sections, profile header, config form, tools table, memory aside 310), Skille (grid, filter bar, detail 340), Zgody (list + detail with diff, no active rail item: opened from the top bar Approvals button), Activity (runs list 250, trace, events table, usage 300), Workspace (nav 240 + sections incl. matrix, rules, docs, isolation, danger), Polaczenia (card grid + fallback panel 320), Ustawienia (two-column sections + Global Pause panel).
2. Rail active item per view as in `VIEWS.md` (Agenci 343, Skille 343, Activity 174, Workspace/Polaczenia/Ustawienia 840 settings; Zgody none) and `SubTabs` sets (`Agenci | Skille`, `Canvas | Runy i Activity`, `Workspace | Połączenia i modele | Aplikacja`); the Ustawienia page has the tab bar at y=67 in the mock because its top bar is 67 high: with the normalised single-row bar (E1) all pages share y=67+... the exceptions list records the shift.
3. Method, determinism, tolerance, exceptions file and the no-page-scroll assertion are identical to OVE_DS105 (shared helpers imported from its `pages/` helpers; if not yet merged, duplicate-free stub `AppShell`).
4. Scrolled comparison: for Workspace settings the harness scrolls the main column to 600 and 960 px and compares to the corresponding crops of the Playwright mock renders produced by the task's `render-mock-scrolled` script (the same technique used for the crops in the design tasks), because the static PNG only has the first viewport.
5. Security-sensitive pages (Zgody, Workspace permissions, Polaczenia): in addition to pixels, assert via DOM tests that destructive/permanent actions are not primary (E26: `Zezwalaj na stałe w tym Workspace` is secondary, scope words present), expired grants carry no checked rights and no secret fields exist on Connections.
6. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
7. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
8. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
9. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
10. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
11. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
12. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` = Agenci full view; extras: Skille, Zgody, Activity, Workspace, Polaczenia, Ustawienia (`design-skille.png` ...). Scrolled regions are compared with generated scrolled renders (see requirement).

## 7. Reuse

Reuses the part 2 composites only. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Dev/test composition only.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Fictional fixtures only. DOM assertions guard the permission UX described above.

## 10. Errors and edge cases

- Scroll offset differs between mock render and page -> compare relative to the section anchor, not absolute px.
- Large pages exceed the screenshot size limit -> split by region.

## 11. Acceptance criteria

- [ ] Seven page stories render at 1440x900 without console errors.
- [ ] Each is within tolerance of its PNG after documented exceptions; long pages also pass their scrolled comparisons.
- [ ] No page-level scroll.
- [ ] Security DOM assertions pass.
- [ ] `visual-exceptions.md` updated.

## 12. Test plan

Playwright via the part 1 harness plus Vitest DOM assertions. `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

Parallel with OVE_DS105 and OVE_DS107.

## 14. Open questions and assumptions

- OPEN: whether the Zgody page keeps no active rail item (mock) or highlights the Chief item (default: mock).
