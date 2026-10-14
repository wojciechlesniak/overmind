---
id: OVE_DS058
title: Build ApprovalDetail composition (git push, domain, delete, access, escalation)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS022, OVE_DS024, OVE_DS025, OVE_DS031, OVE_DS039, OVE_DS051, OVE_DS055, OVE_DS056]
soft_depends_on: []
provides: ["ui:ApprovalDetail", "ui:AccessRequestForm", "ui:EscalationReport"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Avatar", "ui:Card", "ui:Button", "ui:Checkbox", "ui:RadioCardGroup", "ui:SectionLabel"]
owns: ["packages/ui-kit/src/approvals/ApprovalDetail/**"]
reads: []
design: design.png
design_source: "Zgody#appr/detail (crop 432,117,1008,783 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 7"]
adr_refs: [3, 6, 21, 26]
---

# OVE_DS058: Build ApprovalDetail composition (git push, domain, delete, access, escalation)

## 1. Summary

Builds the Approval/Access Request/Escalation detail pane (1008px main column): header with kind and Run link, title and Agent, facts tiles, preview area (diff, command, file list, rights chooser or loop report), the decision panel with three actions and the policy footnote. Only the git-push variant is drawn in the mock; the other kinds are specified here from design-system rules.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Zgody.dc.html` and its 2x render `_design/views/Zgody.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C3.3 (ApprovalDetail), C3.4 and E30. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). E30: only git push is drawn; Access Request, new domain, delete and escalation details must be designed from the rules. Access Request: Agent asks for a folder outside the Allowed Directories; approving at the computer adds it permanently, approving from Telegram is for the current Run only (SPEC 11, criterion 9). Escalation: the loop limit was exhausted (SPEC 7) and Chief hands the decision to the Owner. The permanent removal of a consent requirement changes Owner Rules and is only possible at the computer.

## 3. Scope (in)

- `ApprovalDetail` generic shell (header, facts, preview slot, decision panel).
- `AccessRequestForm` (path, rights R/W/X, duration).
- `EscalationReport` (loop report + 3 resolution cards).
- Kind presets: git-push, new-domain, delete, access-request, escalation.

## 4. Out of scope

- Inline card (OVE_DS055), list (OVE_DS056).
- Deny-with-comment dialog, permanent-grant confirmation dialog (feature).
- Computing diffs/facts (engine).

## 5. Detailed requirements

1. Shell props:
   ```ts
   interface ApprovalDetailProps {
     kind: ApprovalKind;
     state: 'pending' | 'submitting' | 'decided' | 'expired' | 'decided-elsewhere';
     kindLabel: string;                      // 'ZGODA · GIT PUSH · DOMYŚLNA LISTA ZGÓD' (SectionLabel amber)
     runLink?: ReactNode;                    // RunLink + 'Dostarczanie funkcji v7 · węzeł Developer'
     agent: { name: string; hue: AgentHue; initials: string };
     title: string;                          // 24/700
     description?: ReactNode;                // 14px, inline mono for 'origin'
     facts: KeyValueItem[];                  // grid3
     preview?: ReactNode;                    // DiffView | command block | file list | AccessRequestForm | EscalationReport
     previewLabel?: string;                  // 'PODGLĄD ZMIANY'
     decision: { allowOnce: ApprovalActionSpec; allowPermanent?: ApprovalActionSpec; denyWithComment: ApprovalActionSpec; footnote: ReactNode };
     result?: ApprovalCardProps['result'];
     labels: { expired: string; decidedElsewhere: string };
   }
   ```
2. Layout (main column padding 24, gap 18): meta row (kind label amber + `runLink` mono 12) -> heading row (Avatar 48 + title 24/700 `title-section` + description 14px, gap 16) -> `KeyValueList grid3` (`POLECENIE` command mono, `ZMIANY` `2 pliki · +14 −3` with mint/error numbers, `DOWODY` `testy 112 z 112` mint) -> `previewLabel` `SectionLabel` + preview -> decision panel. The decision panel is a `ui:Card` (radius 20, padding 19, 1px `line`, fill `bg-surface`): `ApprovalActions` (size `xl`: height 46) then the footnote as `CalloutAmber`-style `InfoNote` (12px: `Stałe zdjęcie wymogu Zgody zmienia Reguły Właściciela i jest możliwe tylko tutaj, przy komputerze. Z Telegrama zatwierdzasz wyłącznie ten Run.`).
3. Actions in the panel (E8/E26): `approve-amber` 46 radius 14 padding 0 20 `Zezwól tym razem`; `approve-amber-outline` `Zezwalaj na stałe w tym Workspace` (E26 label, kind-specific wording is provided by the caller but follows this pattern: `Zezwalaj na git push w tym Workspace` is allowed for git-push because it names the action); `deny-outline` `Odmów z komentarzem` (opens the feature's dialog; component only calls `denyWithComment.onClick`). Same state rules as OVE_DS055 (submitting, no grants after expired/decided).
4. git-push preset: preview = `DiffView`, facts = command/changes/evidence. new-domain preset (R): facts `DOMENA` (mono, wraps), `AGENT/POWÓD` (agent's stated reason, labelled as the Agent's claim), `ZAKRES` (`tylko ten Run` vs `na stałe w tym Workspace`); preview = command block with the request context; permanent grant adds the domain to the Workspace network allow-list (stated in the button's help text). delete preset (R): facts `LICZBA PLIKÓW`, `ŚCIEŻKI`; preview = scrollable list of paths in a `terminal`-tone card, error tint, max 200 shown + `+N więcej`; allow-permanent omitted by default (deleting is high risk; feature may enable).
5. `AccessRequestForm` (kind access-request): path in a mono tile with the canonical path and the origin line (`Prośba Designera · przy komputerze` via `OriginLine`); rights `Odczyt` (checked), `Zapis` (unchecked), `Wykonywanie` (unchecked; Execute off by default as in the wizard) as `ui:Checkbox` rows with the wizard descriptions; duration as `ui:RadioCardGroup` `tylko ten Run` | `stałe w tym Workspace` (default `tylko ten Run` - least privilege, ASSUMPTION for open question 5). The form is controlled (`value`/`onChange` of `{ read, write, execute, duration }`); allow button label summarises the choice (`Zezwól: odczyt, tylko ten Run`). If the request came from Telegram the `stałe` option is disabled with the reason text (permanent only at the computer). Rights requested by the Agent are pre-checked and shown as `żądane`; the Owner may only narrow, never exceed (the form cannot check a right the Agent did not request).
6. `EscalationReport` (kind escalation): header `ESKALACJA · LIMIT PĘTLI`, report summary (iterations used `5 z 5`, last Quality Gate result lines as `KeyValueList rows`, failing criteria), and three resolution cards as radio group (`ui:RadioCardGroup` radius 14): `{ id, title, description, tone }[]` supplied by the feature (fixture: `Zwiększ limit o 3 iteracje`, `Zmień podejście: Chief przygotuje nowy plan`, `Anuluj Run`); one `Button primary-violet` `Zastosuj` enabled only after a choice. Destructive resolution (`Anuluj Run`) uses error tone and needs the feature's confirm dialog.
7. Decided/expired/decided-elsewhere: the preview stays visible (audit), the decision panel is replaced by a result line + origin; the actions are not in the DOM.
8. A11y: pane is `<section aria-labelledby=title>`; the preview region is keyboard-focusable when scrollable; the footnote is linked with `aria-describedby` to the permanent button so screen readers hear the 'only at the computer' constraint when it is focused.
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` is the complete git-push detail from the mock (meta line, Avatar 48 with the title and the description `Developer chce wysłać 2 commity na origin, żeby Senior Reviewer mógł otworzyć PR.`, facts, diff, three amber/outlined actions at 46px, footnote). Variants new-domain/delete/access-request/escalation are NOT drawn: build them with the same shell and the primitives named above and record the result in Storybook for design review (E30). Not in the mock: submitting/expired/decided states, focus rings, access-request rights UI, escalation resolutions, loading skeleton of the pane.

## 7. Reuse

Consumes OVE_DS051 (`KeyValueList`, `DiffView`, `StatTile` not needed), OVE_DS055 (`ApprovalActions`), `ui:Checkbox`, `ui:RadioCardGroup`, `OriginLine`/`RunLink`/`InfoNote` (OVE_DS040).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The Access Request form can only narrow requested rights (never grant more than the Agent asked, and never beyond what the policy intersection allows: the feature validates again, ADR 0003). The path is shown canonicalised as received from the engine (SEC002 does the canonicalisation); the UI must show symlink-resolved targets if the engine supplies `resolvedPath` (extra line, error tone when it differs from the requested path). Permanent grants are impossible for Telegram-originated requests and for expired ones. All agent-supplied reasons are labelled as claims.

## 10. Errors and edge cases

- Unknown `kind` -> falls back to the generic shell with only facts and footnote, no grant presets.
- Preview too large -> internal scroll with max-height 320 (diff) and truncation controls from OVE_DS051.
- Access request with no rights requested -> allow disabled, error text `Brak żądanych praw`.
- Resolution not chosen in escalation -> apply disabled.
- Pane state flips to `expired` while a form edit is in progress -> inputs disabled, entered values retained for display.

## 11. Acceptance criteria

- [ ] Given the git-push fixture, Then the pane matches `design.png` within tolerance (46px actions, 3-column facts, diff).
- [ ] Given an Access Request where only Read was requested, Then Write/Execute checkboxes are disabled and unchecked.
- [ ] Given an Access Request from Telegram, Then the `stałe` duration option is disabled with the reason visible.
- [ ] Given `state="expired"`, Then no grant button exists in the DOM.
- [ ] Given the escalation fixture, Then Apply is disabled until a resolution is selected.
- [ ] axe clean for all five kind presets.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Story per kind and per state (5x5 matrix generated from a typed table); form logic unit tests (narrow-only rights).

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- DESIGN GAP (E30): four of five kinds are undrawn; ship as designed here and ask design review.
- ASSUMPTION (question 5): default duration `tylko ten Run`, Execute unchecked.
- OPEN: escalation resolutions are feature-defined; the three listed are fixtures.
