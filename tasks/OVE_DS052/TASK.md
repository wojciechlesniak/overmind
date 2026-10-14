---
id: OVE_DS052
title: Build TerminalPane (live preview, login mode, mini variant) with safe output handling
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS022, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:TerminalPane", "lib:sanitizeTerminalText", "ui:TerminalBlock"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Button", "ui:Pill", "ui:SectionLabel", "ui:Card"]
owns: ["packages/ui-kit/src/data/TerminalPane/**"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/terminal-header + terminal-output (crop 1121,137,299,310 CSS px); design-login.png = Kreator-Polaczenia (crop 416,634,968,191); design-mini.png = Chief (crop 1161,172,259,157)"
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [22, 26, 20]
---

# OVE_DS052: Build TerminalPane (live preview, login mode, mini variant) with safe output handling

## 1. Summary

Builds the read-only terminal output component: `live-preview` mode (Agent terminal in the Direct chat, 'tylko podgląd'), `login` mode (the CLI login terminal in the wizard with the magenta frame and 'Otwórz link w przeglądarce'), and a `mini` variant for the test-progress excerpt in the Chief right panel. All terminal text is sanitised.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Czat-Agent.dc.html` and its 2x render `_design/views/Czat-Agent.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C8.1 (TerminalPane). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Terminals come from herdr running inside the isolation layer (ADR 0026); the Owner logs in inside the CLI, Overmind never sees passwords or tokens (ADR 0022). The terminal state is a hint, not evidence (footnote in the mock). The pane is a viewer: no keystrokes are sent from here (input to Agents goes through the chat). CLI output can contain ANSI escapes, secrets accidentally echoed and hostile text.

## 3. Scope (in)

- `TerminalPane` modes `live-preview | login | mini`.
- `sanitizeTerminalText` (ANSI strip, control-char handling, length caps, secret-looking token masking hook).
- Auto-follow (tail) behaviour, caret, copy support.
- Story fixtures from the three mocks.

## 4. Out of scope

- Interactive terminal input / xterm.js (not in MVP UI; viewer only).
- Opening the URL (`onOpenLink` callback; feature validates and opens via the Tauri opener).
- The facts block under the terminal (OVE_DS053).

## 5. Detailed requirements

1. Props:
   ```ts
   type TerminalLineKind = 'prompt' | 'pass' | 'fail' | 'muted' | 'text' | 'link';
   interface TerminalLine { id: string | number; kind?: TerminalLineKind; text: string }
   interface TerminalPaneProps {
     lines: (TerminalLine | string)[];       // strings are classified by classifyLine()
     mode?: 'live-preview' | 'login' | 'mini';
     title?: string;                          // mono-label header, e.g. 'TERMINAL AGENTA'
     readOnlyLabel?: string;                  // pill, e.g. 'tylko podgląd'
     caret?: boolean;                         // blinking ▍ after the last line
     follow?: boolean;                        // default true: stick to bottom unless the user scrolled up
     maxLines?: number;                       // default 500 (ring buffer from the end)
     minHeight?: number;                      // default 240 (live-preview), 0 mini
     loginUrl?: string;                       // login mode: detected https URL
     onOpenLink?: (url: string) => void;
     labels: { region: string; openLink: string; copy: string; copied: string };
   }
   ```
2. `classifyLine(text)`: `$ ` prefix -> `prompt` (colour `text-secondary` #A79BBF), leading `✓` -> `pass` (mint #62E3B4), leading `✗` -> `fail` (error #FF8FA3), leading `…` -> `muted` (#8C80A6), `https://` token -> `link` styling (text-lavender underline) but NOT clickable inside the pane, everything else `text` (`text-primary`). Glyphs are rendered via the status glyph component (E21) when they lead a line, but the text content remains copyable as the original characters.
3. Body: radius 14, 1px `line-subtle`, fill `bg-code` (#06040A), padding 12, mono 11/1.5 (live-preview in the 299px side panel) or 12/1.6-1.7 (login), `white-space: pre-wrap; overflow-wrap: anywhere`, `overflow-y: auto`, min-height by prop. `role="log"` with `aria-label=labels.region`, `aria-live="off"` (a terminal must not be auto-announced), `tabindex=0` so keyboard users can scroll; selection and copy work (`user-select: text`), plus a header `ghost` icon button `copy` copying the visible text (sanitised) with the label switching to `labels.copied` for 1.5s.
4. Header (live-preview): `SectionLabel` title left (mono-label) and `Pill` `labels.readOnlyLabel` right (`tylko podgląd`, meta tone). `login` mode: the pane sits in a card radius 20, 1px magenta a50, fill `#120A18` (callout-magenta-dark token), padding 16, header row = `SectionLabel` `TERMINAL · CODEX CLI W KONTENERZE` + `Button` `primary-magenta` (h40) `labels.openLink`, disabled until `loginUrl` is set; body below with the login lines and the caret. `mini`: no header, padding 10 12, radius 12, mono 11/16.5 (Chief panel test excerpt `✓ koszyk › dodaje produkt ... … 38 z 52`).
5. Caret: the `▍` glyph at the end, blinking 1s steps (`motion` token), static under reduced motion; only drawn when `caret` is true (login waiting, live Agent). Never drawn for finished sessions.
6. `follow`: auto-scroll to bottom on new lines only if the user is within 24px of the bottom; when the user scrolls up a small `Pill` `↓` jump control appears (label from `labels`, add `jumpToEnd`). Ring buffer: only the last `maxLines` lines render; a muted `…` line at the top indicates truncation.
7. `sanitizeTerminalText(raw: string): string` (pure, in `TerminalPane/sanitize.ts`): remove ANSI CSI/OSC/DCS sequences (state machine, not regex backtracking), `\r` handling (carriage-return overwrite -> keep last segment), NUL and C0 controls except `\n` and `\t`, bidi override/isolate characters shown as `<U+XXXX>`, lines capped at 2000 chars (`…` marker), total input capped at 256 KiB per call. Optional `redact?: (line: string) => string` prop hook is applied AFTER sanitising (the feature plugs the secret-redaction patterns from SEC003; this component does not hold patterns).
8. `loginUrl` detection helper `extractLoginUrl(lines): string | undefined`: first `https://` URL token (RFC-valid, max 2048 chars, no whitespace, no credentials `user:pass@`); the pane displays it middle-truncated (`https://auth.openai.com/authorize?…`) with the full value in `title`; `onOpenLink(url)` is called only for https URLs. The pane never navigates, never uses `window.open`.
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Direct chat terminal header (`Terminal Agenta`, `tylko podgląd`) and output (`$ npx playwright test cart/`, `Running 52 tests using 2 workers`, ✓ lines mint, ✗ lines red with the reason line indented, `… 38/52`). `design-login.png`: the wizard login panel (magenta frame, `TERMINAL · CODEX CLI W KONTENERZE`, `Otwórz link w przeglądarce`, URL line, `Czekam na zalogowanie… ▍`). `design-mini.png`: the Chief panel active Agent card terminal excerpt. Not in the mock: idle/disconnected terminal (R: muted line `Terminal niedostępny` + reconnect text from props), copy button, jump-to-end, truncation line, login success transition (lines turn `pass`, button disabled, caret off), focus ring on the scroll region.

## 7. Reuse

Consumes `ui:Button`, `ui:Pill`, `ui:SectionLabel`, `ui:Card`. Provides `ui:TerminalPane` to OVE_DS054 (mini), OVE_DS053, and the wizard system-check list (OVE_DS074). `sanitizeTerminalText` is the one place that cleans terminal text for display.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). This component displays output of third-party CLIs running in the isolated container: treat every byte as hostile. ANSI/OSC sequences (e.g. title-setting, hyperlink OSC 8) are stripped, so a hostile process cannot inject clickable links or fake UI; bidi controls cannot reorder displayed text; size caps prevent memory exhaustion; no input channel exists. Secrets may appear in CLI output despite the Keychain-only rule: the `redact` hook runs before render and before the copy action, so copying never leaks what the screen hides. The login URL is opened only through the feature's validated opener, never from here.

## 10. Errors and edge cases

- Input with only ANSI -> empty string, no blank spam lines.
- 1 MB single call -> truncated at 256 KiB with a muted notice line.
- `loginUrl` using `http:`/`javascript:`/credentials -> button stays disabled.
- `lines` replaced wholesale (not appended) -> `follow` re-pins to bottom only if the user was at the bottom.
- Rapid line floods (1000 lines/s) -> ring buffer keeps DOM <= `maxLines`, rendering is batched with `requestAnimationFrame`.
- Copy fails (clipboard permission) -> label does not switch to copied, no throw.

## 11. Acceptance criteria

- [ ] Given a raw string with `\u001b[31mred\u001b[0m` and an OSC 8 hyperlink, Then the displayed text is `red` plus the link text only, and no anchor element exists.
- [ ] Given `\r` progress output `10%\r50%\r100%`, Then one line `100%` is shown.
- [ ] Given `loginUrl="javascript:alert(1)"`, Then `Otwórz link` is disabled.
- [ ] Given 600 lines and `maxLines=500`, Then the DOM has 500 line nodes plus a truncation marker.
- [ ] Given the user scrolled up, When a line arrives, Then scrollTop is unchanged and the jump control shows.
- [ ] Given `redact` masking `sk-...`, Then neither the DOM nor the copied text contains the secret.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit: sanitiser corpus (ANSI CSI/OSC/DCS, C1 controls, bidi, CR, giant input), `extractLoginUrl` table test, ring buffer. Security regression test list is stored as fixtures so SEC tasks can reuse.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: viewer only; xterm.js is not adopted (dependency cost, SPEC 19.7). If interactive login typing is needed in the wizard, a separate task decides (herdr keystroke API).
- OPEN: exact secret-redaction patterns are SEC003; this component only exposes the hook.
