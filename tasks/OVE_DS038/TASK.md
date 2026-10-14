---
id: OVE_DS038
title: "UiLabelsProvider: i18n strings for ui-kit accessible names"
area: DS
kind: ui
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_SHELL007]
soft_depends_on: [OVE_ARCH011]
provides: [ui:UiLabels, ui:UiLabelsProvider]
needs: [lib:i18n]
owns: [packages/ui-kit/src/i18n/**]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 13]
adr_refs: [17]
---

# OVE_DS038: UiLabelsProvider: i18n strings for ui-kit accessible names

## 1. Summary

Provide the small, dependency-free label system that lets ui-kit render its own accessible names and fallback words (close, dismiss, remove, loading, ...) without owning any translation catalogue: `UiLabels` type, English `defaultLabels`, `UiLabelsProvider` and `useUiLabels()`. The app (OVE_ARCH011 i18n setup) supplies Polish and English catalogues.

## 2. Context

ADR 0017: project language is English; the product UI is Polish first and English too (OVE_ARCH011 owns the i18n mechanism, catalogues and the language switch). ui-kit must not import the app's i18n library (no dependency on other internal packages; `ui-kit` has only `@floating-ui/react` as runtime dependency). Components therefore take user-visible text as props (`label`, `children`) and, only for strings the component itself must generate (icon button names where the caller omitted them, "Loading", visually hidden text), read them from this provider. The guard 'no hard-coded JSX strings' (OVE_DS001) accepts only `useUiLabels()` or props.

## 3. Scope (in)

- `UiLabels` interface (key list below), `defaultLabels` (English), `UiLabelsProvider`, `useUiLabels`, `createUiLabels(partial)` merge helper, tests, story (override demo), a guard test that every key is used by at least one component or documented as reserved.
- Documentation of the mapping to the app catalogue (a code block showing how `apps/desktop` builds the object from its i18n library; illustrative).

## 4. Out of scope

- The i18n library, catalogues, language selection and date/number formatting: OVE_ARCH011. Polish copy: apps.

## 5. Detailed requirements

**5.1 `UiLabels` keys and English defaults**
| Key | Default (English) | Used by |
|---|---|---|
| `close` | "Close" | Dialog close button |
| `dismiss` | "Dismiss" | Toast dismiss |
| `remove` | "Remove" | Chip removable, SkillChip |
| `loading` | "Loading" | SkeletonGroup, Spinner, Select loading |
| `clearSearch` | "Clear search" | SearchField |
| `required` | "required" | Field |
| `optional` | "optional" | Field |
| `visibilityPublic` | "Public" | VisibilityBadge default word |
| `visibilityPrivate` | "Private" | VisibilityBadge default word |
| `toastRegion` | "Notifications" | ToastProvider region |
| `moreActions` | "More actions" | IconButton presets, row menus |
| `expand` | "Expand" | disclosure presets |
| `collapse` | "Collapse" | disclosure presets |
| `externalLink` | "(opens in a new tab)" | TextLink external |
| `avatarOverflow` | `(n: number) => string`, default `(n) => "+" + n + " more"` | AvatarStack overflow label |
Labels are `string` or a function `(...args) => string` for plurals/interpolation (ICU is the app's job, the function receives already-formatted values).
**5.2 API**
```ts
type UiLabels = { close: string; dismiss: string; remove: string; loading: string; clearSearch: string; required: string; optional: string;
  visibilityPublic: string; visibilityPrivate: string; toastRegion: string; moreActions: string; expand: string; collapse: string; externalLink: string; avatarOverflow: (n: number) => string };
const defaultLabels: Readonly<UiLabels>;
function createUiLabels(partial?: Partial<UiLabels>): Readonly<UiLabels>;
function UiLabelsProvider(props: { labels: Partial<UiLabels>; children: ReactNode }): JSX.Element;
function useUiLabels(): Readonly<UiLabels>;   // never throws: falls back to defaults without a provider
```
Rules: the provider merges `labels` over the defaults (partial catalogues are valid); nested providers merge over the parent; the merged object is memoised by shallow comparison of the input so a re-render with equal labels does not re-render consumers; the context value is frozen (`Object.freeze`).
**5.3 Adding a key**: add to the `UiLabels` type, `defaultLabels`, the table above and the guard test's reserved list in one PR; other component tasks request keys through `tasks/_proposals/` (no one edits this file but the owner). Keys are camelCase nouns/verbs, never sentences with variables concatenated by components.
**5.4 Accessibility and RTL**: the provider sets nothing on the DOM; `lang`/`dir` are the app's responsibility; labels may be longer than English (components truncate or wrap per their own specs).
**5.5 Testing helper**: `renderWithLabels(ui, labels?)` exported only from `@overmind/ui-kit/testing` (OVE_DS012) for component tests; it wraps in the provider and `ThemeRoot`.

## 6. Design notes

`design: none` (no visual). A story shows the Polish override (a literal object in the story file only).

## 7. Reuse

No reuse; every other task consumes this one (`needs: ui:UiLabels`). Real dependency on OVE_ARCH011 only for the documented integration pattern, not for code.

## 8. Architecture and code placement

`packages/ui-kit/src/i18n/{labels.ts,UiLabelsProvider.tsx,useUiLabels.ts,index.ts}`. Plain React context, no external i18n library (OCP: the app maps any library into the object; DIP: ui-kit depends on its own interface).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Labels are plain strings rendered as text nodes: a malicious or corrupted translation file can only change words, never inject markup. Prototype pollution: `createUiLabels` ignores keys not in `defaultLabels` and copies own properties only.

## 10. Errors and edge cases

- Missing provider: defaults used silently.
- Partial or `undefined` values: default kept for that key.
- Function label throws: caught, default used, dev warning.
- Extra unknown keys: ignored with dev warning.
- Server/SSR: no browser APIs used.

## 11. Acceptance criteria

- [ ] All keys of 5.1 exist with the English defaults and are typed; `useUiLabels()` never throws.
- [ ] Partial override merges; nested providers merge over parents; equal re-renders keep a stable object identity.
- [ ] Unknown keys and prototype-pollution attempts (`__proto__`, `constructor`) are ignored.
- [ ] Guard: a key is either used by a component (grep test) or listed as reserved.
- [ ] `ui-kit` has no import of any i18n library (guard).

## 12. Test plan

- Vitest: provider/hook tests, merge tests, pollution test, identity stability test (render counter).
- Commands: `pnpm --filter @overmind/ui-kit test i18n`.

## 13. Parallelization notes

Starts right after OVE_DS001; many tasks list it as a dependency, so merge it early. Other authors must not add keys here directly (proposal files). No file overlap with other tasks.

## 14. Open questions and assumptions

- ASSUMPTION: default catalogue is English; Polish lives in the app (OVE_ARCH011).
- Open: if OVE_ARCH011 chooses a library with ICU messages, the adapter is app code, not ui-kit.
- Open: the key list is extended through proposals as components appear (e.g. `copy`, `copied` for a future CopyButton).
