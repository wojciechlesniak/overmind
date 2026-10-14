---
id: OVE_DS073
title: Build WizardLayout and WizardStepper (first-run wizard frame)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS022, OVE_DS039, OVE_DS040, OVE_DS041]
soft_depends_on: []
provides: ["ui:WizardLayout", "ui:WizardStepper"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Button", "ui:SectionLabel", "ui:Pill"]
owns: ["packages/ui-kit/src/wizard/WizardLayout/**", "packages/ui-kit/src/wizard/WizardStepper/**"]
reads: []
design: design.png
design_source: "Kreator-Folder#onb/sidebar + stepper (crop 0,0,360,900 CSS px); design-main.png = Kreator-Folder (crop 360,0,1080,215); design-footer.png = Kreator-Folder (crop 360,470,1080,80)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [9, 10, 24]
---

# OVE_DS073: Build WizardLayout and WizardStepper (first-run wizard frame)

## 1. Summary

Builds the frame of the four-step first-run wizard: the 360px branded sidebar (logo, eyebrow, intro, `WizardStepper`, footnote) and the scrolling main column (step counter, title, lead, content slot, sticky footer actions).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Kreator-Folder.dc.html` and its 2x render `_design/views/Kreator-Folder.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C7.1 (WizardLayout), C7.2 (WizardStepper), E2, E24. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The wizard runs once on first launch (SPEC 14): allowed folder, CLI and isolation, first Workspace, optional Telegram. It has no AppRail or TopBar. Step 2 content is 943px tall in a 900px window (E2), so the main column must scroll and the footer must stay reachable.

## 3. Scope (in)

- `WizardLayout`, `WizardStepper`, `WizardFooter` (Back/Next row with optional hint), responsive heights, stories for step 1..4.

## 4. Out of scope

- Step content (FolderPicker etc. in OVE_DS074), wizard state machine and persistence (ONB feature).
- Window chrome.

## 5. Detailed requirements

1. `WizardLayoutProps`:
   ```ts
   interface WizardStep { id: string; label: string; sublabel?: string; state: 'done' | 'active' | 'pending' }
   interface WizardLayoutProps {
     brand: { name: string };                    // 'Overmind' rendered next to <LogoTile size=46>
     eyebrow: string; intro: string; footnote: string;
     steps: WizardStep[]; stepCounter: string;   // 'Krok 1 z 4'
     title: string; lead?: string;
     children: ReactNode;                         // step content, max-width 620/640 (prop contentMaxWidth)
     footer: ReactNode;                           // normally <WizardFooter/>
     labels: { stepsNav: string };
   }
   ```
2. Sidebar (exact): width 360, `bg #0D0915` + `radial-gradient(circle at 20% 0, rgba(242,95,196,.16), transparent 55%)` (token `bg-wizard-sidebar`), padding 40 36, column; border-right 1px `line-subtle`. Brand row: `LogoTile` 46 (OVE_DS041) + wordmark (token `wordmark`, 22px). Eyebrow mono label 11 +0.1em `text-muted` at y=122; intro 15/1.5 `text-secondary` max 287px; stepper at y=224; footnote 12/1.5 `text-muted` pinned to the bottom (margin-top auto).
3. `WizardStepper` is an `<ol aria-label=labels.stepsNav>`; item row gap 14, 28px number dot + label 14/600 + optional sublabel 11px (`opcjonalnie`, `text-muted`, below the label). Item spacing 18 (step y 224, 270, 316, 362 in the mock, so row height 28 + 18 gap, the optional step is 31). Dot states: done = mint fill with `check` icon 14 (R, not in mock); active = magenta fill `#F25FC4` ink number + `glow-dot-active`, label `#EFE9F7`; pending = 2px ring `#5B3E8F`, number `#A79BBF`, label `#A79BBF`. Active item has `aria-current="step"`; every dot also has a visually hidden state word (`labels` provided per step as `stateLabel`).
4. Main column: flex 1, `overflow-y: auto` (E2), padding 48 56 (32 56 when `height < 960`, via `@media (max-height: 959px)`), step counter mono 13 `text-muted` at y=48, title `title-wizard` 34/700/-0.5px at y=84, lead 17/1.5 `text-secondary` max 620/640 at y=145, content starts at y=217. Content width is capped by `contentMaxWidth` (default 968 for the folder step, steps 2 use the same).
5. Footer: `position: sticky; bottom: 0` inside the scroll column with a gradient fade background so content never hides behind it; `display:flex; justify-content: space-between; align-items:center; gap:16`. `WizardFooter` props `{ hint?: ReactNode; back?: { label; onClick } | null; next: { label; onClick; disabled?: boolean; disabledReason?: string; loading?: boolean } }`: hint 13px `text-muted` left; Back = `Button secondary lg` (E8, always a `button`, hidden when `back` is null, E24: step 1 passes null); Next = `Button primary xl` (46px, r14, the wizard CTA). Disabled Next exposes `aria-disabled` + `aria-describedby` to the reason (hint) rather than silently doing nothing.
6. Focus management: on step change the layout calls `onStepChange` side effect `focus()` to the title (`tabIndex=-1`, `aria-live=polite` region announces `stepCounter + title`). Provide `titleRef`. Keyboard: Enter on a focused step content control never triggers Next implicitly.
7. Minimum window: 1100x700 supported; below 1100 wide the sidebar shrinks to 280 and the intro is hidden (`display:none`, still in DOM for AT). Not designed in the mock (open question 7).
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the sidebar (radial glow, logo tile, `PIERWSZE URUCHOMIENIE`, stepper with active step 1 magenta, steps 2-4 ringed, step 4 sublabel `opcjonalnie`, footnote `Jedna instalacja to jeden Właściciel...`). `design-main.png`: counter, title, lead. `design-footer.png`: Back secondary 40px / Next 46px CTA (the mock's 40 vs 46 mismatch is normalised, E8). Not drawn: done state, disabled Next, hidden Back, scrolled/sticky footer.

## 7. Reuse

Consumes `ui:LogoTile` (OVE_DS041), `ui:Button` (`secondary lg`, `primary xl`), `ui:SectionLabel`, `ui:Text`. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). No sensitive data. The footer disabled reason must be visible text (fail closed: Next stays disabled until the feature reports the check passed; the component never enables it by itself).

## 10. Errors and edge cases

- `steps` has no active item -> no `aria-current`, dev warning.
- More than 4 steps -> stepper still renders, sidebar scrolls.
- Very long title -> wraps (max 2 lines then ellipsis not applied; titles are fixed copy).
- Window height < 700 -> main scrolls, footer remains sticky.

## 11. Acceptance criteria

- [ ] Given step 1 active, Then dot 1 is magenta with glow and `aria-current="step"`; steps 2-4 show ring dots; step 4 shows `opcjonalnie`.
- [ ] Given `back=null`, Then no Back button is in the DOM.
- [ ] Given content taller than the viewport, Then the main column scrolls and the footer stays visible.
- [ ] Given Next disabled with a reason, Then `aria-disabled` is set and the reason is announced.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN question 7: behaviour below 1100px width (default as specified).
- ASSUMPTION E24: Back hidden on step 1.
