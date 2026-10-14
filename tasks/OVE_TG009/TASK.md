---
id: OVE_TG009
title: "Format outbound messages safely: HTML escaping, splitting, redaction and no secrets"
area: TG
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH015, OVE_TG002]
soft_depends_on: []
provides: ["lib:telegram-formatter"]
needs: ["lib:i18n-engine", "port:Translator", "lib:redaction"]
owns: ["packages/adapters/telegram/src/format/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 11"]
adr_refs: [6]
---

# OVE_TG009: Format outbound messages safely: HTML escaping, splitting, redaction and no secrets

## 1. Summary

The single place where text becomes a Telegram message: typed builders for HTML parse mode, escaping of untrusted text, neutralised links, bidi and control character stripping, splitting at 3500 characters, redaction and the final `assertTelegramSafe` gate.

## 2. Context

Chats with the bot are not end-to-end encrypted, so no secret may be sent (ADR 0006, SPEC 5). Agent output, file names and task titles are untrusted and could imitate an approval message or buttons (formatting spoofing). Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. T7, T11. Parse mode choice: HTML (three characters to escape) instead of MarkdownV2 (eighteen reserved characters, high bug risk).

## 3. Scope (in)

- Builders: `text`, `bold`, `code`, `pre`, `lines`, `senderLabel`.
- `escapeHtml`, `sanitizeUntrusted`, URL neutralisation.
- `splitMessage` and truncation notice.
- `prepareOutbound(parts): PreparedMessage[]` ready for `sendMessage`.

## 4. Out of scope

- Approval bubble content: TG010. What to say in status or replies: their tasks. Sending and rate limiting: TG006.

## 5. Detailed requirements

1. **Parse mode HTML only.** Messages are built from typed parts, never by string concatenation: `bold(str)`, `code(str)`, `text(str)` (escaped), `lines(parts[])`. The formatter is the only code that emits `<b>`, `<i>`, `<code>`, `<pre>`; untrusted strings can never become tags. `escapeHtml` replaces `&`, `<`, `>` (and `"` inside attributes, which are not used).
2. **`sanitizeUntrusted(s, { maxLen })`:** NFC normalise; remove control characters except `\n`; remove bidi controls U+202A-202E, U+2066-2069 and zero-width characters U+200B-200F, U+2060, U+FEFF; collapse runs of more than 2 newlines and of more than 3 spaces; cap length in code points (never in UTF-16 units, no split surrogate pairs); append '…' when cut.
3. **Links:** untrusted text is not interpreted as Markdown or HTML, so `[x](http://evil)` stays literal text; URL-like tokens (`https?://…`, `www.`) in untrusted text are rendered inside `<code>` so they are not tappable; no `<a>` is ever generated from untrusted input. Every send sets `link_preview_options.is_disabled = true` (and the legacy flag).
4. **Spoofing defence:** untrusted text is never placed on the first line of a message (the first line is a trusted label such as `<b>Chief</b>` or an agent name that went through `sanitizeUntrusted(40)`); text that begins with lines resembling the bot's own labels ('Zgoda ·', 'Chief') is prefixed with a zero-width-free visual marker '> ' (quote style) when it comes from an agent message, so that it cannot imitate an approval bubble.
5. **Length:** each part is at most 3500 characters INCLUDING tags after escaping; `splitMessage` splits first at blank lines, then at newlines, then at word boundaries, finally hard at the limit; tags are balanced because builders split at part boundaries, never inside a tag; at most 4 parts, then the last part ends with 'Reszta na komputerze.'; each part after the first starts with '(cd.)'.
6. **Redaction and safety gate:** every prepared part is passed through `redaction.redact()` (SEC003 patterns; replaced by `[ukryto]`) and `assertTelegramSafe` (ARCH015: no absolute paths, no token patterns, 3500 limit); a violation replaces the content with the fixed text 'Treść ukryta ze względów bezpieczeństwa.' and logs `unsafe_outbound` with the rule id; unsafe text is NEVER sent.
7. **Localisation:** all fixed strings come from `telegram:` keys through the Translator (Owner locale, ARCH015 requirement 6); no hard-coded Polish in code.
8. `prepareOutbound` returns `{ text, parse_mode: 'HTML' }[]`; keyboards are attached by TG010 only to the last part.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Translator`, `assertTelegramSafe` (ARCH015), redaction patterns (ARCH004/SEC003), `BotApiClient` types (TG002).

## 8. Architecture and code placement

`packages/adapters/telegram/src/format/{builders.ts,escape.ts,sanitize.ts,split.ts,prepare.ts}`. Pure functions; no I/O; other TG tasks import only `prepareOutbound` and the builders (SRP, DRY).

## 9. Security and safety

- T11: HTML escaping, no tag injection, link neutralisation, 3500 limit, no previews.
- T7: redaction plus `assertTelegramSafe` as the last gate; the SEC008 test sends corpus secrets through agent output and asserts none leaves.
- Anti-spoofing: untrusted text cannot occupy the label position or start with a fake 'Zgoda' header; approval buttons exist only as server-issued inline keyboards (TG010), which text cannot create.

## 10. Errors and edge cases

- 10 000-character agent output: 3 parts or fewer with the truncation note.
- Text ending in the middle of a surrogate pair: cut on code point boundary.
- Only bidi controls: becomes empty; the caller sends a placeholder.
- `&lt;b&gt;` already escaped in the input: double-escaped once (shows literally).
- Empty parts: dropped; empty message: 'Brak treści.'.
- Number of code points vs Telegram's UTF-16 limit: limit chosen far below 4096 to be safe.

## 11. Acceptance criteria

- [ ] Given '<b>x</b> [a](http://e)', Then the output shows literal text with escaped angle brackets and no `<a>`.
- [ ] Given 10 000 characters, Then at most 4 parts of at most 3500 characters and the truncation note.
- [ ] Given bidi override and zero-width characters, Then they are removed.
- [ ] Given a corpus secret and `/Users/x/y`, Then neither leaves (replacement text sent instead).
- [ ] Given untrusted text starting with 'Zgoda · Security', Then it is quoted and cannot occupy the label line.
- [ ] `pnpm i18n:check` passes for the `telegram` namespace keys introduced here.

## 12. Test plan

Unit and property tests: `escape.test.ts`, `sanitize.test.ts` (bidi, ZW, surrogates), `split.test.ts` (tag balance property), `prepare.test.ts`, `spoofing.test.ts`; corpus tests with SEC003. Command: `pnpm vitest run packages/adapters/telegram/src/format`.

## 13. Parallelization notes

Parallel with TG003 to TG005; used by TG007 replies, TG008, TG010, TG013.

## 14. Open questions and assumptions

- ASSUMPTION: HTML parse mode (not MarkdownV2). SEC008 T11 covers both; the SEC008 tests assert on escaped output either way.
- ASSUMPTION: URL-like tokens in untrusted text are shown in `<code>` (not tappable).
