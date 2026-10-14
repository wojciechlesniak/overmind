---
id: OVE_DS102
title: Build WorkflowHeader (title, visibility tab, version badge, Run pill, actions)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS019, OVE_DS020, OVE_DS039, OVE_DS040, OVE_DS045]
soft_depends_on: []
provides: ["ui:WorkflowHeader"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Button", "ui:VersionBadge", "ui:NodeTab", "ui:Pill", "ui:StatusDot"]
owns: ["packages/ui-kit/src/canvas/WorkflowHeader/**"]
reads: []
design: design.png
design_source: "Main#canvas/workflow-header (crop 330,178,802,95 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19, 28, 8]
---

# OVE_DS102: Build WorkflowHeader (title, visibility tab, version badge, Run pill, actions)

## 1. Summary

Builds the Workflow header above the canvas: name (26/700), filled visibility word tab (`PRYWATNY`), version badge (`v7 · opublikowana`), Run state pill (`Run #14 · działa · 18 min`) and the action buttons (`Dry-run`, `Pauza runu`, violet `Edytuj jako v8`) with edit-mode, draft and read-only variants.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11 (header is a composition not listed in C11), E5, E7, E16, E27. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Workflows are versioned programs: a published version is read-only, edits create a new version (`Edytuj jako v8`, ADR 0019). A Workflow can be public (all Workspaces) or private (ADR 0028) and the word is always shown. The Run pill is the shared `StatusPill`.

## 3. Scope (in)

- `WorkflowHeader` with modes published/draft/running/paused, buttons and labels, stories.

## 4. Out of scope

- Dry-run/pause/edit logic (feature), version history UI.

## 5. Detailed requirements

1. `WorkflowHeaderProps`:
   ```ts
   interface WorkflowHeaderProps {
     name: string; visibility: Visibility; visibilityLabel: string;     // 'PRYWATNY'
     version: { label: string /* 'v7 · opublikowana' */; kind: 'published' | 'draft' };
     run?: { label: string /* 'Run #14 · działa · 18 min' */; state: RunState; onOpen?(): void };
     actions: { dryRun?: Action; pause?: Action; edit?: Action; save?: Action; discard?: Action };
     mode: 'published' | 'draft'; dirty?: boolean;
   }
   type Action = { label: string; onClick(): void; disabled?: boolean; disabledReason?: string; busy?: boolean }
   ```
2. Layout (mock): title row (height 90 region): name 26/700/-0.52 (E7, ellipsis, title), filled visibility tab (`NodeTab` filled shape: padding 3px 8px, radius 7, mono 10/700 +0.1em, bg violet for private `#9B7BFF`, blue for public; E16: filled shape in headers), version badge `ui:VersionBadge` (mono 12, `v7 · opublikowana`, bg `line`), Run `Pill` (magenta tint: dot + `Run #14 · działa · 18 min`; done mint, escalated amber, etc. by `runStateTone`) - then right-aligned `Dry-run` `Button secondary md`. Second row (gap 10): `Pauza runu` secondary, `Edytuj jako v8` `Button primary-violet md` (draft mode: `Zapisz jako v8` primary + `Odrzuć` ghost, an `Niezapisane zmiany` amber pill when `dirty`). Rows wrap; the title row never wraps (nowrap + ellipsis on the name).
3. Mode behaviour: `published` -> canvas is read-only (feature passes `mode=view`) and `Edytuj jako vN+1` is the only edit entry; `draft` -> version badge shows `v8 · wersja robocza` in violet, `Dry-run` stays enabled. While a Run is active `Pauza runu` is visible; with Global Pause active (E33) action buttons are disabled with reason `Wszystko wstrzymane`.
4. A11y: `<header>` with `<h1>`-level heading per page; buttons have visible disabled reasons through `aria-describedby`; the Run pill is a link (`onOpen`) to the Run in Activity.
5. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
6. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
7. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
8. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
9. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
10. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
11. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: header region: `Dostarczanie funkcji` + filled `PRYWATNY` tab, `v7 · opublikowana`, magenta Run pill, `Dry-run`, `Pauza runu`, violet `Edytuj jako v8`. Not drawn: draft mode, dirty, busy, disabled, Global Pause, long name.

## 7. Reuse

Consumes `ui:Button`, `ui:VersionBadge`, `ui:NodeTab`/`VisibilityBadge` filled shape, `ui:Pill`, `runStateTone` (OVE_DS040); page header patterns from OVE_DS045. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Visibility word always present (ADR 0028). `Edytuj jako vN` creates a NEW version; the component never offers overwriting a published version (immutability, ADR 0008 spirit). Dry-run must be visibly labelled so it is never confused with a real Run.

## 10. Errors and edge cases

- No run -> pill omitted.
- Name 80 chars -> ellipsis.
- `actions.edit` missing -> button omitted.
- Unknown run state -> neutral pill.

## 11. Acceptance criteria

- [ ] Given the mock fixture, Then all elements render with the mock layout in two rows.
- [ ] Given `mode=draft` and `dirty`, Then `Zapisz jako v8`, `Odrzuć` and the amber pill appear and `Edytuj` is absent.
- [ ] Given disabled with reason, Then the reason is announced.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: where version history lives (default: version badge opens a popover, feature).
