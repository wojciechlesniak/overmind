---
id: OVE_CHATUI013
title: "Wire inline Approval cards: live status, decisions and the pause guard"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI011, OVE_DS055, OVE_PAUSE012, OVE_PERM013, OVE_PERM015, OVE_PERM027, OVE_PERM028]
soft_depends_on: []
provides: ["lib:chat-approval-card"]
needs: ["ui:ApprovalCard", "ui:ApprovalActions", "api:approvals.get", "api:approvals.decide", "lib:api-client-approvals", "api:access-requests.get", "api:access-requests.decide", "lib:api-client-access-requests", "event:approval.decided", "event:approval.expired", "event:access_request.decided", "lib:use-pause-guard", "ui:PausedReason"]
owns: ["apps/desktop/src/features/chat/approvals/card/**", "apps/desktop/src/locales/en/chat-013.json", "apps/desktop/src/locales/pl/chat-013.json"]
reads: []
design: design.png
design_source: "Chief#chief/approval-card (crop 367,575,748,192)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 5"]
adr_refs: [3, 6, 21]
---

# OVE_CHATUI013: Wire inline Approval cards: live status, decisions and the pause guard

## 1. Summary

Mounts `ui:ApprovalCard` for `approval_ref` parts in the Chief thread (and in an Agent chat): loads the live status from PERM by id, maps kind and snapshot to the card, submits decisions (allow this Run, deny; permanent grants through CHATUI014), reflects `decided`, `expired` and `decided elsewhere (Telegram)`, and disables approving while paused.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHAT002: the `approval_ref` part is `{approvalId or accessRequestId, kind:'approval'|'access_request', snapshot{title<=120, detail<=300, workspaceName, runLabel?, expiresAt?}}`; the snapshot is display-only, live status always comes from PERM by id (PERM027 `GET /v1/approvals/{id}`, `POST /v1/approvals/{id}/decision {decision:'approve'|'deny', note?}`; PERM028 for Access Requests with `grant_run|grant_permanent|deny`). Approvals started on Telegram can only apply to the current Run (ADR 0006); from the desktop they are Local Approvals when permanent. The kit card has states `pending|submitting|decided|expired|decided-elsewhere` (DS055).

## 3. Scope (in)

- `ApprovalSlot` implementing the slot of CHATUI011.
- Live status loading and event updates.
- Decision submission and result line.
- Kind mapping (heading, title, description, command block).

## 4. Out of scope

- Permanent grant and Local Approval confirmation (CHATUI014).
- The Approvals page (APPRUI area).
- Cards for Owner Rule and proposals (CHATUI015, 016).

## 5. Detailed requirements

1. `ApprovalSlot({ part })` loads `GET approvals/{id}` or `access-requests/{id}` (by `kind`) with `useResource`; shows the kit card from the snapshot immediately (`state:'pending'` is NOT assumed: until the live status arrives the actions are disabled and the card shows a skeleton line `chat-cards:approval.checking`), then renders the live state.
2. Mapping: `heading` = `ZGODA · <AGENT NAME UPPER> · RUN #<n>` (or `PROŚBA O DOSTĘP · ...` for Access Requests) via i18n with params; `expiryLabel` = `wygasa za 25 min` computed by `formatRelative` from `expiresAt` and refreshed every 30 s by a single shared ticker (not per card); `title` from the snapshot title; `description` from the snapshot detail rendered as plain text with inline `code` only for the structured `command` field (never parsed out of the text); `kind` selects tone and the `command` block (git push shows `git push origin <branch>` from the structured field).
3. Actions: `allowRun` label `Zezwól na ten Run` -> approval `decision:'approve'` or access-request `grant_run`; `deny` label `Odmów` -> `deny`; `allowPermanent` is rendered ONLY for `access_request` kind (ASSUMPTION, see section 14) and opens the CHATUI014 flow. All three are wrapped in `usePauseGuard`: when blocked, approve actions are disabled with `PausedReason` (`Wznów, aby zatwierdzić.`), deny stays enabled.
4. Submission: set the kit `submitting` state synchronously, call the route with `Idempotency-Key` = a ULID created per click; success -> wait for the event or the response to set `decided` (no optimistic transition: the card leaves `submitting` only when the parent state changes, DS055 requirement 4). Result line: `Zezwolono na ten Run · 14:21 · z desktopu` or `Odmówiono · 14:21`.
5. Errors: `perm.approval_expired` -> state `expired`; `perm.approval_not_pending` / `perm.access_request_not_pending` -> reload and show `decided`/`decided-elsewhere` according to `by` (`owner_telegram` -> `Rozstrzygnięto w Telegramie · 14:19`); `perm.owner_required` and `perm.local_approval_required` -> inline error under the card (never a silent failure); `pause.paused` -> paused reason; network error -> `error` line with retry (same Idempotency-Key).
6. Live updates: subscribe (shared hook) to `approval.decided`, `approval.expired`, `access_request.decided` by id; also handles `chat.message.updated` refreshing the part snapshot.
7. Expiry: the card flips to `expired` when the engine says so (event) or when the live status says `expired`; the client clock is only used for the label, never to decide validity (fail closed: a card whose `expiresAt` passed locally but whose status is still pending stays `pending` with label `expires now` until the engine decides, and the approve action is still enabled only if the engine accepts it).
8. The card never moves focus; the thread live region announces a new pending approval once (`chat-cards:approval.announce`: 'Approval needed: {{title}}').
9. Telegram parity: a card decided on Telegram shows the decided-elsewhere state within one event round trip (SPEC criterion 13).
10. Multiple identical cards (same approvalId in two conversations: Chief and Agent chat): both reflect the same live state.

## 6. Design notes

`design.png` shows the amber Approval card inline in the Chief thread: `ZGODA · SECURITY · RUN #14`, `wygasa za 25 min`, `Wejście na nową domenę: registry.npmjs.org`, description with mono `npm audit`, buttons `Zezwól na ten Run` (amber fill), `Zezwól na stałe` (outline), `Odmów`. Geometry is DS055. Per ASSUMPTION the `Zezwól na stałe` button is not rendered for new-domain approvals in MVP (the mock shows it; see open questions). Derived states: submitting, decided, expired, decided-elsewhere (DS055 section 6), checking (skeleton), paused-disabled.

## 7. Reuse

- `ui:ApprovalCard`, `ui:ApprovalActions`, `ui:PausedReason` (OVE_DS055, OVE_PAUSE012), api-client approvals and access requests (OVE_PERM027, OVE_PERM028), `useResource` and `useEventSubscription` (OVE_CHATUI003).

## 8. Architecture and code placement

`features/chat/approvals/card/`: slot component + `useApprovalCard(part)` hook (state machine in a pure reducer) + `approvalCardMapper.ts`. Dependency direction: UI -> api-client; no PERM domain logic is re-implemented (state machine decisions stay in PERM; the UI only maps statuses). Owns `chat-cards.json`. **i18n namespace:** this task writes its strings into its own namespace `chat-013` (files `locales/en|pl/chat-013.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-013`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Approval is a security boundary: (1) the decision is sent to the engine with an explicit Owner click only; no keyboard shortcut, no auto-focus, no default button; (2) the desktop UI never sends a scope field for plain approvals (PERM027: body only `decision`, `note`); (3) the snapshot text can contain agent-influenced strings: shown as plain text, never as Markdown, and the command comes from the structured field; (4) a pending card whose live status cannot be loaded keeps approve disabled (fail closed); (5) double activation is prevented by a synchronous `useRef` guard and the idempotency key; (6) audit is done by PERM; the UI sends the viewing channel implicitly through the authenticated session, never in the body.

## 10. Errors and edge cases

- Approval already decided elsewhere before the click: 409 -> reload -> `decided-elsewhere`.
- Expired while the Owner reads: `expired` state, actions removed; a new request is needed.
- Engine offline: card shows last known state with actions disabled and the reconnect banner.
- Snapshot detail longer than 300 chars (should not happen): truncated with ellipsis by CSS.
- Unknown `kind`: renders as `other` (amber, generic heading).
- Two quick clicks: second ignored.

## 11. Acceptance criteria

- [ ] Clicking `Zezwól na ten Run` sends exactly one decision request and the card moves to `decided` only after the engine confirms.
- [ ] Denying works while Global Pause is active; approving is disabled with the paused reason.
- [ ] A card decided on Telegram updates to `Rozstrzygnięto w Telegramie` without a reload.
- [ ] Expired cards cannot be approved.
- [ ] A pending card never takes focus; the thread announces it once.
- [ ] The snapshot text is rendered as plain text (hostile snapshot test).

## 12. Test plan

- Vitest: reducer table tests for all state transitions; mapper tests per kind; paused guard; idempotency key reuse on retry.
- Playwright scenario `approval-pending` in CHATUI035: approve, deny, expire (via `pushEvent`), decided on Telegram, paused.
- Storybook: `Pending`, `Submitting`, `Decided`, `Expired`, `DecidedElsewhere`, `Checking`, `PausedDisabled`, `GitPush`, `AccessRequest`. Command: `pnpm --filter @overmind/desktop test features/chat/approvals/card`.

## 13. Parallelization notes

Owns `chat-cards.json` (CHATUI014, 015, 016 add their keys through their own keyed sections: to avoid conflicts they write ONLY under the top-level objects `permanent.*`, `rule.*`, `proposal.*` respectively and coordinate by rebasing; if conflicts become frequent split the file via proposal). Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Owner decision needed: the mock offers `Zezwól na stałe` on a new-domain Approval, but PERM012 states that per-host permanent allowances are not in MVP. Default until answered: the permanent button is shown only for Access Requests (folders).
- ASSUMPTION: the E26 label `Zezwalaj na stałe w tym Workspace` replaces `Zezwól na stałe` where permanent grants are offered.
