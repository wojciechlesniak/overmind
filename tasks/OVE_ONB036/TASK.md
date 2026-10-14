---
id: OVE_ONB036
title: "Implement the first Chief greeting: fixed template, preview, one-time post on completion"
area: ONB
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH015, OVE_CHAT006, OVE_CHAT009, OVE_DATA011, OVE_DATA017, OVE_ONB001, OVE_ONB007, OVE_ONB031]
soft_depends_on: ["OVE_ONB033"]
provides: ["usecase:BuildChiefGreeting", "usecase:PostFirstChiefGreeting", "port:ChiefGreetingPoster", "api:onboarding.greeting.preview", "lib:api-client-onboarding-greeting"]
needs: ["event:onboarding.completed", "usecase:GetWorkspace", "usecase:GetOrCreateConversation", "usecase:PostSystemMessage", "usecase:ListProjectDocs", "lib:route-module", "lib:i18n-engine"]
owns: ["packages/application/src/onboarding/greeting/**", "packages/application/src/ports/ChiefGreetingPoster.ts", "packages/application/locales/en/onboarding-greeting.json", "packages/application/locales/pl/onboarding-greeting.json", "packages/gateway/src/routes/onboarding/greeting.route.ts", "packages/api-client/src/onboarding/greeting.ts", "packages/adapters/chat-greeting/**"]
reads: ["packages/application/src/onboarding/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [15, 16, 23]
---

# OVE_ONB036: Implement the first Chief greeting: fixed template, preview, one-time post on completion

## 1. Summary

Builds the first Chief greeting from a fixed, localised template (no model call) and posts it once into the Owner-Chief conversation when onboarding completes. The same builder serves a preview in step 3, so what the Owner sees is what the Chief later says.

## 2. Context

Step 3's purpose in the Owner's brief is a first Workspace plus 'first Chief greeting'. ONB007 deliberately has no side effects beyond the `onboarding.completed` event ("no Runs, no Telegram messages"), so the greeting is a separate event subscriber. The greeting is a template and not a model turn because: the CLI login may be fresh, it costs a quota, it adds prompt-injection surface (workspace names and doc titles are Owner text but must stay data), and it is deterministic to test. Chief is the single conversational counterpart (ADR 0023 keeps direct agent chats separate); autonomy defaults apply (ADR 0015): the greeting proposes nothing and creates no Tasks.

## 3. Scope (in)

- `BuildChiefGreeting({ workspaceId })` pure-ish use case returning `ChiefGreeting` (ONB031).
- `PostFirstChiefGreeting` subscriber for `onboarding.completed`.
- Port `ChiefGreetingPoster` and its adapter wrapping CHAT's `PostSystemMessage`.
- Route `GET /v1/onboarding/greeting/preview` and api-client function.
- Locale files for EN and PL.

## 4. Out of scope

- Planning from documentation (CHIEF `PlanFromDocumentation`).
- Telegram delivery of the greeting (not sent: no outbound Telegram message at completion).
- The preview UI (ONB037).

## 5. Detailed requirements

1. **Templates (PL proposed, EN equivalent).** With docs: `Cześć, jestem Chief. Pracuję teraz w Workspace „{{workspaceName}}” i widzę Dokumentację projektu „{{docTitle}}”. Powiedz, co budujemy, albo poproś mnie o plan z dokumentacji.` Without: `Cześć, jestem Chief. Pracuję teraz w Workspace „{{workspaceName}}”. Wskaż mi Dokumentację projektu albo powiedz, co budujemy, a zaplanuję pracę.` Keys `onboarding.greeting.withDocs` / `.noDocs`. Max 600 characters after interpolation; `{{docTitle}}` omitted (use `noDocs`) when the title is empty.
2. **Interpolation is text-only.** Params are inserted as plain text, no markdown or HTML; backticks, angle brackets and control characters are stripped from params; params longer than 80 characters are truncated with an ellipsis. The greeting never contains paths, Agent names, Skill names or Owner Rules.
3. **Preview.** The route returns `ChiefGreeting` (key, params, English fallback) for the Workspace; the UI renders it with its own locale (not the server's).
4. **Post on completion.** On `onboarding.completed { workspaceId }`: `GetOrCreateConversation({ kind: 'chief' })`, then `ChiefGreetingPoster.post({ conversationId, workspaceId, greeting, idempotencyKey: 'onboarding-greeting:' + workspaceId })`. The poster posts a Chief-authored message of kind `chief_greeting` (needs a new `PostSystemMessage` kind; see proposal `_proposals/OVE_ONB036-chat-chief-greeting-kind.md`), stores `textKey` and `params` plus the English `text` (CHAT009 rule), unread for the Owner.
5. **Exactly once.** The idempotency key prevents duplicates on restart or event redelivery; if a message with that key exists the subscriber does nothing. Failures are retried with backoff 3 times (1 s, 5 s, 30 s) then logged; failure never affects onboarding completion.
6. The subscriber runs only for the first completion on this installation (`onboarding.completed` is emitted once; guard also checks the key).
7. No model call, no Run, no Task, no notification sound for the greeting itself (an unread badge only), no fan-out to Telegram (poster sets `channels: ['desktop']`).
8. Locale resolution uses the Owner's UI locale stored in config (`api:config.get` through the existing `LocaleReader` port of ARCH011); default `en`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`GetOrCreateConversation` and `PostSystemMessage` (CHAT), `GetWorkspace`, `ListProjectDocs`, engine i18n (ARCH011), event bus (ARCH010), route-module conventions. Contract `ChiefGreeting` from ONB031.

## 8. Architecture and code placement

`packages/application/src/onboarding/greeting/{build-chief-greeting.ts, sanitize-param.ts, post-first-greeting.ts}`; port `ChiefGreetingPoster` in `packages/application/src/ports/`; adapter `packages/adapters/chat-greeting/` implements it on top of the CHAT use case (adapters never import each other: the adapter receives the CHAT use case by injection from the composition root). The builder has no I/O beyond reads through ports.

## 9. Security and safety

- Workspace name and doc title are Owner-supplied but treated as data: sanitised, bounded, inserted only into a fixed template; they are not forwarded to any model here.
- Posting needs no extra permission; it is Chief-authored UI content and grants nothing (ADR 0003, 0015).
- Idempotency key prevents repeated Owner-visible spam; failures are logged without params.
- A greeting must never contain secrets: params come only from name and title.

## 10. Errors and edge cases

- Workspace renamed after completion: the message keeps the old text (historical record).
- Docs unlinked later: the greeting is not edited.
- Conversation missing: created by `GetOrCreateConversation`.
- CHAT unavailable at completion: retry then give up, onboarding is already completed; the dashboard simply has an empty Chief conversation (UI empty state of CHATUI).
- Locale `pl` missing keys: fallback to `en`.
- Name containing `{{` or markdown: stripped or inserted as plain text; never re-interpolated.

## 11. Acceptance criteria

- [ ] Given a linked doc then the with-docs template is used with the doc title; without, the no-docs template.
- [ ] Given a name with markup and 200 characters then the greeting contains plain text truncated to 80.
- [ ] Given the completion event delivered twice then exactly one message exists.
- [ ] Given a CHAT failure then onboarding stays completed and the post is retried 3 times.
- [ ] Given the preview route then it returns the same key and params that the post later uses.
- [ ] Given no provider calls in the fakes then none were made.

## 12. Test plan

Unit: sanitiser table, template selection, length cap. Subscriber test with fake bus, fake poster (duplicate events, failure and backoff with fake clock). Route test. Contract test that the proposal kind exists once merged. Command: `pnpm --filter @overmind/application test onboarding/greeting`.

## 13. Parallelization notes

Parallel with ONB032..ONB035. Hotspot: CHAT's `PostSystemMessage` kinds (closed set) is owned by CHAT; use the proposal file, do not edit it.

## 14. Open questions and assumptions

- OPEN (CHAT): add `chief_greeting` kind; until merged the adapter falls back to kind `plan_update` with the same parts and the UI renders it as a normal Chief message.
- ASSUMPTION: template, not model; Owner may later want a model-written greeting (post-MVP).
- ASSUMPTION: greeting texts are proposed copy and need Owner confirmation.
