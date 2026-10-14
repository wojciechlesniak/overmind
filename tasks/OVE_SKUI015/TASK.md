---
id: OVE_SKUI015
title: "Skills feature manifest: route, tab, namespaces and exports"
area: SKUI
kind: feature
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_SHELL009, OVE_SKUI003]
soft_depends_on: []
provides: ["lib:skills-feature"]
needs: ["lib:feature-manifest", "lib:route-table", "lib:nav-model", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/skills/feature.manifest.ts", "apps/desktop/src/features/skills/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8"]
adr_refs: [28]
---

# OVE_SKUI015: Skills feature manifest: route, tab, namespaces and exports

## 1. Summary

Registers the `skills` feature through `defineFeature`: lazy route `/skills`, the sub-tab `Skille` next to `Agenci`, all namespaces and the public route helper.

## 2. Context

CONVENTIONS 5: features are plugged in via manifests; the mock shows `Skille` in the shell tab bar next to `Agenci`.

## 3. Scope (in)

- `feature.manifest.ts`, `index.ts`.

## 4. Out of scope

- Region content.

## 5. Detailed requirements

1. `defineFeature({ id:'skills', routes:[{ path:'/skills', lazy }], nav:{ section:'workspace', labelKey:'skills:nav.skills' }, namespaces:['skills','skills-header','skills-grid','skills-inspector','skills-edit','skills-detach','skills-create','skills-visibility','skills-import','skills-review','skills-proposal','skills-states'] })`.
2. Requires an active Workspace (`lib:workspace-gate`).
3. Public export: `skillRoute(skillId?)` for `routeLinks` (no other exports).
4. A test asserts all namespace files exist in EN and PL.
5. Lazy chunk not part of the initial bundle.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`defineFeature`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `feature.manifest.ts`, `index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Missing PL namespace: `i18n:check` fails the build.

## 11. Acceptance criteria

- [ ] Given the manifest, Then `/skills` renders and the tab `Skille` shows.
- [ ] Given the boundary lint, Then no other feature is imported.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `manifest.test.ts`, `pnpm lint:boundaries`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Single hotspot file of the feature, only this task touches it.

## 14. Open questions and assumptions

- ASSUMPTION: nav section `workspace` is shared with Agents.
