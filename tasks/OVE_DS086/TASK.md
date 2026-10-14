---
id: OVE_DS086
title: Build the Telegram preview kit (TelegramHeader, Thread, Bubble, ApprovalBubble, InputBar)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS010, OVE_DS013, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:TelegramHeader", "ui:TelegramThread", "ui:TelegramBubble", "ui:TelegramApprovalBubble", "ui:TelegramInputBar"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:LogoTile", "ui:Button"]
owns: ["packages/ui-kit/src/telegram/TelegramKit/**"]
reads: []
design: design.png
design_source: "Telegram#tg/* (crop 0,0,390,844 CSS px); design-approval.png = Telegram (crop 12,499,340,182)"
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 9"]
adr_refs: [6, 3]
---

# OVE_DS086: Build the Telegram preview kit (TelegramHeader, Thread, Bubble, ApprovalBubble, InputBar)

## 1. Summary

Builds the visual reference kit of the Telegram bot chat (390x844): header, dot-grid thread, day separator, owner/Chief/Agent bubbles, the Approval bubble with inline Approve-this-Run and Deny buttons, and the input bar. Used for Storybook design reference and the in-app 'Telegram preview' in settings, so bot message formats match the design.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Telegram.dc.html` and its 2x render `_design/views/Telegram.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C13 (TelegramHeader, Thread, Bubble, InputBar), E8, E26, E34. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Telegram is the second channel and talks to the same Chief (SPEC 5, ADR 0006). The bot approves only per Run: permanent grants are desktop-only (ADR 0003), shown as the footnote `Na stałe zatwierdzisz tylko przy komputerze.` The real chat is rendered by Telegram, not by us; this kit documents and previews the formats the TG feature must produce (text, buttons).

## 3. Scope (in)

- The five components + stories (conversation, approval pending, approved, denied), a `TelegramPreviewFrame` story at 390x844.

## 4. Out of scope

- The bot itself, message formatting and command parsing (TELEGRAM feature), pairing UI.

## 5. Detailed requirements

1. Header: `TelegramHeaderProps { name: string; subtitle: string }`: height 71, padding 0 14, bg surface, bottom border 1px; `LogoTile` 42 (radius 13) + name 17/700 + subtitle 12px `text-muted` (`bot · tylko Ty`).
2. `TelegramThread` props `{ children; dayLabel?: string }`: dot-grid background 18px (radial dots token `grid-dot`), padding 12, column gap 8, `role="log"`; day separator mono 11 centred (`wtorek, 13 października`, the feature formats with `Intl pl-PL`, E32).
3. `TelegramBubbleProps { side: 'owner' | 'bot'; sender?: { label: string; kind: 'chief' | 'agent' }; text: ReactNode; time: string }`: owner right, max-width 80%, padding 9 12, radius `16 16 4 16`, fill `#3A2A5C`, text 14/1.4; bot left, max 86%, radius `16 16 16 4`, fill `#140F20`, 1px `#2A2040`, sender label 12/700 (`Chief` `#FFB3E6`, Agent `#D6C9FF`); time mono 11 `#8C80A6` right-aligned under the text. Text is plain with `white-space: pre-wrap`.
4. `TelegramApprovalBubbleProps { sender; title: string /* 'Zgoda · Security' */; detail: string; domain?: string; runLabel: string; approve: { label: string; onClick(): void; state?: 'idle'|'pending'|'done' }; deny: { label: string; onClick(): void }; footnote: string; time: string; result?: 'approved' | 'denied' | 'expired' }`: bubble as bot plus bold title 14/700, detail text, domain mono 12, button row (gap 8): `approve-amber` 40px (E8: touch target 44 in the real client, preview uses 40 as the mock; token `tg-button-h`) = `Zatwierdź ten Run` and `deny-telegram` outlined `Odrzuć`; footnote 12px `text-muted`. After `result` the buttons are replaced by a status line (`zatwierdzono · tylko Run #14`), mirroring Telegram editing the message.
5. `TelegramInputBar` props `{ placeholder: string; value?: string; onSend?(): void; disabled?: boolean }`: height 85 (padding 12 12 28 for the safe area), input pill 44 radius 22 `#140F20` 1px `line-control`, send button 44 circle flat magenta (`icon-send-flat`). In the preview it is static (`readOnly`, `tabIndex=-1`) unless `onSend` is provided.
6. Preview frame story: 390x844 with radius 38 phone-like border for Storybook only (not exported); the kit components themselves have no fixed viewport.
7. There is NO `Zezwalaj na stałe` control anywhere in this kit (ADR 0003, E26); a unit test asserts the approval bubble exposes exactly two actions.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the whole chat: header, day separator, owner bubble (right, violet), Chief bubble, Agent bubble, approval bubble with `Zatwierdź ten Run` (amber) and `Odrzuć`, input bar with flat magenta send. `design-approval.png` zooms the approval bubble. Not drawn: approved/denied/expired result, long text, error message, offline.

## 7. Reuse

Consumes `ui:LogoTile` (OVE_DS041), `ui:Button` (`approve-amber`, `deny-telegram` variants of part 1), `ui:Text`. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). A forged or injected Telegram message must not look like an Approval: only `TelegramApprovalBubble` renders buttons and its props come from the engine, never from message text. Text is plain (no HTML/Markdown), links inert. The approval scope word (`ten Run`) and the desktop-only note are mandatory props (required by type) so a permanent grant can never be offered here.

## 10. Errors and edge cases

- Very long text -> wraps, bubble keeps its max width.
- Result `expired` -> buttons removed, status `wygasło`.
- Missing time -> time slot omitted.
- Unknown sender kind -> plain `Agent` colour.

## 11. Acceptance criteria

- [ ] Given the fixtures, Then bubble radii/fills/max widths match the spec and the owner bubble is right aligned.
- [ ] Given the approval bubble, Then exactly two buttons exist and the footnote is present.
- [ ] Given `result=approved`, Then no buttons remain.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: button height 40 (mock) vs 44 touch target (E8); default 44 in real Telegram (inline buttons are Telegram-rendered), 40 in the preview.
- ASSUMPTION: this kit is a design reference; real bot messages use Telegram-native formatting.
