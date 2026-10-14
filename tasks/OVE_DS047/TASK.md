---
id: OVE_DS047
title: Build special chat messages (RelayNote, ResultChip, SkillUsedChip, TypingIndicator)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS017, OVE_DS031, OVE_DS039, OVE_DS046]
soft_depends_on: []
provides: ["ui:RelayNote", "ui:ResultChip", "ui:SkillUsedChip", "ui:BindingNotice", "ui:TypingIndicator"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Pill", "ui:Card", "ui:Avatar"]
owns: ["packages/ui-kit/src/chat/SpecialMessages/**"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/thread (binding notice, result chip, skill-used chip) (crop 342,182,758,614 CSS px); design-relay.png = Chief (crop 351,500,780,70)"
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 8"]
adr_refs: [23, 27]
---

# OVE_DS047: Build special chat messages (RelayNote, ResultChip, SkillUsedChip, TypingIndicator)

## 1. Summary

Builds the non-conversational message kinds that appear inside chat threads: the agent-to-Chief relay note ('QA → Chief: ...'), the success result chip with link ('Chief zaktualizował plan'), the 'used Skill: name vN' chip, the 'your commands are binding' notice and a typing/streaming indicator.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Czat-Agent.dc.html` and its 2x render `_design/views/Czat-Agent.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C2.2 (relay, result-chip, skill-used), C2.6 (BindingNotice). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Direct commands to an Agent are binding for that chat and the Agent immediately informs Chief (SPEC 3, ADR 0023); the Owner Rules still win, which the refusal card (OVE_DS057) shows. Every Skill use records name and version in history (SPEC 8), so the Skill-used chip always carries a version. Agent state hints are not proof (ADR 0026); the relay note is a message, not a state.

## 3. Scope (in)

- The five components with stories and fixtures from the Direct chat mock.

## 4. Out of scope

- Base bubbles (OVE_DS046), approval/refusal cards (OVE_DS055, OVE_DS057).
- Navigation behaviour of links (callbacks only).

## 5. Detailed requirements

1. `RelayNote` props `{ from: string; to: string; arrow: string /* '→' glyph via ui:Icon not text */; children: ReactNode; icon?: IconName }`: note card radius 14, 1px `line-subtle`, fill `bg-surface`, padding 12 14, leading 16px `agents` icon in `text-secondary` (mock). Text 13/1.45 `text-secondary`; the prefix `QA → Chief:` is bold (`text-primary`, 600) built as `<strong>{from}</strong> <Icon arrow-right/> <strong>{to}:</strong>`; the arrow is an SVG glyph (E21) with `aria-hidden`, and the sentence has an `aria-label` of `{from} to {to}` via visually-hidden text supplied through `labels.toWord`.
2. `ResultChip` props `{ children: ReactNode; link?: { label: string; onOpen: () => void }; tone?: 'ok' }`: `ui:Card` tone `ok` (1px mint a35, fill #10161A, radius 14, padding 10 14), leading `check` 14 mint, text 13px; the link on the right uses text-link style (`Tablica`). Indented 38px from the left edge in agent threads (aligned under the agent text) via `inset` prop (default 38). `role="status"`-less: it is static content in the log.
3. `SkillUsedChip` props `{ name: string; version: string; label: string /* 'użyto Skilla' */; onOpen?: () => void }`: `ui:Pill` variant `skill-used` (padding 4 9, fill rgba(155,123,255,.14), text #D6C9FF, mono 11/500), text `${label}: ${name} ${version}` (`użyto Skilla: e2e-playwright v2`), `align-self: flex-start`, inset 38. If `onOpen` it becomes a button opening the Skill detail (callback). Name and version are always both required (TypeScript) because use records need the version.
4. `BindingNotice` props `{ children: ReactNode; icon?: IconName /* default 'lock' */ }`: card radius 14, 1px `line`, fill `bg-surface`, padding 10 14, 13px `text-secondary`, leading `lock` 14 icon; pinned at the top of the thread (the feature places it first; component is not sticky). Text from the mock: `Twoje polecenia w tym czacie są wiążące. QA od razu przekazuje je Chiefowi.`
5. `TypingIndicator` props `{ label: string; author?: MessageAuthor }`: three 6px dots (`text-muted`) animating opacity in sequence (1.2s, staggered 150ms) next to the visually hidden `label` (`Chief pisze…`); `role="status"`; with `prefers-reduced-motion` the dots are static at 60% opacity. Used for streaming/pending replies (not in the mock, recommended).
6. All five render inside the thread as siblings of `MessageBubble`; none of them owns scroll or live-region logic.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` is the Direct chat thread: lock notice at the top, owner bubble, agent text with the mint `Chief zaktualizował plan · „Testy obciążeniowe” → Odłożone` result chip and link `Tablica`, the red refusal card (out of scope here), and the small violet `użyto Skilla: e2e-playwright v2` chip at the bottom. `design-relay.png` is the Chief thread relay row `QA → Chief:` with the agents icon. Exact values in the requirements. Not in the mock: typing indicator, ResultChip with failure tone (R: tone `error` reuses `Card` `danger`), long chip text (wraps, no ellipsis for notices; ellipsis for the Skill chip at 100% width).

## 7. Reuse

Consumes `ui:Pill` (`skill-used`), `ui:Card` (`ok`), `ui:Icon`, `ui:Avatar`. Uses `MessageAuthor` from OVE_DS046.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). `RelayNote` text is another Agent's output relayed through Chief: untrusted, text only. The Skill chip shows what the Agent claims it used; it is a record, not a grant (Skills give no tool access, ADR 0003).

## 10. Errors and edge cases

- `version` empty -> TypeScript error; at runtime chip renders name only and logs a dev warning.
- Link callback missing -> link renders as plain text, no dead button.
- Notice text very long -> wraps, card grows.
- Typing indicator mounted while the user prefers reduced motion -> static.

## 11. Acceptance criteria

- [ ] Given the Direct chat fixture, Then the five elements render with the exact paddings/radii listed and match `design.png`.
- [ ] Given `SkillUsedChip` with `onOpen`, Then it is a button with the accessible name `użyto Skilla: e2e-playwright v2`.
- [ ] Given reduced motion, Then no element animates.
- [ ] Given the relay note, Then the arrow glyph is `aria-hidden` and the sentence is read as `QA to Chief: ...`.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: whether ResultChip should support a failure tone; default supported via `tone: "ok" | "error"`.
