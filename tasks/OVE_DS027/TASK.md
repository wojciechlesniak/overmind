---
id: OVE_DS027
title: "ComposerShell and the send action"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS015, OVE_DS026]
soft_depends_on: []
provides: [ui:ComposerShell, ui:Composer]
needs: [ui:icons]
owns: [packages/ui-kit/src/forms/ComposerShell/**]
reads: []
design: design.png
design_source: "Chief#chief/composer (box 375,836.3,732,72); design-agentchat Czat-Agent#agentchat/composer (342,796,758,104)"
spec_refs: [SPECIFICATION 9]
adr_refs: [23]
---

# OVE_DS027: ComposerShell and the send action

## 1. Summary

Implement `ComposerShell`: the rounded message input container (textarea + trailing `SendButton` + optional leading/toolbar slots, disabled during Global Pause). It is the visual and a11y shell; message logic, mentions and quick actions are DS part 2 (UI-31).

## 2. Context

Inventory B10 `Composer`: container flex, gap 10, padding 10 10 10 16, radius 22, 1px `#3A2A5C` (`line-owner`), fill `#120D1C` (`bg-composer`), `glow-composer` shadow; textarea rows 2, 15px, transparent, padding 6 0; send button is `SendButton` (OVE_DS015); placeholder "Napisz do Chiefa... albo @qa". Used in Chief, Direct chat and Discussion (Owner voice). ADR 0023: direct chats with Agents exist; the composer is the same for all. Global Pause (E33): composers are disabled with a visible reason.

## 3. Scope (in)

- `ComposerShell` with slots, autosize textarea, Enter to send / Shift+Enter newline, disabled and busy states.
- Stories and tests.

## 4. Out of scope

- Mention picker, quick actions, attachments, draft persistence, slash commands: DS part 2 and apps.
- The send button itself: OVE_DS015.

## 5. Detailed requirements

**5.1 API**
```ts
interface ComposerShellProps {
  value: string; onValueChange: (v: string) => void; onSend: (v: string) => void;
  placeholder: string; label: string /* accessible name, required */;
  disabled?: boolean; disabledReason?: ReactNode; busy?: boolean; maxRows?: number /* default 8 */; minRows?: number /* default 2 */;
  leading?: ReactNode; belowSlot?: ReactNode; sendLabel: string; sendOnEnter?: boolean /* default true */ }
```
**5.2 Geometry (exact)**: container `display: flex; align-items: flex-end; gap: 10px; padding: 10px 10px 10px 16px; border-radius: 22px; border: 1px solid #3A2A5C (--om-color-line-owner); background: #120D1C (--om-color-bg-composer); box-shadow: var(--om-glow-composer)`; textarea: transparent, no border, `font: 15px/1.5 Bricolage`, `padding: 6px 0`, `rows` 2 (min height 2 lines), color `text-primary`, placeholder `text-muted`; `SendButton` 44x44 per OVE_DS015 aligned to the bottom. Container min height 72 (as the mock crop).
**5.3 States**
- focus-within: border `violet-500` plus `--om-ring-focus` on the container (focus belongs to the textarea; E19).
- hover: border `#5B3E8F`.
- disabled (Global Pause): container opacity .6, textarea `disabled`, send button disabled, `disabledReason` rendered above the container as a caption (12px `amber-300`) and linked by `aria-describedby`.
- busy (message being sent): send button `loading`, textarea stays editable but `onSend` ignored until `busy` clears.
- empty: send disabled (whitespace only counts as empty).
**5.4 Keyboard**: Enter sends (when `sendOnEnter`), Shift+Enter inserts a newline, Cmd/Ctrl+Enter always sends, Escape blurs only when empty; IME composition (`isComposing`) never sends. `aria-keyshortcuts="Enter"`. Label is a visually hidden `<label>` (E19/E20: pattern of the mock) with `label` text.
**5.5 a11y**: textarea has the accessible name; send button name from `sendLabel`; `aria-busy` while busy; the shell is not a form unless the parent wraps it.
**5.6 Autosize**: grows with content up to `maxRows`, then scrolls (`overflow-y: auto`); uses `field-sizing: content` where supported, otherwise a hidden mirror element measured in `useLayoutEffect`.

## 6. Design notes

`design.png`: the Chief composer 72px high, placeholder "Napisz do Chiefa... albo @qa" and the magenta send tile with glow on the right. `design-agentchat.png`: the same shell inside the Direct chat view (no quick actions). Not drawn: focus, disabled, busy, multi-line growth.

## 7. Reuse

`SendButton` (OVE_DS015), `fieldBox` text rules from OVE_DS026 are NOT reused (different geometry); Spinner via SendButton; tokens OVE_DS002/007.

## 8. Architecture and code placement

`packages/ui-kit/src/forms/ComposerShell/`. Controlled only (the value belongs to the app draft store). No mention parsing (open/closed: `belowSlot` and `leading` extension slots).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). The composer is the main prompt-injection entry for the Owner's text: it passes the string untouched, never interprets markup or commands, does not auto-send pasted text, and strips nothing silently. Disabled during Global Pause means keystrokes are not captured at all.

## 10. Errors and edge cases

- Paste of very large text (>100k chars): accepted, `maxLength` optional prop passthrough; no truncation by the shell.
- `onSend` throws: shell does not clear value (parent owns).
- Disabled while the user is typing: draft kept.
- Missing `label`: dev warning.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`ComposerShell` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Container: padding 10/10/10/16, r22, border `#3A2A5C`, fill `#120D1C`, composer glow; min height 72.
- [ ] Enter sends, Shift+Enter newline, IME composition does not send, empty/whitespace disables send.
- [ ] Disabled shows the reason text and removes all focusable controls from tab order except none.
- [ ] Autosize grows to `maxRows` then scrolls.

## 12. Test plan

- Vitest + Testing Library + user-event in `forms/ComposerShell.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test ComposerShell` and `pnpm --filter @overmind/ui-kit test:visual ComposerShell`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task.

## 14. Open questions and assumptions

- ASSUMPTION (E33): disabled composer shows a reason line; the Global Pause UI is designed later.
- Open: send shortcut is Enter (chat convention); a setting may change it later.
- Open: attachments are post-MVP.
