---
id: OVE_DS032
title: "Skeleton family and EmptyState"
area: DS
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS013, OVE_DS031]
soft_depends_on: []
provides: [ui:Skeleton, ui:EmptyState]
needs: [ui:icons]
owns: [packages/ui-kit/src/surfaces/Skeleton/**, packages/ui-kit/src/surfaces/EmptyState/**]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS032: Skeleton family and EmptyState

## 1. Summary

Implement `Skeleton` (shimmer placeholder with line/title/avatar/card shapes and ready-made row/card/table-row skeletons) and `EmptyState` (icon tile, title, text, optional actions). Neither exists in the mocks; both are specified by inventory B22 and B23 and are needed by every list and by loading states.

## 2. Context

Mocks never draw loading or empty states (VIEWS.md lists them as states to design: "Loading skeleton for cards and notifications", "Empty notification center"). Inventory B22: centered column, 44px icon tile (`#1C1330`, 1px `#5B3E8F`, r14, 20px icon `#D6C9FF`), title 15/700, text 13px `#A79BBF`, max-width 320, optional primary and secondary button. B23: fill `#1C1330`, shimmer 1.4s linear gradient of `violet-a08`, shapes: line (h12 r6), title (h18 r8), avatar (blob), card (r16). Honour `prefers-reduced-motion`. Copy templates (Polish) for apps are listed in 5.6; ui-kit stores no product copy outside stories.

## 3. Scope (in)

- `Skeleton` (+ `SkeletonGroup`), `ConversationRowSkeleton`, `CardSkeleton`, `TableRowSkeleton`; `EmptyState`.
- Stories (the Polish copy lives only in stories), tests. `design: none` (no mock); visuals verified with `expectComputed` and a snapshot baseline without a design crop.

## 4. Out of scope

- `NodeSkeleton` and screen-level compositions (DS part 2). Copy strings in apps (i18n, OVE_ARCH011).

## 5. Detailed requirements

**5.1 `Skeleton`**
```ts
interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> { shape?: 'line' | 'title' | 'avatar' | 'card' | 'block'; width?: number | string; height?: number | string; size?: number /* avatar */ ; animated?: boolean /* default true */ }
```
Fill `bg-raised` `#1C1330`; shimmer overlay: `linear-gradient(90deg, transparent, violet-a08, transparent)` moving across 1.4s linear infinite (`om-anim-shimmer`, OVE_DS007); shapes: `line` h12 r6 (width default 100%), `title` h18 r8 (width 60%), `avatar` square `size` (default 34) with `--om-radius-blob`, `card` r16 (height required), `block` r10. Decorative: `aria-hidden="true"`.
**5.2 `SkeletonGroup`**: wrapper `role="status"` + `aria-busy="true"` with a `VisuallyHidden` text from UiLabels `loading`; children skeletons inside. Only one live announcement per group.
**5.3 Composite skeletons**: `ConversationRowSkeleton` = avatar 34 + two lines (title 60%, sub 40%) with the row geometry of OVE_DS033 (padding 9 10, r14, gap 10); `CardSkeleton` = Card default (OVE_DS031) padding 16 with title, 2 lines and a footer line; `TableRowSkeleton { columns: number }` = row height 40 with `columns` lines of random-looking but deterministic widths (index-based, stable for snapshots).
**5.4 `EmptyState`**
```ts
interface EmptyStateProps { icon: IconName; title: ReactNode; description?: ReactNode; primaryAction?: ReactNode; secondaryAction?: ReactNode; headingLevel?: 2 | 3 | 4; size?: 'md' | 'sm'; align?: 'center' | 'start' }
```
Layout: column, centered, gap 12, padding 32. Tile 44x44 (`sm` 36), radius 14, fill `bg-raised` `#1C1330`, `border: 1px solid line-strong` `#5B3E8F`, icon 20px colour `text-lavender` `#D6C9FF`. Title Bricolage 15/700 `text-primary` as `<h2|h3|h4>`; description 13px/1.45 `text-secondary` `#A79BBF`, `max-width: 320px`, centered. Actions: row, gap 8, `Button variant="primary-violet"` / `secondary` are passed as nodes by the caller (the component only lays them out; DIP).
**5.5 States**: static; actions have their own states. Reduced motion: shimmer static (tone-only).
**5.6 Copy templates for apps (documented in a story, not shipped as code)**: Workspaces "Nie masz jeszcze Workspace'u" + CTA "Nowy Workspace"; Task Board "Tablica jest pusta. Chief doda Zadania, gdy Dokumentacja bedzie gotowa."; Approvals "Nic nie czeka na Twoja Zgode."; Decisions "Brak Decyzji. Pojawia sie po pierwszej Dyskusji lub Decyzji Chiefa."; Skills "Brak Skilli. Zaimportuj lub popros Chiefa o propozycje."; Activity "Brak Runow."; Notifications "Brak powiadomien.".

## 6. Design notes

No mock crop exists. Visual spec is inventory B22/B23 and the 5.x numbers; the story `EmptyStates/Gallery` is the reference for designers to review before the first release.

## 7. Reuse

`Card` (OVE_DS031), `Icon` (OVE_DS009), `Button` (OVE_DS013, via slots only), shimmer animation (OVE_DS007), `VisuallyHidden` (OVE_DS022 as soft dependency through BASE ordering).

## 8. Architecture and code placement

`packages/ui-kit/src/surfaces/{Skeleton,EmptyState}/`. Composite skeletons live next to `Skeleton` and import geometry constants, not components, from the ListRow task (no upward group import).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Empty and error copy must not leak data: EmptyState displays only caller text; skeleton widths are deterministic, never derived from real data lengths (prevents side-channel guesses about hidden content).

## 10. Errors and edge cases

- Missing `icon`: dev warning; renders no tile.
- Very long title: wraps, centered.
- `SkeletonGroup` nested inside another: inner one drops its own `role=status`.
- Reduced motion or forced colours: no animation, solid `#1C1330` with a 1px border in forced colours.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Skeleton/EmptyState` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Skeleton shapes: line 12/r6, title 18/r8, avatar blob, card r16; shimmer 1.4s linear; no animation under reduced motion.
- [ ] `SkeletonGroup` announces once through `role=status` and is `aria-busy`.
- [ ] EmptyState tile 44 r14 `#1C1330`/`#5B3E8F`, icon 20 `#D6C9FF`, title 15/700, text 13 `#A79BBF` max-width 320.
- [ ] Gallery story renders every Polish copy template of 5.6 (stories only; the guard allows strings in stories).

## 12. Test plan

- Vitest + Testing Library + user-event in `surfaces/(Skeleton|EmptyState).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test surfaces` and `pnpm --filter @overmind/ui-kit test:visual surfaces`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task.

## 14. Open questions and assumptions

- ASSUMPTION: specs are the inventory R rules; designers should review the Gallery story (no mock).
- Open: shimmer colour `violet-a08` on `#1C1330` is subtle; contrast is intentionally low (decorative).
- Priority P1: needed before the first list screen leaves the prototype stage.
