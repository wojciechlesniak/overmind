---
id: OVE_DS081
title: Build PermissionMatrix (Allowed folders table) and SettingsToggleRow
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS023, OVE_DS024, OVE_DS031, OVE_DS039, OVE_DS040, OVE_DS069, OVE_DS078]
soft_depends_on: []
provides: ["ui:PermissionMatrix", "ui:ToggleRow"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Checkbox", "ui:Button", "ui:Pill", "ui:Switch", "ui:DataTable"]
owns: ["packages/ui-kit/src/workspace/PermissionMatrix/**"]
reads: []
design: design.png
design_source: "Workspace#ws/dirs-section + dirs-table (crop 340,184,980,318 CSS px); design-toggles.png = Workspace (crop 340,518,980,304)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 10"]
adr_refs: [3, 4, 21]
---

# OVE_DS081: Build PermissionMatrix (Allowed folders table) and SettingsToggleRow

## 1. Summary

Builds the Allowed-folders table with the Read/Write/Execute checkbox matrix (origin line, added date, expired Telegram grants, remove, add folder) and the `ToggleRow` (label + mono value + switch) used for the Permissions section.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Workspace.dc.html` and its 2x render `_design/views/Workspace.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C7.6 (PermissionMatrix), C9.2, E18, E22. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Folders are the only filesystem scope Agents get (SPEC 11, ADR 0004). A grant has an origin (Owner in wizard, Agent Access Request, Telegram) and may expire (Access Requests are time-limited, ADR 0003); expired ones are shown as `wygasło` and carry no rights.

## 3. Scope (in)

- `PermissionMatrix`, row states, add/remove, `ToggleRow` with ON/OFF stories.

## 4. Out of scope

- Persisting grants, native folder picker, Access Request flow (APPR/PERM features).
- Section frame (`SettingsSection`, OVE_DS078).

## 5. Detailed requirements

1. Props:
   ```ts
   interface FolderGrantRow { id: string; path: string; origin: string /* 'Właściciel · kreator' */; read: boolean; write: boolean; execute: boolean; addedLabel: string; expired?: boolean; expiredLabel?: string; locked?: boolean; note?: string }
   interface PermissionMatrixProps { rows: FolderGrantRow[]; onChange(id: string, right: 'read'|'write'|'execute', value: boolean): void; onRemove?(id: string): void; onAdd(): void; labels: { path: string; read: string; write: string; execute: string; added: string; add: string; remove: (p: string) => string; table: string }; busyIds?: string[] }
   ```
2. Table in a r16 container (`#140F20`, 1px `line`, overflow hidden): `<table>` columns `minmax(0,1fr) 88 88 112 128` (KATALOG | ODCZYT | ZAPIS | WYKONYWANIE | DODANY), header row mono 10 `mono-label` (E17 min 10) padding 10 14, rows height 44 (66 with a note line), cells padding 8 14, 1px `line-subtle`. Path cell: mono 13 (ellipsis + title) with the origin line mono 11 `text-muted` under it; rights cells: centred `ui:Checkbox` custom 20px (E22) with accessible name `{right} {path}`; added cell 12px text.
3. Expired row: all three checkboxes unchecked + disabled, added cell shows `wygasło` in amber (tone + word) and the row note (e.g. `Prośba z Telegrama · wygasła 12:40`); `locked` rows (the Workspace root) have a lock icon and disabled checkboxes. Execute is visually off by default in fixtures. Optional trailing `IconButton` `close` (appears on hover/focus) calls `onRemove`.
4. Footer: `Button secondary md` with `plus` icon `Dodaj katalog` (flex, padding 14, border-top). Table scrolls horizontally inside its container only when narrower than 640 (path column keeps min 220).
5. Sensitive defaults in UI: toggling `execute` on emits `onChange` and the feature may show the confirmation; component marks the checkbox `aria-describedby` to a hidden warning text when `write && execute` (`labels.writeExecuteWarning`).
6. `ToggleRowProps { label: string; value?: string; help?: string; checked: boolean; onChange(v: boolean): void; disabled?: boolean }`: row padding 14 18 height 51, label 14/600, value mono 12 `text-secondary` (`git push · wymaga Zgody`), right `ui:Switch` (`role="switch"`). ON/OFF stories (mock rows `perms-row-on/off`).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Allowed-folders section: header, table with 3 folders (checkbox matrix, origin line), the expired Telegram grant row (amber note), `Dodaj katalog` button. `design-toggles.png` (scrolled render): the Permissions section with ON and OFF toggle rows. Not drawn: locked, busy, hover/focus, empty table, remove.

## 7. Reuse

Consumes `ui:Checkbox`, `ui:Switch`, `ui:Button`, `ui:Pill`, `ui:Card`; table styling shared with `ui:DataTable` (OVE_DS069) via its `compact` variant (header `mono-label`, cell padding). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). This is the Owner's permission UI: every change is an explicit user event (`onChange`), nothing toggles by itself, no optimistic widening: while `busyIds` contains a row its checkboxes are disabled so the displayed state always equals the engine state (fail closed). Expired grants cannot be re-checked from here (a new grant needs a new Access Request/Approval). Paths are untrusted text (symlink resolution is the engine's job).

## 10. Errors and edge cases

- No rows -> an `EmptyState` line `Brak katalogów` and the Add button.
- Path with RTL characters -> `unicode-bidi: plaintext`.
- Row removed while focused -> focus moves to the table caption.
- `onChange` rejected by the feature -> controlled state keeps old value.

## 11. Acceptance criteria

- [ ] Given the fixture, Then three rows render with correct checkbox states and the expired row has disabled boxes and the amber word `wygasło`.
- [ ] Given a click on a checkbox, Then `onChange(id, right, value)` fires and the displayed value stays until props change.
- [ ] Given keyboard, Then Tab reaches every checkbox and Space toggles.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: `Wykonywanie` default off in fixtures (ADR 0021).
- OPEN: whether removal of a folder asks for confirmation (default: feature dialog).
