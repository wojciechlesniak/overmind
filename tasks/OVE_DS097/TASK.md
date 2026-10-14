---
id: OVE_DS097
title: Build SkillPalette and SkillPaletteItem (left panel upper half)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS017, OVE_DS019, OVE_DS026, OVE_DS029, OVE_DS032, OVE_DS039, OVE_DS040, OVE_DS067]
soft_depends_on: []
provides: ["ui:SkillPalette", "ui:SkillPaletteItem"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:SearchField", "ui:Pill", "ui:VisibilityBadge", "ui:Skeleton", "ui:EmptyState", "ui:Menu", "lib:skillDragPayload", "ui:SkillDragChip"]
owns: ["packages/ui-kit/src/canvas/SkillPalette/**"]
reads: []
design: design.png
design_source: "Main#canvas/side-panel (skills upper half) (crop 72,162,240,620 CSS px); design-item.png = Main (crop 86,310,211,60); design-dragging.png = Main (crop 86,660,211,72)"
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 8"]
adr_refs: [12, 28, 25]
---

# OVE_DS097: Build SkillPalette and SkillPaletteItem (left panel upper half)

## 1. Summary

Builds the upper half of the canvas left panel: header `Zainstalowane Skille` + count, `SearchField`, drag hint, and the draggable `SkillPaletteItem` list (grip, mono name + version, visibility word, `N agentów`), including the dragging item look and the keyboard 'Przypisz do…' alternative.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.7 (SkillPalette, SkillPaletteItem), C6.6 (compact SkillCard), B2. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Skills are installed capabilities (SPEC 3); a Skill from the internet only comes from the Owner (ADR 0012). Public Skills are shared by all Workspaces, private ones stay in this Workspace (ADR 0028), always shown as a word. Dragging a Skill onto a node attaches it to that Agent in this Workflow.

## 3. Scope (in)

- `SkillPalette`, `SkillPaletteItem`, search filtering (controlled), dragging look, loading/empty, a11y alternative, stories.

## 4. Out of scope

- Drop handling (OVE_DS096), the library page card (OVE_DS071), Skill data.
- Node palette (OVE_DS098).

## 5. Detailed requirements

1. `SkillPaletteItemProps { skill: { id: string; name: string; version: string; visibility: Visibility; usedBy: string /* '3 agentów' */; scopeNote?: string }; dragging?: boolean; draggingNote?: string /* 'przeciągasz na Senior Reviewera' */; onAssign?(skillId: string): void; disabled?: boolean }`. Row: `draggable` button-like (`role="listitem"` + inner `button`), radius 14, padding 10 14, gap 10, bg `bg-surface` + 1px `line`; grip `grip` icon 16 `text-muted` left, column: name mono 14/500 `text-primary` + version mono 14 `text-muted` (`grill-me v3`), then line: outline `VisibilityBadge` (`PUBLICZNY` blue / `PRYWATNY` violet, E16 outline 10px) + `usedBy` 12px `text-secondary`. Height 53 (mock 53; 65 when a note wraps).
2. Dragging (`dragging`): `border: 1.5px dashed #F25FC4`, bg `rgba(242,95,196,.06)`, text `#FFB3E6`, the second line replaced by `draggingNote` (12/1.35, 2-line clamp); the original row stays in place (it is the source) at this look; the pointer carries `ui:SkillDragChip` (the browser drag image is the chip rendered offscreen via `setDragImage`).
3. `SkillPaletteProps { heading: string; count: number; search: { value: string; onChange(v: string): void; placeholder: string }; hint: string; skills: SkillPaletteItemProps['skill'][]; draggingId?: string; draggingNote?: string; loading?: boolean; assignTargets?: { id: string; label: string }[]; onAssign?(skillId: string, nodeId: string): void; labels: { list: string; assign: string } }`: heading `Zainstalowane Skille` 18/700 + count mono 12 right; `SearchField` (40px, `Szukaj Skilla`, clear button); hint 13/1.45 `text-secondary` (`Upuść na zakładkę ze Skillami w prawym górnym rogu kafelka.`); list gap 10 scrolling inside the panel (panel owns scroll, G5). Filtering is by the parent (`skills` already filtered) but the component highlights nothing; empty -> `EmptyState` `Brak Skilli pasujących do wyszukiwania`.
4. Drag start (native HTML5 DnD): `onDragStart` builds the payload through `lib:skillDragPayload(skill)` (custom MIME, ids/strings only), sets `effectAllowed='copy'`, registers the dragged skill in the module store, `setDragImage(chip)`; `onDragEnd` clears the store and `dragging`. The palette itself calls no `canAccept`.
5. Keyboard alternative: focus a row + `Enter`/`Space` (or the trailing `Przypisz do…` menu button visible on focus) opens a `ui:Menu` of `assignTargets` (nodes by title) -> `onAssign(skillId, nodeId)`. Rows are in the tab order; `ArrowUp/Down` moves between rows.
6. System Skill (`overmind`, read-only): shown with a `lock` icon and without the visibility badge, not draggable in the palette (the engine attaches it automatically, ADR 0027).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the left panel top: heading with count `7`, search `Szukaj Skilla`, hint, the Skill list: `grill-me v3` PUBLICZNY `3 agentów`, `TypeScript v4`, `tdd v2`, `security-audit v1` PRYWATNY, `user-stories v2`, `ui-review v1` and the dragging item `review-rubric v1` (dashed magenta, `przeciągasz na Senior Reviewera`). Exact values from the mock; palette row 53px. Not drawn: loading, empty, system Skill, disabled, focus.

## 7. Reuse

Consumes `ui:SearchField`, `ui:VisibilityBadge`, `ui:Pill`, `ui:Menu`, `ui:Skeleton`, `ui:EmptyState`, OVE_DS067 (`lib:skillDragPayload`, `ui:SkillDragChip`). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The drag payload carries only `{ v:1, id, version }` plus display strings; no file contents or paths. The palette never reveals private Skill details of other Workspaces (the feature passes only what this Workspace may see).

## 10. Errors and edge cases

- `skills` empty and no search -> `EmptyState` with install hint supplied.
- Name longer than the row -> ellipsis + title.
- Drag cancelled with Esc -> look reset.
- Same Skill twice (duplicate ids) -> dev warning.

## 11. Acceptance criteria

- [ ] Given the mock list, Then rows are 53px with name/version/badge/usedBy as in the crop.
- [ ] Given `dragging`, Then the dashed magenta look and note appear.
- [ ] Given keyboard Enter on a row, Then the assign menu opens and selecting a node calls `onAssign`.
- [ ] Given `dragstart`, Then `dataTransfer` has our MIME with a valid payload and no other type.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: system Skill rows are not draggable.
- OPEN: show Skill description tooltip on hover (default: no).
