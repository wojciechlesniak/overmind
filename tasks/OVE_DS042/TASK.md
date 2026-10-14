---
id: OVE_DS042
title: Build TopBar status controls (LimitMeter, SlotsPill, ChannelPill, Approvals, Global Pause)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS020, OVE_DS021, OVE_DS028, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:LimitMeter", "ui:SlotsPill", "ui:ChannelPill", "ui:ApprovalsButton", "ui:GlobalPauseButton"]
needs: ["ui:tokens", "ui:Pill", "ui:Meter", "ui:StatusDot", "ui:Button", "ui:Icon", "ui:Tooltip", "ui:Popover"]
owns: ["packages/ui-kit/src/shell/TopBarControls/**"]
reads: []
design: design.png
design_source: "Pulpit#shell/top-bar controls (one-row variant) (crop 487,12,953,42 CSS px); design-pause-banner.png = Pulpit (crop 72,0,1368,67)"
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12"]
adr_refs: [3, 6, 22]
---

# OVE_DS042: Build TopBar status controls (LimitMeter, SlotsPill, ChannelPill, Approvals, Global Pause)

## 1. Summary

Builds the five status controls of the top bar as separate, individually testable components: subscription limit meter ('wg CLI'), parallel-slots pill, channel (Telegram) status pill, the amber Approvals button with count, and Global Pause (including its active 'paused' state that no mock draws). The TopBar composition itself is in OVE_DS043.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Pulpit.dc.html` and its 2x render `_design/views/Pulpit.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C1.2 (TopBar). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Rules visible in every view: limits always say 'wg CLI' because the limit is reported by the official CLI itself (SPEC 9, ADR 0022); numbers carry a word unit ('3 z 3 naraz'); urgent items (Approvals) live in the top bar. Global Pause stops all Agents after the current step (PAUSE area); inventory E33 requires a designed active state.

## 3. Scope (in)

- `LimitMeter` (one pill per CLI, tone by percentage, compact form, unlimited form).
- `SlotsPill`, `ChannelPill`.
- `ApprovalsButton` (link-like button, count, zero state).
- `GlobalPauseButton` (idle and active variants) and the `PausedBanner` strip used by the TopBar when Global Pause is active.

## 4. Out of scope

- TopBar layout, wrapping and the Workspace switcher (OVE_DS043).
- Gateway data and Global Pause semantics (PAUSE area, `api:pause.global`).
- Confirmation dialog for Global Pause (uses `ui:Dialog` in the feature).

## 5. Detailed requirements

1. `LimitMeter` props:
   ```ts
   interface LimitEntry { id: string; cli: string /* 'Claude Max' */; percent: number | null /* null = no limit (Ollama) */; resetLabel?: string /* 'reset 3 h' */ }
   interface LimitMeterProps { entries: LimitEntry[]; compact?: boolean; labels: { source: string /* 'wg CLI' */; unlimited: string /* 'bez limitu' */; ariaLimit: (e: LimitEntry) => string } }
   ```
   Renders one `ui:Pill` (variant `meta`, mono 12, padding 6 10, gap 8) per entry, max 2 pills inline; entries beyond 2 collapse into a `+N` pill that opens a `ui:Popover` listing every CLI (same row format). Row text composition: `${cli} ${percent}% · ${resetLabel} · ${labels.source}`; the suffix `wg CLI` is MANDATORY and not removable by props (product rule).
2. Meter: `ui:Meter` 48x6, radius 3, track `line` (#2A2040), fill by percent: < 90 violet `#9B7BFF`, >= 90 amber `#FFB547`, 100 error `#FF8FA3` (B14 recommendation; at 90% Chief switches Agents to the fallback model, SPEC 9). `percent: null` renders no meter and the text `${cli} · ${labels.unlimited}`. Meter has `role="meter"` with `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100` and `aria-label` from `ariaLimit`.
3. Compact form (`compact` or container width < 1280px, decided by the TopBar through a container query, E1): the pill shows only `62%` + the meter, the full text moves into the tooltip/`aria-label`. The `wg CLI` source is still present in the tooltip and the accessible name.
4. `SlotsPill` props `{ active: number; max: number; label: string }` where `label` is the preformatted phrase (`Agenci 3 z 3 naraz`); `Pill` meta, `white-space: nowrap`. Adds `data-saturated="true"` when `active >= max` (styling hook only, no colour change by default). `aria-label` = `label`.
5. `ChannelPill` props `{ status: 'connected'|'connecting'|'disconnected'|'error'; label: string }`: meta pill with `ui:StatusDot` size 6 + label. Dot: connected mint + glow; connecting amber pulsing (respect reduced motion); disconnected grey, no glow; error `#FF8FA3` + glow. Status is always also in the text `label` (never colour alone).
6. `ApprovalsButton` props `{ count: number; label: string /* '3 czekają' */; ariaLabel: string /* 'Zgody i Prośby: 3 czekają' */; href?: string; onClick?: () => void }`. Visual (from the mock): min-height 40 (design bar slot 42), padding 0 12, radius 12, 1px border `rgba(255,181,71,.5)` (amber-a50), fill `#22180A` (amber-bg), text `#FFCF85` (amber-300) 13/600, leading `shield-check` 16 icon, gap 8. It is an `<a>`/router link (opens Approvals view) unless only `onClick` is given. `count === 0`: neutral variant (`secondary` look, text `Brak oczekujących`-style label supplied by caller) so the amber attention colour is only used when something waits. Hover: fill +1 step and `glow` of amber 0 0 18px a25. Count > 99 shows `99+` inside `label` supplied by caller (caller formats).
7. `GlobalPauseButton` props `{ paused: boolean; pending?: boolean; onToggle: () => void; labels: { pause: string; resume: string; paused: string } }`. Idle: the inventory `pause` button variant (height 40, padding 0 14, radius 12, 1px #5A2A4F, fill #2A1026, text #FFD3F1 13/600, `pause` icon 16) using `ui:Button` variant `pause`. Active (`paused=true`, E33, recommended design): same shape, fill `magenta-500` @ 18% with 1px `magenta-500` @ 55%, icon `play`, label `labels.resume` ('Wznów'), `aria-pressed="true"`. `pending` shows the spinner and `aria-busy`. The button never calls the engine; `onToggle` is the only effect, and the feature wraps it in the confirm dialog.
8. `PausedBanner` props `{ message: string; resumeLabel: string; onResume: () => void }`: full-width strip rendered by the TopBar above its row while paused (E33): magenta tint (`rgba(242,95,196,.12)` fill, 1px bottom border magenta a40), `pause` icon, message (`Wszystko wstrzymane`), `ui:Button` `primary-magenta` size sm `Wznów`. `role="status"` so screen readers announce entering the paused state. Height 36 (does not break the 67px bar rule: it is an extra row only while paused).
9. All five are `display: inline-flex; flex-shrink: 0` except `LimitMeter` whose text may shrink with ellipsis (`min-width: 0`) so the bar never wraps (E1, enforced in OVE_DS043).
10. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
11. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
12. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
13. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
14. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
15. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
16. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` shows the right half of the one-row top bar (Workspaces view, 67px tall): limit pill with 62% violet meter, `Agenci 3 z 3 naraz`, `Telegram połączony` with mint glow dot, amber `3 czekają` button, magenta-tinted `Global Pause`. `design-pause-banner.png` shows the whole bar for orientation. Exact values are in the requirements; copy from mock: `Claude Max 62% · reset 3 h · wg CLI`, `Agenci 3 z 3 naraz`, `Telegram połączony`, `3 czekają` (aria `Zgody i Prośby: 3 czekają`), `Global Pause`. Not in the mock (derive from the rules above): limit >=90% amber, 100% error, unlimited, compact, `+N` popover, Telegram disconnected/connecting/error, slots 0 z 3, Approvals count 0, Global Pause active and pending, hover/focus.

## 7. Reuse

Consumes `ui:Pill` (meta), `ui:Meter`, `ui:StatusDot`, `ui:Button` (`pause`, `primary-magenta`), `ui:Icon`, `ui:Tooltip`, `ui:Popover`. Provides the five controls consumed by OVE_DS043 and re-used by OVE_DS085 (Global Pause look) - the Tray reuses `GlobalPauseButton` with `size="tray"` (height 42, margin 4 2, 13/700).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Global Pause is a safety control: it must stay reachable and visually unmistakable in every state, and a failed pause must never look like success (`pending` ends only when the feature flips `paused`). Limits are displayed exactly as reported by the CLI (no rounding up that hides nearness to a limit: percent is rendered as given, integer).

## 10. Errors and edge cases

- `percent` > 100 or < 0 -> clamped for the bar, text shows the raw integer.
- `entries` empty -> `LimitMeter` renders nothing.
- Very long CLI name -> ellipsis at 220px with title.
- `count` NaN -> treated as 0.
- Rapid double click on Global Pause -> second click ignored while `pending`.
- Popover open while the bar shrinks -> popover closes on container resize.

## 11. Acceptance criteria

- [ ] Given 62% for `Claude Max` with reset `reset 3 h`, Then the pill reads `Claude Max 62% · reset 3 h · wg CLI`, the meter fill is 62% violet and `aria-valuenow=62`.
- [ ] Given 90% and 100%, Then fill is amber and error respectively and the text also changes nothing but the number (no colour-only signal: a warning icon appears at >=90%).
- [ ] Given `compact`, Then only `62%` and the meter are visible while the accessible name keeps the full sentence including `wg CLI`.
- [ ] Given `paused=true`, Then the button shows Resume with `aria-pressed=true` and the banner is announced via `role=status`.
- [ ] Given count 3, Then the button has the amber styling and aria label `Zgody i Prośby: 3 czekają`; Given count 0 the amber styling is absent.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit: percent->tone thresholds (89/90/100), unlimited form, popover overflow (3 CLIs), toggle pending lock.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- DESIGN GAP (E33): Global Pause active state and banner are not in any mock; the design above is the default until the Owner/design confirms it.
- ASSUMPTION: at most 2 inline limit pills; the Owner has 2 CLIs in MVP (claude, codex) plus Ollama (no limit).
- OPEN: whether Ollama (`bez limitu`) is shown in the top bar at all; default yes inside the popover only.
