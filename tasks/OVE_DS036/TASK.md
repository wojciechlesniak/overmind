---
id: OVE_DS036
title: "Dialog: confirm, destructive and form"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS013, OVE_DS014, OVE_DS015, OVE_DS026, OVE_DS028]
soft_depends_on: []
provides: [ui:Dialog, ui:ConfirmDialog]
needs: [ui:icons]
owns: [packages/ui-kit/src/overlays/Dialog/**]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 9, SPECIFICATION 13]
adr_refs: [3, 15]
---

# OVE_DS036: Dialog: confirm, destructive and form

## 1. Summary

Implement the modal `Dialog` (compound: Dialog, DialogHeader/Body/Footer, close button) and the `ConfirmDialog` convenience in three variants: `confirm`, `destructive` (typed confirmation phrase, safe default focus) and `form`.

## 2. Context

Inventory B16 (not in the mocks). Needed for: deny with comment, confirm Delete Workspace (type the name), Cancel Run, Stop Agent, Replay, New Workspace, Pull Ollama model, pairing code, import Skill. Spec: scrim `rgba(10,7,16,.72)` (token `--om-color-scrim`), dialog radius 22, fill `#140F20`, 1px `#2A2040`, padding 24, width 480 (sm 400, lg 640), title `title-22` (22/700/-0.2, E7), body 14px `#A79BBF`, actions right-aligned (secondary left, primary/danger right), `shadow-popover`, focus trap, Esc closes unless a destructive action is in progress. ADR 0003 (deny by default) and ADR 0015: destructive actions need friction; a mis-click must not confirm them.

## 3. Scope (in)

- `Dialog`, `ConfirmDialog`, parts, focus management, scroll lock, stories (confirm, destructive, form, long content, busy), tests, visual baseline without a design crop.
- Typed-phrase gate for destructive variant.

## 4. Out of scope

- Concrete dialogs (Delete Workspace copy, Pull Ollama form fields): apps / part 2 features.
- Non-modal panels: `Popover` (OVE_DS028). Toasts: OVE_DS037.

## 5. Detailed requirements

**5.1 API**
```ts
interface DialogProps { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; size?: 'sm' | 'md' | 'lg'; busy?: boolean; dismissible?: boolean /* default true */; role?: 'dialog' | 'alertdialog'; initialFocus?: 'first' | 'cancel' | RefObject<HTMLElement>; children?: ReactNode; footer?: ReactNode; closeLabel?: string }
interface ConfirmDialogProps extends Omit<DialogProps, 'children' | 'footer' | 'role'> {
  variant?: 'confirm' | 'destructive'; confirmLabel: string; cancelLabel: string; onConfirm: () => void | Promise<void>;
  confirmPhrase?: string; confirmPhraseLabel?: ReactNode; confirmPhraseHint?: ReactNode; children?: ReactNode }
```
**5.2 Visual (exact)**: scrim fixed full-screen `--om-color-scrim` (`rgba(10,7,16,.72)` as token), centered flex; panel `width: min(480px, calc(100vw - 32px))` (sm 400, lg 640), `max-height: calc(100vh - 64px)`, `border-radius: 22px`, `background: #140F20`, `border: 1px solid #2A2040`, `padding: 24px`, `box-shadow: var(--om-shadow-popover)`, `z-index: var(--om-z-dialog)`. Header: title `title-22` (22/700/-0.2 tracking) `text-primary`, optional description 14px/1.5 `text-secondary` `#A79BBF` (gap 8), close `IconButton` (OVE_DS015) `close` icon top-right 36px with `aria-label` from UiLabels `close`. Body scrolls independently (`overflow-y: auto`, header and footer pinned). Footer: `display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px`; secondary (Cancel) first, primary/danger last (right). Motion: panel opacity 0->1 and scale .98->1 over `--om-duration-base`, scrim fade; none under reduced motion.
**5.3 Behaviour**: `FloatingFocusManager` (modal): focus trap, initial focus on the first tabbable (or the explicit target), focus returns to the opener on close; Tab/Shift+Tab cycle; background gets `inert`/`aria-hidden`; body scroll locked (`FloatingOverlay lockScroll`) with scrollbar compensation; scrim click and Escape call `onOpenChange(false)` only if `dismissible && !busy`. `busy` disables close button, Escape, scrim click and Cancel (shows spinner in the confirm button).
**5.4 `ConfirmDialog` variants**
- `confirm`: `role="dialog"`, footer = `Button secondary` (cancel) + `Button primary-violet` (confirm). Initial focus on the confirm button.
- `destructive`: `role="alertdialog"` with `aria-describedby` the description; footer = `Button secondary` + `Button danger` (OVE_DS014); initial focus on CANCEL (safe default); if `confirmPhrase` is set, a `TextField` (OVE_DS026) "type X to confirm" is shown (label `confirmPhraseLabel`, hint `confirmPhraseHint`) and the danger button stays `disabled` (with `aria-disabled` and reason text) until the input equals the phrase: comparison is exact, case-sensitive, after Unicode NFC normalisation and trimming only outer whitespace; paste allowed; `autocomplete="off"`, `spellcheck=false`. Enter in the input confirms only when the phrase matches. A destructive confirm triggers `onConfirm` once (guards double activation until it resolves).
- `form` (use `Dialog` directly): footer buttons wired by the caller; Enter submits the wrapping `<form>`; closing with unsaved changes is the caller's decision (`dismissible={false}` or intercept `onOpenChange`).
**5.5 States**: confirm button loading (Promise pending): `loading` prop of Button, `busy` true; error returned by `onConfirm` (thrown) keeps the dialog open and shows `errorMessage` slot `role="alert"` (prop `error?: ReactNode`).
**5.6 a11y**: `aria-modal="true"`, `aria-labelledby` the title, `aria-describedby` the description; title is a heading (`h2`); no auto-announcement beyond the dialog role; contrast: body `#A79BBF` on `#140F20` 6.3:1.

## 6. Design notes

No mock exists. Spec is inventory B16 plus 5.2. A `Dialogs/Gallery` story is the reference for design review; the visual baseline is a snapshot of that story.

## 7. Reuse

`Button` and tones (OVE_DS013/014), `IconButton` (OVE_DS015), `TextField` (OVE_DS026), floating layer and portal root (OVE_DS028), `Text` title style (OVE_DS005).

## 8. Architecture and code placement

`packages/ui-kit/src/overlays/Dialog/{Dialog.tsx,ConfirmDialog.tsx,Dialog.module.css,index.ts}`. `ConfirmDialog` composes `Dialog` (no duplicated focus logic).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Dialogs guard destructive and permission actions: (1) destructive default focus is Cancel so a stray Enter cannot confirm; (2) the typed phrase gate prevents one-click deletion of a Workspace; (3) while `busy` nothing can dismiss the dialog, avoiding half-finished destructive flows with an unknown outcome; (4) `onConfirm` is invoked once per open; (5) dialog text is rendered as text (the Workspace name typed or shown is Owner/Agent controlled).

## 10. Errors and edge cases

- Two dialogs open (e.g. confirm over a form): stacked via floating-ui tree; Escape closes the topmost only.
- Opener unmounted: focus returns to `body`/document title region.
- Content taller than viewport: body scrolls, footer stays visible.
- `onConfirm` rejects: dialog stays open, `error` displayed, `busy` cleared.
- Reduced motion: no animation; forced colours: border `CanvasText`.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Dialog/ConfirmDialog` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Panel 480 (sm 400, lg 640), r22, `#140F20`, border `#2A2040`, padding 24, scrim token, popover shadow, title 22/700.
- [ ] Focus trap, initial focus rules (confirm: confirm button; destructive: Cancel), focus returns to opener, Escape/scrim dismiss only when allowed.
- [ ] Destructive confirm is disabled until the exact phrase is typed (NFC, case-sensitive); double activation blocked.
- [ ] `busy` blocks every dismissal path; rejected `onConfirm` keeps the dialog open with the error shown.
- [ ] Body scroll lock and background `inert` verified.

## 12. Test plan

- Vitest + Testing Library + user-event in `overlays/Dialog.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test Dialog` and `pnpm --filter @overmind/ui-kit test:visual Dialog`.
- Table test for phrase matching (NFC vs NFD, trailing spaces, case).

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Depends on OVE_DS028 for the portal and floating-focus utilities.

## 14. Open questions and assumptions

- ASSUMPTION: destructive dialogs use `alertdialog` and default focus Cancel (ADR 0003 spirit).
- ASSUMPTION: phrase comparison is exact after NFC and outer trim.
- Open: unsaved-changes interception for form dialogs is the feature's responsibility.
