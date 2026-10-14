---
id: OVE_DS082
title: Build SettingsNav, OwnerRuleRow, ProposalBanner, DocsList and DangerRow
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS031, OVE_DS033, OVE_DS039, OVE_DS040, OVE_DS078]
soft_depends_on: []
provides: ["ui:SettingsNav", "ui:OwnerRuleRow", "ui:ProposalBanner", "ui:ConsentExceptionChips", "ui:DocsList", "ui:DangerRow"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:ListRow", "ui:Button", "ui:Pill", "ui:Card", "ui:DocRefChip"]
owns: ["packages/ui-kit/src/workspace/SettingsNav/**", "packages/ui-kit/src/workspace/OwnerRules/**"]
reads: []
design: design.png
design_source: "Workspace, mock scrolled 600px#ws/rules-section (crop 340,837,980,470 CSS px); design-nav.png = Workspace (crop 72,162,240,500); design-docs.png = Workspace, mock scrolled 960px (crop 340,1323,980,152); design-danger.png = Workspace, mock scrolled 960px (crop 340,1491,980,341)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 6"]
adr_refs: [15, 25, 16, 28]
---

# OVE_DS082: Build SettingsNav, OwnerRuleRow, ProposalBanner, DocsList and DangerRow

## 1. Summary

Builds the remaining Workspace-settings pieces: the 240px `SettingsNav`, `OwnerRuleRow` (R1.., last-invoked note, Edit), Chief's `ProposalBanner` for a new rule, `ConsentExceptionChips`, `DocsList` with the git status line, the private-items summary row and the destructive `DangerRow` (delete Workspace).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Workspace.dc.html` and its 2x render `_design/views/Workspace.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C9.6, C9.7, C9.8, B13. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Owner Rules are standing instructions the Chief must obey and may only change when the Owner approves (ADR 0015, SPEC 10). Default-consent exceptions list actions that normally need no Approval but the Owner wants to require (ADR 0021). The documentation list shows which files Tasks point to (ADR 0016). Deleting a Workspace is irreversible, and Decisions are never deleted (ADR 0008) so the danger copy must say what is deleted.

## 3. Scope (in)

- The six components + stories for each state.

## 4. Out of scope

- Rule editing dialog, Workspace delete confirmation dialog, git status computation (features).
- Allowed folders and permission rows (OVE_DS081).

## 5. Detailed requirements

1. `SettingsNavProps { title: string; items: { id: string; label: string; badge?: string }[]; activeId: string; onSelect(id: string): void; 'aria-label': string }`: aside 240, bg `#0C0814`, padding 22 14, title 18/700 (padding 0 12 14); `<nav>` list; item padding 10 12, radius 12, 14/600 `text-secondary`; active = `list-selected` + `aria-current="location"` and `text-primary`; hover surface +1. Items (copy from the mock): Workspace, Dozwolone katalogi, Uprawnienia, Reguły Właściciela, Dokumentacja projektu, Izolacja i budżet. Clicking scrolls the matching `SettingsSection` (feature handles; the nav only emits).
2. `OwnerRuleRowProps { id: string; text: string; lastInvokedLabel?: string; onEdit?: () => void; editLabel: string }`: row padding 14 18, min-height 66 (71 with the note), id mono 12 `R2` in a `Pill` meta tone, text 14/1.45 `text-body-soft` (wraps), note mono 11 `text-muted` (`Ostatnio powołany: Run #12 · odmowa git push`), trailing `Button ghost sm` `Edytuj`. The rule text is shown whole, never truncated (rules must be readable).
3. `ProposalBannerProps { title: string; text: string; onAccept(): void; onReject(): void; labels: { accept: string; reject: string } }`: dashed violet card (`drop`-like tone), r16 padding 14 18, eyebrow `CHIEF PROPONUJE REGUŁĘ R4`, text 14/1.45, buttons `primary-violet sm` `Dodaj regułę` and `secondary sm` `Odrzuć`. Chief can only propose; accepting is the Owner's explicit action (no auto-adopt).
4. `ConsentExceptionChipsProps { items: { id: string; label: string }[]; onRemove(id: string): void; onAdd?(): void; labels: { remove: (l: string) => string; add: string; list: string } }`: wrapping row gap 8 of removable chips (`Pill meta-tone amber` + `close` 12 button with name `Usuń wymóg: {label}`), trailing dashed `+ wymagaj Zgody dla…` text button. Removing a chip makes behaviour LESS strict, so the button is `ghost` and the feature confirms.
5. `DocsListProps { files: { path: string; onOpen?(): void }[]; status: string; labels: { list: string } }`: file chips (`DocRefChip`) wrapping, then a status line mono 12 muted (`Git · main @ 4f2c9a1 · 14 Zadań wskazuje te pliki`). No add/remove here (docs come from the repository).
6. `DangerRowProps { title: string; description: string; actionLabel: string; onAction(): void; disabledReason?: string }`: in a `danger` `SettingsSection`, row padding 14 18 (min 70), title 14/600, description 12/1.4 muted (must state what is removed and that Decisions of this Workspace are deleted with it), trailing `Button danger md`. `disabledReason` (e.g. a Run is active) disables the button with visible text. The private-items summary row (`1 Agent · 2 Skille · 3 Workflow`) is a plain `SettingRow` composition and appears in the story.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` (scrolled render): Owner Rules section: R1/R2 rows (one with `Ostatnio powołany`), the Chief proposal banner `R4`, the consent-exception chips and `+ usuń wymóg`. `design-nav.png`: the 240px nav. `design-docs.png`: documentation chips + git line. `design-danger.png`: Isolation and budget section with the private-items summary and the delete row. Not drawn: nav hover, empty rules, disabled danger.

## 7. Reuse

Consumes `ui:ListRow`, `ui:Button`, `ui:Pill`, `ui:Card`, `DocRefChip`/`InfoNote` (OVE_DS040), `ui:SettingsSection`/`SettingRow` (OVE_DS078). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Owner Rules are security-relevant instructions: the UI never lets Chief or an Agent edit them (`onEdit` exists only for the Owner's desktop session; the proposal banner offers explicit accept/reject, never a default action, never auto-accepts on timeout). Deletion is destructive: `danger` tone, confirmation by the feature, disabled while a Run is active. Rule text is untrusted display text (may come from a Chief proposal).

## 10. Errors and edge cases

- No rules -> `EmptyState` line `Brak reguł. Chief może zaproponować pierwszą.`
- Rule text of 1000+ chars -> wraps, row grows.
- Chip label long -> ellipsis 200px + title.
- Active id not in nav -> none active.

## 11. Acceptance criteria

- [ ] Given the nav fixture, Then exactly one item has `aria-current` and keyboard Tab/Enter emits `onSelect`.
- [ ] Given `lastInvokedLabel`, Then the mono note appears under the rule text.
- [ ] Given the proposal banner, Then no action fires without an explicit click and both buttons are reachable.
- [ ] Given a removable chip, Then the button name reads `Usuń wymóg: {label}`.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: whether Owner Rules editing is inline or a dialog (default: dialog by the feature).
- ASSUMPTION: delete copy lists consequences (feature supplies).
