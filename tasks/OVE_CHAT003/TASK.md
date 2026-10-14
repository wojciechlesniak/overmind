---
id: OVE_CHAT003
title: Implement pure chat rules (mention routing, limits, sequencing, unread)
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT001]
soft_depends_on: [OVE_CHAT002]
provides: ["lib:chat-rules", "lib:mention-parser"]
needs: []
owns: ["packages/domain/src/chat/**"]
reads: ["packages/contracts/src/chat/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16.2", "SPECIFICATION 16.13"]
adr_refs: [23, 6, 28]
---

# OVE_CHAT003: Implement pure chat rules (mention routing, limits, sequencing, unread)

## 1. Summary

Pure functions for the rules of conversation: where an Owner message goes (no mention = Chief, `@agent` = that Agent), how text is normalised and bounded, how `seq` and unread counts are computed. Telegram and desktop call the same functions, which is what makes their behaviour identical.

## 2. Context

SPEC 5 and ADR 0023: on Telegram "Bez wzmianki odpowiada Chief, ze wzmianką `@agent` odpowiada wskazany Agent"; the desktop has a conversation per Agent, so there the conversation decides the target, but a message in the Chief conversation containing `@qa` also goes to QA (the mock composer hint: "Napisz do Chiefa... albo @qa"). Agent names are unique inside a visibility scope (`OVE_AGENT002`), which makes mentions unambiguous.

## 3. Scope (in)

- `parseMentions(text, candidates)`, `resolveRoute(input, ctx): Result<Route>`.
- `normaliseMessageText`, `checkLimits`.
- `nextSeq`, `unreadCount(lastSeq, lastReadSeq)`, `shouldNotify` (unread bump rules).
- Preview builder for list rows.

## 4. Out of scope

- Loading candidates and persistence: `OVE_CHAT006`. Telegram specifics (update ids, markup): TG. Rendering: CHATUI.

## 5. Detailed requirements

1. Mention syntax: `@` followed by an Agent name key (letters, digits, `-`, `_`, `.`; Agent display names with spaces are matched by their slug, for example "Senior Reviewer" -> `@senior-reviewer`; slug rule in `slugForMention(name)`). Mentions are recognised only at a word boundary and not inside code spans or fenced blocks; `@@x`, e-mail addresses (`a@b.com`) and URLs are not mentions.
2. `resolveRoute({ text, conversation, channel }, { agents: AgentMentionCandidate[], chiefAliases: ['chief'] })`:
   - In an `agent` conversation: target is that Agent regardless of mentions; a different `@other` mention does not reroute (it is plain text), to avoid surprising cross-routing; Chief mentions (`@chief`) in an Agent chat are plain text too.
   - In the Chief conversation or from Telegram: no mention -> Chief; a first mention of a known Agent -> that Agent (`route.agentId`), mentions after the first are ignored for routing but kept in the text; `@chief` -> Chief; an unknown mention -> `chat.unknown_mention` (does not guess); two candidates with the same slug -> `chat.ambiguous_mention` (should not occur; defensive).
   - In a `discussion` conversation: the Owner message is posted into the Discussion (route kind `discussion`).
3. Candidates are only Agents visible in the active Workspace (caller supplies; the rule never queries). An Agent not visible there yields `chat.agent_not_in_workspace`, not "unknown", so the UI can explain.
4. `normaliseMessageText`: NFC, convert CRLF to LF, strip C0/C1 control characters except `\n\t`, strip ANSI sequences, remove zero-width and bidi control characters from owner text entirely (they have no use in typed chat and enable spoofing), trim, collapse more than 3 consecutive blank lines. Result empty -> `chat.empty_message`. Length limits from `OVE_CHAT001` -> `chat.message_too_large` with the limit in details.
5. `nextSeq(lastSeq)` is `lastSeq + 1`; `unreadCount = max(0, lastSeq - lastReadSeq)` counting only messages not authored by the Owner (the caller passes `ownerSeqs` or the repository counts; this function takes `lastForeignSeq` and `lastReadSeq` and a count of foreign messages after the read marker).
6. `preview(message)`: single line of at most 140 characters from `text` (or from the part label when text is empty), newline replaced by space, no markup, secrets already redacted.
7. Idempotency key derivation `dedupeKey(channel, clientMessageId, channelMessageRef)` returns a stable string used by CHAT006/007.
8. Everything is deterministic and clock-free.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`slugForMention` is shared with CHAT011 (list) and TG (command parsing); do not re-implement slugging elsewhere. Unicode helpers from SEC004 `sanitize` are NOT reused for owner chat because their policy marks instead of removes; this task documents that difference.

## 8. Architecture and code placement

`packages/domain/src/chat/{mention.ts,route.ts,normalise.ts,limits.ts,unread.ts,preview.ts,dedupe.ts}`. Domain imports only contracts.

## 9. Security and safety

Routing decides which model sees the text, so the rules are conservative: unknown mention is an error (never "best guess"); a mention never reroutes inside an Agent chat; text from Telegram carries `owner_remote` trust at a higher layer, but the routing rule is the same so there is no Telegram-only path to Agents the Owner cannot reach on desktop. Control and bidi characters are removed so a pasted payload cannot visually spoof a mention or hide text.

## 10. Errors and edge cases

- `@qa` inside backticks: not a mention.
- `@QA` uppercase: matched case-insensitively against the slug.
- `Please ask @qa and @security`: routes to QA (first mention), text kept whole.
- `@` alone or `@ ` : not a mention.
- Agent renamed between typing and sending: caller reloads candidates; unknown mention error carries the text.
- Very long single line without spaces: limited by character count; no regex catastrophic backtracking (linear scanner implementation; tested with 1 MB input within 50 ms).

## 11. Acceptance criteria

- [ ] Routing table tests: Chief conversation, Agent conversation, Discussion conversation, Telegram, each with and without mentions, unknown, ambiguous and not-in-workspace cases.
- [ ] Mentions inside code spans, e-mails and URLs are ignored.
- [ ] Control, zero-width and bidi characters are removed from owner text.
- [ ] Limit checks return the right codes.
- [ ] Linear-time test on a pathological input.
- [ ] Unread arithmetic matches the table of cases.

## 12. Test plan

Table-driven Vitest tests, fast-check property test for `normaliseMessageText` idempotence (`n(n(x)) = n(x)`), performance test. Command: `pnpm vitest run packages/domain/src/chat`.

## 13. Parallelization notes

Parallel with CHAT002 and CHAT004. TG authors read `parseMentions` through the application layer. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: a message routed to an Agent by mention is stored in that Agent's conversation (the target conversation), not in the Chief conversation; the composer shows a small "sent to QA" hint (decided in CHAT006).
- ASSUMPTION: Agent names with spaces are mentioned by slug; the composer UI autocompletes the slug.
