---
id: OVE_PROV013
title: Translate CLI permission dialogs into Overmind Approvals with a change preview
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_CHIEF015, OVE_ENGINE016, OVE_NOTIF004, OVE_PAUSE001, OVE_PERM013, OVE_PERM014, OVE_PROV005, OVE_PROV006, OVE_PROV008, OVE_PROV009, OVE_PROV034]
soft_depends_on: [OVE_PROV029, OVE_PERM006]
provides: ["usecase:TranslateCliDialogToApproval", "usecase:AnswerCliDialog", "lib:cli-dialog-parser"]
needs: ["usecase:RequestApproval", "event:approval.decided", "event:approval.expired", "contract:ApprovalRequest", "port:TerminalLayer", "port:PauseState", "port:AuditSink", "usecase:RaiseEscalation", "usecase:CreateNotification", "lib:redaction", "port:Clock", "port:EventBus"]
owns:
  - packages/domain/src/prov/cli-dialog/**
  - packages/application/src/prov/dialog/**
  - tasks/_proposals/OVE_PROV013-cli-permission-class.md
reads: ["docs/research/prototyp-wnioski.md", "tools/fake-cli/screens/", "packages/contracts/src/perm/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [3, 21, 22, 26]
---

# OVE_PROV013: Translate CLI permission dialogs into Overmind Approvals with a change preview

## 1. Summary

When a CLI shows its own permission window ("Do you want to make this edit to README.md? Yes / Yes for session / No"), Overmind turns it into an Approval with a preview of the change, waits for the Owner (desktop or Telegram, for the current Run only), and then types the single matching answer into the CLI, but only if the very same dialog is still on screen. Choice dialogs that are not permissions are never answered; they become an Escalation.

## 2. Context

ADR 0022: agents run in the CLI's automatic mode and the isolation is the boundary; a CLI window that still appears is converted into a Zgoda (Approval) with a change preview. Prototype 5A: herdr's `blocked` appears reliably for real permission dialogs; the screen holds the full diff (readable by `pane.read`), the terminal title holds the Task summary; the Owner's answer is typed as `1/2/3`. Approvals are single-use, hash-bound and expire (PERM013/PERM014); approvals from Telegram apply to the current Run only (ADR 0006). The default Approval list (ADR 0021) is separate: deletion, push, publish, messages, payments, new domain, budget; this task covers CLI-originated dialogs.

## 3. Scope (in)

- Dialog parser (pure, in the domain layer) for the Claude and Codex permission dialogs and for choice dialogs.
- `TranslateCliDialogToApproval`: registered as a `BlockedStateHandler` of the gateway; builds the Approval request.
- `AnswerCliDialog`: reacts to `approval.decided`/`approval.expired`, verifies the dialog fingerprint and types the answer.
- Escalation path for non-permission choice dialogs.
- A proposal for a new Approval action class.

## 4. Out of scope

- Approval storage, decision rules and UI (PERM013/PERM014/APPRUI), state classification (PROV006), the guard for ordinary prompts (PROV008), Owner answering of choice dialogs (post-MVP, open question), the Approval classes of ADR 0021 (PERM006).

## 5. Detailed requirements

1. **Dialog model:** `CliDialog = { kind: 'permission'|'choice'; cli: 'claude'|'codex'; action?: { type: 'edit'|'write'|'command'|'read'|'other'; target?: string /* <=300, display only */; commandExcerpt?: string /* <=400 */; diffExcerpt?: string /* <=2000, lines capped at 40 */ }; question: string /* <=200 */; options: { index: number; label: string; role: 'allow_once'|'allow_session'|'allow_always'|'deny'|'other' }[]; fingerprint: string }`. `fingerprint = sha256(normalised question + option labels + target + diff hash)`. Parsing is a pure function `parseDialog(screenTail, profile): CliDialog | null` with per-CLI rule files (OCP) in `packages/domain/src/prov/cli-dialog/profiles/`; roles are assigned by label patterns (for example `^Yes$` allow_once, `Yes, .*(session|always|don't ask)` allow_session/allow_always, `^No` deny).
2. **Translate:** on observation `waiting_approval` with `kind: 'permission'` the handler calls `RequestApproval` with `principal: system`, `class` per mapping, `structured` built from the parsed dialog (never from Agent text), `runId`/`agentId` of the session. Mapping: command dialogs whose command is recognised as `rm`/`git push`/`curl` to a new host map to `delete_files`/`git_push`/`new_domain` (so existing previews and rules apply, the parser only extracts those fields and the PERM rules decide); everything else uses the proposed class `cli_permission` (proposal file `tasks/_proposals/OVE_PROV013-cli-permission-class.md` asks PERM006/PERM013 for `cli_permission { cli, actionType, targetDisplay, commandExcerpt?, diffExcerpt? }` with a preview of up to 40 diff lines). Until PERM adds it, the handler falls back to raising an Escalation with the same preview data and never answers the dialog (fail safe).
3. **Dedupe:** one Approval per dialog fingerprint per Run (PERM dedupes by action hash); repeated observations of the same dialog do not create another. A new fingerprint creates a new Approval.
4. **Notification and waiting:** the Approval raises the usual notification (PERM014 `approval.requested` with sound); the Agent's state is `waiting_approval` (AGENT010). Nothing is typed meanwhile (guard blocks sends, PROV008).
5. **Answer (`AnswerCliDialog`):** on `approval.decided`: (a) re-read the screen and re-parse; the dialog must still be shown AND its `fingerprint` must equal the Approval's bound fingerprint (stored in `structured`), otherwise cancel with `provider.dialog_changed` (audit, Escalation to Chief, no typing); (b) pause check: when Global Pause is on only a `deny` answer may be typed, an approve is deferred (stays pending until Pause is lifted, or expires); (c) choose the option: approved gives the `allow_once` option; denied or expired gives the `deny` option; options with role `allow_session`/`allow_always` are never selected, so the CLI asks again next time (ADR 0003: no permanent widening by dialog); if no `allow_once` or `deny` option exists in the parsed dialog the answer is not typed and an Escalation is raised; (d) type only the option's key (digit and, if the profile requires, Enter) through `TerminalLayer.sendKey` (PROV005), limited by this module to digits `1-9`, `y`, `n` and `enter` (no free text possible); (e) afterwards read the screen: the dialog must be gone, otherwise audit `provider.dialog_answer_unconfirmed`; (f) `ConsumeApproval` is called only after step (e) shows the effect, so a failed typing leaves the Approval consumable once (single-use).
6. **Telegram:** decisions made from Telegram carry `channel: 'telegram'` and are valid for the current Run only; this task adds no logic, but the answer must not be typed for an Approval whose Run is no longer active (checked via `RunReader`).
7. **Choice dialogs (`kind: 'choice'`):** never answered by Overmind or an Agent. The handler raises an Escalation `cli_choice_dialog` with the question and option labels (display text, escaped, at most 500 chars) and a notification; Agent state shows `waiting_approval` with reason `cli_choice_dialog` (AGENT009). Resolution is by the Owner in the terminal outside Overmind or by a later feature (open question). The Agent's work does not resume until the observation changes.
8. **Prompt-injection stance:** the dialog text (file names, commands, diff) comes from the repository and the model and is shown only as escaped display data in the Approval; it cannot select options and cannot change the Approval class beyond the fixed mapping table; all excerpts are bounded and redacted.
9. **Audit:** `provider.dialog_detected`, `provider.dialog_answered { approvalId, role, confirmed }`, `provider.dialog_changed`, ids and roles only.
10. **Limits:** at most 5 open CLI-originated Approvals per Run (PERM limit applies; exceeding raises Escalation); parse time budget 50 ms per screen.

## 6. Design notes

N/A, functionality only. The Approval preview rendering belongs to APPRUI; this task only supplies `diffExcerpt`, `targetDisplay` and `commandExcerpt` as data.

## 7. Reuse

`RequestApproval`/`ConsumeApproval` and approval events (PERM013/PERM014), `classify` and dialog position rules (PROV006), `BlockedStateHandler` hook (PROV029), `TerminalLayer` (PROV005), escalation and notification use cases (CHIEF015, NOTIF004), redactor.

## 8. Architecture and code placement

Pure parsing in `packages/domain/src/prov/cli-dialog/{parse.ts,fingerprint.ts,roles.ts,profiles/claude.dialog.ts,profiles/codex.dialog.ts}`; use cases in `packages/application/src/prov/dialog/{translate.ts,answer.ts,mapping.ts}`. Keys are sent through `TerminalLayer.sendKey` (PROV005). No adapter imports.

## 9. Security and safety

The riskiest automation in the product: it types into a CLI on the Owner's behalf. Controls: only after an explicit Approval decision; only the same dialog (fingerprint match, re-read before typing); only `allow_once` or `deny`, never session or permanent options; only allow-listed keys; no typing while paused except deny; Approval single-use and bound to run, agent and fingerprint; text from the screen is escaped display data; a malicious README that prints `1. Yes` cannot cause approval because only a parsed live dialog at the bottom of the screen with the CLI's own structure counts and typing happens only after an Owner decision. Any mismatch results in no typing and an Escalation (fail closed).

## 10. Errors and edge cases

- The dialog disappears (CLI timed out or the Owner answered in another terminal): answer cancelled, Approval cancelled, audit.
- The CLI changes the dialog layout (new version): parser returns `null` and the classifier still says `waiting_approval`: Escalation with a generic message, nothing typed.
- Two dialogs stacked: bottom-most wins; the other becomes visible later with a new fingerprint.
- Approval expired: deny typed if the same dialog is still shown (safe direction), else dropped.
- Huge diff: preview truncated to 40 lines with a count of omitted lines.
- Owner approves twice (desktop and Telegram): second decision is idempotent (PERM014); a conflicting decision returns `perm.approval_not_pending`.

## 11. Acceptance criteria

- [ ] Prototype fixture (edit dialog with diff, options Yes / Yes for session / No) produces one Approval with the diff excerpt and `fingerprint`; approving types exactly one `1` (allow_once) and `ConsumeApproval` runs after the dialog disappears.
- [ ] Denying or expiry types the `deny` key; options with role session/always are never chosen (test over fixtures with reordered options).
- [ ] Changed dialog between request and decision: nothing typed, `provider.dialog_changed`, Escalation.
- [ ] Choice dialog ("Set up auto mode...") raises an Escalation and types nothing.
- [ ] While paused, approve is deferred and deny is typed; no key outside digits, `y`, `n`, `enter` is ever passed to `sendKey` by this module (type and property test).
- [ ] A README in the repo printing a fake dialog in old scrollback creates no Approval (position rule).
- [ ] No Approval summary contains raw unescaped screen text beyond the bounded excerpts; excerpts pass the redactor.

## 12. Test plan

Table-driven parser tests over real and synthetic screens; fingerprint stability tests; use-case tests with `FakeTerminalLayer`, fake Approval use cases and `FakeClock`; adversarial fixtures (injected dialog text, option reordering, ANSI tricks); property test: the set of keys ever sent is a subset of the allow-list. Commands: `pnpm vitest run packages/domain/src/prov/cli-dialog packages/application/src/prov/dialog`.

## 13. Parallelization notes

Can start after PROV006 profiles exist; the PERM class proposal is a cross-area dependency (not blocking: fallback Escalation). Hotspot: `TerminalLayer.ts` (`sendKey` is defined by PROV005).

## 14. Open questions and assumptions

- ASSUMPTION: PERM adds `cli_permission` (or accepts it from the proposal); until then dialogs mapped to existing classes work and others escalate.
- Open: should the Owner be able to answer a choice dialog from the app (list of options)? Not in the MVP; Escalation text tells the Owner to open the session terminal.
- Open: with auto mode as default, how often dialogs occur; if rare, the Escalation-only fallback is acceptable at launch.
