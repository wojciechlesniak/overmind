---
id: OVE_PAUSE012
title: "Block work-starting controls while paused: composers, quick actions and Approval buttons"
area: PAUSE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS048, OVE_DS055, OVE_PAUSE010]
soft_depends_on: []
provides: ["lib:use-pause-guard", "ui:PausedReason"]
needs: ["ui:ChatComposer", "ui:ApprovalActions", "ui:ApprovalCard", "lib:use-pause"]
owns: ["apps/desktop/src/features/pause/guard/**"]
reads: []
design: design.png
design_source: "Chief#chief/composer-area (crop 351,782,780,120); design-approvals.png = Zgody#appr/decision-panel (crop 460,532,952,118)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 6]
---

# OVE_PAUSE012: Block work-starting controls while paused: composers, quick actions and Approval buttons

## 1. Summary

Provides `usePauseGuard(workspaceId)` and the `PausedReason` text so every chat composer, quick action, Discussion composer and Approval action button reflects the engine's pause rules: composers show a reason line and are disabled; 'approve' buttons are disabled while 'deny' stays enabled.

## 2. Context

Inventory E33: 'disable composers and Approval buttons that start work' during Global Pause. The engine already rejects these actions with `pause.paused` (OVE_PAUSE005); the UI must tell the Owner why instead of failing after a click. The view features (CHATUI, DISCUI, APPRUI, AGUI) own their screens; this task gives them one tested hook and component so no view invents its own copy (DRY).

## 3. Scope (in)

- `usePauseGuard(workspaceId?)` hook.
- `PausedReason` small text component (icon + sentence) used in disabled composers and under disabled approve buttons.
- Mapping of which controls are blocked/allowed (table in code and docs).
- Integration helpers: `composerPauseProps(guard)` returning `{ disabledReason }` for `ui:ChatComposer`, `approvalActionsPauseProps(guard)` returning disabled flags for `ui:ApprovalActions`.

## 4. Out of scope

- Adopting the helpers inside CHATUI/DISCUI/APPRUI/AGUI screens: those areas (they need `lib:use-pause-guard`).
- Engine enforcement: PAUSE005 and the consumers of `PauseGate`.

## 5. Detailed requirements

1. **Hook:**
   ```ts
   interface PauseGuard {
     blocked: boolean;                     // global OR this Workspace paused
     by: 'global' | 'workspace' | null;
     phase: 'running'|'pausing'|'paused';
     reason: string | null;                // localised, e.g. 'Wszystko wstrzymane (Global Pause)'
     canDeny: true;                        // denying/cancelling is always allowed
   }
   usePauseGuard(workspaceId?: string): PauseGuard
   ```
   Reason texts (pl / en): global `Wszystko wstrzymane (Global Pause)` / `Everything is paused (Global Pause)`; Workspace `Ten Workspace jest wstrzymany` / `This Workspace is paused`.
2. **Composer rule:** when `blocked`, pass `disabledReason = reason` to `ui:ChatComposer` (the DS keeps the typed text, replaces the placeholder with the reason and disables textarea, send and quick actions; DS requirement 7 of OVE_DS048). Applies to the Chief composer, direct Agent composers and the Discussion Owner-voice composer. The composer's draft text is preserved.
3. **Approval rule:** when `blocked`, approve-type actions (allow this Run, allow permanently, and the Access Request grants) are rendered disabled with `PausedReason` under the row ('Wznów, aby zatwierdzić.'); 'Odmów' and 'Odmów z komentarzem' stay enabled (denying reduces activity). If `ui:ApprovalActions` lacks a per-action `disabled` input, this task files a proposal `tasks/_proposals/OVE_PAUSE012-approval-actions-disabled.md` for OVE_DS055 and implements the adapter with `disabled` on the whole group except deny via the existing `submitting` pattern; it must not fork the component.
4. **Allowed while paused (documented in the hook's JSDoc and in `docs/architecture/pause.md` by reference):** reading all views, opening chat history, deny, Run cancel, backups, notifications, settings. **Blocked:** sending to Chief or Agents, quick actions that start a turn, starting a Run, starting a Discussion, approving requests, 'Resume Run'.
5. A pending submit that races with a pause: the engine answers `pause.paused`; the UI maps the error to an inline `PausedReason` (not a generic error toast) and keeps the typed text.
6. `PausedReason` is `role="status"`-free (the banner already announces); it is linked to the disabled control with `aria-describedby`.
7. i18n keys in `pause.json`: `guard.global`, `guard.workspace`, `guard.approveHint` ('Resume to approve.' / 'Wznów, aby zatwierdzić.'), `guard.pausingHint`.

## 6. Design notes

`design.png` shows the Chief composer area (quick-action chips 'Pokaż Tablicę', 'Zacznij Dyskusję', 'Podsumuj dzień' and the 22px-radius composer with the magenta send button; the mock clips the lower edge). `design-approvals.png` shows the Approval decision row: amber primary 'Zezwól tym razem', amber outline 'Zezwalaj na git push w tym Workspace', neutral 'Odmów z komentarzem' and the amber note about Telegram. Paused derivation (not in a mock): composer = DS disabled state, placeholder replaced by `Wszystko wstrzymane (Global Pause)` in `text-muted`, chips `aria-disabled` at opacity .5; approvals = the two amber buttons disabled (opacity .5, no glow) with the hint line `Wznów, aby zatwierdzić.` in `text-muted` 12px under the row, deny button unchanged. The amber note line stays. No new colours.

## 7. Reuse

- `ui:ChatComposer` `disabledReason` (OVE_DS048), `ui:ApprovalActions` (OVE_DS055), `usePause` (OVE_PAUSE010). No per-view copies of the reason strings.

## 8. Architecture and code placement

`apps/desktop/src/features/pause/guard/{use-pause-guard.ts,PausedReason.tsx,composer-props.ts,approval-props.ts}` exported as a public API of the feature (barrel). View features import from the barrel; this feature never imports view features (dependency direction: views -> pause guard).

## 9. Security and safety

- All pause state comes from the gateway; the UI never stores 'paused' in localStorage or decides authority itself (the engine enforces; the UI only reflects).
- All strings are rendered as React text nodes; no HTML injection; labels come from i18n keys with only numeric and Workspace-name params (Workspace names are untrusted text, truncated with ellipsis).
- A failed pause call is shown as an error and the button returns to its previous state; the UI never shows 'paused' before the engine confirmed (no optimistic state), because a false sense of safety is worse than a delay.
- The guard is a UX aid only: the authoritative check is the engine's `PauseGate`; tests include a case where the UI is stale and the engine rejects, and the UI recovers.
- Approve controls must be disabled, not merely hidden, so keyboard users get the explanation through `aria-describedby`.

## 10. Errors and edge cases

- Workspace id unknown (dashboard): only the global rule applies.
- Pause lifted while the Owner typed a draft: composer re-enables, draft intact.
- `phase: 'pausing'`: composers are already blocked (new work must not start); the hint reads the pausing sentence.
- Approval decided elsewhere meanwhile: the DS `decided-elsewhere` state wins over the pause hint.
- Multiple composers on one screen (Chief and Discussion panes): all use the same guard instance via the shared store.

## 11. Acceptance criteria

- [ ] Given global paused, Then the Chief composer is disabled, shows 'Wszystko wstrzymane (Global Pause)' and keeps its typed text.
- [ ] Given Workspace A paused, Then only A's composers are disabled; B's remain enabled.
- [ ] Given paused, Then 'Zezwól tym razem' and the permanent approval are disabled with the hint and 'Odmów z komentarzem' is enabled.
- [ ] Given the engine rejects a send with `pause.paused`, Then the composer shows the reason inline, not a generic error.
- [ ] axe clean; disabled controls expose the reason through `aria-describedby`.
- [ ] `composerPauseProps` and `approvalActionsPauseProps` are covered by unit tests and used in at least the Storybook composition stories.

## 12. Test plan

Unit: `use-pause-guard.test.ts` (matrix global/workspace/pausing), `composer-props.test.ts`, `approval-props.test.ts`; component tests `PausedReason.test.tsx`; Storybook compositions with ChatComposer and ApprovalActions in paused state (visual baselines derived from the two crops with the paused modifications reviewed by the Owner); Playwright `pause-composer.spec.ts` (mock gateway). Commands: `pnpm --filter desktop test pause`.

## 13. Parallelization notes

Parallel with OVE_PAUSE011, 013, 014, 015. The adopting view tasks (CHATUI, DISCUI, APPRUI, AGUI) depend on this one; each edits only its own view.

## 14. Open questions and assumptions

- ASSUMPTION (see OVE_PAUSE005): approvals are blocked while paused. If the Owner prefers 'record now, release on resume', only the approval rule here and in `PauseGate.guard('approve_request')` change.
- If `ui:ApprovalActions` cannot disable single actions, a DS change request via proposal is required before the approval part can ship.
