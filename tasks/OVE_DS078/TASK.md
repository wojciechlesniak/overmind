---
id: OVE_DS078
title: Build SettingsSection, SettingRow and GlobalPausePanel
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS022, OVE_DS023, OVE_DS029, OVE_DS030, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:SettingsSection", "ui:SettingRow", "ui:GlobalPausePanel", "ui:SettingsPage"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Switch", "ui:SelectButton", "ui:Button", "ui:Select", "ui:Menu", "ui:Kbd"]
owns: ["packages/ui-kit/src/settings/SettingsSection/**"]
reads: []
design: design.png
design_source: "Ustawienia#appset/section-general (crop 100,183,646,228 CSS px); design-pause.png = Ustawienia (crop 766,678,646,92); design-notifications.png = Ustawienia (crop 100,430,646,431)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 9"]
adr_refs: [5, 6]
---

# OVE_DS078: Build SettingsSection, SettingRow and GlobalPausePanel

## 1. Summary

Builds the settings kit: `SettingsSection` (default, danger and global-pause variants), `SettingRow` with a control slot (select, switch, buttons, mono value) and the `GlobalPausePanel`, plus the two-column `SettingsPage` grid used by App settings.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Ustawienia.dc.html` and its 2x render `_design/views/Ustawienia.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C9.1 (SettingsSection), C9.2 (SettingRow), B11, B6, E4, E18, E23. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). App settings hold General, Notifications, Backup, Security and logs, and the Global Pause panel (SPEC 12). Global Pause stops all Agents at once (SPEC 9) so its panel must look different from ordinary settings and never trigger on a single click without the feature's confirmation.

## 3. Scope (in)

- `SettingsSection`, `SettingRow`, `GlobalPausePanel`, `SettingsPage` two-column layout, stories for the three section variants and all control types.

## 4. Out of scope

- Specific settings content (SETTINGS feature), backup logic, the Workspace delete confirmation dialog (feature using `ui:Dialog`).
- `ConnectionCard` (OVE_DS079), Workspace settings sections (OVE_DS082).

## 5. Detailed requirements

1. `SettingsSectionProps { title: string; description?: string; variant?: 'default' | 'danger' | 'global-pause'; children: ReactNode; actions?: ReactNode; id?: string }`: `<section aria-labelledby>`, radius 18, bg `#140F20`, 1px `#2A2040` (`line-section`), overflow hidden; header padding 16 18, h2 16/700 (+ optional description 12/1.4 muted), body rows. `danger`: border `rgba(255,143,163,.4)` and title in `text-error` tint. `global-pause`: radius 18, bg `#1C0B19`, 1px `#5A2A4F`, padding 18, flex row: text column (h2 16/700 + description 13/1.45) and the CTA on the right.
2. `SettingRowProps { label: string; help?: string; control: ReactNode; layout?: 'inline' | 'stack'; htmlFor?: string; disabled?: boolean }`: padding 14 18, min-height 64, flex space-between gap 16; label 14/600 `text-primary`, help 12/1.4 `text-muted`; separators 1px `line-subtle` between sibling rows (not after the last). The control slot never shrinks (`flex: 0 0 auto`) while label/help wrap (`min-width:0`). `layout=stack` puts the control below at < 520px container width (container query). Row sets `aria-describedby` linking help to the control via `htmlFor`.
3. Control helpers exported for rows: `SettingSelect` (= `ui:SelectButton` 38px with `chevron-down`, E4, listing via `ui:Menu`), `SettingSwitch` (= `ui:Switch` with `role="switch"`, E23), `SettingValue` (mono 12 `text-secondary`, selectable), `SettingActions` (button group gap 8, wraps). They only wrap part 1 primitives with the row ids (no new styling).
4. `GlobalPausePanelProps { title: string; description: string; active: boolean; onToggle(): void; labels: { pause: string; resume: string; activeNote: string } }`: CTA `Button primary-magenta lg` 44px with `pause` icon (`Global Pause` / when `active`: `Wznów`, and the panel gets `activeNote` text `Wszystko wstrzymane od 14:02` and a magenta tint border). The component calls `onToggle` only; confirmation dialog belongs to the feature. `aria-pressed` reflects `active` (E33).
5. `SettingsPage`: `display:grid; grid-template-columns: repeat(2, minmax(0, 646px)); gap: 20px 20px; padding 22 28` (mock: columns at x=100 and x=766, width 646); collapses to one column below 1200px; the page scrolls inside the main area (G5).
6. Focus order follows DOM order = visual order within a section; `SettingRow` is not itself focusable (controls are). Sections have `id` anchors so `SettingsNav`-like jump lists can link.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: General section (select rows with 38px select buttons, a switch row). `design-pause.png`: the magenta-tinted Global Pause panel with the 44px CTA. `design-notifications.png`: Notifications section (5 select rows + 1 switch) showing long lists. Not drawn: danger variant (Workspace delete row sits in Workspace settings), active pause, disabled rows, narrow layout.

## 7. Reuse

Consumes `ui:Card`, `ui:Switch`, `ui:SelectButton`, `ui:Menu`, `ui:Button` (`primary-magenta lg`, `secondary sm`, `danger`), `ui:Kbd`. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). `GlobalPausePanel` is the safest-direction control: the component never auto-resumes and `onToggle` fires only on an explicit activation (click/Enter/Space), never on focus or drag. Danger variant must never be the default; destructive actions in a `danger` section are always secondary-styled with the destructive tone and require the feature's confirmation dialog.

## 10. Errors and edge cases

- Section with no rows -> only the header renders.
- Control missing -> label only.
- Very long label -> wraps; the control keeps its width.
- `variant` unknown -> default.

## 11. Acceptance criteria

- [ ] Given a switch row, Then the control has `role="switch"`, `aria-checked`, a visible focus ring and 3:1 off-state outline (E18).
- [ ] Given `active=true`, Then the CTA reads `Wznów`, `aria-pressed=true` and the note is visible.
- [ ] Given width 480 container, Then rows stack.
- [ ] Visual match with `design.png` and `design-pause.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: whether the Global Pause panel is also reachable from the top bar only (default: both).
- ASSUMPTION E4: selects use `chevron-down`.
