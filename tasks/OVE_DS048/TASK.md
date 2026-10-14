---
id: OVE_DS048
title: Build ChatComposer with QuickActions and @mention menu
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS017, OVE_DS027, OVE_DS029, OVE_DS039, OVE_DS046]
soft_depends_on: []
provides: ["ui:ChatComposer", "ui:QuickActions"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Composer", "ui:Pill", "ui:Menu", "ui:Avatar"]
owns: ["packages/ui-kit/src/chat/ChatComposer/**", "packages/ui-kit/src/chat/QuickActions/**"]
reads: []
design: design.png
design_source: "Chief#chief/composer-area (crop 351,782,780,146 CSS px); design-direct.png = Czat-Agent (crop 342,796,758,104); design-disc.png = Dyskusja (crop 332,796,798,104)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23, 6]
---

# OVE_DS048: Build ChatComposer with QuickActions and @mention menu

## 1. Summary

Builds the chat composer used by the Chief chat, direct Agent chats and the Discussion (Owner voice): a controlled auto-growing textarea inside the `ui:Composer` shell, a send button in three tones, an optional QuickActions row ('Pokaż Tablicę', 'Zacznij Dyskusję', 'Podsumuj dzień') and an `@agent` mention menu. It supports a disabled state with a visible reason (Global Pause).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Chief.dc.html` and its 2x render `_design/views/Chief.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C2.3 (Composer + QuickActions) and B10. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Chief is the default addressee; '@agent' routes to an Agent (also in Telegram, SPEC 5). The composer must be disabled while Global Pause is active (E33). Messages typed here are Owner commands (binding, ADR 0023); the composer only collects text and calls `onSend`.

## 3. Scope (in)

- `ChatComposer`, `QuickActions`, mention menu, send tones (chief glow, agent gradient without glow, discussion), auto-grow, keyboard map, disabled/sending states.

## 4. Out of scope

- The `ui:Composer` shell primitive (part 1).
- Sending, history, draft persistence (feature; the draft is controlled via `value`).
- Attachments, voice (post-MVP).

## 5. Detailed requirements

1. Props:
   ```ts
   interface MentionOption { id: string; label: string /* 'qa' */; name: string; hue: AgentHue; initials: string }
   interface QuickActionItem { id: string; label: string; icon?: IconName }
   interface ChatComposerProps {
     value: string; onChange: (v: string) => void; onSend: (text: string) => void;
     placeholder: string;                 // 'Napisz do Chiefa… albo @qa'
     tone?: 'chief' | 'agent' | 'discussion'; agentHue?: AgentHue; // send button gradient
     mentions?: MentionOption[];          // enables the @ menu
     quickActions?: QuickActionItem[]; onQuickAction?: (id: string) => void;
     sending?: boolean;
     disabledReason?: string;             // set => textarea+send disabled, reason shown
     maxLength?: number;                  // default 8000
     labels: { send: string; message: string; mentionList: string; noMatches: string };
   }
   ```
2. Shell (exact, from `ui:Composer`): container flex gap 10, padding 10 10 10 16, radius 22, 1px `line-owner` (#3A2A5C), fill `bg-composer` (#120D1C), `glow-composer` (0 0 30px rgba(155,123,255,.12)). Textarea: transparent, no border, 15px, line-height 1.5, padding 6 0, `rows=2` min, grows with content up to 8 rows then scrolls; the visually hidden `<label>` text = `labels.message`. Focus: the container gets the focus ring (violet 2px) via `:focus-within` since the textarea itself has no border (E19).
3. Send button: 44x44 radius 14, icon `send` 18 stroke 2 `ink`. Tone `chief` and `discussion`: gradient `#FF9BDD -> #C23FA0` + `glow-send` (0 0 18px rgba(242,95,196,.5)); tone `agent`: radial agent gradient of `agentHue`, NO glow (Direct chat mock). Disabled when `value.trim()` is empty, `sending`, or `disabledReason`; `aria-label=labels.send`; while `sending` shows a 14px spinner in place of the icon and `aria-busy`.
4. Keyboard: Enter sends (when not empty), Shift+Enter inserts a newline, Cmd/Ctrl+Enter also sends; ignore Enter while an IME composition is active (`event.isComposing`/`keyCode 229`); Escape closes the mention menu; `onSend` receives the trimmed text and the component does NOT clear `value` itself (the feature clears after accepted send), preventing loss of text on failure.
5. Mentions: typing `@` at the start or after whitespace opens a `ui:Menu` (`role="listbox"`, `aria-label=labels.mentionList`) anchored above the caret line, filtered by the characters after `@` (case-insensitive prefix on `label`/`name`), arrow keys move, Enter/Tab inserts `@label ` (replacing the typed fragment), Escape closes; no matches shows `labels.noMatches` row (disabled). The menu entries use `ui:Avatar` 22 + name + mono `@label`. The component only edits text; the engine parses mentions server-side (do not trust the client).
6. `QuickActions`: row above the composer, gap 8, wraps, each item `ui:Pill` variant `quick-action` (min-height 34, padding 0 12, radius 999, 12px Bricolage, `bg-surface`, 1px `line`, `text-secondary`) as a `button`; click calls `onQuickAction(id)` and moves no focus. Hidden when `quickActions` empty (Direct chat and Discussion have none). Disabled together with the composer when `disabledReason` is set.
7. `disabledReason`: the textarea becomes `disabled`, the placeholder is replaced by the reason (e.g. `Wszystko wstrzymane (Global Pause)`), linked with `aria-describedby`; the entered text is kept; QuickActions are `aria-disabled`.
8. Draft integrity: `value` is never trimmed on change; paste of > `maxLength` characters is truncated at `maxLength` and a counter (mono 11, error colour) appears within 200 characters of the limit.
9. Layout inside the thread column: the area (QuickActions + composer) is pinned to the bottom of the chat column with padding 12 24 20 (width = thread column, max 780).
10. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
11. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
12. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
13. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
14. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
15. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
16. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` shows quick actions `Pokaż Tablicę`, `Zacznij Dyskusję`, `Podsumuj dzień` and the composer with placeholder `Napisz do Chiefa… albo @qa` and the glowing magenta send button. `design-direct.png`: Direct chat composer (`Napisz do QA…`, agent-coloured send, no glow, no quick actions). `design-disc.png`: Discussion composer (`Twój głos w Dyskusji rozstrzyga…`). Not in the mock: focus, mention menu, disabled (Global Pause), sending spinner, char counter, multi-line growth, error after failed send (feature shows a toast and keeps the text).

## 7. Reuse

Consumes `ui:Composer` (shell), `ui:Pill` (`quick-action`), `ui:Menu`, `ui:Avatar`, `ui:Icon`, `ui:Button` is NOT used for send (icon-send is a Composer slot variant `icon-send`; if part 1 exposes it as `Button variant="icon-send"` use that).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Text typed by the Owner is sent as-is; the component never interprets slash commands or mentions as authority. Disabled-by-pause is enforced by the engine too (fail closed); the UI state is only a convenience. No draft is written to `localStorage` here (drafts may contain secrets the Owner pasted; persistence is a feature decision).

## 10. Errors and edge cases

- Mentions list empty -> typing `@` shows nothing, text stays plain.
- Paste containing newlines -> preserved.
- `onSend` throws -> caught by the feature; this component stays mounted with text intact.
- Double Enter quickly -> second send blocked while `sending`.
- Disabled while the mention menu is open -> menu closes.
- Value longer than max -> truncated + counter.

## 11. Acceptance criteria

- [ ] Given text and Enter, Then `onSend` is called once with trimmed text and `value` is unchanged by the component.
- [ ] Given Shift+Enter, Then a newline is inserted and `onSend` is not called.
- [ ] Given IME composition active, When Enter is pressed, Then nothing is sent.
- [ ] Given `@q`, Then the menu shows `@qa` only; Tab inserts `@qa `.
- [ ] Given `disabledReason`, Then textarea, send and quick actions are disabled and the reason is announced.
- [ ] Given tone `agent`, Then the send button has no glow; tone `chief` has `glow-send`.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Interaction tests with `userEvent` for the keyboard map, IME simulation via `compositionstart/end`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: Cmd/Ctrl+Enter also sends (not in mock).
- OPEN: draft persistence per conversation is a feature concern.
