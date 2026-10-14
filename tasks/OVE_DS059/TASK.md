---
id: OVE_DS059
title: Build WorkspaceCard (5 variants), WorkspaceGrid and ChiefSummaryStrip
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS017, OVE_DS020, OVE_DS021, OVE_DS031, OVE_DS032, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:WorkspaceCard", "ui:WorkspaceGrid", "ui:ChiefSummaryStrip"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:StatusDot", "ui:Pill", "ui:SegmentBar", "ui:AvatarStack", "ui:Avatar", "ui:Skeleton", "ui:EmptyState", "ui:Button"]
owns: ["packages/ui-kit/src/workspaces/WorkspaceCard/**", "packages/ui-kit/src/workspaces/ChiefSummaryStrip/**"]
reads: []
design: design.png
design_source: "Pulpit#dash/workspace-grid (crop 100,284,992,511 CSS px); design-summary.png = Pulpit (crop 100,170,992,94)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 12"]
adr_refs: [10, 28, 5]
---

# OVE_DS059: Build WorkspaceCard (5 variants), WorkspaceGrid and ChiefSummaryStrip

## 1. Summary

Builds the Workspaces dashboard building blocks: `WorkspaceCard` (working, done, paused, isolated, no-Run variants), the responsive `WorkspaceGrid` and the `ChiefSummaryStrip` banner with the Chief's one-line summary and 'Otwórz czat'.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Pulpit.dc.html` and its 2x render `_design/views/Pulpit.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C4.1 (WorkspaceCard), C4.2 (ChiefSummaryStrip), C4.5 (AvatarStack), E14. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). A Workspace is a project with its own Tablica, Decisions and Agent memory (SPEC 4); an isolated Workspace shares nothing outside and everything in it is private (ADR 0028, SPEC 10). The Chief summary answers 'one sentence per Workspace' (SPEC 4). Lane distribution counts come from the Task Board; Agents are shown as an avatar stack (E14: with a 2px separating ring and max 4 + `+N`).

## 3. Scope (in)

- `WorkspaceCard` (all variants), `WorkspaceGrid`, `ChiefSummaryStrip`, loading and empty (no Workspaces) states.

## 4. Out of scope

- Data (WSPACE feature), creating a Workspace (dialog).
- Notification centre (OVE_DS060).

## 5. Detailed requirements

1. `WorkspaceCardProps`:
   ```ts
   interface LaneCounts { todo: number; doing: number; review: number; done: number }
   interface WorkspaceCardProps {
     name: string; path: string; summary: string;               // summary = Chief one-liner
     state: 'working' | 'done' | 'paused' | 'idle';            // dot + border treatment
     isolated?: boolean;                                         // lock pill + note
     isolatedNote?: string;                                      // 'Nic nie wychodzi poza ten Workspace...'
     approvals?: { count: number; label: string };               // amber pill '3 Zgody czekają'
     lanes: LaneCounts; countsLabel: string;                      // preformatted caption
     agents: AvatarStackItem[]; runLabel?: string; idleLabel?: string;   // 'Run #14 · pętla jakości 2 z 5' | 'nikt nie pracuje' | 'bez aktywnego Runu'
     pausedLabel?: string;                                       // 'wstrzymany przez Ciebie'
     href?: string; onOpen?: () => void;
     labels: { isolated: string; lanes: string };
   }
   ```
2. Card (exact): link card (`<a>` or `button` role per `href/onOpen`), radius 22, padding 18, column gap 14, `bg-surface` + 1px `line`. Header row: `StatusDot` 10 (working = magenta + glow, done = mint + glow, paused/idle = grey no glow) + name 18/700 (ellipsis, title) + spacer + badges (gap 8): `izolowany` `Pill` with `lock` 12 icon (tone lavender), approvals `Pill` amber (`3 Zgody czekają`, tone amber tint). Path mono 12 `text-muted` (ellipsis). Summary 14/1.45 `text-body-soft` (#E3DAF0), clamp 3 lines.
3. Distribution: `ui:SegmentBar` height 8, radius 4, gap 2, segments `flex: N` in order todo `#8C80A6`, doing `#F25FC4`, review `#9B7BFF`, done `#62E3B4`; zero segments omitted; track role `img` with `aria-label` = `countsLabel`. Caption `countsLabel` mono 11 `text-muted` (`4 do zrobienia · 5 w toku · 1 review · 7 gotowe z 17`). When all counts are 0 show only the caption (`brak Zadań`) and an empty track.
4. Footer (flex, gap 12, space-between): `AvatarStack` (Avatar 26, overlap -6, 2px ring in the card background `bg-surface` per E14, max 4 + `+N` chip; empty stack hidden) and the run text mono 12 (`runLabel`; for paused `pausedLabel` + `idleLabel`; isolated `idleLabel`). Text is the state, so state is never colour only.
5. Variant visuals: `working` = 1px `rgba(242,95,196,.45)` border + `glow-card-working` (0 0 30px rgba(242,95,196,.12)); `done`/`idle` default; `paused` default with grey dot, summary unchanged, footer `pausedLabel`; `isolated` default plus the lock pill, an extra line under the summary (`isolatedNote`, 12px `text-secondary`) and the footer `bez aktywnego Runu`. Isolated and paused can combine.
6. Interaction: hover border `line-strong`, focus ring on the card (not on inner chips); the whole card is one link (no nested interactive elements: the approvals pill is plain text inside the link, `aria-label` of the link summarises name + state + approvals).
7. `WorkspaceGrid` props `{ children; minCardWidth?: number /* 380 */; 'aria-label' }`: `display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 14px` as a `<ul>` with `<li>` wrappers; cards are equal height per row (`align-items: stretch`).
8. `ChiefSummaryStrip` props `{ eyebrow: string /* 'CHIEF · PODSUMOWANIE' */; summary: ReactNode; action: { label: string; onClick?: () => void; href?: string }; loading?: boolean; stale?: { label: string } }`: `ui:Card` tone `chief` (1px rgba(242,95,196,.4), gradient 120deg #2A1130 -> #120D1C 60%, radius 22), padding 16 18, flex gap 14: Chief `Avatar` 44 (mono 14), text column (eyebrow mono 11/500 +0.88px `#FFB3E6`; summary 15/1.5 `text-primary`), trailing text-link `Otwórz czat` + `chevron-right` 14. `loading`: avatar + 2 skeleton lines. `stale` shows a muted line (`Podsumowanie sprzed 2 godz.`) so an outdated Chief summary is never presented as current.
9. Empty (no Workspaces): `EmptyState` with the Polish copy template `Nie masz jeszcze Workspace'u` + CTA `Nowy Workspace`: rendered by the feature using `ui:EmptyState`; the grid has a story with it.
10. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
11. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
12. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
13. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
14. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
15. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
16. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the 2x2 grid: working card (magenta border/glow, `3 Zgody czekają`, `Run #14 · pętla jakości 2 z 5`), `Strona fundacji` done, `Research rynku` paused (`nikt nie pracuje`, `wstrzymany przez Ciebie`), `Projekt klienta (NDA)` isolated (`izolowany`, `bez aktywnego Runu`). NOTE: in the mock the agent avatars collapse (E14): implement the ring + overlap properly. `design-summary.png`: the Chief banner. Not in the mock: hover/focus, loading skeleton card (`CardSkeleton`), Global Pause active (R: the feature passes `state=paused` + pausedLabel for all), long names, 1 and 10 Workspaces, empty state.

## 7. Reuse

Consumes `ui:Card`, `ui:StatusDot`, `ui:Pill`, `ui:SegmentBar`, `ui:AvatarStack` (E14 ring, max 4), `ui:Avatar`, `ui:Skeleton`, `ui:EmptyState`, `stateMaps` (OVE_DS040).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Isolated Workspaces must always show the lock pill and word `izolowany` (ADR 0028); summary text for an isolated Workspace is shown only to the Owner locally and the component never decides what is shared with Chief (engine). Names/paths are untrusted text.

## 10. Errors and edge cases

- All counts 0 -> empty track + caption.
- Name very long -> ellipsis; approvals pill never shrinks below its text.
- `agents` empty -> footer shows only the run text.
- Path with unusual unicode -> rendered as text with `unicode-bidi: plaintext`.
- Grid width < 380 -> single column, cards shrink to width.
- `state=working` but no `runLabel` -> dev warning (inconsistent data), card still renders.

## 11. Acceptance criteria

- [ ] Given the four fixtures, Then the card visuals match `design.png` (borders, glow, dot colours) within tolerance.
- [ ] Given counts 4/5/1/7, Then segments have flex ratios 4:5:1:7 and zero segments are omitted.
- [ ] Given 6 agents, Then 4 avatars + `+2` chip show with separating rings.
- [ ] Given the isolated fixture, Then the lock pill with the word `izolowany` is present.
- [ ] Given `stale`, Then the strip shows the stale line.
- [ ] axe clean; keyboard focus ring visible on the card link.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION (E14): avatar stack ring colour = card background token.
- OPEN: card click target when the Workspace is the current one (default: opens its Chief chat; feature decision).
