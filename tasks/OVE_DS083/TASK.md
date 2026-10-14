---
id: OVE_DS083
title: Build DiscussionHeader, DiscussionMessage and DiscussionList
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS017, OVE_DS018, OVE_DS021, OVE_DS022, OVE_DS031, OVE_DS033, OVE_DS039, OVE_DS040, OVE_DS044]
soft_depends_on: []
provides: ["ui:DiscussionHeader", "ui:DiscussionMessage", "ui:DiscussionList", "ui:RoundBar", "ui:StancePill"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Avatar", "ui:Pill", "ui:Button", "ui:Card", "ui:ListRow", "ui:SectionLabel", "ui:SkillChip", "ui:CalloutAmber", "ui:SegmentBar"]
owns: ["packages/ui-kit/src/discussion/DiscussionMessages/**"]
reads: []
design: design.png
design_source: "Dyskusja#disc/header + thread (crop 332,117,798,579 CSS px); design-list.png = Dyskusja (crop 72,117,260,300); design-composer.png = Dyskusja (crop 332,796,798,104)"
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 8"]
adr_refs: [23, 15]
---

# OVE_DS083: Build DiscussionHeader, DiscussionMessage and DiscussionList

## 1. Summary

Builds the Live Discussion main column and list: `DiscussionHeader` (title, live pill, pause, agenda, `RoundBar`, notice that Chief started it), `DiscussionMessage` (participant with stance pill and Skill chips; Chief moderator variant) and `DiscussionList` (live / finished rows).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Dyskusja.dc.html` and its 2x render `_design/views/Dyskusja.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C10.1, C10.2, C10.3. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). A Discussion is a moderated multi-Agent conversation opened by the Chief or the Owner, with rounds and positions, ending in a draft Decision (SPEC 5, 8; ADR 0015: Chief may start one on its own, and the UI must say so). Agents state a position (agree, no preference, conditional). The Owner can speak in it through the composer (`ui:ChatComposer`, tone discussion, OVE_DS048).

## 3. Scope (in)

- `DiscussionHeader`, `RoundBar`, `StancePill`, `DiscussionMessage` (participant, Chief, Owner), `DiscussionList` + rows, notices, stories.

## 4. Out of scope

- Right result panel (OVE_DS084), the composer (OVE_DS048), streaming/data.

## 5. Detailed requirements

1. `DiscussionHeaderProps { title: string; live: boolean; liveLabel: string; agenda: string; round: { current: number; total: number; label: string }; runState?: { label: string; onOpenRun?(): void }; onPause?(): void; pauseLabel?: string; notice?: { text: string; icon?: IconName } }`: title 22/700/-0.2 (E7), `Pill` `na żywo` with magenta dot (live) or grey `zakończona`; right `Button secondary md` `Wstrzymaj` (hidden when not live); meta row (gap 18, mono 12 muted): agenda text, `RoundBar` + `Runda 2 z 4`, Run state with a link (`gałąź Runu wstrzymana do końca Dyskusji`). Notice (callout `bell` icon, `CalloutAmber` neutral-lavender tone) `Chief rozpoczął tę Dyskusję sam, bo ...` always shown when Chief initiated (ADR 0015).
2. `RoundBar { total: number; current: number }`: `total` segments 28x6 radius 3 gap 4 (mock: 4 x 6px bars in 120px); done segments violet `#9B7BFF`, current magenta, pending `line`; `role="img"` + `aria-label` `Runda 2 z 4`.
3. `StancePill { stance: 'agree' | 'no-preference' | 'conditional' | 'disagree'; label: string }`: `ui:Pill` mono 11, agree mint, no-preference grey, conditional amber, disagree error; always the word (`za`, `bez preferencji`, `warunkowo`, `przeciw`).
4. `DiscussionMessageProps { author: { name: string; hue: AgentHue; initials: string; role?: string }; round?: number; stance?: { stance; label }; skills?: { name: string }[]; body: ReactNode; variant?: 'participant' | 'moderator' | 'owner'; time?: string; summary?: ReactNode }`: card r14 padding 12 14, bg `#140F20` 1px `line`, grid: Avatar 36 + column. Head row: name 14/700, role/round mono 11 muted (`runda 2`), stance pill, skill chips (`ui:SkillChip`, `ui:Pill skill-chip`, max 3 + `+N`). Body 14/1.55 `text-body-soft`, `white-space: pre-wrap`, links inert. `moderator` (Chief): tinted `chief` card (magenta border a30) with the round summary list. `owner`: right aligned violet card (`line-owner`) like the owner chat bubble.
5. Thread container (story composition `DiscussionThread`): max-width 820, padding 22 24, gap 12; the notice first, then messages in order; auto-scroll stickiness is a feature concern, but the container exposes `role="log"` `aria-live="polite"` `aria-relevant="additions"` so new messages are announced without stealing focus.
6. `DiscussionListProps { liveHeading: string; doneHeading: string; live: DiscussionRowData[]; done: DiscussionRowData[]; selectedId?: string; onSelect(id): void; loading?: boolean }` with `DiscussionRowData { id; title; meta: string /* 'runda 2 z 4 · rozpoczął Chief' */; outcome?: string }`: 260px `SidePanel`, headings `Dyskusje` 15/700, section labels `TRWAJĄ`/`ZAKOŃCZONE` (OVE_DS049 section label style), rows `ListRow` (55px): live = magenta dot + title 13/600 + meta mono 11, finished = grey dot + outcome meta (`3 decyzje`). Selected = violet. Empty section hidden.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: header (title `Zakres MVP`..., live pill, `Wstrzymaj`, agenda/round/Run meta), the Chief-initiated notice, the moderator message, three participant messages with mint / grey / amber stance pills and Skill chips. `design-list.png`: the 260px list. `design-composer.png`: composer region (belongs to OVE_DS048, shown for placement). Not drawn: finished Discussion (no live pill), owner message, disagree stance, loading, empty.

## 7. Reuse

Consumes `ui:Avatar`, `ui:Pill`, `ui:SkillChip`, `ui:Button`, `ui:Card`, `ui:ListRow`, `ui:SectionLabel`, `ui:SegmentBar` (RoundBar may wrap it), `ui:CalloutAmber` and `OriginLine` (OVE_DS040). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Agent messages are untrusted (prompt injection): text only, no Markdown rendering or links; the component offers no action that follows instructions inside a message. The Chief-initiated notice must not be removable (ADR 0015: autonomy visible). `Wstrzymaj` calls back only.

## 10. Errors and edge cases

- `round.current` > total -> clamped.
- Unknown stance -> grey pill with the raw label.
- Body empty -> `—`.
- Very long unbroken text -> `overflow-wrap:anywhere`.
- No live and no done -> `EmptyState`.

## 11. Acceptance criteria

- [ ] Given round 2 of 4, Then RoundBar has two done, current magenta, one pending and `aria-label` `Runda 2 z 4`.
- [ ] Given the three stance fixtures, Then pills are mint, grey, amber with their words.
- [ ] Given a moderator message, Then it has the chief tint and summary.
- [ ] Given `live=false`, Then the live pill and pause button are absent.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: whether Owner messages inside a Discussion are shown inline (default yes, violet card).
- ASSUMPTION: `disagree` stance exists as an additive value.
