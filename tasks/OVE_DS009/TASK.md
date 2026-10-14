---
id: OVE_DS009
title: "Icon pipeline, Icon component and the 23 UI icons of the mocks"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS008]
soft_depends_on: []
provides: [ui:icons, ui:Icon, lib:ui-icon-pipeline]
needs: []
owns: [packages/ui-kit/src/icons/Icon/**, packages/ui-kit/src/icons/data/folder-plus.ts, packages/ui-kit/src/icons/data/chevron-right.ts, packages/ui-kit/src/icons/data/check.ts, packages/ui-kit/src/icons/data/home.ts, packages/ui-kit/src/icons/data/chat.ts, packages/ui-kit/src/icons/data/workflow.ts, packages/ui-kit/src/icons/data/board.ts, packages/ui-kit/src/icons/data/scales.ts, packages/ui-kit/src/icons/data/agents.ts, packages/ui-kit/src/icons/data/settings.ts, packages/ui-kit/src/icons/data/shield-check.ts, packages/ui-kit/src/icons/data/pause.ts, packages/ui-kit/src/icons/data/plus.ts, packages/ui-kit/src/icons/data/lock.ts, packages/ui-kit/src/icons/data/discussion.ts, packages/ui-kit/src/icons/data/activity.ts, packages/ui-kit/src/icons/data/send.ts, packages/ui-kit/src/icons/data/search.ts, packages/ui-kit/src/icons/data/grip.ts, packages/ui-kit/src/icons/data/skill-cube.ts, packages/ui-kit/src/icons/data/document.ts, packages/ui-kit/src/icons/data/bell.ts, packages/ui-kit/src/icons/data/telegram-plane.ts, packages/ui-kit/src/icons/registry.generated.ts, packages/ui-kit/scripts/build-icons.ts, packages/ui-kit/scripts/__tests__/build-icons.test.ts]
reads: []
design: design.png
design_source: "Main#shell/rail (crop 0,0,72,420)"
spec_refs: [SPECIFICATION 13]
adr_refs: [17, 18]
---

# OVE_DS009: Icon pipeline, Icon component and the 23 UI icons of the mocks

## 1. Summary

Create the icon pipeline (one data file per icon, a validating generator, a typed `Icon` component) and port the 23 UI icons that the mocks draw as inline SVG. All icons share one grid: viewBox 0 0 24 24, stroke 1.8, `fill: none`, round caps and joins, colour through `currentColor`.

## 2. Context

Inventory A.10: 26 distinct SVGs (23 UI icons + brand marks). The mocks hard-code stroke colours in a few places; the implementation passes colour through the parent (`currentColor`). Stroke 2, 2.4, 2.6 are used only inside filled buttons (send, chevron on the Chief button, check in the done ring), hence a `strokeWidth` prop with default 1.8. The rail crop shows the six rail icons at 20px (home, chat, workflow, board, scales, agents) and the logo tile. Missing icons are OVE_DS011; the brand mark is OVE_DS010. Status glyphs (`✓ ✗ ● ○ ◆ ▍`) become SVG in OVE_DS011 (E21).

## 3. Scope (in)

- Icon data format and one data file per icon for the 23 icons (5.2).
- `scripts/build-icons.ts` (`icons:build`): validates data files and generates `registry.generated.ts` (name union + data map). Added to `build` and `test` flows.
- `Icon` component (5.1) with a11y behaviour, size and stroke props.
- Story: icon grid (all icons x sizes 12-22) and rail strip; tests.

## 4. Out of scope

- Brand mark and tile: OVE_DS010. Extra icons and status glyphs: OVE_DS011 (adds data files only; this task owns the generator and `Icon`).
- Icon buttons: OVE_DS015. Icons inside Button: OVE_DS013 (prop `icon: IconName`).

## 5. Detailed requirements

**5.1 `Icon` API**
```ts
type IconSize = 12 | 14 | 16 | 18 | 20 | 22;        // sizes used by the mocks; no free numbers
interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children' | 'width' | 'height' | 'viewBox'> {
  name: IconName;                // generated union from registry
  size?: IconSize;               // default 16
  strokeWidth?: number;          // default 1.8; allowed 1.8 | 2 | 2.4 | 2.6
  label?: string;                // when set: role="img" aria-label=label; otherwise aria-hidden="true" focusable="false"
}
```
1. Output: `<svg data-om="Icon" data-icon="home" width=size height=size viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=strokeWidth stroke-linecap="round" stroke-linejoin="round" ...>` with children created through `createElement` from the data tuples (never `dangerouslySetInnerHTML`, never string parsing at runtime).
2. `display: block; flex-shrink: 0` (set by OVE_DS008 for all `svg`). Colour is inherited: callers set `color` on the parent (`text-lavender`, state colours).
3. Unknown names are a type error; at runtime an unknown name renders nothing and, in development, throws (so typos fail in tests).
4. Rotation helpers are not props: callers use CSS (`transform: rotate(180deg)` for caret open state, OVE_DS030).

**5.2 Icon data format (one file per icon in `src/icons/data/<kebab-name>.ts`)**
```ts
import type { IconData } from '../types';
export default { name: 'folder-plus', nodes: [
  ['path', { d: 'M3 6h6l2 2h10v11H3z' }],
  ['path', { d: 'M12 12v4M10 14h4' }],
] } satisfies IconData;
```
Allowed elements: `path`, `circle`, `rect`, `line`, `polyline`, `ellipse`. Allowed attributes: `d`, `cx`, `cy`, `r`, `rx`, `ry`, `x`, `y`, `x1`, `y1`, `x2`, `y2`, `width`, `height`, `points`, `fill` (only `currentColor` or `none`), `stroke-width` (number), `opacity` (0-1). Anything else (`style`, `href`, `on*`, `id`, `class`, `filter`, `mask`, `use`, `image`, `script`) is a generator error. All numeric coordinates MUST lie within 0..24 (tolerance 0 at the viewBox edge; the grid keeps 3px optical margin for most icons).

**5.3 Generator** `icons:build`: reads `src/icons/data/*.ts` (file name must equal `name`, kebab-case, unique), validates 5.2, writes `registry.generated.ts` (`export const iconRegistry = { 'activity': activity, ... } as const; export type IconName = keyof typeof iconRegistry;` alphabetical) and fails on a stale file in `icons:check`. Regeneration is part of any task that adds an icon data file; conflicts in the generated file are resolved by regenerating (documented exception to "do not touch files of other tasks", same rule as the barrel in OVE_DS039).

**5.4 The 23 icons (exact inner markup, viewBox 24, stroke 1.8, round)**
| name | nodes | sizes used |
|---|---|---|
| `folder-plus` | `path d="M3 6h6l2 2h10v11H3z"`; `path d="M12 12v4M10 14h4"` | 16 |
| `chevron-right` | `path d="m9 6 6 6-6 6"` | 12, 14, 16 |
| `check` | `path d="m5 12 5 5 9-10"` | 14, 16 (stroke 2.6 on mint fill) |
| `home` | `path d="M3 11 12 4l9 7"`; `path d="M5 10v10h14V10"`; `path d="M10 20v-5h4v5"` | 20 |
| `chat` | `path d="M4 5h16v11H9l-5 4z"` | 16, 20 |
| `workflow` | `circle cx=6 cy=6 r=2.5`; `circle cx=18 cy=12 r=2.5`; `circle cx=6 cy=18 r=2.5`; `path d="M8.5 6.8 15.6 11M8.5 17.2l7.1-4.2"` | 16, 18, 20 |
| `board` | `rect x=3 y=4 width=5 height=16 rx=1.5`; `rect x=10 y=4 width=5 height=11 rx=1.5`; `rect x=17 y=4 width=4 height=7 rx=1.5` | 18, 20 |
| `scales` | `path d="M12 3v18"`; `path d="M5 7h14l-2 4H5z"`; `path d="M8 21h8"` | 16, 20 |
| `agents` | `circle cx=9 cy=8 r=3`; `path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.6 3 6"` | 16, 20 |
| `settings` | `circle cx=12 cy=12 r=3`; `path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"` | 20 |
| `shield-check` | `path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"`; `path d="m9 12 2 2 4-4"` | 16 |
| `pause` | `path d="M9 5v14M15 5v14"` | 16 |
| `plus` | `path d="M12 5v14M5 12h14"` | 14, 16 |
| `lock` | `rect x=5 y=11 width=14 height=10 rx=2`; `path d="M8 11V8a4 4 0 0 1 8 0v3"` | 12, 14, 16, 18 |
| `discussion` | `path d="M3 6h11v8H7l-4 3z"`; `path d="M17 9h4v8l-3-2h-6v-1"` | 16, 18 |
| `activity` | `path d="M3 12h4l3-7 4 14 3-7h4"` | 16 |
| `send` | `path d="M4 12 20 4l-6 16-3-7z"` | 18 (stroke 2 on magenta) |
| `search` | `circle cx=11 cy=11 r=6`; `path d="m20 20-4.5-4.5"` | 16 |
| `grip` | six `circle r=1` at (9,6) (15,6) (9,12) (15,12) (9,18) (15,18) | 14 |
| `skill-cube` | `path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"`; `path d="M4 7.5 12 12l8-4.5M12 12v9"` | 12, 14, 18, 22 |
| `document` | `path d="M6 3h8l4 4v14H6z"`; `path d="M14 3v4h4"` | 12 |
| `bell` | `path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"`; `path d="M10 20a2 2 0 0 0 4 0"` | 16 |
| `telegram-plane` | `path d="M21 4 3 11l6 2 2 6 3-4 5 4z"`; `path d="m9 13 8-6"` | 20 |
Naming note (E25): `board` (Task Board), glossary term Lane/Tor is not an icon; the `board` icon is also used for Lane nodes on the canvas.
5. Semantic mapping documented in the story (not code): Workspaces `home`, Chief `chat`, Workflow/Runs `workflow`, Task Board `board`, Decision Register `scales`, Agents/Skills `agents`, Settings `settings`, Approvals `shield-check`, Global Pause `pause`, Private marker `lock`, Discussion `discussion`, Run/Activity/Escalation `activity`, Skill `skill-cube`, doc reference `document`, notification `bell`, Telegram `telegram-plane`.

## 6. Design notes

`design.png` (rail crop): logo tile and the six rail items; each icon 20px, stroke 1.8, colour `text-secondary` inactive and `text-bright` on the active item (rail itself is OVE_DS-part-2 UI-20). Verify glyph shapes by overlaying the Icon story at 20px beside the crop. Icon colour, hover and focus belong to the consuming component (the Icon has no states).

## 7. Reuse

Tokens (colour via `currentColor`); `cx` (OVE_DS001); OVE_DS008 base CSS for `svg` display rules.

## 8. Architecture and code placement

`packages/ui-kit/src/icons/`: `Icon/` (component), `data/` (one file per icon, SRP and conflict-free), `types.ts`, generated `registry.generated.ts`. Dependency-free (no SVGR, no icon library). New icons are added by new files only (OCP).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`).
Specific: the generator whitelists SVG elements and attributes, so an icon contributed through a PR cannot carry `<script>`, event handlers, `<use href>` to external files, `<image>` or `style` (SVG is an XSS vector). Icons are data tuples rendered with `createElement`; there is no path where a string becomes markup.

## 10. Errors and edge cases

- Icon name typo from JS: dev throw, production renders nothing (no crash of the view).
- `size` not in the union (JS caller): falls back to 16.
- Two data files with the same `name`, a name not matching the file name, or a coordinate outside 0..24: generator error naming the file.
- Icon without `label` placed alone in a button: the button must carry `aria-label` (checked in OVE_DS015 tests); `Icon` itself stays decorative.

## 11. Acceptance criteria

- [ ] 23 data files exist with the exact markup of 5.4; the generator outputs `IconName` with 23 members (plus those added later).
- [ ] `<Icon name="home" size={20} />` renders an `svg` with `width=20 height=20 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`.
- [ ] With `label="Home"` it renders `role="img"` and `aria-label="Home"` and no `aria-hidden`.
- [ ] `strokeWidth={2.6}` is honoured (check on mint ring).
- [ ] The generator rejects each forbidden element/attribute/out-of-range coordinate (fixtures).
- [ ] Icon grid story shows every icon at 12, 14, 16, 18, 20, 22 px with its name; axe clean.
- [ ] Visual test: story `IconRail` (six rail icons at 20px on `bg-panel`) matches the icon region of `design.png` within tolerance.

## 12. Test plan

Vitest: `Icon.test.tsx` (attributes, a11y variants, throws on unknown name in dev, no innerHTML), `registry.test.ts` (every registry entry renders, every data file validates), `build-icons.test.ts` (fixtures). Story `Icons/Icon` (autodocs) with `Matrix`. Visual via OVE_DS012 (`IconRail` vs crop). Commands: `pnpm --filter @overmind/ui-kit icons:build && test icons`.

## 13. Parallelization notes

After OVE_DS008. Runs in parallel with OVE_DS010 and OVE_DS011 (data files only) and with all primitives that do not need icons. OVE_DS013 and later tasks depend on this one for `IconName`. Hotspot: `registry.generated.ts` (regenerate, never hand-merge).

## 14. Open questions and assumptions

- ASSUMPTION: no external icon library (Lucide etc.) to keep the exact shapes of the mocks and zero dependencies.
- ASSUMPTION: `skill-cube` in blue at stroke 2 (inventory note) is achieved by `strokeWidth={2}` plus parent colour, not a separate icon.
