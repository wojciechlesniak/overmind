---
id: OVE_DS074
title: Build FolderPicker, PermissionChecklist and CheckRow (wizard step content)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS020, OVE_DS022, OVE_DS024, OVE_DS031, OVE_DS032, OVE_DS039, OVE_DS040, OVE_DS073]
soft_depends_on: []
provides: ["ui:FolderPicker", "ui:PermissionChecklist", "ui:CheckRow", "ui:CheckList"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Checkbox", "ui:Button", "ui:SectionLabel", "ui:StepRing", "ui:StatusText", "ui:Skeleton"]
owns: ["packages/ui-kit/src/wizard/FolderPicker/**", "packages/ui-kit/src/wizard/PermissionChecklist/**", "packages/ui-kit/src/wizard/CheckRow/**"]
reads: []
design: design.png
design_source: "Kreator-Folder#onb1/folder-picker + permissions-panel (crop 416,216,968,251 CSS px); design-checklist.png = Kreator-Polaczenia (crop 416,216,968,400)"
spec_refs: ["SPECIFICATION 14", "SPECIFICATION 11"]
adr_refs: [3, 4, 20, 22, 21]
---

# OVE_DS074: Build FolderPicker, PermissionChecklist and CheckRow (wizard step content)

## 1. Summary

Builds the step-content components of the wizard: `FolderPicker` (tree of allowed-folder candidates + 'Wybierz w Finderze…'), `PermissionChecklist` (Read/Write/Execute for the chosen folder) and `CheckRow`/`CheckList` (system check rows: ready, waiting, skipped, running, failed, with retry).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Kreator-Folder.dc.html` and its 2x render `_design/views/Kreator-Folder.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C7.3, C7.4, C7.5, E22. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Agents only see folders on the Allowed Directories list; the rest is blocked by OS isolation, not by an app switch (SPEC 11, ADR 0004). Execute is off by default (ADR 0021). Step 2 lists the isolation self-check: Apple container, isolation test (reading ~/.ssh from the container is blocked), herdr, official CLIs, optional Ollama (ADR 0020, 0022, 0026).

## 3. Scope (in)

- The three components + stories, the failed/running/disabled states the mock lacks.

## 4. Out of scope

- Native folder dialog and filesystem listing (feature supplies `nodes` and `onPickInFinder`).
- Terminal login panel (`ui:TerminalPane`, OVE_DS052).
- Persisting the grant.

## 5. Detailed requirements

1. `FolderPickerProps`:
   ```ts
   interface FolderNode { id: string; path: string; label: string; depth: 0 | 1; expanded?: boolean; disabledReason?: string }
   interface FolderPickerProps { nodes: FolderNode[]; selectedId?: string; onSelect(id: string): void; onPickInFinder(): void; labels: { tree: string; pickInFinder: string }; loading?: boolean; error?: string }
   ```
   Container `ui:Card` r20 padding 14, gap 4. Parent row (depth 0): `folder` icon 16 + mono 13 path (`~/Projects`), height 36. Child rows (depth 1): indent 26, mono 13; selected = tint `list-selected` (violet a14) + 1px violet border + trailing `check` 14; unselected hover = surface +1 step. Rows are `role="radio"` in a `role="radiogroup"` (single selection) with roving tabindex, arrows move, Space selects. Rows with `disabledReason` (system path, outside home) are `aria-disabled` and show the reason as muted text (the picker never lets the Owner choose `/`, `~` itself or `~/.ssh`: the feature marks them, the component renders them inert).
2. Finder button: dashed 1.5px `line-dashed` full-width 44px `Button dashed-add` with `plus` icon and `Wybierz w Finderze…`. Loading = 3 skeleton rows; error = inline error text (`text-error`, with icon) and the button stays usable.
3. `PermissionChecklistProps { folderLabel: string; heading: string /* 'PRAWA DLA ~/Projects/aplikacja-rezerwacji' */; items: { id: 'read'|'write'|'execute'; label: string; description: string; checked: boolean; disabled?: boolean; warning?: string }[]; onToggle(id, checked): void; footnote?: string }`. `ui:Card` tone `wizard-permission` (1px magenta border `rgba(242,95,196,.45)`, gradient 160deg #22102A to #120D1C, r20, padding 18), `SectionLabel` heading (mono 11, truncates with title for long paths, `overflow-wrap:anywhere` is NOT used; ellipsis in the middle is done by the feature), three rows each `ui:Checkbox` custom (E22) + label 15/600 + description 13px muted, row height 34 gap 16. Footnote 12px muted: `Kolejne foldery dodasz później...`.
4. Rights semantics (display only): `execute` unchecked by default; when `write` and `execute` are both checked the item shows the amber `warning` line (default copy supplied by the feature: `Zapis + wykonywanie pozwala Agentom uruchamiać zmieniony kod.`). Component does not compute it; it shows `warning` when provided (SRP).
5. `CheckRowProps { status: 'ready' | 'waiting' | 'skipped' | 'running' | 'failed'; title: string; description: string; statusLabel: string; action?: { label: string; onClick(): void; busy?: boolean }; detail?: ReactNode }`: row padding 14 16, flex gap 14, `ui:StepRing` 26 (ready = mint check, waiting = magenta ring with pulse dot, skipped = grey ring, running = spinner arc, failed = error ring with `✗`), title 15/600, description 13px `text-muted` (2-line clamp), trailing status word mono 12: ready (`gotowe`, `zaliczony`, `zalogowany`) mint, waiting (`czeka na Ciebie`) magenta, skipped (`pominięto`) grey, failed `text-error`, running `text-muted`; if `action` present (e.g. `Wykryj`, `Spróbuj ponownie`) a `Button secondary sm` replaces the status word. `detail` slot (below the description) holds the failure remedy text.
6. `CheckListProps { rows: CheckRowProps[]; 'aria-label' }`: container r20 `#140F20` 1px `line`, overflow hidden, rows separated by 1px `line-subtle`, `<ul>` with `role="list"`; the waiting row gets a faint magenta left rule 2px. A live region (`aria-live=polite`, visually hidden) announces status changes (`status` -> `title: statusLabel`) so screen readers hear detection finish.
7. Isolation test failed (R): `failed` + `detail` in error colour, and the feature keeps Next disabled (rule: isolation unavailable = nothing runs, SPEC 11). The component renders but cannot unblock anything.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the folder tree card (parent `~/Projects`, selected `aplikacja-rezerwacji` with violet tint and check, `fundacja-www`, `shared-ui`, dashed Finder button) and the magenta permission panel (Odczyt on, Zapis on, Wykonywanie off). `design-checklist.png`: the system check list (ready rows with mint check, waiting Codex CLI with magenta ring, skipped Ollama with `Wykryj`). Not drawn: running, failed, loading, disabled folders, warning line, hover/focus.

## 7. Reuse

Consumes `ui:Card`, `ui:Checkbox` (custom, E22), `ui:Button` (`dashed-add`, `secondary sm`), `ui:StepRing`, `ui:SectionLabel`, `ui:Skeleton`, `ui:StatusText`. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Folder paths are untrusted text (symlinks and unusual unicode: `unicode-bidi: plaintext`, never resolved in the UI). The picker must not offer, and a keyboard user must not reach, rows marked disabled. Execute defaulting to off is the feature's data, but the Storybook default fixture mirrors it. The `check` result states (isolation test passed) are only displayed; the engine computes them.

## 10. Errors and edge cases

- No node selected -> PermissionChecklist hidden by the parent; component itself with empty `items` renders only the heading.
- Path very long -> mono ellipsis + `title`.
- Zero rows in CheckList -> empty state text via `children` fallback.
- Two rows `waiting` -> both show the ring; only the latest is announced.

## 11. Acceptance criteria

- [ ] Given the folder fixture, When ArrowDown/Space is used, Then selection moves and `onSelect` fires with the id; disabled rows are skipped.
- [ ] Given `execute.checked=false`, Then its checkbox is unchecked and has an accessible name `Wykonywanie`.
- [ ] Given a `failed` row with `action`, Then the button reads `Spróbuj ponownie` and shows a busy state while `busy`.
- [ ] Given a status change, Then the live region text updates once.
- [ ] Visual match with `design.png` and `design-checklist.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: whether the picker shows a second level (deeper folders) - default depth 1 as in the mock.
- ASSUMPTION E22: custom Checkbox primitive used.
