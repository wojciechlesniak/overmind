---
id: OVE_CHATUI009
title: "Define secret-safe text rules for chat: redaction markers and sanitiser pipeline"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI001, OVE_DS052, OVE_SEC003]
soft_depends_on: []
provides: ["lib:chat-safe-text"]
needs: ["lib:sanitizeTerminalText", "lib:redaction-corpus", "lib:no-secrets-assert", "doc:secrets-policy", "ui:TerminalPane"]
owns: ["apps/desktop/src/features/chat/safe/**", "apps/desktop/src/locales/en/chat-009.json", "apps/desktop/src/locales/pl/chat-009.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 5"]
adr_refs: [3, 22]
---

# OVE_CHATUI009: Define secret-safe text rules for chat: redaction markers and sanitiser pipeline

## 1. Summary

One tiny module that every chat component uses before text reaches the screen: `safeMessageText`, `safeTerminalLines` and `redactForDisplay`. It enforces defence in depth: the engine redacts at write time (ARCH004), the UI additionally neutralises control characters and applies the SEC003 display patterns to terminal text, so a secret echoed by a CLI never appears in a message or a terminal preview.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. The terminal preview (CHATUI029) shows live CLI output which is the riskiest text in the product: it can contain tokens, login URLs with codes, ANSI escape sequences and bidi tricks. SEC003 defines the secret patterns and the `expectNoSecrets` assertion. The kit `TerminalPane` provides `sanitizeTerminalText` and a `redact` hook but holds no patterns by design.

## 3. Scope (in)

- `safeMessageText(text, {redacted})`.
- `safeTerminalLines(raw, state)`: incremental sanitise + redact for streaming terminal chunks.
- `redactForDisplay(line)`: applies the SEC003 display patterns.
- Test vectors from the redaction corpus.

## 4. Out of scope

- Server-side redaction (ARCH004, CHAT009, DISC013).
- Markdown (CHATUI008).
- Terminal transport (CHATUI029).

## 5. Detailed requirements

1. `redactForDisplay(line: string): string` replaces every match of the patterns exported by `lib:redaction-corpus` (API keys such as `sk-ant-...`, `ghp_`/`github_pat_` tokens, `Bearer`/`Authorization:` values, private-key blocks, JWTs, `?code=`/`state=` query values of login URLs, AWS-style keys) with `[REDACTED:<kind>]`. It is idempotent (`redact(redact(x)) === redact(x)`) and linear-time (no catastrophic regex; patterns come from SEC003 and are tested with ReDoS vectors up to 100 KB).
2. Pattern updates are not hard-coded: the module imports the pattern table from the shared package that SEC003 defines (`packages/contracts/src/redaction` or the location named by SEC003 owner). Adding a pattern needs no change here.
3. `safeTerminalLines(chunk: string, state: SafeTerminalState): { lines: string[]; state }` handles chunks that split an ANSI sequence, a multibyte character, or a secret across two chunks: it keeps a carry buffer of at most 256 characters (the maximum secret pattern length) and emits a line only after its newline or after 500 ms of quiet; the carry is redacted before display as part of the next emit (so a token split across chunks is still redacted).
4. Order of operations: (1) `sanitizeTerminalText` from the kit (ANSI, controls, bidi, caps), (2) `redactForDisplay`, (3) cap lines at 2000 characters. Never redact before sanitising (escape sequences could split a pattern).
5. `safeMessageText(text, flags)`: neutralises C0/C1 controls (except newline and tab) and bidi controls to `<U+XXXX>`; does NOT redact message text again unless `flags.redacted===false` and the text matches a pattern, in which case it redacts and sets `flags.displayRedacted=true` (defence in depth for messages that bypassed the engine pipeline, for example old data); a message flagged `redacted:true` by the engine shows an inline marker `chat:message.redactedNote` ('Some content was hidden because it looked like a secret').
6. Login URL handling: lines containing `https://` login URLs keep the host and path but their query values are replaced (`?code=[REDACTED:oauth]`); copying a terminal line copies the redacted text.
7. A shared test helper `expectNoSecretsInDom(container)` uses `lib:no-secrets-assert` and is exported for every CHATUI test that renders agent text.
8. The module is pure and synchronous; no logging of inputs.

## 6. Design notes

N/A, functionality only. Redaction marker look is defined in CHATUI008 (message pill) and kit TerminalPane (muted text).

## 7. Reuse

- `sanitizeTerminalText` and `TerminalPane.redact` (OVE_DS052).
- Pattern table, corpus and assertion (OVE_SEC003).

## 8. Architecture and code placement

`features/chat/safe/`. Pure TypeScript, no React. Used by markdown, terminal stream, message renderer and the Discussion thread (DISCUI012 imports it; cross-feature use is allowed through a `shared` re-export proposal if the team wants; for now DISCUI imports `features/chat/safe` through the public entry `features/chat/safe/index.ts`). **i18n namespace:** this task writes its strings into its own namespace `chat-009` (files `locales/en|pl/chat-009.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-009`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

This task IS a security control (SR for secret display). Rules: the UI is the last line of defence, never the only one; fail closed: if redaction throws or a pattern table fails to load, the text is replaced by `[hidden: could not verify]` rather than shown raw; no secret is placed in a thrown error message; tests use synthetic tokens built at runtime from fragments so the repository itself never contains a realistic secret (secret scanning in CI must stay clean).

## 10. Errors and edge cases

- Pattern table missing: fail closed marker, error reported once to the logger without content.
- Secret split across chunks: redacted.
- Multibyte character split: carried over.
- Text with 10 MB: capped at 256 KiB per call (kit rule) with a muted truncation line.
- Marker text typed by a hostile agent (`[REDACTED:fake]`): rendered like any text; markers carry no authority.

## 11. Acceptance criteria

- [ ] A token split across two terminal chunks never reaches the DOM.
- [ ] `redactForDisplay` is idempotent and linear-time on a 100 KB adversarial input.
- [ ] Bidi override characters appear as visible `<U+XXXX>`.
- [ ] If the pattern table fails, nothing raw is shown.
- [ ] The corpus from SEC003 is fully covered by tests.

## 12. Test plan

- Vitest with `lib:redaction-corpus` vectors, chunk-split fuzz (seeded, 1000 splits), ReDoS timing guard, idempotence, fail-closed test, DOM helper test.
- Command: `pnpm --filter @overmind/desktop test features/chat/safe`.

## 13. Parallelization notes

No hotspot. CHATUI029 and DISCUI012 depend on this. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the SEC003 pattern table is exported from a shared package usable by the UI; if it lives only in the engine, a copy generated at build time (`tools/gen`) is needed. Reported in the gap list.
