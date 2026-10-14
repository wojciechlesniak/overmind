---
id: OVE_WSPACE023
title: "Owner Rules section: list, edit and create with Local Approval"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA015, OVE_DS013, OVE_DS017, OVE_DS023, OVE_DS026, OVE_DS040, OVE_DS078, OVE_DS082, OVE_WSPACE014, OVE_WSPACE015, OVE_WSPACE017, OVE_WSPACE018]
soft_depends_on: []
provides: ["lib:rules-areas-context"]
needs: ["ui:SettingsSection", "ui:OwnerRuleRow", "ui:Field", "ui:Textarea", "ui:Switch", "ui:Pill", "ui:Button", "ui:InfoNote", "lib:use-local-approval", "api:owner_rules.list", "api:owner_rules.create", "api:owner_rules.edit", "api:owner_rules.history"]
owns: ["apps/desktop/src/features/workspace-settings/components/sections/Rules.section.tsx", "apps/desktop/src/features/workspace-settings/model/rule-rows.ts", "apps/desktop/src/features/workspace-settings/components/RuleEditor.tsx", "apps/desktop/src/features/workspace-settings/components/rules-areas/context.ts"]
reads: []
design: design.png
design_source: "Workspace#ws/rules-section rows (crop 328,826,1004,300 CSS px, tall render)"
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 2"]
adr_refs: [16, 3]
---

# OVE_WSPACE023: Owner Rules section: list, edit and create with Local Approval

## 1. Summary

Implements the 'Reguły Właściciela' section: the list of Owner Rules (R1, R2, ...) shown whole, the edit mode, creating a new rule and the conflict handling, with every change confirmed through Local Approval.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock regions `ws/rules-section`, `ws/rule-row` (R1 with 'Edytuj'), `ws/rule-row-invoked` (R2 with 'Ostatnio powołany: QA odmówił wyłączenia testu · 14:21'), R3. Description: 'Obowiązują wszystkich i niczym ich nie osłabisz. Zmienia je tylko Właściciel.' Spec 6: Owner Rules bind everyone; only the Owner changes them; Chief may only propose (ADR 0016). DATA015 routes: `GET /v1/owner-rules?workspaceId=`, `POST /v1/owner-rules`, `PATCH /v1/owner-rules/{id}` with `expectedVersion`, `GET /v1/owner-rules/{id}/history`. `OwnerRule`: `id, workspaceId|null, title(1..120), text(1..4000), consentOverrides[], active, version`.

## 3. Scope (in)

- `components/sections/Rules.section.tsx` (id `rules`, order 40) hosting the list, the proposals slot and the consent-exceptions slot (separate tasks plug into named areas).
- `model/rule-rows.ts`: rules -> `OwnerRuleRowProps[]` (R-label, text, scope badge, last-invoked line).
- `components/RuleEditor.tsx` (inline expand editor) and 'Add rule' button + create flow.
- History popover (read-only versions).

## 4. Out of scope

- Proposal banner (OVE_WSPACE024), consent-exception chips (OVE_WSPACE025).
- Checking a rule against Project Documentation by the model (CHIEF).

## 5. Detailed requirements

1. List: `ui:OwnerRuleRow` per rule (id mono 'R1' in a meta `Pill`, text 14/1.45 NEVER truncated, optional note line, ghost 'Edytuj'). Display label `R<n>` = 1-based position ordered by `createdAt` among rules visible here (ASSUMPTION: the contract has no short id; the label is not stable across deletions: the row title attribute carries the real id prefix). Global rules (`workspaceId:null`) get a `Pill` 'Global' / 'dla wszystkich Workspace\'ów' and are listed after the Workspace rules.
2. Last-invoked note (mock R2): shown only when the engine provides `lastInvokedLabel` (ASSUMPTION: Chief/CHAT010 refusal events `chat.rule_refusal` carry rule id + short text + time and DATA/CHIEF expose it through the rules list; NO owner found yet: gap). Without data nothing is rendered (no placeholder).
3. Inactive rule (`active:false`): row dimmed with the word 'inactive' (Pill) and a switch in the editor.
4. Edit: 'Edytuj' expands an inline editor under the row: `ui:Field` Title (1..120) + `ui:Textarea` Text (1..4000, counter, autosize), toggle Active, buttons 'Save' (`primary-violet sm`) and 'Cancel'. Rules are Owner-authored text: the editor shows a hint 'Rules bind Chief and all Agents and cannot be weakened by anything but you.' Save -> `useLocalApproval().run({ operation:'owner_rule.edit' , args:{ ruleId, workspaceId, title, text, active }, call:(proof,args)=> editRule({...args, expectedVersion, localProof: proof}) })` (ASSUMPTION per PERM031 registry; see section 14). The approval summary shows the OLD and NEW text side by side (describer) so the Owner sees what is weakened or strengthened.
5. Create: 'Add rule' (`secondary md`, plus) below the list opens the same editor in create mode (new row at the end): `POST /v1/owner-rules` with `{ workspaceId, title, text }`; approval operation `owner_rule.edit` with `ruleId:null`. `consentOverrides` are NEVER edited here (only OVE_WSPACE025 lifts requirements).
6. Deactivate/delete: no delete in MVP (history is append-only); deactivation via the Active switch (needs approval like any edit because it can weaken rules).
7. History: a small 'History' text button in the editor shows the last 10 versions (`GET /history`) with date and diff-free full texts; read-only.
8. Conflict with Project Documentation: after saving, if the engine returns a warning `rules.doc_conflict` (CHIEF check, ASSUMPTION optional) the UI shows an `InfoNote` 'This rule may conflict with docs/spec.md. Owner Rules take precedence over documentation (ADR 0016).' It never blocks saving.
9. Version conflict: `data.version_conflict` -> reload the rule, keep the Owner's draft text in the editor and show 'Changed elsewhere: review before saving' (OVE_WSPACE031 pattern); the retry requires a NEW approval.
10. Empty list: `EmptyState` small 'No rules yet. Chief follows only the project documentation.' + Add rule.
11. Keyboard: editor opens with focus on the title; Escape cancels (confirm if dirty); Cmd+Enter saves (still shows approval).

## 6. Design notes

`design.png`: three rule rows in `#16111F`-like inset rows r16 (padding 14 18, 66/71px), mono 'R1' in magenta-tint pill, text 14/1.45, ghost 'Edytuj' right. Not in the mock: editor, create, history, inactive, global badge, empty, loading, approval summary.

## 7. Reuse

- `ui:SettingsSection`, `ui:OwnerRuleRow` (OVE_DS082), `ui:Field`, `ui:TextField`, `ui:Textarea`, `ui:Switch`, `ui:Pill`, `ui:Button`, `ui:InfoNote`.
- `useOwnerRules`, `useVersionedMutation` (OVE_WSPACE018), `useLocalApproval`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: Owner Rules are the top of the precedence chain (spec 2.4): changing them is Owner-only and desktop-only. The UI never edits a rule from any automated source: Chief proposals are applied only by the explicit Accept (OVE_WSPACE024). Rule text is shown whole and as plain text (never Markdown/HTML) so a crafted rule cannot hide content. A rule text sent by the Owner is not interpreted by the UI.

## 10. Errors and edge cases

- Rule text with 4000 chars: editor scrolls; row shows full text.
- Rule edited in another window: push `owner_rule.changed` refreshes; if the editor is open, banner 'changed elsewhere'.
- Approval cancelled: draft kept.
- Rule list > 50: scrolls inside the section (virtualisation not needed under 200).
- Global rule edit from a Workspace page: allowed, warned 'applies to all Workspaces' (`ui:InfoNote`).

## 11. Acceptance criteria

- [ ] Given the mock rules, Then rows match `design.png` and text is never truncated.
- [ ] Given Edit + Save, Then Local Approval shows old/new text and only then one PATCH with `expectedVersion` and `localProof` is sent.
- [ ] Given Cancel in approval, Then the draft stays and nothing is sent.
- [ ] Given create, Then a POST is sent after approval with no `consentOverrides`.
- [ ] Given a version conflict, Then the draft is kept and a new approval is required.
- [ ] Given a global rule, Then the 'applies to all Workspaces' notice is shown when editing.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `rule-rows.test.ts`, `RuleEditor.test.tsx` (validation, dirty cancel, conflict), `Rules.section.test.tsx`, `describer.owner_rule_edit.test.ts` (old/new shown), Playwright `owner-rules.e2e.ts`. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/rules, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/sections/Rules.section.tsx`, `apps/desktop/src/features/workspace-settings/model/rule-rows.ts`, `apps/desktop/src/features/workspace-settings/components/RuleEditor.tsx`, `apps/desktop/src/features/workspace-settings/components/rules-areas/context.ts`; local-approval describer `owner_rule.edit` is requested by proposal file to OVE_WSPACE014 owners (one file `describers/owner_rule_edit.describer.ts`, listed in section 14)` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: `owner_rule.edit` operation requires Local Approval for all edits (PERM031 registry) although DATA015 text only requires it for consent-override increases: raise with DATA/PERM owners (final report).
- ASSUMPTION: 'R<n>' label is positional.
- GAP: last-invoked data has no owner.
- The describer file for `owner_rule.edit` and the others (`workspace.delete`, `workspace.make_shared`, `override.lift`, `backup.folder.change`) is created by OVE_WSPACE014 as it lists them; this task supplies only the args shape.
