---
id: OVE_WSPACE001
title: Define the dashboard view-model types and pure data-to-props mappers
area: WSPACE
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_BOARD001, OVE_DATA009, OVE_NOTIF001, OVE_PAUSE001, OVE_PERM013, OVE_PERM015, OVE_WFRT051]
soft_depends_on: []
provides: ["lib:ws-dashboard-model"]
needs: ["contract:Workspace", "contract:WorkspaceProgress", "contract:Notification", "contract:PauseSnapshot", "contract:ApprovalRequest", "contract:AccessRequest", "lib:i18n-ui", "contract:RunSummary"]
owns: ["apps/desktop/src/features/workspaces/model/dashboard.types.ts", "apps/desktop/src/features/workspaces/model/card-state.ts", "apps/desktop/src/features/workspaces/model/map-workspace-card.ts", "apps/desktop/src/features/workspaces/model/map-chief-summary.ts", "apps/desktop/src/features/workspaces/model/map-notification.ts", "apps/desktop/src/features/workspaces/model/format.ts", "apps/desktop/src/features/workspaces/model/index.ts", "apps/desktop/src/features/workspaces/model/__fixtures__/**"]
reads: ["packages/contracts/src/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 10", "SPECIFICATION 12"]
adr_refs: [28, 3, 10]
---

# OVE_WSPACE001: Define the dashboard view-model types and pure data-to-props mappers

## 1. Summary

Defines the typed view-model of the Workspaces dashboard and the pure functions that turn gateway data (Workspace, WorkspaceProgress, Chief summary, Agent states, Runs, pending Approvals, pause snapshot) into `ui:WorkspaceCard`, `ui:ChiefSummaryStrip`, `ui:NotificationCenter` and `ui:SystemStatusList` props. No React, no I/O: everything is unit-testable.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Splitting the mapping out of the components (CONVENTIONS 4: contracts, then static UI, then data wiring) means the UI tasks 003-010 render a ready view-model, and the card state rules (working, done, paused, idle, isolated) exist exactly once.

## 3. Scope (in)

- `model/dashboard.types.ts`: `DashboardViewModel`, `WorkspaceCardVm`, `NotificationVm`, `SystemRowVm`, `ChiefSummaryVm`.
- `model/card-state.ts`: `deriveCardState(input)` with the table in requirement 3.
- `model/map-workspace-card.ts`, `map-chief-summary.ts`, `map-notification.ts`, `map-system-rows.ts`.
- `model/format.ts` helpers: counts caption keys, relative age (delegates to `formatRelative` of ARCH011), approvals count.
- Fixtures `model/__fixtures__/dashboard.fixtures.ts` reproducing the four mock cards and five notifications verbatim (Polish sample data).

## 4. Out of scope

- Fetching, caching, push events (OVE_WSPACE002).
- Rendering (OVE_WSPACE003..010).
- Pause data itself (`lib:use-workspace-pause`, OVE_PAUSE014): the mapper accepts its output.

## 5. Detailed requirements

1. Input types come from `@overmind/contracts`: `WorkspaceSummary` (DATA009: `id, name, slug, isolated, paused, status, updatedAt`), `WorkspaceProgress` with `segments[{key:'todo'|'doing'|'review'|'done',count,ratio}]` and `total` (BOARD001/012), `ChiefSummary` rows `{workspaceId, sentence, state:'attention'|'working'|'paused'|'ok'|'idle'}` plus `attention` counts and `generatedAt` (CHIEF007), `AgentState` rows (AGENT010), `RunSummary` (ASSUMPTION, see section 14: `{ id, number:int, workflowName, status:'running'|'waiting'|'succeeded'|'failed'|'cancelled', qualityLoop?:{iteration,max}, endedAt? }`), `ApprovalRequest`/`AccessRequest` counts per Workspace (PERM013/015), `PauseSnapshot` (PAUSE001), `NotificationView` (NOTIF001), `HealthResponse` (ENGINE006).
2. `WorkspaceCardVm = { id, name, path, summary, state:'working'|'done'|'paused'|'idle', isolated, isolatedNoteKey?, approvals:{count}|null, lanes:{todo,doing,review,done}, total, countsCaption:{key,params}, agents:{agentId,initials,hue,working:boolean}[], runLine:{key,params}|null, idleLine:{key}|null, pausedLine:{key}|null, href }`. All text fields are `MessageRef`-like `{key, params}` or already-localised engine text (summary, name); the component layer calls `t()`.
3. `deriveCardState`: (a) `paused` when Global Pause is active OR `workspace.paused`; (b) else `working` when a Run has `status in ('running','waiting')` or any Agent state is `working`; (c) else `done` when the latest Run `succeeded` and `lanes.doing+lanes.review === 0`; (d) else `idle`. Precedence a > b > c > d. `isolated` is orthogonal and may combine with any state. The mapper never returns a state the card component does not know.
4. `path`: the primary Allowed Directory display form (`~/Projects/x`, never a canonical host path from the engine beyond what the PERM route returns as display form); `null` path (no folder yet) renders `workspaces:card.noFolder` ('no folder yet'), never an empty string.
5. Summary text: `ChiefSummary.rows[workspaceId].sentence`; for an isolated Workspace Chief does not summarise (CHIEF007: excluded) so the mapper uses the isolated note key `workspaces:card.isolatedNote` ('Nothing leaves this Workspace, Chief does not search its Decisions.') and leaves `summary` as the note; when the row is missing the key `workspaces:card.summaryMissing` is used ('No summary yet.').
6. Approvals pill: `count = pendingApprovals + pendingAccessRequests` for the Workspace; `0` -> `null` (no pill). Plural key `workspaces:card.approvals_one|_few|_many|_other` ('{{count}} Approval waiting' / PL '3 Zgody czekają').
7. Counts caption: `workspaces:card.counts` with params `{todo, doing, review, done, total}` ('4 to do · 5 in progress · 1 review · 7 done of 17'); total 0 -> key `workspaces:card.noTasks`. Deferred Tasks are not counted (BOARD012).
8. Run line: running -> `workspaces:run.running` 'Run #{{n}} · {{what}}' where `what` is `quality loop {{i}} of {{max}}` when `qualityLoop` exists else the workflow name; no active Run -> `idleLine = workspaces:run.none` ('no active Run'); paused -> `pausedLine = workspaces:card.pausedByYou` ('paused by you') plus `idleLine = workspaces:card.nobodyWorking`; Global Pause -> `pausedLine = workspaces:card.pausedGlobal`.
9. Ordering of cards: attention first (pending approvals > 0), then working, then by `updatedAt` desc, then name (locale compare). Stable and pure.
10. Notification mapper: `NotificationView.kind` -> `ui:NotificationItem` kind (`approval|access-request|discussion|run-completed|escalation|telegram|error`; unknown -> neutral), `ageLabel` via `formatRelative(createdAt)`, `unread = readAt === null`, title/subtitle are already rendered by the engine in the Owner locale (NOTIF010) and are passed through as text.
11. System rows mapper: see OVE_WSPACE009 for the rows; this task only exports the type `SystemRowVm = { id:'engine'|'isolation'|'herdr'|'backup'|'telegram', label:{key}, value:{key,params}|string, status:'ok'|'warn'|'error', remedy?:{labelKey, route} }`.

## 6. Design notes

N/A, functionality only. Values quoted come from `design.png` of the tasks that render them.

## 7. Reuse

- `@overmind/contracts` types only (no re-declared shapes: DRY).
- `formatRelative`, `formatNumber` from `lib:i18n-ui` (ARCH011).
- Fixtures reused by stories of OVE_WSPACE003..010 and by the Playwright mock gateway data (OVE_TEST004 `e2e-fixtures`).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components. Pure TypeScript under `model/`, exported through `model/index.ts`. Dependency: model -> contracts only.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: the mapper must never place data of an isolated Workspace into another Workspace's card, and must not log; names and paths are untrusted text; `href` is built only from the id with the route builder (no string from the server).

## 10. Errors and edge cases

- Workspace without Board progress yet: counts 0, caption `noTasks`, empty track.
- Chief row missing or older than 120 s (`generatedAt`): the mapper sets `summaryStale` so the strip can show the stale line (OVE_WSPACE004).
- Run data unavailable (route failed): `runLine = null`, state falls back to Agent states; never throws.
- Two sources disagree (paused flag vs running Run): paused wins (fail safe: show 'paused').
- Unknown enum value from a newer engine: neutral rendering, warning counted in a dev-only log.
- Name 80 chars with RTL characters: passed through; component sets `unicode-bidi: plaintext`.

## 11. Acceptance criteria

- [ ] Given the fixtures of the four mock cards, Then `deriveCardState` returns working, done, paused, idle(isolated) and the captions equal the mock copy in PL.
- [ ] Given Global Pause active, Then every card state is `paused` with `pausedGlobal`.
- [ ] Given approvals 2 and access requests 1, Then the pill count is 3.
- [ ] Given a missing Chief row, Then `summaryMissing` and `summaryStale=false` are returned; with an old `generatedAt`, `summaryStale=true`.
- [ ] Given an unknown notification kind, Then the neutral kind is returned.
- [ ] Mappers have no imports from React, `api-client` or the DOM (lint boundary).

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `derive-card-state.test.ts` (truth table incl. precedence), `map-workspace-card.test.ts` (path, counts, approvals, run lines), `map-chief-summary.test.ts`, `map-notification.test.ts`, property test: ordering is a total stable order, `no-react-import.test.ts`. Commands: `pnpm --filter @overmind/desktop test model`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/model/` (the files listed in `owns`)`` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Merge early: tasks 002-010 import its types. Other tasks add their own mapper files in `model/` under distinct names; this task owns only the listed files. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: `RunSummary` contract and `api:runs.list` are provided by WFRT/RUNUI (no owner found yet, see final report); until then the mapper accepts `runs: RunSummary[] | undefined`.
- ASSUMPTION: Approvals and Access Requests are summed into one pill (mock label 'Zgody czekają' covers both; Access Request has its own notification).
- ASSUMPTION: card state `done` means last Run succeeded and nothing in progress; the Owner may refine this.
