---
id: OVE_AGUI016
title: "Agents feature manifest: route, rail item, namespaces and cross-feature exports"
area: AGUI
kind: feature
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI003, OVE_ARCH009, OVE_ARCH011, OVE_SHELL009]
soft_depends_on: []
provides: ["lib:agents-feature"]
needs: ["lib:feature-manifest", "lib:route-table", "lib:nav-model", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/agents/feature.manifest.ts", "apps/desktop/src/features/agents/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9"]
adr_refs: [28]
---

# OVE_AGUI016: Agents feature manifest: route, rail item, namespaces and cross-feature exports

## 1. Summary

Registers the `agents` feature through `defineFeature`: lazy route `/agents`, the sub-tab `Agenci` of the Workspace section, all i18n namespaces of the feature and the public exports (only a route link helper).

## 2. Context

CONVENTIONS 5: features are plugged in through manifests discovered by the app shell; no shared file is edited. The mock shows `Agenci` next to `Skille` in the shell tab bar (`shell/tab-bar`).

## 3. Scope (in)

- `feature.manifest.ts`.
- `index.ts` public exports.

## 4. Out of scope

- Region content.

## 5. Detailed requirements

1. `defineFeature({ id:'agents', routes:[{ path:'/agents', lazy: () => import('./routes/AgentsRoute') }], nav:{ section:'workspace', order:..., labelKey:'agents:nav.agents', icon:'agents' }, namespaces:['agents','agents-list','agents-header','agents-config','agents-visibility','agents-skills','agents-tools','agents-memory','agents-dynamic','agents-create','agents-versions','agents-states'] })`.
2. The route requires an active Workspace (`lib:workspace-gate`).
3. Public exports: `agentRoute(agentId, tab?)` returning the in-app path, used by other features through `routeLinks` (no feature imports another feature's components).
4. A test asserts that every namespace file exists in EN and PL and that `index.ts` exports nothing but the route helper.
5. Lazy loading: the route chunk is not part of the initial bundle (bundle budget test from ARCH).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`defineFeature`, shell route table and nav model.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `feature.manifest.ts`, `index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Namespace file missing in PL: `i18n:check` fails the build (not a runtime error).

## 11. Acceptance criteria

- [ ] Given the manifest, Then `/agents` renders the route and the rail/tab shows `Agenci`.
- [ ] Given the boundary lint, Then no import of another feature exists.
- [ ] Given the namespace test, Then all files exist in both languages.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `manifest.test.ts`, boundary lint (`pnpm lint:boundaries`). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Single file hotspot of the feature; touched only by this task.

## 14. Open questions and assumptions

- ASSUMPTION: nav section id `workspace` and icon key `agents` are defined by SHELL (OVE_SHELL nav model).
