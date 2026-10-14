---
id: OVE_DS056
title: Build ApprovalList and ApprovalListItem (waiting, escalations, resolved today)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS022, OVE_DS032, OVE_DS033, OVE_DS039, OVE_DS055]
soft_depends_on: []
provides: ["ui:ApprovalList", "ui:ApprovalListItem"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:ListRow", "ui:SectionLabel", "ui:Avatar", "ui:EmptyState", "ui:Skeleton"]
owns: ["packages/ui-kit/src/approvals/ApprovalList/**"]
reads: []
design: design.png
design_source: "Zgody#appr/list (crop 72,117,360,783 CSS px)"
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 21]
---

# OVE_DS056: Build ApprovalList and ApprovalListItem (waiting, escalations, resolved today)

## 1. Summary

Builds the 360px inbox list of the Approvals view: title and subtitle, sections 'OCZEKUJĄ · 3', 'ESKALACJE' and 'ROZSTRZYGNIĘTE DZIŚ', rows for Approvals, Access Requests and Escalations with kind label, age, title and Agent chip, and compact resolved rows.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Zgody.dc.html` and its 2x render `_design/views/Zgody.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C3.2 (ApprovalListItem), B13 (ApprovalRow) and E25. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Approvals and Access Requests share one screen titled 'Zgody i Prośby' (E25: in code they stay `Approval` and `AccessRequest`). Escalations (loop limit exhausted) also need the Owner (SPEC 7). Marker colours: amber for Approval, magenta for Access Request, error for Escalation.

## 3. Scope (in)

- `ApprovalList` sections, `ApprovalListItem` pending/selected/resolved variants, empty and loading states.

## 4. Out of scope

- Detail pane (OVE_DS058), data/feature wiring (APPRUI).

## 5. Detailed requirements

1. Props:
   ```ts
   interface ApprovalListEntry { id: string; kind: ApprovalKind; kindLabel: string /* 'ZGODA · GIT PUSH' */; ageLabel: string /* 'Run #14 · 3 min' */; title: string; agent: { name: string; hue: AgentHue; initials: string }; }
   interface ResolvedEntry { id: string; verdict: 'allowed' | 'denied'; text: string; origin?: string }
   interface ApprovalListProps { title: string; subtitle: string; pending: ApprovalListEntry[]; escalations: ApprovalListEntry[]; resolved: ResolvedEntry[]; selectedId?: string; onSelect: (id: string) => void; labels: { pendingSection: string /* 'OCZEKUJĄ · 3' */; escalationsSection: string; resolvedSection: string; empty: string; list: string }; loading?: boolean }
   ```
   Section labels carry the count in the caller-formatted string.
2. Panel: `SidePanel` left 360, padding 18, title 24/700 `title-section` (-0.48px), subtitle 13px `text-secondary` (`Agent czeka, reszta pracuje dalej.`); sections use `SectionLabel` (the pending label tinted amber, margin 14 8 4). The list is `role="listbox"` hmm: no - a `<ul>` of `button` rows (`aria-current` for the selected) because rows open a detail pane; roving ArrowUp/Down like OVE_DS049.
3. `ApprovalListItem`: button column gap 8, padding 12 14, radius 16; default `bg-surface` + 1px `line`; selected `bg-surface-sel` + 1px `line-strong`. Row 1: leading 8px square marker in the kind tone (amber / magenta / error; shape differs from the round state dots so kinds are not confused with Agent state) + `kindLabel` (`SectionLabel` tone by kind) + age mono 11 right; row 2: title 14/600 (2-line clamp, title attribute); row 3: Agent chip: `Avatar` 24 + name 12px. Escalation rows are 113px (extra line allowed).
4. Resolved rows (`ROZSTRZYGNIĘTE DZIŚ`): compact single/double line 12px `text-secondary`, glyph `✓` mint or `✗` error via `StatusText` (word shown by `text`), origin `z desktopu`/`z Telegrama` as `OriginLine` (OVE_DS040); non-interactive (informational) unless `onSelect` is wanted later.
5. Empty (`pending` and `escalations` both empty): `ui:EmptyState` with `labels.empty` (`Nic nie czeka na Twoją Zgodę.`) between the title and the resolved list. Loading: 3 row skeletons per section.
6. Selection preserved by id across list updates; if the selected id disappears (decided elsewhere) the list keeps no selection and the feature moves the detail pane to a 'decided elsewhere' notice.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: full Approvals list: title `Zgody i Prośby`, `OCZEKUJĄ · 3` (selected git push with amber square marker, new domain, magenta access request), `ESKALACJE` (red marker `ESKALACJA · LIMIT PĘTLI`, agent Chief) and `ROZSTRZYGNIĘTE DZIŚ` rows with ✓/✗. Not in the mock: empty inbox, hover/focus, loading, new-arrival highlight (R: 2s magenta a10 fade, none under reduced motion).

## 7. Reuse

Consumes `ui:ListRow` base, `ui:SectionLabel`, `ui:Avatar`, `ui:EmptyState`, `ui:Skeleton`, `OriginLine`/`stateMaps` (OVE_DS040).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Titles are agent-authored; text only, clamp does not hide the full text (title attribute and the detail pane show it in full). The list never offers a grant action: granting happens only in the detail pane or inline card, after the Owner has seen the full request.

## 10. Errors and edge cases

- Duplicate ids across pending/escalations -> keyed by section+id.
- Count in the section label differs from the array length -> label is the caller's; no auto-count.
- Very long agent name -> ellipsis.
- Selected row scrolled out of view -> `scrollIntoView({block:"nearest"})` on selection by keyboard only.

## 11. Acceptance criteria

- [ ] Given the fixture, Then the three sections render with the row heights of the mock (94/94/94, 113, 72) within 2px.
- [ ] Given the selected id, Then exactly one row has `aria-current="true"` and `bg-surface-sel`.
- [ ] Given empty pending and escalations, Then the empty state shows.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: resolved rows are not clickable in MVP.
- OPEN: escalation list item copy beyond `ESKALACJA · LIMIT PĘTLI` (other escalation reasons: budget, timeout).
