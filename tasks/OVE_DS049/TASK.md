---
id: OVE_DS049
title: Build ConversationList (Chief row, Agent rows, live Discussion rows, New Agent)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS019, OVE_DS020, OVE_DS022, OVE_DS031, OVE_DS032, OVE_DS033, OVE_DS039, OVE_DS044]
soft_depends_on: []
provides: ["ui:ConversationList", "ui:ConversationRow"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:ListRow", "ui:Avatar", "ui:StatusDot", "ui:CountBadge", "ui:SectionLabel", "ui:Button", "ui:Card", "ui:Skeleton", "ui:EmptyState"]
owns: ["packages/ui-kit/src/chat/ConversationList/**"]
reads: []
design: design.png
design_source: "Chief#chief/conversation-list (crop 72,117,270,783 CSS px); design-direct.png = Czat-Agent (crop 72,117,270,783)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23]
---

# OVE_DS049: Build ConversationList (Chief row, Agent rows, live Discussion rows, New Agent)

## 1. Summary

Builds the 270px conversation list shown in the Chief view and in direct Agent chats: the pinned Chief row (selected: magenta gradient with glow), the 'AGENCI W TYM WORKSPACE' rows with avatar, state dot, state line and optional count badge, the 'DYSKUSJE NA ŻYWO' rows and the pinned dashed 'Nowy Agent' button.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Chief.dc.html` and its 2x render `_design/views/Chief.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C2.1 (ConversationList), B13 (ConversationRow) and A.1.3. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). There is one Chief and one Owner; direct chats with each Agent are also conversations (ADR 0023). State lines come from Agent State (herdr state is a hint, but the UI vocabulary is: pracuje, czeka na Zgodę, bezczynny, skończył · 4 pliki, czeka na Quality Gate). Count badges signal Approvals waiting, so they are amber (E10).

## 3. Scope (in)

- `ConversationList` panel content (to be placed in `SidePanel` left 270).
- `ConversationRow` variants `chief`, `agent`, `discussion`.
- Loading skeleton and empty states.

## 4. Out of scope

- The conversation data and unread logic (CHATUI feature).
- Creating an Agent (button only calls `onNewAgent`).
- The Discussion list of the Discussion view (OVE_DS083).

## 5. Detailed requirements

1. Props:
   ```ts
   interface ConversationItem { id: string; kind: 'chief'|'agent'|'discussion'; name: string; hue?: AgentHue; initials?: string; state?: AgentState; stateLabel: string /* 'pracuje · testy e2e koszyka' */; badge?: { count: number; label: string }; meta?: string /* 'runda 2 z 4 · 3 uczestników' */ }
   interface ConversationListProps {
     chief: ConversationItem; agents: ConversationItem[]; discussions?: ConversationItem[];
     selectedId?: string; onSelect: (id: string) => void; onNewAgent?: () => void;
     loading?: boolean;
     labels: { navigation: string; agentsSection: string; discussionsSection: string; newAgent: string; empty: string };
   }
   ```
2. Container: column flex, gap 0, fills the SidePanel (padding 12 as in the mock: rows at x=84 are 12px from the 72px rail edge); the Chief row is pinned at the top, the middle region (agents + discussions) scrolls (`overflow-y:auto; min-height:0`), the `Nowy Agent` button is pinned at the bottom with margin-top 12 (mock y=840, height 44).
3. `ConversationRow` kind `chief`: padding 12, radius 18, gap 12; selected = `ui:Card` tone `chief` (1px rgba(242,95,196,.4), gradient 135deg #2A1130 -> #1A1029) + `glow-card-chief` (0 0 24px rgba(242,95,196,.15)); NOT selected = plain surface `bg-surface` with 1px `line` (Direct chat mock). Avatar 40 (Chief hue, initial `C`), title 15/700, state line 12px wraps to 2 lines (`Security czeka na Twoją Zgodę`) in `text-secondary`. Height 77.
4. kind `agent`: padding 9 10, radius 14, gap 10, `1px solid transparent`; selected `bg-surface-sel` (#1A1422) + 1px `line-strong` (Direct chat: border #2A2040 in the mock is normalised to `line-strong`, same as every other selected row). Avatar 34 (mono 11) with the positioned `StatusDot` 10 at bottom-right (`left:34 top:34` of the avatar) for working (magenta + glow), waiting-approval (amber + glow), done (mint + glow); idle shows NO dot. Title 14/600; state line 12px coloured by `agentStateTone`: working magenta-300 (#FFB3E6), waiting amber-300 (#FFCF85), done mint (#62E3B4), idle/waiting-gate `text-muted`. Row height 54. Badge: `ui:CountBadge` circle, tone amber (E10), right aligned, `aria-hidden` and appended to the row's accessible name via `badge.label`.
5. kind `discussion`: padding 10 12, radius 14, 1px dashed `line-strong` (violet), dot 8 magenta + glow, title 14/600 (ellipsis), meta mono 11 `text-muted`; height 56. Selected uses the same selected style as agent rows but keeps the dashed border.
6. Sections: `ui:SectionLabel` for `agentsSection` and `discussionsSection` (margin 14 8 4 per the mock); the discussions section is omitted when empty. Accessibility: the panel is `<nav aria-label=labels.navigation>`; rows are `<button>` with `aria-current="true"` on the selected one; Up/Down arrows move focus between rows (roving, Home/End supported); the accessible name = `name, stateLabel[, badge.label]`.
7. `loading`: 6 row skeletons (`ConversationRowSkeleton`, avatar blob + 2 lines) replace the lists; the Chief row and the button stay. Empty agents: `ui:EmptyState` small variant with `labels.empty` and the New Agent button remains.
8. Truncation: names and state lines single-line with ellipsis EXCEPT the Chief row state line (max 2 lines, `-webkit-line-clamp: 2`); full text in `title`.
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: Chief view list (Chief selected with magenta gradient, QA working magenta line, Security amber with badge 1, Developer mint `skończył · 4 pliki`, idle rows grey, `DYSKUSJE NA ŻYWO` dashed row, `Nowy Agent` dashed button). `design-direct.png`: same list with Chief NOT selected and QA selected. Token values in requirements. Not in the mock: hover (`bg-surface`), focus ring, loading skeleton, many Agents scroll (fade mask 16px at the top/bottom of the scroll region), long names, unread-message badge distinct from approvals (R: same badge, different `label`).

## 7. Reuse

Consumes `ui:ListRow` as the row base (variant `conversation`), `ui:Avatar` (status dot overlay), `ui:StatusDot`, `ui:CountBadge`, `ui:SectionLabel`, `ui:Button` (`dashed-add`), `ui:Card` (`chief`). Provides `ui:ConversationRow` consumed by the Discussion list (OVE_DS083).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Names of Agents come from user/Chief-created configuration: text only. Badge counts are display-only; the Approval list is the authoritative surface for decisions.

## 10. Errors and edge cases

- `selectedId` not present -> nothing selected.
- `agents` > 50 -> list scrolls; no virtualisation required (MVP has <= ~20).
- Unknown `state` -> idle styling with `stateLabel` text.
- `hue` missing for an Agent -> `hueForAgentId(id)` from OVE_DS040.
- Rapid keyboard navigation -> focus never lost when a row is removed (focus moves to the next row).

## 11. Acceptance criteria

- [ ] Given the Chief fixture, Then row heights are 77/54/56 and the button is pinned at the bottom of the panel at 900px.
- [ ] Given Security with badge 1, Then the badge is amber, not magenta, and the row name includes the badge label.
- [ ] Given ArrowDown on a focused row, Then focus moves to the next row; Home/End jump to first/last.
- [ ] Given `loading`, Then skeletons render and axe is clean.
- [ ] Visual match with `design.png` (selected Chief) within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION (E10): badge amber.
- OPEN: unread messages indicator is not designed; default reuses the badge with a different label.
