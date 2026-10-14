---
id: OVE_DS050
title: Build ChatHeader (Chief header and Agent header with state pill and profile link)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS017, OVE_DS018, OVE_DS039, OVE_DS046]
soft_depends_on: []
provides: ["ui:ChatHeader"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Avatar", "ui:Pill", "ui:StatusPill", "ui:Button"]
owns: ["packages/ui-kit/src/chat/ChatHeader/**"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/chat-header (crop 342,117,758,65 CSS px); design-chief.png = Chief (crop 342,117,798,65)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23]
---

# OVE_DS050: Build ChatHeader (Chief header and Agent header with state pill and profile link)

## 1. Summary

Builds the 65px conversation header: avatar 36, name 17/700, mono subtitle (agent kind, CLI and model), a state pill ('pracuje') or a channel pill ('desktop + Telegram') and a link to the Agent profile.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Czat-Agent.dc.html` and its 2x render `_design/views/Czat-Agent.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C2.5 (ChatHeader). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The subtitle tells the Owner which CLI and model answer (`Agent stały · Codex CLI · gpt-5.5`, `Claude Code · Opus 5.5 · widzi 3 Workspace'y`), because model is per Agent (ADR 0007). 'Profil Agenta' links to the Agents view.

## 3. Scope (in)

- `ChatHeader` with variants chief/agent; state pill states idle, working, waiting-approval, done, paused, failed.

## 4. Out of scope

- Pause/Interrupt controls (they live in the right terminal panel, OVE_DS053).
- Routing.

## 5. Detailed requirements

1. Props:
   ```ts
   interface ChatHeaderProps {
     name: string; hue: AgentHue; initials: string;
     subtitle: string;                        // mono 12 text-muted: kind · CLI · model
     state?: { value: AgentState; label: string };   // StatusPill, e.g. pracuje
     channelLabel?: string;                    // Pill meta, e.g. 'desktop + Telegram'
     profileLink?: { label: string; onOpen: () => void };
     actions?: ReactNode;
   }
   ```
2. Layout: `<header>` height 65, padding 14 24 (aligned with the thread column 24 padding), flex, gap 12, `border-bottom: 1px solid line-subtle`, background transparent (main column). Avatar 36 (mono 12). Text column: name 17/700 (ellipsis), subtitle mono 12 `text-muted` (ellipsis, `title`). Right group (margin-left auto, gap 12, `flex-shrink: 0`): state `ui:StatusPill`, channel `ui:Pill meta`, profile link (text-link 12-13px underlined, `text-link` #E9D8FF), `actions`.
3. State pill: dot + word; working = magenta tint pill (fill rgba(242,95,196,.12), 1px magenta a40, text #FFB3E6, dot 8 glow, mono 12/500) as in the mock; waiting-approval amber tint, done mint tint, idle neutral (`meta`), paused neutral with `pause` glyph, failed error tint. The word is always shown; colour never the only signal. Dot pulses only when working (reduced motion: static).
4. Responsive: below 640px of header width the subtitle truncates first, then the profile link collapses into an icon-only `ghost` button with tooltip; pill and name never truncate below 8 characters.
5. Semantics: `<header>` inside the chat region with `aria-label` = name; the pill is `role="status"` so state changes are announced politely (debounced by the feature, not here).
6. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
7. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
8. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
9. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
10. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
11. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
12. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: direct chat header (avatar QA, `QA`, `Agent stały · Codex CLI · gpt-5.5`, magenta `pracuje` pill, link `Profil Agenta`). `design-chief.png`: Chief header with `Claude Code · Opus 5.5 · widzi 3 Workspace'y` and the `desktop + Telegram` pill. Not in the mock: other pill states, narrow layout, loading skeleton, hover on link.

## 7. Reuse

Consumes `ui:Avatar`, `ui:StatusPill`, `ui:Pill`, `ui:Button` (ghost), tokens. State styling uses `agentStateTone` from OVE_DS040.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel).

## 10. Errors and edge cases

- Missing subtitle -> only name shown, header height unchanged.
- State undefined -> no pill (Chief header).
- Name longer than the room -> ellipsis, never wraps.

## 11. Acceptance criteria

- [ ] Given the Agent fixture, Then header height is 65px and the pill shows the magenta tint with the word `pracuje`.
- [ ] Given the Chief fixture, Then the channel pill shows `desktop + Telegram` and no state pill.
- [ ] Given 560px width, Then subtitle truncates before the pill disappears.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- DESIGN GAP: idle/waiting/done pill variants are derived from the Agent State colour map (A.1.3).
