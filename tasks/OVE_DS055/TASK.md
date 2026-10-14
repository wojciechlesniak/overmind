---
id: OVE_DS055
title: Build ApprovalCard (inline Approval in the Chief thread, five states)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS020, OVE_DS022, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:ApprovalCard", "ui:ApprovalActions"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Button", "ui:SectionLabel", "ui:StatusText"]
owns: ["packages/ui-kit/src/approvals/ApprovalCard/**"]
reads: []
design: design.png
design_source: "Chief#chief/approval-card (crop 375,583,732,177 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 6, 21, 26]
---

# OVE_DS055: Build ApprovalCard (inline Approval in the Chief thread, five states)

## 1. Summary

Builds the inline Approval card: amber glow card with kind/Agent/Run label, expiry, title, explanation with inline mono code and the three actions (allow for this Run, allow permanently in this Workspace, deny), plus the states the mock does not draw: submitting, decided (collapsed result line), expired and decided elsewhere (Telegram). `ApprovalActions` is exported for reuse by the Approval detail.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Chief.dc.html` and its 2x render `_design/views/Chief.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C3.1 (ApprovalCard) and B1 approve variants, E8, E26. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Approvals are the default consent list (delete files, git push, publish, outbound messages, payments, new domain, budget exceeded; ADR 0021). Only the Owner grants permissions (ADR 0003). From Telegram only a per-Run approval exists (ADR 0006); the permanent grant exists only on desktop and changes Owner Rules (so it is a security-sensitive control). Approval states are shared between desktop and Telegram: when decided elsewhere, the card must reflect that (acceptance criterion 13).

## 3. Scope (in)

- `ApprovalCard` with 5 states; `ApprovalActions`; stories for kinds git-push, new-domain, delete.

## 4. Out of scope

- Approval list rows (OVE_DS056), detail pane (OVE_DS058), Telegram approval bubble (OVE_DS086).
- Deny-with-comment dialog and confirmations (feature, `ui:Dialog`).
- Any engine call or permission logic.

## 5. Detailed requirements

1. Props:
   ```ts
   type ApprovalCardState = 'pending' | 'submitting' | 'decided' | 'expired' | 'decided-elsewhere';
   interface ApprovalActionSpec { label: string; onClick: () => void }
   interface ApprovalCardProps {
     kind: ApprovalKind;
     state: ApprovalCardState;
     heading: string;                 // 'ZGODA · SECURITY · RUN #14' (SectionLabel, amber)
     expiryLabel?: string;            // 'wygasa za 25 min' (mono 11 amber)
     title: string;                   // 'Wejście na nową domenę: registry.npmjs.org' 17/700
     description: ReactNode;          // 13/1.45 #E9D2AE with <code> inline mono
     allowRun: ApprovalActionSpec;    // 'Zezwól na ten Run'
     allowPermanent?: ApprovalActionSpec;  // omitted => button not rendered (policy forbids or Telegram-only context)
     deny: ApprovalActionSpec;        // 'Odmów'
     result?: { verdict: 'allowed-run' | 'allowed-permanent' | 'denied'; text: string; time?: string; channel?: string };
     labels: { pendingHint?: string; expired: string; decidedElsewhere: string };
   }
   ```
2. State `pending`/`submitting` (the drawn state): `ui:Card` tone `approval` (1.5px #FFB547, gradient 160deg #2A1D0C -> #170F1A 70%, radius 22 in the thread, `glow-card-approval` 0 0 40px rgba(255,181,71,.18)), padding 18, column gap 14. Header row: `heading` as `SectionLabel` amber (mono 10/500, +0.08em) and `expiryLabel` right (mono 11 amber `#FFCF85`). Title 17/700 `text-primary`. Description 13/1.45 `#E9D2AE`; inline `<code>`-like mono 12 in `text-primary`.
3. Actions row (`ApprovalActions`): flex gap 10, wrap. Sizes per E8: `lg` = height 44, radius 14, label 14/700 or 600. `allowRun` = `Button` `approve-amber` (fill #FFB547, text `ink-amber` #1A1005, padding 0 18, 14/700); `allowPermanent` = `approve-amber-outline` (1px #6B4E22, text #FFE2B5, 14/600, padding 0 16) with the E26 normalised label supplied by the caller (`Zezwalaj na stałe w tym Workspace`); `deny` = `deny-outline` (1px #3A2E44, text #D9C7EA/#E3DAF0, 14/600, padding 0 16). Order is fixed: allow once, allow permanent, deny; the primary emphasis stays on the narrowest grant (this Run), never on the permanent one.
4. `submitting`: all three buttons `disabled`, the clicked one shows the spinner (`loading`), card `aria-busy="true"`; there is NO optimistic transition: the card leaves this state only when the parent changes `state`. Double activation is impossible (disabled synchronously via local `useRef` guard before the parent re-renders).
5. `decided`: the card collapses (height animates 200ms, none under reduced motion) to a compact result line: `ui:Card` tone `nested`, padding 10 14, glyph (`✓` mint for allowed, `✗` error/grey for denied via `StatusText`), `result.text` (`Zezwolono na ten Run · 14:21`), optional channel (`z desktopu`). Permanent grants show the scope word explicitly (`na stałe w tym Workspace`). `expired`: neutral card (no amber glow), title struck? NO (no strike-through); label `labels.expired`, actions removed (an expired Approval can never be granted: fail closed; a new request is needed). `decided-elsewhere`: same as decided with the channel `Rozstrzygnięto w Telegramie · 14:19`, actions removed.
6. Expiry: the component does not run a timer; the caller updates `expiryLabel` and flips `state` to `expired` when the engine reports expiry (single source of truth). While `pending` the expiry label is `role="timer"`-less static text to avoid constant announcements.
7. Accessibility: root `<section aria-labelledby=titleId role="group">`; when a pending card is inserted the feature announces it via the thread live region; focus is NOT moved automatically (never steal focus to an approve button). Buttons are in DOM order allow-run, allow-permanent, deny so the destructive/narrow option is first reachable; Escape does nothing.
8. Responsive: the actions wrap in the card width; each button `min-width: 0` with text wrapping disabled (`white-space: nowrap`) and the row wrapping below 480px, so labels never truncate (they are the consent text).
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Chief inline card (`ZGODA · SECURITY · RUN #14`, `wygasa za 25 min`, `Wejście na nową domenę: registry.npmjs.org`, description with mono `npm audit`, amber `Zezwól na ten Run`, outlined `Zezwól na stałe` (E26: relabel), outlined `Odmów`). Not in the mock and derived: submitting, decided, expired, decided-elsewhere, focus ring (violet ring is visible on amber: use the 2px `bg-app` gap), hover (amber +6% brightness with amber glow), disabled (opacity .45), kinds delete (`danger`-tinted label) and git-push (command shown in a mono block: `ui:Card` tone `terminal` with `git push origin dev/...`).

## 7. Reuse

Consumes `ui:Card` (`approval`, `nested`), `ui:Button` variants `approve-amber`, `approve-amber-outline`, `deny-outline`, `ui:SectionLabel`, `ui:StatusText`. `ApprovalActions` is reused by OVE_DS058 (size `xl` 46 per the Approvals page).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Approval is the product's main safety UI. Rules: (1) the card shows exactly what is requested (title + explanation + optional command) and who/where (`heading` includes Agent and Run); never truncate the title or command to hide a long domain/path (wrap instead); (2) a permanent grant is never the default or visually primary; (3) expired and decided states remove all grant buttons (fail closed, no resurrection); (4) the component never sends anything: `on*` callbacks go to the feature, which re-validates server-side that the Approval is still pending and unexpired; (5) the description is agent-written text (prompt-injection possible): rendered as text, with inline code only via structured `description` nodes provided by the caller, never parsed from the string; (6) bidi/control characters in titles are the feature's job to neutralise with the shared sanitiser, but the component sets `unicode-bidi: plaintext` on title and code to limit visual spoofing.

## 10. Errors and edge cases

- Both `allowRun` handler and state `expired` -> buttons not rendered at all.
- `allowPermanent` omitted -> two-button layout, no gap.
- Very long domain or command -> wraps (`overflow-wrap: anywhere`), card grows; buttons stay visible.
- State flips from pending to decided while a click is in flight -> clicks after the flip are impossible (buttons gone).
- `result` missing while `decided` -> generic text from labels is not invented: renders `heading` only plus a dev warning.
- Two cards for the same Approval id in the thread -> the feature de-duplicates (documented).

## 11. Acceptance criteria

- [ ] Given the pending fixture, Then the three buttons are 44px high with radius 14 and the card has the amber 1.5px border + glow (matches `design.png`).
- [ ] Given a click on `allowRun`, Then state `submitting` disables all buttons and `onClick` fires exactly once even with a second synchronous click.
- [ ] Given `state="expired"`, Then no grant button is in the DOM.
- [ ] Given `state="decided"` with `result.verdict="allowed-permanent"`, Then the line contains the scope text and a `✓` glyph.
- [ ] Given keyboard Tab, Then focus order is allow-run, allow-permanent, deny with visible rings.
- [ ] axe clean in all five states.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit: state machine render table (5 states x 3 kinds), double-click guard, no-grant-after-expiry assertion (DOM query for buttons).

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION (E26): the permanent label is `Zezwalaj na stałe w tym Workspace` everywhere on desktop; Telegram has no permanent option.
- OPEN: whether `allowPermanent` should require a second confirmation click inside the card; default: confirmation dialog owned by the feature.
- DESIGN GAP: decided/expired/elsewhere visuals are derived (E30-like).
