---
id: OVE_DS057
title: Build OwnerRuleRefusalCard and ChiefProposalCard (skill and rule proposals)
area: DS
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS022, OVE_DS031, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:OwnerRuleRefusalCard", "ui:ChiefProposalCard"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Button", "ui:Avatar", "ui:SectionLabel"]
owns: ["packages/ui-kit/src/chat/ProposalCards/**"]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/owner-rule-card (crop 404,575,587,124 CSS px); design-skill.png = Skille (crop 96,240,980,87); design-rule.png = Workspace, mock scrolled 600px (crop 361,1154,938,70)"
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 6", "SPECIFICATION 8"]
adr_refs: [15, 16, 12]
---

# OVE_DS057: Build OwnerRuleRefusalCard and ChiefProposalCard (skill and rule proposals)

## 1. Summary

Builds two decision cards that live in several views: `OwnerRuleRefusalCard` (an Agent refuses a command because an Owner Rule forbids it; actions 'Zmień Regułę' / 'Zostaw jak jest') and `ChiefProposalCard` (Chief proposes a new Skill or a new Owner Rule; Accept / Reject / View).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Czat-Agent.dc.html` and its 2x render `_design/views/Czat-Agent.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C3.5 and C3.6. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Owner Rules apply to everyone and cannot be weakened by anything except the Owner; chat commands cannot bypass them (SPEC 6). Chief may only PROPOSE rules and Skills; they take effect after the Owner accepts (ADR 0016: nothing is added on the agent's own initiative; ADR 0012: Skills from the internet only from the Owner). The proposal text is LLM-written and untrusted.

## 3. Scope (in)

- Both cards, states pending/accepted/rejected/busy, stories for skill and rule proposals and the refusal.

## 4. Out of scope

- The dynamic Agent proposal card (OVE_DS066), editing rules (WSPACE feature, OVE_DS082).
- Showing the full Skill content (callback `Zobacz treść` opens the feature panel).

## 5. Detailed requirements

1. `OwnerRuleRefusalCard` props `{ ruleId: string; heading: string /* 'REGUŁA WŁAŚCICIELA · R2' */; quote: string; changeRule: { label: string; onClick: () => void }; keep: { label: string; onClick: () => void }; state?: 'open' | 'kept' }`. Visual: `ui:Card` tone `rule-refusal` (1.5px rgba(255,143,163,.5), fill #1E0E16, radius 16), padding 14, gap 10; heading `SectionLabel` error tone (mono), quote 13px `text-body-soft` in typographic quotes supplied by the caller; actions row: `secondary` `Zmień Regułę` and `ghost`/outline `Zostaw jak jest`. `kept`: collapses to a one-line note `Reguła zostaje` (label via props) so the thread keeps its history.
2. `ChiefProposalCard` props:
   ```ts
   interface ChiefProposalCardProps {
     variant: 'skill' | 'rule';
     state?: 'pending' | 'busy' | 'accepted' | 'rejected';
     title: ReactNode;               // 'Chief proponuje nowy Skill: release-checklist' / 'Chief proponuje: „Testy wydajności tylko przed wydaniem”'
     rationale: ReactNode;           // 13px text-secondary
     accept: { label: string; onClick: () => void };   // 'Akceptuj' / 'Dodaj jako R4'
     reject: { label: string; onClick: () => void };   // 'Odrzuć'
     view?: { label: string; onClick: () => void };    // 'Zobacz treść'
     resolvedLabel?: { accepted: string; rejected: string };
   }
   ```
   `skill` variant: `ui:Card` tone `drop` (1px dashed #F25FC4, fill rgba(242,95,196,.05), radius 18), padding 16, Chief `Avatar` 28 + title 14/700 + rationale; actions right: `view` as text button, `accept` `primary-magenta` (h40, 13/700), `reject` `secondary`. `rule` variant: tone `callout-magenta` (1px rgba(242,95,196,.5), fill #1F0F25, `glow-card-rule` 0 0 28px rgba(242,95,196,.18), radius 18) in the Workspace settings Owner Rules section, same actions (`Dodaj jako R4`, `Odrzuć`).
3. Safety rule: the proposal's actual content (the rule text or Skill summary) MUST be visible in the card before accept is possible: for `rule` the full quoted rule is part of `title`; for `skill` the primary action is enabled but the card shows the origin line `Skill zaproponowany przez Chiefa, prywatny do czasu Twojej decyzji` (supplied by caller) and `view` is promoted next to accept. `accept` is never auto-focused.
4. `busy`: buttons disabled with spinner on the clicked one; `accepted`/`rejected`: the card collapses to a result line (glyph + `resolvedLabel`) so the decision remains in the log; no undo here.
5. Both cards: `role="group"` with `aria-labelledby`; actions are real buttons in DOM order view, accept, reject (accept before reject, destructive/negative last).
6. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
7. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
8. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
9. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
10. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
11. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
12. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the red Owner Rule refusal card from the Direct chat (`REGUŁA WŁAŚCICIELA · R2`, quote, `Zmień Regułę`, `Zostaw jak jest`). `design-skill.png`: the Skills proposal banner (dashed magenta, Chief avatar, `release-checklist`, `Zobacz treść`, `Akceptuj`, `Odrzuć`). `design-rule.png`: the rule proposal in Workspace settings (`Chief proponuje: „Testy wydajności tylko przed wydaniem”, bo pominąłeś je 2 razy.` `Dodaj jako R4` `Odrzuć`) - rendered from the mock scrolled 600px. Not in the mock: busy/resolved states, focus, narrow layout (actions wrap below text).

## 7. Reuse

Consumes `ui:Card` tones `rule-refusal`, `drop`, `callout-magenta`, `ui:Button` (`primary-magenta`, `secondary`, `ghost`), `ui:Avatar`, `ui:SectionLabel`.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Chief/LLM proposals are a social-engineering vector: the card renders the proposal verbatim as text, labels it clearly as a proposal from Chief, and exposes no one-click path that applies it without the Owner pressing accept. Accepting a rule is local-only (desktop), consistent with ADR 0021 (exceptions only locally).

## 10. Errors and edge cases

- Missing `view` -> two-button layout.
- Very long rule text -> wraps, card grows (no truncation of the rule being accepted).
- `state=busy` and the parent unmounts -> no callbacks after unmount.
- Double accept click -> second ignored (busy).

## 11. Acceptance criteria

- [ ] Given the refusal fixture, Then it renders heading, quote and two actions with the error-tinted border from the mock.
- [ ] Given `variant="rule"`, Then the full quote is in the DOM before the accept button.
- [ ] Given accept clicked, Then buttons disable and `onClick` fires once.
- [ ] Visual match for `design.png`; `design-skill.png` and `design-rule.png` match their variants within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: wording `Zostaw jak jest` variants (ghost vs outline): default `ghost`.
- The dynamic-Agent proposal card is built in OVE_DS066 with the same `drop` tone.
