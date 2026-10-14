---
id: OVE_DS077
title: Build UsagePanel (per-CLI limits, per-Agent time, reproducibility)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS021, OVE_DS022, OVE_DS032, OVE_DS039, OVE_DS040, OVE_DS051]
soft_depends_on: []
provides: ["ui:UsagePanel", "ui:UsageBarRow"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Meter", "ui:SectionLabel", "ui:Skeleton", "ui:EmptyState", "ui:KeyValueList"]
owns: ["packages/ui-kit/src/activity/UsagePanel/**"]
reads: []
design: design.png
design_source: "Activity#activity/usage-panel (crop 1140,162,300,738 CSS px)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [7, 22]
---

# OVE_DS077: Build UsagePanel (per-CLI limits, per-Agent time, reproducibility)

## 1. Summary

Builds the 300px usage sidebar: `Limity wg CLI` meter rows per provider, per-Agent time bars for the selected Run, the reproducibility key/value block (versions, models, hashes) and the 'Wartości raportuje samo CLI' footnote.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Activity.dc.html` and its 2x render `_design/views/Activity.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C8.8 (UsagePanel), B14 (Meter), C8.3 (KeyValueList). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Subscription limits are reported by the official CLIs, not measured by Overmind, hence the mandatory words `wg CLI` (VIEWS domain rules, SPEC 7, ADR 0022). The reproducibility block lets the Owner re-run a Run with the same models and Skill versions (SPEC 8, ADR 0007).

## 3. Scope (in)

- `UsagePanel` (3 sections), `UsageBarRow`, stories incl. limit >= 90%, unknown value, no CLI connected.

## 4. Out of scope

- Top-bar `LimitMeter` (OVE_DS042) which this panel reuses for the rows.
- Data and refresh.

## 5. Detailed requirements

1. `UsagePanelProps`:
   ```ts
   interface LimitRow { id: string; provider: string; plan?: string; percent?: number | null; resetLabel?: string; stale?: boolean }
   interface AgentUsageRow { id: string; name: string; hue: AgentHue; initials: string; minutes: number; label: string /* '12 min' */ }
   interface UsagePanelProps { limitsHeading: string; limits: LimitRow[]; agentHeading: string; agents: AgentUsageRow[]; reproHeading: string; repro: { label: string; value: string }[]; footnote: string; labels: { byCli: string; unknown: string; stale: string } }
   ```
2. Layout: panel padding 21, column gap 20 (headings at y=182, 405, 595 in the mock). Headings 15/700 (`Limity wg CLI`, `Czas pracy Agentów`, `Powtarzalność`). Limit rows reuse `ui:LimitMeter`-style row (bar + `Claude Max 62% · reset za 3 h`): bar 60x6 stays, but in the panel the bar is full width (259) with the text above it (mono 12). Tone: < 70% violet/magenta default, 70-89% amber, >= 90% error with the word `blisko limitu` (R, E-states from VIEWS shell: warning at >= 90%). `percent = null` -> text `brak danych wg CLI` and empty track; `stale` appends `· nieaktualne`.
3. `UsageBarRow`: avatar 22 + name 13/600 + bar (height 6, radius 3, magenta fill `#F25FC4`, width = minutes / max(minutes)) + label mono 12 right; max 8 rows then `+N` line. Sorted by the feature.
4. Reproducibility: `ui:KeyValueList` layout `definition-rows` mono 11/12 (`workflow v7`, `Opus 5.5 · Claude Code 2.4.1`, `Skille: TypeScript v4, tdd v2`, `seed: …`); values selectable text (`user-select: text`) so the Owner can copy; long values wrap with `overflow-wrap: anywhere`.
5. Footnote 12/1.4 `text-muted`: `Wartości raportuje samo CLI.` (always rendered; if `limits` is empty it is the only text and an `EmptyState` line says no CLI is connected).
6. Panel scrolls internally when taller than the viewport; headings are not sticky (MVP).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the whole sidebar: limits heading with the Claude Max 62% meter (and Codex row), per-Agent bars (magenta, minutes), reproducibility mono block, footnote. Not drawn: >= 90%, null data, stale, empty, many agents.

## 7. Reuse

Consumes `ui:Meter`/`ui:LimitMeter` (OVE_DS042), `ui:KeyValueList` (OVE_DS051), `ui:SectionLabel`, `ui:Avatar`, `ui:Skeleton`, `ui:EmptyState`. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Never display tokens, cookies or CLI credentials; only the facts the CLI reports. Repro values may contain file paths or hashes: text only. A displayed percentage is a hint, not enforcement (engine enforces budgets).

## 10. Errors and edge cases

- Percent > 100 -> clamped bar, text shows the real number.
- All agent minutes 0 -> empty tracks.
- Provider unknown -> neutral tone.

## 11. Acceptance criteria

- [ ] Given 62%, Then the bar fill is 62% and text reads `Claude Max 62% · reset za 3 h`.
- [ ] Given 93%, Then error tone and the words `blisko limitu` appear.
- [ ] Given `percent=null`, Then `brak danych wg CLI` appears.
- [ ] The footnote is always present.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: thresholds 70/90 are defaults; OPEN whether the CLI-reported units differ per provider (display string only).
