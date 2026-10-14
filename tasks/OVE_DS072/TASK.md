---
id: OVE_DS072
title: Build SkillDetail panel and MarkdownPreview (source viewer)
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS017, OVE_DS019, OVE_DS022, OVE_DS032, OVE_DS039, OVE_DS063, OVE_DS071]
soft_depends_on: []
provides: ["ui:SkillDetail", "ui:MarkdownPreview"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:VisibilityBadge", "ui:VersionBadge", "ui:Pill", "ui:Button", "ui:SectionLabel", "ui:Avatar", "ui:EmptyState"]
owns: ["packages/ui-kit/src/skills/SkillDetail/**"]
reads: []
design: design.png
design_source: "Skille#skills/inspector (crop 1100,162,340,738 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [12, 28, 27]
---

# OVE_DS072: Build SkillDetail panel and MarkdownPreview (source viewer)

## 1. Summary

Builds the 340px Skill detail panel (name, visibility/version/source tags, content preview, version list, recent uses, actions) and `MarkdownPreview`, a monospace read-only viewer of the Skill's Markdown source.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Skille.dc.html` and its 2x render `_design/views/Skille.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C6.7 (SkillDetail). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Editing a Skill creates a new version (`Edytuj jako v5`); detaching removes the assignment from Agents. Recent uses record the Run, Agent and Skill version (SPEC 8). Skills from the internet are provided only by the Owner and are untrusted content (ADR 0012, SEC004): the preview shows source as inert text so injected instructions can be inspected but never interpreted.

## 3. Scope (in)

- `SkillDetail`, `MarkdownPreview`, system (read-only) and import-origin variants, empty selection, loading.

## 4. Out of scope

- Skill editing UI, import dialog, assignment logic.

## 5. Detailed requirements

1. `SkillDetailProps`:
   ```ts
   interface SkillDetailProps {
     name: string; visibility?: Visibility; visibilityLabel?: string; versionLabel: string /* 'v4 · aktualna' */; sourceLine: string /* 'źródło: Właściciel' */; originNote?: string;
     source: string;                                 // Markdown text
     versions: { id: string; label: string; note?: string; onOpen?: () => void }[];
     uses: { id: string; run: ReactNode; agent: { name: string; hue: AgentHue; initials: string }; versionLabel: string; time: string }[];
     actions: { edit?: { label: string; onClick: () => void }; detach?: { label: string; onClick: () => void } };
     system?: boolean; loading?: boolean; labels: { versions: string; uses: string; empty: string; readOnly: string };
   }
   ```
2. Panel (SidePanel right 340, padding 20-21, gap 16): header = `skill-cube` 22 icon + name mono 18/600 (ellipsis); tags row: `VisibilityBadge filled-sm` (10px/700, #6FA8FF or #9B7BFF fill, text #0A0710), `VersionBadge` (`v4 · aktualna`, mono 11/500 #C9B8FF on #191226), origin pill; source line mono 12 `text-muted`; optional `originNote` as `InfoNote` (imports: `Zaimportowany przez Właściciela. Treść nie jest weryfikowana.`).
3. `MarkdownPreview` props `{ source: string; maxLines?: number /* 40 */; 'aria-label': string }`: radius 14, `bg-code`, 1px `line-subtle`, padding 12, mono 12/1.6, `white-space: pre-wrap; overflow-wrap: anywhere`, scrollable (`max-height: 220px`, `tabindex=0`, `role="region"`). Light token colouring ONLY by line prefix (no parsing into HTML): lines starting `# ` heading in `text-lavender` 600; `- ` list markers `text-muted`; fenced code lines `text-secondary`. Control/bidi characters neutralised with the same sanitiser as OVE_DS052 (`sanitizeTerminalText`-like helper exported from `common`? NO: import `lib:sanitizeTerminalText`). Truncation row `… N więcej linii`.
4. Versions list: `SectionLabel` `WERSJE` + rows (`v4 · 2026-10-02 · dodane kontrakty API` 12px; mono), current marked by the badge, clicking a row calls `onOpen` (shows that version in the preview: the feature swaps `source`). Recent uses: `OSTATNIE UŻYCIA` rows: `RunLink` + avatar 22 + `Developer · v4` + time mono 11; max 5.
5. Actions pinned at the bottom (y=840 in the mock): `Button primary-violet` `Edytuj jako v5` (`flex: 1`) + `secondary` `Odłącz od agentów` (destructive-ish: feature confirm). For `system` Skills both are absent and `labels.readOnly` text shows (`Skill systemowy: tylko do odczytu`). Edit never happens in place (new version by design).
6. No selection: `EmptyState` (`Wybierz Skill`); loading skeleton blocks of the same heights.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the `TypeScript` Skill panel (icon + name, filled `PUBLICZNY`, `v4 · aktualna`, `źródło: Właściciel`, mono markdown preview `# TypeScript - strict: true, bez any ...`, `WERSJE` three rows, `OSTATNIE UŻYCIA` with Run links and Agents, bottom actions). Not in the mock: system variant, import note, loading, empty selection, long source (scroll), truncation.

## 7. Reuse

Consumes OVE_DS040 `RunLink`, `InfoNote`; OVE_DS063 is NOT reused for lists (Timeline not needed); `ui:VisibilityBadge`, `ui:VersionBadge`, `ui:Pill`, `ui:Button`, `ui:Avatar`; `lib:sanitizeTerminalText` from OVE_DS052.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The Skill source can contain prompt-injection text addressed to the reader or to Chief: it is rendered strictly as inert text in a labelled preview, never executed or interpreted, and nothing in this panel feeds back into prompts. Detach/edit are callbacks only.

## 10. Errors and edge cases

- Source empty -> `Brak treści` muted line.
- Source > 200 KiB -> first `maxLines` lines + truncation row (the component receives already-limited text but guards).
- Version rows empty -> section hidden.
- System Skill with `actions` provided -> actions ignored.

## 11. Acceptance criteria

- [ ] Given the TypeScript fixture, Then it matches `design.png` within tolerance.
- [ ] Given a source containing `<script>alert(1)</script>` and `\u202E`, Then it is displayed as text with the bidi char shown as `<U+202E>` and no script element exists.
- [ ] Given `system`, Then no edit/detach buttons exist.
- [ ] Given keyboard, Then the preview region scrolls with arrow keys when focused.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. XSS corpus test for `MarkdownPreview`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: no rendered Markdown in MVP (source viewer only, as in the mock).
