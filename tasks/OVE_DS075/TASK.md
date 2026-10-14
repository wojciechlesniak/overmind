---
id: OVE_DS075
title: Build RunList and RunListItem (Runs sidebar)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS017, OVE_DS020, OVE_DS022, OVE_DS032, OVE_DS033, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:RunList", "ui:RunListItem"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:ListRow", "ui:Pill", "ui:StatusDot", "ui:Skeleton", "ui:EmptyState", "ui:SectionLabel"]
owns: ["packages/ui-kit/src/activity/RunList/**"]
reads: []
design: design.png
design_source: "Activity#activity/runs-list (crop 72,162,250,420 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19, 16]
---

# OVE_DS075: Build RunList and RunListItem (Runs sidebar)

## 1. Summary

Builds the 250px Runs list of the Activity page: `RunListItem` (id, state chip, title, meta) in four states (running, done, cancelled, escalated, plus failed and paused) and the scrolling `RunList` with heading, selection and empty/loading states.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Activity.dc.html` and its 2x render `_design/views/Activity.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C8.7 (RunListItem), B13 (RunRow), E27. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). A Run is one execution of a Workflow (SPEC 8, ADR 0019). The Activity page lists Runs newest first; the list is a selection master for the trace on the right. Escalation (quality loop limit hit) is amber/red-worded, never colour only. The Run state pill is shared with the canvas Run pill (E27 `StatusPill`).

## 3. Scope (in)

- `RunList`, `RunListItem`, states, keyboard selection (listbox pattern).

## 4. Out of scope

- Run data (RUN feature), pagination/virtualisation (feature supplies a window of items), RunTrace (OVE_DS076).

## 5. Detailed requirements

1. `RunListItemProps { id: string; number: string; state: RunState; stateLabel: string; title: string; meta: string; selected?: boolean; onSelect(): void }` (`RunState` from OVE_DS040). Row: `ListRow` variant `run`, button, padding 12 14, radius 14, gap 6, height 73 (mock: 73 with 4px gap). Line 1: mono 12 `#N` (`text-muted`) + state chip (`ui:Pill` tone by `runStateTone`: running magenta with dot + glow, done mint, cancelled grey, escalated amber (word `Eskalacja`), failed error, paused grey) right aligned; line 2: title 13/600 (2-line clamp, title attr); line 3: meta mono 11 `text-muted` (`18 min · iteracja 2`, `ukończony wczoraj`), single-line ellipsis.
2. Selected: bg `list-selected`, 1px violet border (selection is violet, magenta stays 'working', E5), `aria-selected=true`. Hover: surface +1 step. Running rows never animate beyond the dot glow (respect reduced motion).
3. `RunListProps { heading: string; count?: number; items: RunListItemProps[]; selectedId?: string; onSelect(id): void; loading?: boolean; error?: { message: string; onRetry(): void }; labels: { empty: string; list: string }; footer?: ReactNode /* 'Pokaż starsze' */ }`: lives in a `SidePanel` 250 (OVE_DS044); heading 15/700; list `role="listbox"` (`aria-label`), arrow keys move the roving focus, Home/End, Enter selects; scrolls inside the panel (G5). Loading = 4 skeleton rows 73px; empty = `EmptyState` small with the supplied text (`Brak Runów. Uruchom Workflow z Canvas.`); error = inline retry.
4. Run state mapping is data driven: unknown state -> neutral chip with the raw `stateLabel`. A running Run sorts first by the feature; this component preserves order.
5. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
6. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
7. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
8. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
9. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
10. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
11. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: heading plus the four Runs: `#14` Dostarczanie funkcji running (selected, magenta chip `działa`), `#13` done (mint), `#12` cancelled (grey), `#11` escalated (red/amber). Not drawn: failed, paused, loading, empty, error, long title, hover/focus.

## 7. Reuse

Consumes `ui:ListRow` (`run` variant), `ui:Pill`, `ui:StatusDot`, `ui:Skeleton`, `ui:EmptyState`, `ui:SectionLabel`, `runStateTone`/labels (OVE_DS040). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Run titles come from Workflow names (user text): text only. The list performs no cancel/retry action.

## 10. Errors and edge cases

- Meta empty -> row collapses to 2 lines (height 56).
- Selected id not in items -> nothing selected (no error).
- 1000+ items -> the feature windows; component handles 200 rows without layout thrash (`content-visibility: auto` on rows).

## 11. Acceptance criteria

- [ ] Given the four fixtures, Then chip tones/words match the mock and `Eskalacja` is words, not just colour.
- [ ] Given ArrowDown/Enter, Then focus moves and `onSelect(id)` fires.
- [ ] Given `loading`, Then 4 skeleton rows render with `aria-busy`.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION E27: chip comes from the shared `StatusPill` state map.
