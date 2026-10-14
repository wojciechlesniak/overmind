---
id: OVE_DS051
title: Build KeyValueList, StatTile and DiffView
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS022, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:KeyValueList", "ui:StatTile", "ui:DiffView", "lib:parseUnifiedDiff"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:SectionLabel"]
owns: ["packages/ui-kit/src/data/KeyValueList/**", "packages/ui-kit/src/data/StatTile/**", "packages/ui-kit/src/data/DiffView/**"]
reads: []
design: design.png
design_source: "Zgody#appr/detail-facts + diff-preview (crop 460,239,952,277 CSS px); design-stat.png = Chief (crop 1161,514,259,63); design-facts.png = Czat-Agent (crop 1121,459,299,120)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 15"]
adr_refs: [21, 26]
---

# OVE_DS051: Build KeyValueList, StatTile and DiffView

## 1. Summary

Builds three small data-display components used across the app: `KeyValueList` (3-column tiles, 2x2 tiles, definition rows), `StatTile` (big number + caption, optional link/emphasis) and `DiffView` (unified diff preview with add/remove tints, safe against huge diffs) plus the pure helper `parseUnifiedDiff`.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Zgody.dc.html` and its 2x render `_design/views/Zgody.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C8.2 (DiffView), C8.3 (KeyValueList), C8.4 (StatTile). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The Approval detail must show the exact command and the exact change the Agent wants to make (`+14 −3`, `testy 112 z 112`), because the Owner approves based on it (SPEC 11, ADR 0021/0022: CLI prompts become Approvals with a change preview). The diff text comes from an Agent's worktree and is untrusted.

## 3. Scope (in)

- `KeyValueList` layouts `grid3`, `grid2`, `rows`, `stack`.
- `StatTile` default/link/emphasis.
- `DiffView` + `parseUnifiedDiff(text, limits)`.

## 4. Out of scope

- Approval detail composition (OVE_DS058), Connections cards (OVE_DS079).
- Syntax highlighting (not in the mock).
- Side-by-side diff (later).

## 5. Detailed requirements

1. `KeyValueList` props:
   ```ts
   interface KeyValueItem { id: string; label: string; value: ReactNode; mono?: boolean; tone?: Tone; span?: 1 | 2 }
   interface KeyValueListProps { items: KeyValueItem[]; layout: 'grid3' | 'grid2' | 'rows' | 'stack'; 'aria-label'?: string }
   ```
   Renders a `<dl>`. `label` uses the `SectionLabel`/`mono-label` style (mono 10/500, +0.08em, uppercase via CSS, `text-muted`); value 13-14/600 `text-primary` (or mono 12/13 when `mono`), `overflow-wrap: anywhere`, `tone` colours the value text (mint/amber/error) and ALWAYS needs a textual value (no colour-only).
2. `grid3`: three equal columns gap 12, each item a nested tile (`ui:Card` tone `nested`: 1px `line-subtle`, fill `bg-surface`, radius 14, padding 10 14) - Approval facts `POLECENIE | ZMIANY | DOWODY`; collapses to 1 column below 560px container width (container query). `grid2`: 2 columns gap 8, tiles radius 12 padding 10 12 (Direct chat facts `STAN wg herdr | ZADANIE | WORKTREE | IZOLACJA`). `rows`: definition rows, label left (`flex: 0 0 38%`), value right-aligned or left per `align`, divider 1px `line-subtle` between rows (Connection cards, herdr state). `stack`: label above value, no tile.
3. Values may be long paths/commands: `mono` values use `white-space: pre-wrap; overflow-wrap: anywhere` and `max-height: 6lh; overflow: auto` with a visible focusable scroller; never grow the tile unbounded.
4. `StatTile` props `{ value: ReactNode; caption: string; tone?: Tone; emphasis?: boolean; onClick?: () => void; href?: string; 'aria-label'?: string }`: radius 12, padding 10 8, `bg-surface`, 1px `line`, value 20/700 (coloured by `tone`, e.g. Done count mint), caption 12px `text-muted`; `emphasis` (the active Lane in the Chief panel) = fill magenta a10 + 1px magenta a35. Link variant (with `onClick`/`href`) is a `button`/`a` with hover border `line-strong` and ring on focus; accessible name `{value} {caption}`. A group of tiles sits in a `flex` row gap 8 (`StatTileRow` helper exported; tiles `flex: 1 1 0`, min 52px).
5. `DiffView` props:
   ```ts
   interface DiffLine { kind: 'hunk' | 'add' | 'del' | 'ctx'; text: string; oldNo?: number; newNo?: number }
   interface DiffViewProps { lines: DiffLine[]; maxLines?: number /* default 400 */; showLineNumbers?: boolean; labels: { added: string; removed: string; region: string; showMore: (hidden: number) => string }; onShowMore?: () => void }
   ```
   Container: radius 16, 1px `line-subtle`, fill `bg-code` (#06040A), padding 10 0, mono 12/1.7 (token `mono-code`), horizontal scroll `overflow-x: auto` (`role="region"`, `tabindex=0`, `aria-label=labels.region`). Row = gutter (24px, `user-select: none`, shows `+`, `−` or blank) + text (`white-space: pre`). `add`: text mint `#62E3B4`, row tint mint a08; `del`: text error `#FF8FA3`, row tint error a08; `hunk` (`@@ src/cart/discount.ts`): `text-muted`; `ctx`: `text-secondary`. Screen readers get a visually hidden prefix per changed line (`labels.added`/`labels.removed`).
6. `parseUnifiedDiff(text: string, limits?: { maxBytes: number /* 262144 */; maxLines: number /* 5000 */; maxLineLength: number /* 2000 */ }): { lines: DiffLine[]; truncated: boolean; stats: { added: number; removed: number; files: number } }`. Pure function, no regex with catastrophic backtracking (line-by-line `startsWith` checks); strips `\r`, replaces control characters (except tab) with U+FFFD, truncates lines longer than `maxLineLength` with an ellipsis marker, stops at the limits and sets `truncated`. `stats` feeds the `ZMIANY 2 pliki · +14 −3` fact.
7. When `lines.length > maxLines` only `maxLines` render and a `Button` (`dashed-more`) `labels.showMore(hidden)` expands (calls `onShowMore`; the feature may page). Performance: rows are plain elements, no per-line components with state; 400 lines render in < 50ms in the test.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` covers the Approvals detail from the facts row to the diff (`POLECENIE git push origin dev/cart-discounts`, `ZMIANY 2 pliki · +14 −3` with mint/red numbers, `DOWODY testy 112 z 112` mint, then the diff with hunk headers, a red removed line and mint added lines). `design-stat.png`: Chief lane StatTile row (2 Build, 3 QA emphasised, 1 Review, 7 Gotowe mint). `design-facts.png`: 2x2 facts tiles. Not in the mock: long command wrapping, empty diff (EmptyState text from the caller), binary file notice (R: a `ctx` line `Binary files differ`), truncation row, hover/focus of link tiles.

## 7. Reuse

Consumes `ui:Card` (`nested`), `ui:SectionLabel`, `ui:Button` (`dashed-more`). Provides these three to OVE_DS054, OVE_DS058, OVE_DS053, OVE_DS077, OVE_DS079.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. `parseUnifiedDiff` is pure and lives next to the component (`DiffView/parse.ts`), exported as `lib:parseUnifiedDiff` so the desktop feature and tests share it.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The diff is attacker-controlled (an Agent or repo content can craft it): no HTML, no auto-links; control characters (including bidi override U+202A-U+202E, U+2066-U+2069 and ANSI escapes) are neutralised by the parser (replaced by visible `U+FFFD`, bidi controls shown as `<U+202E>` text) so a diff cannot visually disguise a different command. Limits protect against denial of service by giant diffs. The command shown in the `POLECENIE` tile is rendered verbatim in mono and never reformatted.

## 10. Errors and edge cases

- Empty `lines` -> component renders the `region` with no rows (caller shows empty state).
- Line with only whitespace changes -> still rendered with its gutter.
- Non-diff input to the parser -> every line becomes `ctx`, `files` = 0.
- Extremely long single line -> truncated at `maxLineLength` plus ellipsis marker; horizontal scroll still works.
- Bidi override character in a line -> displayed as `<U+202E>` text.
- `items` empty in `KeyValueList` -> renders nothing.

## 11. Acceptance criteria

- [ ] Given the git-push fixture diff text, Then the parser returns `added=14`, `removed=3`, `files=2` and the view matches the colours of `design.png`.
- [ ] Given a 10 MB string, Then the parser stops at `maxBytes` and `truncated` is true without blocking the main thread for more than 50ms in the unit benchmark.
- [ ] Given a line containing `\u202E`, Then the rendered text contains the literal `<U+202E>` marker.
- [ ] Given the DiffView region, Then it is keyboard-scrollable and axe-clean.
- [ ] Given `layout="grid3"` at 500px container width, Then it renders one column.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit: parser (unified diff with 2 files, rename header, no-newline marker, CRLF, bidi, ANSI, oversize), property-style fuzz of 200 random strings (no throw).

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: no syntax highlighting; revisit post-MVP.
- OPEN: intra-line diff (word level) not planned.
