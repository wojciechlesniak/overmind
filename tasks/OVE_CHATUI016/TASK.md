---
id: OVE_CHATUI016
title: "Wire Chief proposal cards in the thread: Skills, Rules and dynamic Agents"
area: CHATUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_CHAT002, OVE_CHATUI011, OVE_CHIEF014, OVE_DS057, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:chat-proposal-card"]
needs: ["ui:ChiefProposalCard", "api:proposals.list", "api:proposals.decide", "lib:shell-navigation", "contract:MessagePart"]
owns: ["apps/desktop/src/features/chat/approvals/proposal/**", "apps/desktop/src/locales/en/chat-016.json", "apps/desktop/src/locales/pl/chat-016.json"]
reads: []
design: design.png
design_source: "Skille#skills/chief-proposal (crop 92,236,988,94)"
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 6"]
adr_refs: [12, 16, 28]
---

# OVE_CHATUI016: Wire Chief proposal cards in the thread: Skills, Rules and dynamic Agents

## 1. Summary

Renders `ui:ChiefProposalCard` where Chief proposes something to the Owner in the Chief conversation (a new Skill, a Rule change, keeping a dynamic Agent, making something public) and sends the Owner's accept or reject. Content is always visible before accept is possible.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHIEF014: proposals live in the Proposal store; creating one posts an informational part into the Chief conversation; `DecideProposal` is Owner-only, desktop-only (even Skill and visibility proposals change the library and rules). CHAT002 has no proposal part yet: this task consumes an additive part `proposal_ref { proposalId, kind }` (requested from CHAT/CHIEF in the gap list) and loads details by id from `GET /v1/proposals`.

## 3. Scope (in)

- `ProposalSlot`.
- Detail loading by id.
- Accept, reject, view content actions.

## 4. Out of scope

- The Skills library and Agents pages (SKUI, AGUI).
- Proposal creation (CHIEF).

## 5. Detailed requirements

1. `ProposalSlot({ part })`: loads the proposal (`api:proposals.list` filtered by id/status) via `useResource`; while loading shows a skeleton; unknown kind renders the neutral card with title and `View` only.
2. Variants: `skill_publish` -> kit `variant='skill'` (dashed magenta); `rule_change` -> `variant='rule'` with the FULL quoted rule in the title; `agent_promotion` ('Keep dynamic Agent as persistent') -> `skill`-like variant with the Agent name and the private-until-decision origin line; `skill_make_public` and `agent_make_public` -> `skill` variant with text 'Make public' (PUBLICZNY word, never colour only); `doc_change` -> card with `View` only and the note that Overmind never edits Documentation (the Owner does) so no accept button.
3. Accept: `POST decide {decision:'accept'}`; Reject: `{decision:'reject', note?}` (optional note field in a small popover is NOT in MVP); `View` navigates to the subject (Skill detail, Rule editor, Agent profile) through `lib:shell-navigation`.
4. Safety rule from DS057: the proposed content must be visible before accept: for `rule_change` the quoted rule is in the title; for Skills the card shows the origin line `Skill zaproponowany przez Chiefa, prywatny do czasu Twojej decyzji` and promotes `View` next to accept; accept is never auto-focused.
5. Resolved states: `accepted`/`rejected` collapse to the result line (kit); executor failure (`proposal stays pending`, error returned) shows the engine's error key under the card.
6. Desktop-only: accept/reject exist only here; Telegram receives the stripped line (TG).
7. Paused: allowed (does not start work) except `agent_promotion` that may start nothing either; no guard needed.

## 6. Design notes

`design.png` reference is the Skills banner of DS057 (`design-skill.png`: dashed magenta card with Chief avatar, `Chief proponuje nowy Skill: release-checklist`, `Zobacz treść`, `Akceptuj`, `Odrzuć`) as drawn in the Skills view; here it appears inline in the Chief thread. The crop is that banner from the Skills view; geometry is the kit's.

## 7. Reuse

- `ui:ChiefProposalCard` (OVE_DS057), `lib:shell-navigation`, `useResource` (OVE_CHATUI003).

## 8. Architecture and code placement

`features/chat/approvals/proposal/`. Keys `chat-cards:proposal.*`. No decision logic in the UI. **i18n namespace:** this task writes its strings into its own namespace `chat-016` (files `locales/en|pl/chat-016.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-016`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Accept is an Owner action on desktop; proposal text is Chief-written (model output) and therefore shown as plain text. A Skill proposal can never give a Tool (Skills grant no access, ADR 0003/0012). The card never fetches content from the internet.

## 10. Errors and edge cases

- Proposal expired or already decided elsewhere: refresh shows resolved line.
- Executor failed (for example visibility in use, VIS): error key shown, card stays pending.
- Proposal belongs to a private subject of another Workspace: not returned by the server; card shows `unavailable`.
- Unknown part type: ignored by CHATUI011.

## 11. Acceptance criteria

- [ ] Accept and reject call the engine once and reflect the result.
- [ ] The proposed rule text is fully visible before accept.
- [ ] `doc_change` offers no accept (the Owner edits docs).
- [ ] Public/private is expressed by a word.
- [ ] Cards are only reachable on desktop.

## 12. Test plan

- Vitest hook tests; Storybook `Skill`, `Rule`, `AgentPromotion`, `MakePublic`, `DocChange`, `Resolved`, `Error`; Playwright `proposal` scenario in CHATUI035.
- Command: `pnpm --filter @overmind/desktop test features/chat/approvals/proposal`.

## 13. Parallelization notes

Keys under `chat-cards:proposal.*`. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Gap: CHAT002 has no `proposal_ref` part; requested as an additive part (`{proposalId, kind}`). Until it exists this slot receives nothing and Chief proposals are reachable from their own views (Skills, Workspace rules, Agents).
- P1 because proposals are not on the MVP critical path of the Chief view.
