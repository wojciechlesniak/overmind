---
id: OVE_CHATUI008
title: "Build the safe Markdown renderer for Chief and Agent message text"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI001, OVE_DS005, OVE_DS009, OVE_DS022, OVE_SEC004]
soft_depends_on: []
provides: ["lib:chat-markdown"]
needs: ["ui:TextLink", "ui:Text", "ui:Icon", "lib:untrusted-text", "ui:PathText"]
owns: ["apps/desktop/src/features/chat/markdown/**", "apps/desktop/src/locales/en/chat-008.json", "apps/desktop/src/locales/pl/chat-008.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [3, 22]
---

# OVE_CHATUI008: Build the safe Markdown renderer for Chief and Agent message text

## 1. Summary

A small, dependency-free Markdown subset renderer that outputs React elements only (never an HTML string), supports paragraphs, emphasis, inline code, fenced code, lists, block quotes and links, ignores raw HTML, and sends every link through the kit's safe-href rule.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHAT009 requirement 4: Agent and Chief text is untrusted; Markdown is allowed in a restricted subset and sanitised by CHATUI. SEC004 (SR-35): Markdown rendering of agent or content text must be sanitised, URLs are never fetched automatically. DS046 and DS072 explicitly leave Markdown to the feature: kit message bubbles take plain React nodes.

## 3. Scope (in)

- Parser for a defined subset to an AST.
- AST to React renderer using kit `Text`, `TextLink`, `PathText`.
- Limits and truncation (collapse for very long messages).
- Copy-friendly code blocks.

## 4. Out of scope

- Syntax highlighting.
- Images, tables (the Chief workspace summary is a structured part, not Markdown tables), HTML, footnotes, math.
- Rendering Discussion messages (DISCUI012 reuses this component).

## 5. Detailed requirements

1. Supported subset: paragraphs; `**strong**`, `*em*`, `~~del~~`; `` `inline code` ``; fenced code blocks with optional language label (label shown, no highlighting); ordered and unordered lists (max nesting 3); `>` block quotes; `# ` headings clamped to `h4` visual level and rendered as bold paragraphs (messages must not create page-level headings); thematic break; autolinks `https://...` and `[text](url)`.
2. Raw HTML is NEVER interpreted: `<script>`, `<img onerror>`, `<iframe>`, comments and entities are rendered as literal text. There is no `dangerouslySetInnerHTML` and no `innerHTML` anywhere in the module (lint rule `react/no-danger` plus a unit test scanning the source).
3. Links: `[text](url)` and autolinks render `ui:TextLink` with `href` validated by the kit rule (http, https, mailto, tel, relative); otherwise the text is rendered as plain text with the URL in a `title`-less muted suffix (`text (url)`) so the Owner can see the target. External links use `external` (`rel='noopener noreferrer'`, `target='_blank'`) and show the host after the text when the visible text differs from the host (anti-phishing: `[docs.example.com](https://evil.test)` shows `docs.example.com (evil.test)`). Links never auto-load previews or images.
4. Mixed-script and confusable hosts: punycode hosts (`xn--`) are shown in their ASCII form with a warning icon and the title `chat:markdown.punycode`.
5. Bidi override and isolate characters, C0/C1 controls (except `\n`, `\t`) are replaced by `<U+XXXX>` visible markers before parsing (same rule as `sanitizeTerminalText`).
6. Redaction markers (`[REDACTED:kind]` as produced by ARCH004) render as a muted pill-like inline element with the text unchanged; they are not links and cannot be expanded.
7. File paths in inline code that look absolute (`/Users/...`, `~/...`) render through `ui:PathText` only when the whole inline code span is a path; they are plain text, never clickable (opening files is not a chat feature).
8. Limits: input max 32000 characters (CHAT001); parse is linear-time with an explicit state machine (no regex with nested quantifiers); more than 2000 AST nodes or nesting beyond limits render the remainder as preformatted plain text; messages over 4000 characters render collapsed to ~12 lines with a `Show more` button (kit `Button ghost sm`), expansion is local state.
9. Streaming: `<Markdown source status>`; while `status==='streaming'` incomplete constructs are rendered as plain text and finalised when the message completes (no flicker of half-open code fences: an unclosed fence is shown as a code block growing live).
10. Output stability: the component is memoised by `(source, status)`; a streaming message re-parses only the last open block (incremental by block index) to keep 60 fps with 30 KB text.
11. Accessibility: lists use real `ul/ol`, code blocks `pre` with `tabindex=0` and an accessible name from the language label, links keep focus ring.

## 6. Design notes

Typography follows the kit: body 15/1.5 `text-primary`, paragraphs 8px apart, inline code mono 12 `text-primary` on `bg-code` tint, code block radius 14 `bg-code` 1px `line-subtle` mono 12/1.6 with horizontal scroll, quote with 2px left `line-strong` rule. Not in the mock (derived from DS rules): all of the above, since the mock only shows plain paragraphs and one inline mono `npm audit` in the approval card.

## 7. Reuse

- `ui:TextLink` (safe href), `ui:Text`, `ui:PathText` (OVE_DS005, OVE_DS022).
- The terminal control-character handling idea of `sanitizeTerminalText` (OVE_DS052): share the character-class table by importing the exported helper if available, else keep a local copy covered by the same test vectors.
- Untrusted text wrapper conventions (OVE_SEC004).

## 8. Architecture and code placement

`features/chat/markdown/` exports `Markdown` and `parseMarkdown` (pure). Parser (pure, no React) and renderer separated so the parser is unit-testable and reusable by Telegram preview later. New block types are added by registering a renderer in a map (OCP). No third-party Markdown library: justification: sanitisation guarantees are easier to prove for a 300-line subset parser than for configuring a general one, and it avoids a dependency with a large attack surface (CONVENTIONS section 6). If the team prefers `markdown-it`, a written justification and a security review are required. **i18n namespace:** this task writes its strings into its own namespace `chat-008` (files `locales/en|pl/chat-008.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-008`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

This is the main XSS and phishing surface of the chat. Required controls: no HTML output path at all; link allow-list through the kit; visible link targets; punycode warnings; no automatic fetching; bounded parse time and size; control and bidi characters neutralised; redaction markers inert; prompt-injection text (for example `ignore previous instructions`, fake `[APPROVE]` buttons) is just text: Markdown cannot render buttons, forms or inputs. A test corpus of 40+ hostile inputs (javascript: links, data: URLs, nested emphasis bombs, 1 MB single line, unclosed fences, RTL override, zero-width characters, `<img src=x onerror=...>`, markdown inside link text) must produce DOM with no element outside an allow-list (`p, strong, em, del, code, pre, ul, ol, li, blockquote, a, span, br, hr`).

## 10. Errors and edge cases

- Malformed Markdown: rendered as plain text, never throws.
- Unclosed fence while complete: closed implicitly at the end.
- Very long unbroken token: wraps (`overflow-wrap:anywhere`).
- Link with credentials `https://user:pass@host`: rendered as text without a link and with a muted note (credentials in URLs are a phishing and leak vector).
- Emoji and surrogate pairs preserved.
- Empty message: renders nothing (caller handles).

## 11. Acceptance criteria

- [ ] Raw HTML in input appears as literal text; the DOM allow-list test passes for the whole hostile corpus.
- [ ] `javascript:` and `data:` links are not links.
- [ ] Visible link text that differs from the host shows the real host.
- [ ] A 32 KB message renders in under 50 ms on the reference machine (benchmark test with a generous CI threshold of 200 ms).
- [ ] Streaming a code fence never flashes broken markup.
- [ ] No `dangerouslySetInnerHTML`/`innerHTML` in the module.

## 12. Test plan

- Vitest: parser table tests (200+ cases), hostile corpus DOM allow-list, link policy table, punycode, size and node limits, streaming incremental behaviour.
- Storybook stories for every construct, hostile example story, long message collapse. axe clean. Visual baseline not required (no design crop).
- Command: `pnpm --filter @overmind/desktop test features/chat/markdown`.

## 13. Parallelization notes

No hotspot. DISCUI012 depends on this task. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: no tables or images in MVP. If agents routinely answer with tables, add `table` as a later task with the same allow-list approach.
- Open for the Owner: allow clickable absolute file paths that open Finder? Default no (opening files is outside the chat feature and a Local Approval topic).
