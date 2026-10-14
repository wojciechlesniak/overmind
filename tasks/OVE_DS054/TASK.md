---
id: OVE_DS054
title: Build LiveWorkPanel (Teraz pracuje, AgentWorkCard, board tiles, recent Decisions)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS018, OVE_DS022, OVE_DS031, OVE_DS039, OVE_DS040, OVE_DS051, OVE_DS052]
soft_depends_on: []
provides: ["ui:LiveWorkPanel", "ui:AgentWorkCard"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Avatar", "ui:Card", "ui:SectionLabel", "ui:StatusPill"]
owns: ["packages/ui-kit/src/chat/LiveWorkPanel/**"]
reads: []
design: design.png
design_source: "Chief#chief/working-now-panel (crop 1140,117,300,783 CSS px)"
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12"]
adr_refs: [23, 8]
---

# OVE_DS054: Build LiveWorkPanel (Teraz pracuje, AgentWorkCard, board tiles, recent Decisions)

## 1. Summary

Builds the 300px right panel of the Chief view: 'Teraz pracuje · 3 z 3 slotów' with the active Agent card (mini test excerpt and progress), the waiting and other-Workspace Agent rows, the Task Board lane counts as stat tiles, and the 'Ostatnie Decyzje' list.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Chief.dc.html` and its 2x render `_design/views/Chief.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C2.4 (LiveWorkPanel). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Slots are the global 3 parallel Agents (SPEC 9: default 3, configurable). Chief sees all non-isolated Workspaces, so rows can show other Workspaces. Decisions listed come from the Decision Register (append-only, ADR 0008).

## 3. Scope (in)

- Panel composition, `AgentWorkCard` variants `active | waiting | other-workspace`, lane tiles, decision link cards, empty/loading states.

## 4. Out of scope

- Terminal internals (OVE_DS052), StatTile (OVE_DS051).
- Data wiring (CHATUI).

## 5. Detailed requirements

1. Props:
   ```ts
   interface WorkingAgent { id: string; name: string; hue: AgentHue; initials: string; state: AgentState; headline?: string /* 'QA · testy e2e koszyka' */; stateLabel: string; workspaceName?: string; test?: { lines: string[]; progress?: { done: number; total: number; label: string } } }
   interface LaneCount { id: string; label: string; count: number; tone?: Tone; emphasis?: boolean; onOpen?: () => void }
   interface RecentDecision { id: string; title: string; meta: string; onOpen: () => void }
   interface LiveWorkPanelProps { slots: { label: string /* '3 z 3 slotów' */ }; agents: WorkingAgent[]; lanes: LaneCount[]; decisions: RecentDecision[]; labels: { working: string; board: string; recentDecisions: string; empty: string }; loading?: boolean }
   ```
2. Header: `Teraz pracuje` 15/700 left, `slots.label` mono 12 `text-muted` right (the number+unit text is composed by the caller, e.g. `3 z 3 slotów`). Content padding 20 21, column gap 16 (panel from `PageLayout`).
3. `AgentWorkCard` `active` (state working): `ui:Card` tone `chief`-like magenta border (1px rgba(242,95,196,.4), gradient 120deg #2A1130 -> #120D1C, radius 20), padding 14, header row avatar 22 + headline 14/600; below `TerminalPane mini` with the test lines and progress line `… 38 z 52`. If `test.progress` present a `TaskProgress`-style bar (height 4, radius 2, track #3A1C3A, fill #F25FC4) with `role="progressbar"` is shown under the lines. Waiting variant: amber card (1px amber a50, fill #22180A), row layout avatar 22 + name 14/600 + right word `czeka na Zgodę` mono 11 amber. Other-Workspace variant: default card, right text = `workspaceName` mono 11 `text-muted`.
4. Lanes row: heading `Tablica` 15/700 then `StatTileRow` with `StatTile` per lane (Build, QA, Review, Gotowe; Done tone mint; the active lane `emphasis`); tiles are links (`onOpen` navigates to the Task Board, filtered by lane).
5. Recent Decisions: heading `Ostatnie Decyzje` then link cards (`ui:Card` default radius 14 padding 12 14: title 13/600, meta mono 11 `text-muted`, e.g. `Chief · luka „jak” · 11:40`); each is a `button` calling `onOpen`; max 5 shown, no scrolling inside the card list (the panel scrolls).
6. Loading: `ui:Skeleton` card + 4 tile skeletons + 2 row skeletons. Empty agents: muted text `labels.empty` (`Nikt teraz nie pracuje`) in place of the cards. State is conveyed by the word in each row, not colour only.
7. No timers inside: elapsed times and progress are provided by props (the feature updates them), so stories are deterministic.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Chief right panel (header with `3 z 3 slotów`, the magenta QA card with the mini terminal, amber Security row `czeka na Zgodę`, Researcher row `Strona fundacji`, tile row `2 Build / 3 QA (emphasis) / 1 Review / 7 Gotowe`, two decision cards). Not in the mock: loading, empty, more than 3 Agents (list grows; slots label shows `3 z 3`), progress bar when no test, long headlines (ellipsis).

## 7. Reuse

Consumes OVE_DS052 (`mini`), OVE_DS051 (`StatTile`), `ui:Card`, `ui:Avatar`, `ui:StatusPill`, `ui:SectionLabel`, `ui:Skeleton`.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Test lines come from Agent output (untrusted) and pass through `TerminalPane` sanitising. Progress is display-only: it is a hint, the Quality Gate uses real evidence (ADR 0026).

## 10. Errors and edge cases

- `total = 0` in progress -> bar hidden.
- `done > total` -> clamped to 100%.
- More than 6 agents -> list continues; no truncation.
- Decision title too long -> 2-line clamp.

## 11. Acceptance criteria

- [ ] Given the Chief fixture, Then it renders the cards/tiles/decisions with the heights of the mock within 2px and matches `design.png` within tolerance.
- [ ] Given the `QA` lane tile, Then it has emphasis styling and is keyboard-activatable.
- [ ] Given `loading`, Then skeletons render and no layout shift occurs when data arrives (heights reserved).
- [ ] axe clean; the progress bar has a name and `aria-valuenow`.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: max 5 decisions; the feature slices.
