---
id: OVE_DS079
title: Build ConnectionCard (CLI, local runtime, channel, future) with KeyValue rows
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS010, OVE_DS013, OVE_DS017, OVE_DS020, OVE_DS031, OVE_DS039, OVE_DS040, OVE_DS051, OVE_DS078]
soft_depends_on: []
provides: ["ui:ConnectionCard", "ui:ConnectionGrid"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Pill", "ui:Button", "ui:StatusDot", "ui:LogoTile", "ui:KeyValueList"]
owns: ["packages/ui-kit/src/settings/ConnectionCard/**"]
reads: []
design: design.png
design_source: "Polaczenia#conn/card-grid (crop 100,253,992,684 CSS px); design-claude.png = Polaczenia (crop 100,253,489,276); design-telegram.png = Polaczenia (crop 603,543,489,243)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 11"]
adr_refs: [22, 6, 7]
---

# OVE_DS079: Build ConnectionCard (CLI, local runtime, channel, future) with KeyValue rows

## 1. Summary

Builds the Connections page card: icon tile + title + mono subtitle + state pill, key/value rows, action buttons (secondary, danger) with variants for official CLI, local runtime (Ollama), channel (Telegram, paired) and future/disabled (API keys, after MVP), plus the auto-fill `ConnectionGrid`.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Polaczenia.dc.html` and its 2x render `_design/views/Polaczenia.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C9.3 (ConnectionCard), C8.3 (KeyValueList). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Agents run through the Owner's own subscriptions via the official CLIs (ADR 0022); the login happens inside the CLI, so the card never shows or asks for credentials. Telegram is the second channel (ADR 0006, one paired Owner).

## 3. Scope (in)

- `ConnectionCard`, `ConnectionGrid`, state pill states (logged in, working, paired, not logged in, error, checking, disabled), actions, stories for all five mock cards.

## 4. Out of scope

- Logging in/out (feature; opens the terminal login flow), model choice, fallback order (OVE_DS080).

## 5. Detailed requirements

1. `ConnectionCardProps`:
   ```ts
   interface ConnectionCardProps {
     kind: 'cli' | 'runtime' | 'channel' | 'future';
     mark: string;                      // logo tile text: '>_', 'OL', 'TG'
     title: string; subtitle: string;   // 'Claude Code', 'claude 2.4.1' (mono)
     state: 'connected' | 'disconnected' | 'checking' | 'error' | 'disabled'; stateLabel: string;  // 'zalogowany' | 'działa' | 'sparowany'
     rows: { label: string; value: ReactNode; mono?: boolean }[];
     actions?: { id: string; label: string; tone?: 'secondary' | 'danger'; onClick(): void; busy?: boolean }[];
     note?: string; disabledNote?: string /* 'po MVP' */;
   }
   ```
2. Card: `ui:Card` radius 22, padding 18, bg `#140F20`, 1px `line`, column gap 14. Header row (height 42): `LogoTile` variant `connection` 40-44 (mono mark, violet gradient tint), title 16/700 + subtitle mono 12 `text-muted` (ellipsis), state pill right: dot + word (connected = mint dot + glow, error = error, checking = grey pulsing dot, disconnected = amber dot). The state is always a word.
3. Rows: `KeyValueList` layout `two-column` (label left muted 13px, value right 13/600 or mono): `Plan: Claude Max`, `Limit wg CLI: 62% · reset za 3 h` (the words `wg CLI` are part of the label supplied by the feature). Row height 33, 1px `line-subtle` between rows.
4. Actions row (padding-top 12, gap 10, wrap): `Button secondary md` for neutral (`Sprawdź`, `Wykryj ponownie`), `Button danger md` for `Wyloguj`/`Rozłącz`; `busy` shows a spinner and `aria-busy`. Danger actions never use magenta; the feature confirms with a Dialog. `variant kind=cli` and `runtime` actions always include a non-destructive check action first.
5. `state=disabled` (future / API keys): opacity .55, no actions, `disabledNote` pill `po MVP`, whole card `aria-disabled`, not focusable. `note` (e.g. compliance hint) renders as `InfoNote` under the rows.
6. `ConnectionGrid`: `display:grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 14px` (mock: 2 columns of 489 inside 992).
7. Cards are not links; each interactive element inside is a button in tab order. The state word is in the card `aria-label`: `Claude Code, zalogowany`.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the card grid: Claude Code (zalogowany; Plan, Limit wg CLI; buttons), Codex CLI, Ollama (działa, lokalnie), Telegram (sparowany, danger `Rozłącz`), API keys disabled (`po MVP`, opacity .55). `design-claude.png` / `design-telegram.png` zoom on two. Not drawn: error, checking, disconnected, busy action, long values.

## 7. Reuse

Consumes `ui:Card`, `ui:LogoTile` (OVE_DS041), `ui:Pill`, `ui:Button`, `ui:StatusDot`, `ui:KeyValueList` (OVE_DS051), `InfoNote` (OVE_DS040). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). No secrets in props: only display facts (version, plan, percent). Never render tokens, auth URLs or the Telegram bot token; a paired Telegram card shows only the masked chat label supplied by the feature. Rows are untrusted text. Destructive actions (`Rozłącz`) are visually and semantically distinct and reachable by keyboard, but confirmation is the feature's responsibility.

## 10. Errors and edge cases

- No rows -> header + actions only.
- Value very long (path) -> `overflow-wrap:anywhere` in mono.
- `actions` empty and `state=error` -> `note` shows the remedy text.
- `stateLabel` missing -> falls back to a neutral dash.

## 11. Acceptance criteria

- [ ] Given the five fixtures, Then each renders the pill word and variant (disabled at .55 opacity, not focusable).
- [ ] Given `busy`, Then the action is `aria-busy` and cannot be activated twice.
- [ ] Given width 330, Then the grid has one column.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: card order is feature-defined.
- OPEN: whether an `error` state should also surface a banner on the Connections page (default: card only).
