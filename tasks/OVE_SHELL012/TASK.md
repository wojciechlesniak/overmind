---
id: OVE_SHELL012
title: "Compose the shell frame and the ShellPage layout component for all views"
area: SHELL
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS022, OVE_DS032, OVE_DS044, OVE_SHELL009, OVE_SHELL010]
soft_depends_on: []
provides: ["ui:ShellPage", "lib:ShellPage", "ui:ShellFrame", "lib:shell-slots", "lib:shell-page"]
needs: ["ui:PageLayout", "ui:SidePanel", "ui:VisuallyHidden", "ui:Skeleton"]
owns: ["apps/desktop/src/app/layout/**"]
reads: []
design: design.png
design_source: "Pulpit#shell/rail + shell/top-bar (crop 0,0,1440,120); design-main.png = Main#shell/rail + shell/top-bar 117px variant (crop 0,0,1440,180)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [18]
---

# OVE_SHELL012: Compose the shell frame and the ShellPage layout component for all views

## 1. Summary

Builds the layout composition every view uses: the shell frame (rail + top bar + optional sub-tabs + content) from `ui:PageLayout`, and the `ShellPage` component through which views declare their list panel, main content and detail panel without ever assembling rail or top bar themselves.

## 2. Context

DS044 `PageLayout` takes `rail`, `topBar`, `tabs`, `list`, `detail` and `children` as props and sets the fixed-height grid with internal scrolling (styl-wizualny: 'Ekrany mają stałą wysokość okna i przewijają się wewnątrz paneli'). 14 views share the shell (VIEWS 'Shared shell'). If each view built rail and top bar itself, the shell would be duplicated 14 times; instead SHELL provides the frame as a layout route and `ShellPage` as the single entry: views render `<ShellPage list={...} listWidth={270} detail={...} detailWidth={300} mainPadding='page'>`. The rail, top bar and tabs are placed by context (SHELL013/014/016/017). Bare routes (onboarding) use `BareFrame` (no rail).

## 3. Scope (in)

- `ShellFrameRoute` layout route (renders rail, top bar, tabs via slots and an `<Outlet/>`).
- `ShellPage` component (props passthrough to `ui:PageLayout`: `list`, `listWidth`, `detail`, `detailWidth`, `mainPadding`, `mainMaxWidth`, `labels`) and `ShellPageContext`.
- `BareFrame` for `frame: 'bare'` routes (just the theme surface and the main landmark).
- Slot components `RailSlot`, `TopBarSlot`, `TabsSlot` that render nothing until their tasks register implementations (extension via React context registration, no file edits).
- Skip link and landmarks wiring (labels from `a11y` namespace), `main` id `main`.
- Story `Shell/Frame` composing everything with fixtures.

## 4. Out of scope

- Rail items and routing (OVE_SHELL013), tabs (SHELL014), top bar content (SHELL016/017).
- Page headers (`PageHeader` is composed by each view).
- Responsive drawers for narrow windows (DS044 documents behaviour; the minimum window is 1100 px, SHELL008).

## 5. Detailed requirements

1. Frame structure (render tree): `<ShellPageProvider> <PageLayout rail={<RailSlot/>} topBar={<TopBarSlot/>} tabs={<TabsSlot/>} ...> <Outlet/>` is NOT used directly because `PageLayout` owns the panel slots; therefore the layout route renders ONLY the persistent chrome via a context-based approach: `ShellFrameRoute` renders `<ShellChrome>` (rail + top bar + tabs, stable across navigation so they do not remount and keep focus/state) and the page's `ShellPage` portals its list/main/detail into the frame's grid through `PageLayout` slots. Implementation choice: `ShellFrameRoute` itself renders `PageLayout` with `list`/`detail`/`mainPadding` taken from a small store (`useShellPageStore`) that `ShellPage` sets in a layout effect and clears on unmount; this keeps rail/top bar mounted. `ShellPage` renders `null` itself.
2. Store contract: `{ list?: ReactNode; listWidth?; detail?: ReactNode; detailWidth?; mainPadding; mainMaxWidth?; main: ReactNode }`; updates are batched (`useLayoutEffect` + `useSyncExternalStore`); a view that renders no `ShellPage` gets the default empty main. A dev warning fires when two `ShellPage` instances are mounted at once.
3. Tabs: rendered by the frame when the active slot has `TAB_SETS` (SHELL009); `PageLayout.tabs` receives `<TabsSlot/>`; when no tabs the prop is undefined (the top bar bottom border remains).
4. Top bar variant by route meta: `topBar: 'workspace' | 'plain'` from the matched route (`useMatches`), passed to `<TopBarSlot variant>`.
5. Landmarks (DS044 req. 5): rail `<nav aria-label>`, top bar `<header>`, `<main id="main">`, panels `<aside aria-label>`; the skip link text key `a11y:skip.main` ('Skip to main content' / 'Przejdź do treści') is the first focusable element and moves focus to `#main`. `ShellPage` requires `labels.list` and `labels.detail` strings when the panels are provided (TypeScript enforced).
6. Document scroll is never used: the frame root has `height: 100dvh` from DS; panels scroll (`overflow: auto`). A Playwright check asserts `document.scrollingElement.scrollTop` stays 0 after scrolling a long panel.
7. `BareFrame`: `<main id="main">` full-bleed on `bg-app`, no rail; used by ONB (WizardLayout provides its own sidebar).
8. Slots registration API: `registerShellSlot('rail' | 'topBar' | 'tabs', Component)` called at module load of SHELL013/014/016; an unregistered slot renders a visible dev-only placeholder `[rail slot missing]` and nothing in production.
9. Stories: frame with fixtures for each width preset used by the product (list 270/290/340/360/400, detail 290/300/310/320/340) to catch overflow regressions.
10. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` shows the top-left of the shell: the 72px rail (logo tile + home active + 4 icons + divider + agents) and the 67px top bar, i.e. the chrome this task composes. The frame must reproduce: rail width 72 and `bg-panel` with a right border, top bar one row 67px (E1 normalisation wins over the 117px of the Main mock: see `design-main.png`), content area `bg-app`. States not in the mock: skip link visible on focus (top-left, magenta-tint surface), placeholder slots in dev, loading skeleton of the content area (DS `Skeleton` blocks, no spinner).

## 7. Reuse

- `ui:PageLayout`, `ui:SidePanel`, `ui:VisuallyHidden`, `ui:Skeleton` (DS044/022/032); route metadata from SHELL009; `useMatches` from the router (SHELL010).
- Never copy PageLayout CSS; only props.

## 8. Architecture and code placement

`apps/desktop/src/app/layout/{shell-frame-route.tsx,shell-page.tsx,shell-page-store.ts,bare-frame.tsx,slots.ts,skip-link.tsx}`. UI composition layer; depends on `ui-kit` and the nav model only.

## 9. Security and safety

- Views cannot opt out of the top bar or rail (no escape hatch) so the Global Pause control and Approvals counter are always reachable (safety: the Owner can always stop everything).
- Slots render only components registered by code (no data-driven component names).
- Skip link and landmarks are required for keyboard/AT access.

## 10. Errors and edge cases

- View unmounts and mounts another quickly: the store clears and sets in order; no flash of the old content (layout effects).
- `ShellPage` rendered outside the frame (storybook): works with a `ShellPageProvider` decorator.
- Very long list panel content: panel scrolls, frame does not.
- Detail panel provided with an unsupported width: TypeScript rejects (closed union from DS044).
- Route without `ShellPage` (feature forgot it): empty main plus dev warning.

## 11. Acceptance criteria

- [ ] Given the frame with fixtures then rail, top bar and content are laid out at 72px/67px/rest and match `design.png` within the visual tolerance.
- [ ] Given navigation between two views then the rail and top bar do not remount (instance identity test).
- [ ] Given a long list then only the panel scrolls.
- [ ] Given Tab from the document start then the first stop is the skip link, Enter moves focus to `main`.
- [ ] Given two simultaneous `ShellPage` then a dev warning is logged.
- [ ] axe has no violations on the frame story.

## 12. Test plan

- Vitest + Testing Library: store behaviour, no-remount test, slot registry; Storybook stories with play functions (skip link).
- Visual: story `Shell/Frame` vs `design.png` and `design-main.png` (TEST005).
- Playwright: no document scroll (TEST004).
- Commands: `pnpm --filter @overmind/desktop test layout`.

## 13. Parallelization notes

After SHELL009/010 types exist. SHELL013, 014, 016 register their slot components; no edits to this task's files. View areas depend on `ShellPage` (`lib:ShellPage`).

## 14. Open questions and assumptions

- ASSUMPTION: `ShellPage` store approach (layout effect) is acceptable; an alternative (each view renders `PageLayout` and the rail/top bar through a shared `ShellChrome` component) would remount chrome per route.
- DESIGN GAP: skip link and dev placeholders are not in the mocks; derived from DS focus/surface rules.
- ALIASES: this task also provides `lib:shell-page`, the names other view areas reported; they are the same module as the primary capability (no second implementation).
