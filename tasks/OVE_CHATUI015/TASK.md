---
id: OVE_CHATUI015
title: "Wire the Owner Rule refusal card: change the Rule or leave it as is"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT013, OVE_CHATUI011, OVE_DATA015, OVE_DS057, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:chat-rule-refusal"]
needs: ["ui:OwnerRuleRefusalCard", "api:chat.read", "lib:api-client-chat", "lib:shell-navigation", "usecase:CreateOwnerRule"]
owns: ["apps/desktop/src/features/chat/approvals/rule/**", "apps/desktop/src/locales/en/chat-015.json", "apps/desktop/src/locales/pl/chat-015.json"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/msg-agent-with-rule-card (crop 358,512,726,196)"
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6"]
adr_refs: [16, 23]
---

# OVE_CHATUI015: Wire the Owner Rule refusal card: change the Rule or leave it as is

## 1. Summary

Mounts `ui:OwnerRuleRefusalCard` for `rule_refusal` messages in a direct Agent chat: shows the Rule ordinal and quote from the part, `Zmień Regułę` requests a rule-change proposal draft and opens the Rule editor, `Zostaw jak jest` dismisses the card. Nothing here ever changes a Rule.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. ADR 0016: Owner Rules rank above everything and cannot be weakened by a chat command; the Agent does not execute a conflicting command, names the Rule, and the Owner decides whether to change the Rule. CHAT010: a `rule_refusal` message (authored by `system` on behalf of the Agent) carries an `owner_rule_ref {ruleId, ordinal, textSnapshot, actions:['change_rule','keep']}` part; `POST /v1/chat/messages/{id}/change-rule` creates a Rule proposal draft and returns `{proposalId}` (desktop only, `perm.local_only` otherwise); `POST .../dismiss-card` marks `dismissed:true`. The refused command was NOT delivered to the Agent.

## 3. Scope (in)

- `RuleRefusalSlot`.
- Change-rule action with navigation to the Rule editor.
- Keep action with the collapsed `kept` state.
- States and error handling.

## 4. Out of scope

- The Rule editor and proposal editing (WSPACE area).
- Backend gate (CHAT010).

## 5. Detailed requirements

1. Render `ui:OwnerRuleRefusalCard` with `ruleId`, `heading` = `REGUŁA WŁAŚCICIELA · R2` (`chat-cards:rule.heading` with `{{ordinal}}`), `quote` = typographic quotes around `textSnapshot` (quotes added by the i18n template, text itself unchanged and plain), `state` = `kept` when the message part has `dismissed:true`, else `open`.
2. `Zmień Regułę`: call `requestRuleChange(messageId)` (CHATUI004), then `navigate({ to:'workspace-rules', ruleId, proposalId, from:'chat' })` (route name defined by WSPACE/SHELL; typed in `lib:shell-navigation`). The card shows a busy state while the call runs and, on success, the text `chat-cards:rule.draftCreated` ('Draft created. Review it in Rules.') with the same link, so the Owner can return. The card never states that the Rule changed.
3. `Zostaw jak jest`: calls `dismissCard(messageId)`; the card collapses to the `kept` one-line note `Reguła zostaje`; the thread history keeps it (no removal).
4. Both actions are desktop-only: the buttons exist only in the desktop UI; the engine also refuses from Telegram.
5. If the refusal has reason `scope_change` (part `plan_change_required`) the card shows an additional line naming the Documentation location (path as plain text via `DocRefChip`), and the primary action is replaced by `chat-cards:rule.openDocs` ('Open Documentation') that navigates to the docs list; the Owner changes the Documentation themselves (Overmind never edits Documentation, ADR 0016).
6. Pause: both actions are allowed while paused (they start no work).
7. The Owner's refused command text stays visible in the thread above the card (it is a normal Owner message with a `delivery_notice` `blocked: rule`), so the Owner can copy it.

## 6. Design notes

`design.png` shows the Agent message `Nie mogę tego zrobić...` and the red Owner Rule card: label `REGUŁA WŁAŚCICIELA · R2` (mono, error tone), quote `„Wszystko ma być przetestowane, test penetracyjny po każdym Zadaniu.”`, buttons `Zmień Regułę` (secondary) and `Zostaw jak jest` (ghost). Geometry per DS057. Derived: busy, draft created, kept, scope-change variant, error line.

## 7. Reuse

- `ui:OwnerRuleRefusalCard` (OVE_DS057), `ui:DocRefChip` (OVE_DS040), hooks (OVE_CHATUI004).

## 8. Architecture and code placement

`features/chat/approvals/rule/`: slot + small hook. Writes keys under `chat-cards:rule.*`. **i18n namespace:** this task writes its strings into its own namespace `chat-015` (files `locales/en|pl/chat-015.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-015`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. The card can never alter a Rule: `change-rule` creates a draft addressed to the Owner (DATA owns the only writer of Rules, ADR 0016); the UI does not send rule text. The quote is `textSnapshot` from the engine, shown as plain text; an Agent cannot inject a fake rule card because cards come only from typed `owner_rule_ref` parts created by CHAT010 (`author:system`), never from message text.

## 10. Errors and edge cases

- `perm.local_only` (should not occur on desktop): inline error, card stays open.
- Rule deleted or changed since the refusal: the editor opens on the current Rule list; the card text remains the snapshot (historic).
- Dismiss fails: card stays open with a retry hint.
- Message already dismissed on another window: event updates it to `kept`.

## 11. Acceptance criteria

- [ ] `Zmień Regułę` creates a draft through the engine and never modifies a Rule.
- [ ] `Zostaw jak jest` collapses the card and persists across reload.
- [ ] The quote text is plain and cannot render markup.
- [ ] In a scope-change refusal the Owner is sent to Documentation, not to a Rule edit.
- [ ] Telegram-origin refusals do not show these actions on Telegram (verified by contract test of CHAT002 `stripForChannel`, not here) and the desktop copy of the same refusal shows them.

## 12. Test plan

- Vitest hook tests (fake client); Storybook `Open`, `Busy`, `DraftCreated`, `Kept`, `ScopeChange`, `Error`; Playwright in CHATUI035 (`rule-refusal` scenario).
- Command: `pnpm --filter @overmind/desktop test features/chat/approvals/rule`.

## 13. Parallelization notes

Keys under `chat-cards:rule.*` only. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: route name `workspace-rules` with params `{ruleId, proposalId}` exists in `lib:shell-navigation` (WSPACE area); coordinate names in the linker pass.
