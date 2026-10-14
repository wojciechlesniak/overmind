---
id: OVE_DS046
title: Build MessageThread and MessageBubble (owner, chief, agent, table block, day separator)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS020, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:MessageThread", "ui:MessageBubble", "ui:MessageTable", "ui:DaySeparator"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Avatar", "ui:Card", "ui:StatusDot", "ui:Button"]
owns: ["packages/ui-kit/src/chat/MessageBubble/**", "packages/ui-kit/src/chat/MessageThread/**"]
reads: []
design: design.png
design_source: "Chief#chief/message-thread (owner, chief text, summary table) (crop 351,182,780,330 CSS px); design-thread.png = Czat-Agent (crop 342,182,758,260)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23, 6]
---

# OVE_DS046: Build MessageThread and MessageBubble (owner, chief, agent, table block, day separator)

## 1. Summary

Builds the conversation thread container and the base message bubbles used by the Chief chat, direct Agent chats and (with a different wrapper) Discussions: the Owner bubble (with source label such as 'z Telegrama'), Chief/Agent plain-text messages, the bordered per-Workspace summary table block, the system line and the day separator. Special message kinds (relay note, result chip, Skill-used chip) are in OVE_DS047.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Chief.dc.html` and its 2x render `_design/views/Chief.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C2.2 (MessageBubble) and A.4 (radii). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Desktop and Telegram messages are interleaved in one thread and their source is labelled (SPEC 5, acceptance criterion 13: same state on both). The Owner speaks to Chief or directly to an Agent; Chief/Agent messages are LLM output and therefore untrusted text (SEC004). The thread column is max-width 780 (Chief, Direct chat) and is provided by `PageLayout` `mainMaxWidth`.

## 3. Scope (in)

- `MessageThread` (log container, scroll anchoring, new-message jump control).
- `MessageBubble` roles `owner | chief | agent | system`, `source` desktop/telegram, status `sent | sending | failed`.
- `MessageTable` summary block (rows with state marker, title, text).
- `DaySeparator`.

## 4. Out of scope

- Relay note, result chip, Skill-used chip, binding notice, typing indicator (OVE_DS047).
- Approval card and Owner Rule card inside the thread (OVE_DS055, OVE_DS057).
- Telegram bubbles (different geometry, OVE_DS086) and Discussion messages (OVE_DS083).
- Markdown rendering of message bodies (children are plain React nodes; a Markdown renderer is a later task if needed).

## 5. Detailed requirements

1. `MessageBubble` props:
   ```ts
   type MessageRole = 'owner' | 'chief' | 'agent' | 'system';
   interface MessageAuthor { name: string; hue: AgentHue; initials: string }
   interface MessageBubbleProps {
     role: MessageRole;
     author?: MessageAuthor;          // chief/agent; shows the sender label and, with showAvatar, the Avatar
     showAvatar?: boolean;            // default false in 1:1 chats (header names the peer), true in groups
     sourceLabel?: string;            // 'z Telegrama · 14:02' / '14:18' (mono 11, muted) under the bubble
     variant?: 'plain' | 'table';     // 'table' = bordered block for lists (radius 18, bg-composer, overflow hidden)
     status?: 'sent' | 'sending' | 'failed';
     labels?: { sending: string; failed: string; retry: string };
     onRetry?: () => void;
     children: ReactNode;
   }
   ```
2. Owner bubble (exact): aligned right (`margin-left: auto`), `max-width: 80%` (mock 78-80%), padding 12 16, radius `20px 20px 6px 20px` (`r-bubble-owner`), fill `bg-bubble-owner` (#2A1F40), text 15/1.45 `text-primary`; `white-space: pre-wrap; overflow-wrap: anywhere`. The meta line (`sourceLabel`) sits 6px below, right aligned, mono 11 `text-muted`; when `source=telegram` the label MUST be present (product rule: source is always visible), enforced by a dev warning.
3. Chief/agent message (exact): left aligned, no fill, no border (text lies directly on the page), text 15/1.5 `text-primary`, paragraphs separated by 8px; width up to 100% of the thread column. Optional sender label above the first line: Bricolage 12/700 in the hue light colour of `author.hue` (Chief `#FFB3E6`... per A.1.3 'light' column). With `showAvatar`, `ui:Avatar` 28 sits left (gap 12) and the text column is offset. Plain `children` only; links inside are the caller's `TextLink` nodes.
4. `variant="table"` is used for lists such as 'Po jednym zdaniu na Workspace:': container radius 18, 1px `line`, fill `bg-composer` (#120D1C), `overflow: hidden`, row dividers 1px `line-subtle`. `MessageTable` props `{ rows: { id: string; marker: Tone; title: string; text: ReactNode }[]; 'aria-label': string }` rendering a semantic `<table>` (2 columns: title with a 10px `ui:StatusDot` marker + 15/600, then text 15/1.45 `text-secondary`), padding 14 18 per row, first column `width: 240px` shrinking to 40% below 560px, then stacking vertically (title above text) under 480px.
5. `system` role: single centred line 13/1.45 `text-secondary`, optional leading icon, used for non-conversational notices (e.g. 'Chief przełączył Agentów na model zapasowy'). It is NOT a bubble.
6. `status`: `sending` -> bubble opacity .7 and the meta line shows `labels.sending`; `failed` -> meta line in error colour `#FF8FA3` with `labels.failed` and a `Button` (`ghost`, sm) `labels.retry` that calls `onRetry`; the failed text is also `aria-describedby`-linked. Sent messages are never re-ordered by status changes.
7. `DaySeparator` props `{ label: string }`: mono 11 `text-muted`, centred, margin 16 0 8 (mock: `dziś, 14:02`), rendered as `<time>`-less plain text with `role="separator"` and `aria-label`.
8. `MessageThread` props `{ children; 'aria-label': string; onReachTop?: () => void; labels: { newMessages: string }; stickToBottom?: boolean /* default true */ }`: `role="log"`, `aria-live="polite"`, `aria-relevant="additions"`, `aria-label`; column flex gap 16, padding 24 (E6) 0 16, `overflow-y: auto`, `overscroll-behavior: contain`. Scroll anchoring: if the user is within 48px of the bottom when messages are appended the thread stays pinned to the bottom; otherwise it does NOT jump and shows a floating `Button` (`secondary`, sm, bottom-centre, `labels.newMessages`) that scrolls down. `onReachTop` fires (once per attach) when scrollTop < 80 for history loading. Uses `ResizeObserver`+`scrollTo`; honours `prefers-reduced-motion` (no smooth scroll).
9. Streaming: while a message grows (children text changes) the bubble sets `aria-busy="true"` only when `status="sending"`; assistive tech must not re-read the whole message on every token (the live region uses `additions`, and the streaming text node is inside a single element that is not re-created per token).
10. Long content: a single unbroken token (URL, hash) wraps (`overflow-wrap: anywhere`); a code/pre child gets `max-width: 100%; overflow-x: auto`; very long messages (> 4000 chars) are NOT truncated by this component (the feature may collapse them).
11. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
12. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
13. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
14. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
15. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
16. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
17. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` shows the top of the Chief thread: owner bubble `Jak idą prace?` with `z Telegrama · 14:02`, Chief text `Po jednym zdaniu na Workspace:` and the bordered summary table (magenta dot Aplikacja rezerwacji, mint Strona fundacji, grey Research rynku). `design-thread.png` shows the Direct chat thread top (owner bubble with `14:18`, agent text). Day label `dziś, 14:02`. Not in the mock: sending, failed, empty thread, history loading skeleton (3 `ui:Skeleton` lines, the feature renders), error banner, long unbroken text, attachment bubbles, selection/copy affordance.

## 7. Reuse

Consumes `ui:Avatar`, `ui:Card`, `ui:StatusDot`, `ui:Button`, `ui:Text`. Provides the bubble/thread consumed by OVE_DS047, the Chief and Direct chat features and (OVE_DS105 stories).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Message bodies are LLM/Telegram/CLI controlled: they MUST render as text; `white-space: pre-wrap` is the only formatting. No auto-linking of URLs inside this component (links are explicit nodes) so a prompt-injection URL is never turned into a clickable link implicitly. `sourceLabel` is supplied by the engine, not parsed from the text, so a message cannot forge a 'from desktop' origin.

## 10. Errors and edge cases

- `role="owner"` with `author` -> author ignored (Owner has no sender label).
- `source=telegram` without `sourceLabel` -> dev warning, no crash.
- Rows array empty in `MessageTable` -> renders nothing.
- Thread receives 1000+ children -> no virtualisation here (feature paginates); component must not re-render all children on scroll (scroll handlers use refs).
- User scrolls up during streaming -> no forced scroll; the jump button appears.
- `failed` message retried twice quickly -> `onRetry` guarded by the feature; the button is disabled while `status=sending`.

## 11. Acceptance criteria

- [ ] Given an owner message with Telegram source, Then the bubble has the `20/20/6/20` radius, fill #2A1F40 and the right-aligned label `z Telegrama · 14:02`.
- [ ] Given the summary table fixture, Then it renders a semantic table with 3 rows and passes axe (header cells/aria-label).
- [ ] Given the thread scrolled 300px up and a new message appended, Then scrollTop is unchanged and the jump button is shown; clicking it scrolls to the bottom.
- [ ] Given `status=failed`, Then the retry button is focusable and calls `onRetry` once.
- [ ] Given a 200-char unbroken string, Then no horizontal scroll appears on the thread.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit: pinned-to-bottom logic with a fake ResizeObserver/scroll metrics; role/aria assertions; reduced-motion.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: no avatar in 1:1 chats (as in the mock); `showAvatar` exists for groups. `docs` for Discussions use OVE_DS083, not this bubble.
- OPEN: attachments and message actions (copy, quote) are post-MVP; no hooks beyond `children`.
