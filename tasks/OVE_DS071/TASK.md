---
id: OVE_DS071
title: Build SkillCard, SkillGrid and SkillFilterBar
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS017, OVE_DS019, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:SkillCard", "ui:SkillGrid", "ui:SkillFilterBar"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Pill", "ui:VisibilityBadge", "ui:AvatarStack", "ui:Button"]
owns: ["packages/ui-kit/src/skills/SkillCard/**", "packages/ui-kit/src/skills/SkillFilterBar/**"]
reads: []
design: design.png
design_source: "Skille#skills/filter-chips + grid (crop 96,342,980,466 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [28, 12]
---

# OVE_DS071: Build SkillCard, SkillGrid and SkillFilterBar

## 1. Summary

Builds the Skill library list: `SkillCard` (name, version, visibility word, origin chip, description, usage footer; selected, system variant), the responsive `SkillGrid` and `SkillFilterBar` (visibility and origin filter chips with counts).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Skille.dc.html` and its 2x render `_design/views/Skille.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C6.6 (SkillCard), C6.8 (SkillFilterBar), B2/B3. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Skills are versioned instructions; they carry source (Owner, Chief, import), version and visibility and give no tool access (SPEC 8, ADR 0003/0012). Public Skills work in every Workspace, private only in their own. The system Skill `overmind` (ADR 0027) is read-only and has no visibility badge.

## 3. Scope (in)

- Cards, grid, filter bar, loading/empty, system variant.

## 4. Out of scope

- Detail panel (OVE_DS072), the palette item for the canvas (OVE_DS097), import dialog.

## 5. Detailed requirements

1. `SkillCardProps { name: string; version: string; visibility?: Visibility; visibilityLabel?: string; origin: 'owner' | 'chief' | 'import' | 'system'; originLabel: string; description: string; agents: AvatarStackItem[]; usageLabel: string /* '3 agentów · 41 użyć' */; selected?: boolean; onSelect: () => void; system?: boolean }`. Button card radius 18, padding 14, gap 10, `bg-surface` + 1px `line`. Row 1: name mono 14/500 (`text-primary`, ellipsis), version mono 12 `text-muted`, outline `VisibilityBadge` (word), spacer, origin `Pill` variant `origin` (mono 10/500 padding 3 8: import amber tint #FFCF85 on rgba(255,181,71,.12); Właściciel violet tint #D6C9FF on rgba(155,123,255,.14); Chief magenta tint #FFB3E6 on rgba(242,95,196,.12); system neutral). Description 13px `text-secondary` (2-line clamp, title). Footer: `AvatarStack` 22 (ring per E14, max 4 + `+N`) and `usageLabel` mono 11 `text-muted`.
2. Selected: 1.5px `#9B7BFF` + `ring-select-sm` (the same selected look as `TaskCard`); `aria-current`. System variant: no `VisibilityBadge`, origin chip `systemowy` with a `lock` 12 icon, description unchanged, `aria-label` states read-only.
3. `SkillGrid`: `grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px`, `<ul>`; cards equal height per row.
4. `SkillFilterBarProps { value: { visibility: 'all' | 'public' | 'private'; origins: ('owner' | 'chief' | 'import')[] }; onChange: (v) => void; counts: { all: number; public: number; private: number; owner: number; chief: number; import: number }; labels: { all: string; public: string; private: string; owner: string; chief: string; import: string; group: string } }`: row of `Pill` chips (padding 6 10, mono 12): `Wszystkie` (`meta-selected` look: #1C1330 + 1px #5B3E8F + #EFE9F7 when selected), `Publiczne · 6` (blue text #6FA8FF), `Prywatne · 2` (violet text #9B7BFF), a 1px divider, `Właściciel · 4`, `Chief · 2`, `import · 2` (origins multi-toggle); toggles are buttons with `aria-pressed`; the visibility group behaves like a radio set (`role="radiogroup"` semantic via `aria-pressed` buttons in a `role="group"`); the count is part of the visible text. Selected look for tone chips: fill `bg-raised`, border `line-strong`, tone text kept.
5. Loading: 6 `CardSkeleton`s; empty library: `ui:EmptyState` `Brak Skilli. Zaimportuj lub poproś Chiefa o propozycję.` (the feature passes it; story included); no results after filtering: muted text with a `Wyczyść filtry` ghost button.
6. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
7. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
8. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
9. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
10. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
11. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
12. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: filter chips (`Wszystkie` selected, `Publiczne · 6` blue, `Prywatne · 2` violet, origin counts) and the grid: `grill-me v3 PUBLICZNY import` (amber), `TypeScript v4 Właściciel` (selected), `tdd v2`, `security-audit v1 PRYWATNY Chief` (magenta), `user-stories`, `e2e-playwright`, `ui-review`, `overmind` (system). NOTE: avatar stacks collapse in the mock (E14): implement ring + overlap. Not in the mock: hover/focus, loading, empty, no results, long names.

## 7. Reuse

Consumes `ui:Card`, `ui:Pill` (`origin`, `meta`), `ui:VisibilityBadge`, `ui:AvatarStack`, `ui:Button`.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Skill names/descriptions come from files or imports (untrusted): text only. The origin chip makes provenance visible (an imported Skill is never presented as Owner-authored). System Skills are visibly read-only.

## 10. Errors and edge cases

- Long names -> ellipsis, version stays visible.
- `agents` empty -> footer shows only the usage label.
- Counts mismatch -> shown as given.
- Unknown origin -> neutral chip with raw label.

## 11. Acceptance criteria

- [ ] Given the fixture, Then the grid and chips match `design.png` within tolerance.
- [ ] Given the system Skill, Then no visibility badge renders and the lock/origin chip does.
- [ ] Given the visibility group, Then exactly one chip is `aria-pressed=true`.
- [ ] Given `selected`, Then the violet ring is shown.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: origin filters multi-select, visibility single-select.
