---
id: OVE_ONB011
title: "Build the wizard host: route, stepper, resume, step registry and useOnboardingState"
area: ONB
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DS010, OVE_DS032, OVE_DS073, OVE_ONB009, OVE_SHELL005, OVE_SHELL006, OVE_SHELL012]
soft_depends_on: ["OVE_SHELL012", "OVE_SHELL010"]
provides: ["lib:use-onboarding-state", "ui:WizardHost", "lib:use-wizard-step", "lib:onboarding-step-registry"]
needs: ["ui:WizardLayout", "ui:WizardStepper", "ui:LogoTile", "ui:EmptyState", "lib:use-gateway-query", "lib:use-invalidate-on-events", "lib:api-client-onboarding", "lib:feature-manifest", "ui:ShellFrame"]
owns: ["apps/desktop/src/features/onboarding/feature.manifest.ts", "apps/desktop/src/features/onboarding/OnboardingRoute.tsx", "apps/desktop/src/features/onboarding/WizardHost.tsx", "apps/desktop/src/features/onboarding/wizard-step-context.tsx", "apps/desktop/src/features/onboarding/step-registry.ts", "apps/desktop/src/features/onboarding/use-onboarding-state.ts", "apps/desktop/src/features/onboarding/testing.tsx", "apps/desktop/src/locales/en/onboarding.json", "apps/desktop/src/locales/pl/onboarding.json"]
reads: []
design: design.png
design_source: "Kreator-Folder#onb/sidebar (crop 0,0,360,900; identical in Kreator-Polaczenia); design-head.png = onb/step-counter + onb/title + onb/lead (crop 416,40,968,170)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [10, 21]
---

# OVE_ONB011: Build the wizard host: route, stepper, resume, step registry and useOnboardingState

## 1. Summary

Creates the onboarding feature shell: the bare `/onboarding/:step` route, the host that renders `ui:WizardLayout` (sidebar with brand, intro, 4-step stepper and footnote; main column with step counter, title and lead), the step registry that auto-discovers step folders, the footer behaviour (Back/Next) driven by the active step, resume at the stored step and the `useOnboardingState()` hook consumed by the shell's first-run guard.

## 2. Context

The wizard has four steps (ONB012..021). Each step is a separate task with its own folder; none may edit a shared file. The host owns what is common: layout, stepper states, counter 'Krok N z 4', navigation, resume from the engine's `OnboardingState` (ONB003/009) and the contract between host and step (title, lead, validity of Next, Next action, optional hint and back behaviour). The sidebar is drawn in `Kreator-Folder.png` and `Kreator-Polaczenia.png` (identical): 360 px wide, radial magenta glow, brand row, 'PIERWSZE URUCHOMIENIE', intro, stepper, footnote. SHELL025 redirects first runs here and SHELL012's `BareFrame` renders the route without the rail.

## 3. Scope (in)

- `feature.manifest.ts` (route `/onboarding/*`, `meta: { frame: 'bare', titleKey: 'onboarding:title' }`, namespaces, no nav item).
- `OnboardingRoute` and `WizardHost` using `ui:WizardLayout`/`ui:WizardStepper` (DS073).
- Step registry via `import.meta.glob('./steps/*/index.ts')`: each step folder exports `stepDefinition: { id, order, titleKey, leadKey, Component }`.
- `useWizardStep()` context API for steps: `{ setNext({ label?, disabled?, disabledReason?, loading?, onClick }), setBack(...|null), setHint(node) }`.
- `useOnboardingState()` hook (query `onboarding.state` + events) returning `{ status, needsOnboarding, step, state }`.
- Resume: `/onboarding` redirects to the derived resume step (`onboarding/<stepId>`); step progress saved with `SaveOnboardingProgress` on each successful Next/Back.
- `locales/{en,pl}/onboarding.json` with the shell strings (below).
- Fixtures and stories for the host with a stub step.

## 4. Out of scope

- Step contents (ONB012+).
- The first-run guard (SHELL025).
- Completion (ONB022).

## 5. Detailed requirements

1. **Route.** `/onboarding` -> redirect to `/onboarding/<resumeStep>`; `/onboarding/:step` where `:step` in `folder|connections|workspace|telegram`; an unknown step redirects to the resume step; a step beyond the allowed one (the engine says `step_blocked`) redirects to the first not-done step with a polite announcement. Titles: document title 'Pierwsze uruchomienie · Overmind' (SHELL025).
2. **Layout props.** `brand={name:'Overmind'}`, `eyebrow` 'PIERWSZE URUCHOMIENIE' (EN 'FIRST RUN'), `intro` 'Kilka kroków i Chief będzie gotowy do pracy. Wszystko zostaje na tym Macu.' (EN 'A few steps and Chief is ready to work. Everything stays on this Mac.'), `footnote` 'Jedna instalacja to jeden Właściciel. Bez kont i bez serwera.' (EN 'One installation, one Owner. No accounts, no server.'), steps: 1 'Dozwolony folder', 2 'CLI i izolacja', 3 'Pierwszy Workspace', 4 'Telegram' with sublabel 'opcjonalnie' (EN 'Allowed folder', 'CLI and isolation', 'First Workspace', 'Telegram', 'optional'); `stepCounter` 'Krok {{n}} z 4' (EN 'Step {{n}} of 4'); `labels.stepsNav` 'Kroki kreatora' (EN 'Wizard steps'); per-step `stateLabel` ('gotowe'/'bieżący'/'oczekuje' hidden text).
3. **Stepper state.** `done` when the engine's step result is done (`state.steps.*`), `active` for the current route step, `pending` otherwise. Clicking a completed step navigates back to it (allowed, no data loss); clicking a pending step is inert (not focusable as a link; `aria-disabled`).
4. **Step contract.** Each step renders inside the host's `children`; the host supplies `title` and `lead` from the step definition keys. The step uses `useWizardStep()` to register the footer: `setNext({ label: 'Dalej', disabled, disabledReason, loading, onClick })`, `setBack(null | { label: 'Wstecz', onClick })` (step 1 passes `null`: E24, the mock's Back on step 1 is hidden), `setHint(node)` (step 2 hint 'Wystarczy jedno zalogowane CLI, żeby przejść dalej.'). The host renders `WizardFooter`. When a step has not registered Next yet the button is disabled with `aria-busy`.
5. **Navigation.** Next `onClick` is async: the step performs its work (for example provisioning), then calls `host.advance()` which saves progress (`SaveOnboardingProgress`) and navigates to the next step; errors stay in the step. Back calls `host.back()` (saves progress to the lower step, navigates). Steps never call the router directly.
6. **useOnboardingState.** `useGatewayQuery('onboarding.state')` with invalidation by `ONBOARDING_INVALIDATING_EVENTS` (ONB001); returns `{ status: 'loading'|'ready'|'error', needsOnboarding, step, state, refetch }`; `needsOnboarding` true when `state.status !== 'completed'`. A test helper `FakeOnboardingStateProvider` is exported for SHELL025/other tests.
7. **Resume rule on the UI.** The host trusts the engine's derived `currentStep`; it never computes the resume step itself.
8. **Focus and announcements.** On step change focus moves to the title (`tabIndex=-1`) and the polite live region reads 'Krok 2 z 4. Podłącz CLI i sprawdź izolację' (DS073 behaviour; this task supplies `titleRef` and strings).
9. **Window.** Minimum 1100x700 (SHELL008); the DS handles the narrower sidebar.
10. **Engine states.** The wizard is inside `EngineStatusGate` (SHELL020), so no extra engine handling here; query errors show `ui:EmptyState` with retry inside the main column.
11. **i18n keys (`onboarding.json`)**: `title`, `eyebrow`, `intro`, `footnote`, `stepCounter`, `stepsNav`, `steps.<id>.label`, `steps.telegram.sublabel`, `steps.<id>.title`, `steps.<id>.lead` (copied from the mocks for 1 and 2; proposed for 3 and 4 by ONB019/ONB020 into their own namespaces via the registry: the step definition names a key in its own namespace), `footer.back` 'Wstecz', `footer.next` 'Dalej', `state.done/active/pending`, `error.load`, `error.retry`, `announce.step`.
12. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` is the wizard sidebar (360x900): radial magenta glow top-left, brand row (logo tile 46 + 'Overmind'), eyebrow, intro, stepper with step 1 active (magenta numbered dot), step 4 sublabel 'opcjonalnie', footnote pinned to the bottom. `design-head.png` shows the main column head (counter, title 34/700, lead). The host reproduces them through `ui:WizardLayout`; states done/pending/inert are DS-derived (mock shows only step 1 active). DESIGN GAP: done dot (mint check) and the keyboard focus ring are DS decisions.

## 7. Reuse

- `ui:WizardLayout`, `ui:WizardStepper`, `ui:WizardFooter`, `ui:LogoTile`, `ui:EmptyState`, `ui:Skeleton` (DS073/041/032); `useGatewayQuery`, event hub, `BareFrame` (SHELL005/006/012); `api-client-onboarding` (ONB009).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/{feature.manifest.ts,OnboardingRoute.tsx,WizardHost.tsx,wizard-step-context.tsx,step-registry.ts,use-onboarding-state.ts,testing.tsx}` and locale files `apps/desktop/src/locales/{en,pl}/onboarding.json`. Steps live in `apps/desktop/src/features/onboarding/steps/<id>/` owned by their tasks.

## 9. Security and safety

- The UI cannot mark steps done or skip required steps: progress changes go through the engine, which enforces the machine (ONB003).
- No secrets are held by the host; steps clear sensitive inputs themselves.
- The route is owner-only by construction (the desktop session).

## 10. Errors and edge cases

- Direct navigation to `/onboarding/workspace` while folder is not done: redirected back with a short announcement.
- Browser back inside the wizard: allowed to previous completed steps only; forward to pending steps is redirected.
- State query fails: error panel with retry; the stepper is hidden state-unknown placeholders.
- Completion happened elsewhere (tab): state event flips `needsOnboarding` and the guard (SHELL025) leaves the wizard.
- Locale switch mid-wizard: all copy re-renders.

## 11. Acceptance criteria

- [ ] Given a fresh installation then `/onboarding` redirects to `/onboarding/folder` and the stepper shows step 1 active, 4 optional.
- [ ] Given state at step 3 then the stepper shows 1 and 2 done with check dots and lands on step 3.
- [ ] Given a pending step clicked then nothing happens; given a done step clicked then navigation goes back.
- [ ] Given a step registering Next disabled with a reason then the button exposes `aria-disabled` and the reason text.
- [ ] Given the sidebar then it matches `design.png` within tolerance.

## 12. Test plan

- Vitest + Testing Library with `createMemoryRouter`, fake onboarding client, stub step modules: redirects, stepper states, footer registration, advance/back saving progress.
- Storybook: `Onboarding/Host` with stub steps; visual vs `design.png`.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding`.

## 13. Parallelization notes

After SHELL010/012 and ONB009 (can use the fake client). Step tasks (ONB012+) plug in through the registry only. Hotspot: none (steps use own folders).

## 14. Open questions and assumptions

- ASSUMPTION: `import.meta.glob` discovery counts as an ARCH009 extension point for feature internals.
- OPEN (namespaces): step namespaces `onboarding-folder`, `onboarding-checks`, `onboarding-workspace`, `onboarding-telegram` need the ARCH011 allow-list entry (prefix rule `onboarding*`).
- DESIGN GAP: the done-state dot and the inert pending step are not in the mock.
