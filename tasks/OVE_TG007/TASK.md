---
id: OVE_TG007
title: "Route Owner messages: no mention to Chief, @agent to that Agent, commands, secret refusal"
area: TG
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_ARCH004, OVE_CHAT013, OVE_ENGINE019, OVE_ENGINE020, OVE_PAUSE007, OVE_TG004, OVE_TG006]
soft_depends_on: []
provides: ["lib:telegram-router"]
needs: ["api:chat.send", "api:agents.list", "api:pause.global", "lib:api-client", "lib:gateway-inprocess-transport", "lib:redaction"]
owns: ["packages/adapters/telegram/src/router/**"]
reads: []
design: design.png
design_source: "Telegram#tg/bubble-owner + tg/bubble-agent (crop 0,316,390,180)"
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 5", "SPECIFICATION 16"]
adr_refs: [6, 23]
---

# OVE_TG007: Route Owner messages: no mention to Chief, @agent to that Agent, commands, secret refusal

## 1. Summary

Turns an accepted Owner message into the same use cases the desktop uses: plain text goes to the Chief, `@agent text` to that Agent, a small fixed command grammar (`/status`, `/pause`, `/resume`, `/help`, `/start`) is handled, secrets pasted by the Owner are refused, and everything goes through the gateway as channel `telegram`.

## 2. Context

ADR 0023 and 0006: one bot; without a mention the Chief answers, with a mention (`@qa what failed in the last run?`) the Agent answers (mock: Owner bubble '@qa co padło w ostatnim przebiegu?' answered by a bubble labelled 'QA'). Telegram is a thin client over the gateway (in-process transport, SPEC 13, 16.13). Security rules T1-T14 are in `docs/security/telegram-rules.md` (OVE_SEC008); this task implements the parts named below and MUST NOT contradict them. T3, T6, T7. Decision: Telegram may start Global Pause but not resume it (SEC008 assumption).

## 3. Scope (in)

- Command grammar and parser.
- Mention parsing and Agent resolution (including ambiguity).
- Calls to `api:chat.send` and `api:pause.global` with channel `telegram`.
- Inbound secret detection and refusal.
- Forwarded-message handling and unknown-command replies.

## 4. Out of scope

- Replies and formatting: TG009, TG013. `/status` content: TG008. Approvals: TG010/TG011. Fencing of Telegram text inside prompts (data, not instructions): SEC004 and CHAT.

## 5. Detailed requirements

1. **Grammar** (parsed from the message `text` after trimming and removing a trailing `@<botname>` from a command; entities of type `bot_command` are not trusted, the text is):
   | input | action |
   |---|---|
   | `/start` (paired) | reply with a greeting: 'Jestem Overmind. Napisz do Chiefa albo użyj @agent.' |
   | `/status` | TG008 |
   | `/pause` | `PUT /v1/pause/global {paused:true}`; reply 'Wszystko wstrzymane. Wznowić możesz tylko przy komputerze.' |
   | `/resume` | NO call; reply 'Wznowić możesz tylko przy komputerze.' (the gateway would refuse anyway, `pause.resume_requires_desktop`; the audit shows the denied attempt because the call IS made, see req 5) |
   | `/help` | list of commands and mentions |
   | `@handle rest` at the very start | route to that Agent |
   | any other text | route to the Chief |
   | other `/something` | reply 'Nieznana komenda. Użyj /help.' (not forwarded) |
   Only the exact ASCII command names match; lookalike characters (for example Cyrillic `ѕ`) do not form a command and are treated as other text.
2. **Chief routing:** `POST chat.send { conversation: { kind: 'chief' }, text, origin: { channel: 'telegram', trust: 'owner_remote' }, clientMessageId: 'tg:<update_id>' }` (idempotent on `clientMessageId`). The adapter never builds prompts and never fences text itself; CHAT/SEC004 treat `owner_remote` text as data in a fenced block (SEC008 test 10). The reply path is TG013.
3. **Agent routing:** handle regex `^@([A-Za-z0-9_]{1,32})(?=\s|$)`; matched case-insensitively against agent handles = lowercase name with spaces and hyphens removed ('Senior Reviewer' -> `seniorreviewer`, 'QA' -> `qa`) from `api:agents.list` (cached 30 s, only Agents visible to a Workspace with an active Run or that are Public). Exactly one match: `chat.send { conversation: { kind: 'agent', agentId, workspaceId? }, text: rest }`. Several matches (same handle in several Workspaces): reply with an inline keyboard 'Który?' listing 'QA · <Workspace>' (callback action `route_pick`, payload holds the pending text, TTL 5 min, single use) and send after the choice. No match: reply 'Nie znam agenta @{{handle}}. Dostępni: @qa, @developer, …' (max 10 handles, names capped). An `@handle` with no text is a reply asking for the message.
4. **Direct orders are binding** (ADR 0023) and the Agent informs the Chief; none of that is the adapter's job beyond passing the message with `conversation.kind: 'agent'`.
5. **Pause rules:** `/pause` is allowed (T6); `/resume` still issues `PUT /v1/pause/global {paused:false}` through the transport so that the gateway refuses it and the audit trail records a denied remote resume attempt; the reply is the fixed text above whatever the gateway answers. While paused, free text and `@agent` text receive 'Wszystko wstrzymane (Global Pause). Napisz po wznowieniu przy komputerze.' because the gateway answers `pause.paused`; `/status`, `/help`, `/pause` keep working.
6. **Forwarded messages** (`forward_origin`, `forward_from`, `forward_date`, `forward_sender_name`, `via_bot`): never parsed as commands, even when the text starts with `/pause` or `@agent`; the text is sent to the Chief prefixed by the localised marker 'Przekazana wiadomość:' with `origin.trust: 'external'`.
7. **Secrets (T7):** before any call, run `redaction.detect(text)` (SEC003 patterns: API keys, tokens, private key blocks, `ovm` marked fixtures); if a secret is found: do NOT forward, call `deleteMessage` for the Owner's message (best effort), reply 'To wygląda na sekret (klucz lub token). Nie przesyłaj sekretów przez Telegram: rozmowy z botem nie są szyfrowane end-to-end. Wiadomość nie została przekazana.', increment counter `secret_refused` and audit `telegram.secret_refused` with the matched pattern id only.
8. **Other message types** (photo, voice, document, sticker, location, poll without text): reply 'Na razie obsługuję tylko tekst.' (voice and files are post-MVP P2, ADR 0024); captions are treated as text.
9. **Length:** inbound text over 4000 characters is cut at 4000 with a note to the Chief ('…[obcięto]'); control and bidi characters are stripped before routing.
10. Gateway errors are mapped to short Polish replies via the Translator (`telegram:error.*` keys, `renderError(error, 'telegram')`, ARCH015): `pause.paused`, `chat.agent_not_found`, `gateway.rate_limited`, unknown -> 'Coś poszło nie tak. Spróbuj przy komputerze.'.

## 6. Design notes

`design.png` shows the Owner bubble '@qa co padło w ostatnim przebiegu?' (14:05) and the answer bubble labelled 'QA' ('Dwa testy koszyka: rabat liczony po VAT zamiast przed. Developer już poprawił, odpalam ponownie.'). The reply format (bold sender label line, then text) is implemented in TG009/TG013; this task decides WHO answers. States not in the mock: unknown agent, ambiguous agent keyboard, secret refusal, paused reply, unsupported message type; all are plain bot messages in the same style (no new visuals).

## 7. Reuse

- `api-client` in-process transport (`lib:api-client`, ENGINE), `api:chat.send` (CHAT), `api:agents.list` (AGENT005), `api:pause.global` (OVE_PAUSE007), redaction detect (SEC003), `Translator` and `renderError` (ARCH015), callback store (TG004).

## 8. Architecture and code placement

`packages/adapters/telegram/src/router/{parse.ts,commands.ts,mentions.ts,secrets.ts,forwarded.ts,router.ts}`. The router depends on the api-client interface only; it has no access to repositories of other areas and no direct use case imports (thin client).

## 9. Security and safety

- T6: commands recognised by a fixed ASCII grammar; text with approval-like words never approves anything (approval exists only through server-issued callback ids, TG011).
- T3: forwarded and edited content is data, never a command from the Owner.
- T7: secrets are refused and the Owner's message deleted when possible.
- Telegram never extends permissions: there is no command or text path to add a directory, lift an approval requirement, edit Rules, accept Skills, unpair or change the token (such text is just text for the Chief, and the gateway rejects every permission-widening call from channel `telegram` with `perm.local_approval_required`).
- The pending text stored for `route_pick` is kept only in the callback row (5 min) and deleted on use.
- Agent handles in replies are capped and stripped of control characters (untrusted names).

## 10. Errors and edge cases

- `@qa` when two Workspaces have a QA: keyboard choice; callback expired: 'Wygasło, napisz jeszcze raz.'.
- `/status@overmind_bot` with another bot's suffix: ignored (suffix must equal this bot's username).
- Message with leading spaces or a newline before `@qa`: trimmed, still routed.
- Empty text with entities only: unsupported type reply.
- Chief unavailable (engine busy): gateway error mapped to the generic reply.
- The Owner pastes a long log containing a token: refused, nothing forwarded, the log is not stored.

## 11. Acceptance criteria

- [ ] Given 'Jak idą testy?', Then `chat.send` goes to the Chief with channel telegram and `clientMessageId` tg:<id>.
- [ ] Given '@qa co padło…', Then `chat.send` goes to the QA Agent with the rest of the text.
- [ ] Given an ambiguous handle, Then an inline keyboard is sent and a press routes the stored text once.
- [ ] Given `/pause`, Then the gateway pause call is made and the fixed reply sent; Given `/resume`, Then the denied attempt is audited and the fixed reply sent.
- [ ] Given a forwarded message starting with '/pause', Then no pause call is made.
- [ ] Given a corpus secret, Then nothing is forwarded, the message deletion is attempted and the refusal is sent.
- [ ] Given Cyrillic lookalike '/ѕtatus', Then it is plain text for the Chief.
- [ ] Given voice, Then the unsupported reply is sent.

## 12. Test plan

Unit tests with a fake api-client: `parse.test.ts` (table, lookalikes), `mentions.test.ts`, `commands.test.ts`, `secrets.test.ts` (corpus), `forwarded.test.ts`, `route-pick.test.ts`; behaviour under attack is covered by OVE_SEC008. Command: `pnpm vitest run packages/adapters/telegram/src/router`.

## 13. Parallelization notes

After TG006. TG008 (status) and TG010/TG011 plug into the commands table through a registry (`CommandHandler` map) so they add files, not edit this one.

## 14. Open questions and assumptions

- OPEN (Owner): may Telegram resume Global Pause? DEFAULT: no; pause allowed (consistent with OVE_PAUSE003 and SEC008 T6).
- ASSUMPTION: only a LEADING `@handle` routes to an Agent; mentions in the middle of a message stay with the Chief.
- SEC008 test 11 says secrets are 'stored redacted with a warning'; this task refuses and does not store at all (stricter, matches the Owner request 'refusal when the Owner pastes a secret'). SEC008 owner to align.
