---
id: OVE_DS060
title: Build NotificationCenter and SystemStatusList
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS020, OVE_DS031, OVE_DS032, OVE_DS033, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:NotificationCenter", "ui:NotificationItem", "ui:SystemStatusList"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:ListRow", "ui:Card", "ui:StatusDot", "ui:EmptyState", "ui:Skeleton", "ui:Button"]
owns: ["packages/ui-kit/src/workspaces/NotificationCenter/**", "packages/ui-kit/src/workspaces/SystemStatusList/**"]
reads: []
design: design.png
design_source: "Pulpit#dash/notifications + system (crop 1120,67,320,600 CSS px)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [6, 5]
---

# OVE_DS060: Build NotificationCenter and SystemStatusList

## 1. Summary

Builds the 320px side column of the Workspaces dashboard: the Notification centre (items for Approval, Access Request, Discussion started, Run completed, Escalation, Telegram, with unread state) and the System status list (engine, isolation, herdr, backup, Telegram) with degraded variants.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Pulpit.dc.html` and its 2x render `_design/views/Pulpit.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C4.3 (NotificationCenter), C4.4 (SystemStatusList), B13 (NotificationItem, StatusRow). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Notifications cover completion, error, Access Request, Approval, Escalation and Discussion started by Chief (SPEC 12). The Access Request signal also has a sound (OPEN, NOTIF area). The system list tells the Owner whether the engine and isolation are healthy: isolation unavailable means actions are blocked (fail closed, SPEC 11), so degraded states must be visible.

## 3. Scope (in)

- `NotificationCenter` panel content and `NotificationItem` (6 kinds, read/unread).
- `SystemStatusList` (ok, degraded, error rows with remedy link) and its `CheckRow`-like compact variant for the wizard check list is NOT here (OVE_DS074).

## 4. Out of scope

- Notification data/store (NOTIF), sound, banners.
- Tray summary line (OVE_DS085).

## 5. Detailed requirements

1. `NotificationItemProps`:
   ```ts
   type NotificationKind = 'approval' | 'access-request' | 'discussion' | 'run-completed' | 'escalation' | 'telegram' | 'error';
   interface NotificationItemProps { kind: NotificationKind; title: string; subtitle?: string; ageLabel: string; unread?: boolean; onOpen?: () => void; kindLabel: string /* sr-only, e.g. 'Zgoda' */ }
   ```
   Row: button, padding 10 0 (list rows have no horizontal padding; the panel pads 21), bottom border 1px `line-subtle`, flex gap 12. Leading icon tile 32x32 radius 10 filled with the kind tint (a12) and a 16px icon in the kind light colour: approval `shield-check` amber, access-request `folder-plus` magenta, discussion `discussion` lavender (#D6C9FF), run-completed `check` mint, escalation `activity` error, telegram `telegram-plane` lavender, error `activity` error. Title 13/600, subtitle 12px `text-secondary` (2-line clamp), age mono 11 `text-muted` right/top. Heights 54 (one line), 70 (two lines).
2. Unread (R, open question 6): title 13/700 `text-primary`, a 6px magenta dot left of the age and `aria-label` prefix `kindLabel`; read: title 13/600 `text-secondary`, no dot. The component never marks read itself (`onOpen` callback; the feature marks).
3. `NotificationCenterProps { title: string; items: NotificationItemProps[]; markAllRead?: { label: string; onClick: () => void }; labels: { empty: string; list: string }; loading?: boolean; max?: number }`: heading `Powiadomienia` 15/700, optional `ghost` button `Oznacz jako przeczytane`, list `<ul>` of items (max 20 by default, `Pokaż starsze` dashed-more for the rest via `labels`), empty = `EmptyState` small (`Brak powiadomień.`), loading = 4 skeleton rows. Panel width is given by the SidePanel (320).
4. `SystemStatusListProps { heading: string; rows: { id: string; label: string; value: string; status: 'ok' | 'warn' | 'error'; remedy?: { label: string; onClick: () => void } }[] }`: heading `System` 15/700, then `ui:Card` tone `nested` (radius 16, padding 14, gap 10) with rows: `StatusDot` 6 (mint + glow ok; amber + glow warn; error + glow error) + label 13px + value mono 12 `text-secondary` right; warn/error rows ALWAYS show the value text plus (for error) an inline remedy `TextLink`. Rows are `<dl>`-like (`<ul>` of label/value pairs); status is announced by a visually hidden status word (`label` variants supplied: `ok`/`uwaga`/`błąd` through `labels.status`).
5. Degraded examples (fixtures, R): `Izolacja (container) · niedostępna` error + remedy `Sprawdź`, `Kopia zapasowa · wczoraj 03:00` warn, `Silnik w tle · zatrzymany` error. When any row is `error`, the card border becomes error a50 (`danger` tone) so it is noticed.
6. Keyboard/focus: each notification is a focusable button, list navigable with Tab; Enter/Space open. No auto-focus on arrival; new notifications are announced by the feature's live region, not this component.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the right column of the Workspaces view: `Powiadomienia` with five items (amber shield `Zgoda: git push`, magenta folder-plus `Prośba o dostęp: ~/Projects/shared-ui`, lavender `Chief zaczął Dyskusję o płatnościach`, mint `Run #13 ukończony`, red pulse `Eskalacja: limit pętli`), then `System` with five mint-dot rows. Not in the mock: unread/read, empty, loading, degraded rows, hover/focus, overflow (`Pokaż starsze`).

## 7. Reuse

Consumes `ui:ListRow` base (notification and status variants), `ui:Card` (`nested`, `danger`), `ui:StatusDot`, `ui:EmptyState`, `ui:Skeleton`, `ui:Icon`.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Notification titles can contain agent/user text: text only, never HTML or links parsed from text. A notification of kind `access-request`/`approval` is informational: opening it navigates to the Approvals view where the Owner decides (no grant from the notification itself, ADR 0003).

## 10. Errors and edge cases

- Unknown kind -> neutral icon tile + title.
- `ageLabel` empty -> nothing rendered in that slot.
- Very long title -> 2-line clamp with title attribute.
- Rows empty in `SystemStatusList` -> heading hidden.
- All rows ok -> normal border; any error -> `danger` border.

## 11. Acceptance criteria

- [ ] Given the five fixtures, Then icon tiles/colours match `design.png` and heights are 54/70/70/54/69 within 2px.
- [ ] Given `unread`, Then the dot and 700 weight appear and the accessible name starts with `kindLabel`.
- [ ] Given an error row, Then the remedy link is focusable and the card gets the danger border.
- [ ] Given the empty list, Then the empty state shows with the text from labels.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN question 6: unread look; default dot + bold as specified.
- DESIGN GAP: degraded system rows are derived.
