---
id: OVE_DS053
title: Build AgentFactsBlock and AgentControls (herdr state tiles, hint footnote, pause)
area: DS
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS022, OVE_DS039, OVE_DS051, OVE_DS052]
soft_depends_on: []
provides: ["ui:AgentFactsBlock", "ui:AgentTerminalPanel"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Button", "ui:SectionLabel", "ui:Pill"]
owns: ["packages/ui-kit/src/chat/AgentTerminalPanel/**"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/terminal-panel (crop 1100,117,340,783 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [26, 23]
---

# OVE_DS053: Build AgentFactsBlock and AgentControls (herdr state tiles, hint footnote, pause)

## 1. Summary

Composes the 340px right panel of the direct Agent chat: terminal preview, the 2x2 facts block (STAN wg herdr, ZADANIE, WORKTREE, IZOLACJA), the footnote that the terminal state is a hint and not evidence, and the pause/interrupt controls.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Czat-Agent.dc.html` and its 2x render `_design/views/Czat-Agent.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C8.1/C8.3 and VIEWS 5. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). herdr reports Agent state; Overmind treats it as a hint and only advances a Task after the 'overmind' Skill report and effect verification (SPEC 9, ADR 0026/0027). 'Przerwij' is destructive (interrupts the Agent) and needs a confirm dialog owned by the feature.

## 3. Scope (in)

- `AgentTerminalPanel` composition and `AgentFactsBlock`.
- Button states for Pause/Interrupt including loading and confirm hook.

## 4. Out of scope

- Terminal pane internals (OVE_DS052), KeyValueList (OVE_DS051).
- Dialog content and engine calls.

## 5. Detailed requirements

1. Props:
   ```ts
   interface AgentFactsBlockProps { herdrState: { value: AgentState; label: string }; task?: { id: string; label: string }; worktree?: string; isolation: { ok: boolean; label: string }; labels: { herdrState: string; task: string; worktree: string; isolation: string; hint: string } }
   interface AgentTerminalPanelProps extends AgentFactsBlockProps { terminal: TerminalPaneProps; controls: { pause: ControlSpec; interrupt: ControlSpec }; labels: AgentFactsBlockProps['labels'] & { title: string } }
   interface ControlSpec { label: string; onClick: () => void; disabled?: boolean; loading?: boolean }
   ```
2. Panel (SidePanel right 340, padding 20 21): header row `SectionLabel`-style title (`Terminal Agenta`, 15/700) + `tylko podgląd` pill; `TerminalPane` live-preview (min-height 240, flex 1 up to 266); then `KeyValueList grid2` with four tiles (labels mono-label: `STAN wg herdr`, `ZADANIE`, `WORKTREE`, `IZOLACJA`; values: state word with `StatusText`, `T-31 · koszyk`, `qa/cart-e2e` mono, `kontener · OK` mint with check glyph; not OK -> error tone + word); footnote `InfoNote` (`Stan z terminala to wskazówka. Zadanie idzie dalej dopiero po raporcie Skilla „overmind” i sprawdzeniu efektu.`); controls row at the bottom (gap 10): `Wstrzymaj Agenta` `secondary` full width and `Przerwij` `danger` full width.
3. Isolation fact: `ok=false` MUST render in error tone with the explicit word (fail-closed visibility: if isolation is not confirmed the Owner sees it). `herdrState` always labelled 'wg herdr' (source attribution, like limits 'wg CLI').
4. Controls: `loading` shows spinner + `aria-busy`; `disabled` after Global Pause/Agent not running; the component does NOT show a dialog: `onClick` is expected to open the feature's `ui:Dialog` for `Przerwij` (destructive). Both buttons have visible text; icons `pause` and `stop` 16.
5. Unavailable terminal: when `terminal.lines` is empty and `terminal.caret` false the pane shows the muted text from props (`Terminal niedostępny`) and the facts still render.
6. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
7. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
8. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
9. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
10. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
11. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
12. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the full right panel of the Direct chat. Heights from the mock: terminal 266, facts 120, footnote 52, controls 167 (buttons 40 + padding). Not in the mock: Agent not running, confirm dialog, loading/disabled buttons, isolation failure state.

## 7. Reuse

Consumes OVE_DS052 `ui:TerminalPane`, OVE_DS051 `ui:KeyValueList`, `ui:InfoNote` (OVE_DS040), `ui:Button`.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The isolation fact and the hint footnote are safety-relevant and cannot be hidden by props (footnote text is required). `Przerwij` never fires without the feature-level confirmation (documented in the story).

## 10. Errors and edge cases

- Worktree path very long -> ellipsis in the middle via CSS `direction` is NOT used; end ellipsis + title.
- `task` undefined -> tile shows `—` (label provided).
- `isolation.ok=false` -> error tone and the Pause button remains enabled.

## 11. Acceptance criteria

- [ ] Given the fixture, Then the panel shows the four facts, the footnote and two buttons stacked at the bottom of a 783px column without page scroll.
- [ ] Given `isolation.ok=false`, Then the tile uses error tone and includes the word from the label.
- [ ] Given `interrupt.loading`, Then the button is `aria-busy` and cannot be activated twice.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: confirm dialog is a feature concern; story demonstrates with `ui:Dialog`.
