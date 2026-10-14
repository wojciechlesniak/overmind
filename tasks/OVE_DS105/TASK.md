---
id: OVE_DS105
title: Visual regression part 1 for Pulpit, Chief, Czat-Agent, Tablica, Decyzje, Dyskusja
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS039, OVE_DS041, OVE_DS043, OVE_DS044, OVE_DS045, OVE_DS046, OVE_DS048, OVE_DS049, OVE_DS050, OVE_DS052, OVE_DS053, OVE_DS054, OVE_DS055, OVE_DS059, OVE_DS060, OVE_DS062, OVE_DS063, OVE_DS065, OVE_DS083, OVE_DS084]
soft_depends_on: []
provides: ["lib:visualPagesA"]
needs: ["ui:tokens", "ui:Text", "ui:Icon"]
owns: ["packages/ui-kit/src/pages/a/**", "packages/ui-kit/tests/visual/a/**"]
reads: ["OVE_TEST005"]
design: design.png
design_source: "Pulpit#all/pulpit+chief+czat+tablica+decyzje+dyskusja (crop 0,0,1440,900 CSS px); design-chief.png = Chief (crop 0,0,1440,900); design-czat-agent.png = Czat-Agent (crop 0,0,1440,900); design-tablica.png = Tablica (crop 0,0,1440,900); design-decyzje.png = Decyzje (crop 0,0,1440,900); design-dyskusja.png = Dyskusja (crop 0,0,1440,900)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [17]
---

# OVE_DS105: Visual regression part 1 for Pulpit, Chief, Czat-Agent, Tablica, Decyzje, Dyskusja

## 1. Summary

Assembles page-level Storybook stories (`Pages/Pulpit`, `Pages/Chief`, `Pages/CzatAgent`, `Pages/Tablica`, `Pages/Decyzje`, `Pages/Dyskusja`) at 1440x900 from the real kit components and compares each with its PNG in `_design/views/` through the visual harness, fixing small composition/spacing discrepancies.

## 2. Context

Component tasks compare crops. This task proves the composites fit together inside the real shell (rail 72 + top bar 67 + tabs + panels) and that no layout regressions appear (overflow, wrapped top bar E1, panel widths). Mocks are 2x PNGs of 1440x900. Stories use the Polish mock copy as fixtures. Pages are presentational compositions in the kit (`pages/` is dev-only, not exported); real screens live in `apps/desktop`.

## 3. Scope (in)

- One page story per view with fixtures reproducing the mock content exactly (fixtures shared in `pages/fixtures/`).
- Visual tests (`test:visual`) comparing full 1440x900 screenshot to `_design/views/<View>.png` with tolerance from OVE_TEST005; masks for known acceptable differences (font rendering, the normalisations of section E, listed in `visual-exceptions.md`).
- Fixes: when a page differs, the discrepancy is fixed in the page composition; component defects are reported to the owning task (or patched trivially with a note).

## 4. Out of scope

- Feature behaviour, data fetching, routing.
- Other six+ views (OVE_DS106, OVE_DS107).

## 5. Detailed requirements

1. Each page story = `<AppShell>` helper (rail `ui:AppRail`, `ui:TopBar` single row 67px per E1 with workspace switcher, `ui:PageLayout`/`SidePanel`, optional `SubTabs`) + view content built ONLY from kit components. Shell helper lives in `pages/AppShell.tsx` (dev-only) so each page is ~50 lines.
2. Viewport and determinism: Playwright viewport 1440x900, device scale factor 2, fonts loaded from the self-hosted subsets (part 1), animations disabled (`reducedMotion`), fixed clock and `Intl` locale `pl-PL`, no network. Screenshot masked areas: the caret blink, the progress shimmer.
3. Known intentional differences vs the PNG (documented in `visual-exceptions.md`, each with the inventory E-number): top bar always single row 67px with ellipsis (E1; the mocks with a switcher are 117px), Select caret down (E4), Tabs violet underline 42px (E5), page padding 24 (E6), avatar stack ring (E14), custom checkbox (E22). The visual test tolerance is applied after these; unlisted differences fail.
4. Per page acceptance: Pulpit (workspace grid, Chief strip, notifications, system), Chief (conversation list, thread, approval card, composer with quick actions, right Chief panel with lane counts), Czat-Agent (agent header, live terminal, facts block, composer), Tablica (filter bar, four lanes, task inspector with timeline), Decyzje (list, detail, alternatives, outcome), Dyskusja (list, header, messages, result panel).
5. Scroll regions: pages with content below the fold (thread, lanes, panels) scroll INSIDE their panel; a test asserts `document.scrollingElement.scrollHeight === innerHeight` (no page scroll, styl-wizualny).
6. Report: the run prints a table `page | diff % | status` and uploads diff images as CI artefacts; baselines are committed under `tests/visual/a/__baselines__/` produced by `pnpm test:visual --update` only on the reference runner image (OVE_TEST005).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` = the Workspaces dashboard (Pulpit) full view; the other views are the extras (`design-chief.png`, `design-czat-agent.png`, `design-tablica.png`, `design-decyzje.png`, `design-dyskusja.png`), exactly the targets of the comparison. Region slugs in `VIEWS.md` locate any mismatch.

## 7. Reuse

Reuses every part 2 composite; no new components. Shared fixtures are imported from the component fixtures files. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Pages are dev/test composition only (`src/pages/**` excluded from the build output).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Fixtures contain only fictional sample data (no real paths, names or tokens). The pages must not import `apps/*`.

## 10. Errors and edge cases

- Font loading race -> wait for `document.fonts.ready` before screenshot.
- Flaky diff due to sub-pixel text -> tolerance per harness; never blanket-mask large areas.
- A component not yet merged -> the page story is skipped with `test.fixme` and a tracked reason.

## 11. Acceptance criteria

- [ ] Six page stories render without console errors at 1440x900.
- [ ] Each page screenshot is within tolerance of its PNG after documented exceptions.
- [ ] No page-level scroll on any page.
- [ ] `visual-exceptions.md` lists every intentional difference with its E-number.
- [ ] CI uploads diff artefacts and fails on any regression.

## 12. Test plan

Playwright component/page screenshots through the part 1 harness (`lib:ui-visual-harness`), run with `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

Parallel with OVE_DS106 and OVE_DS107 (separate page folders and baselines). Starts when its listed component tasks are merged.

## 14. Open questions and assumptions

- OPEN: tolerance numbers (default from OVE_TEST005, e.g. 0.5% pixels, per-pixel threshold 0.1).
- ASSUMPTION: Pulpit top bar is the same 67px bar as other views (E1).
