---
id: OVE_WSPACE018
title: Workspace settings data hooks with versioned writes and push refresh
area: WSPACE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_DATA011, OVE_DATA015, OVE_DATA017, OVE_ENGINE019, OVE_ENGINE027, OVE_PERM026, OVE_PERM028, OVE_SKILL011, OVE_WFRT048, OVE_WSPACE017]
soft_depends_on: []
provides: ["lib:use-workspace-settings-data"]
needs: ["api:workspaces.get", "api:perm.policies", "api:access-requests.list", "api:perm.overrides", "api:owner_rules.list", "api:owner_rules.proposals.list", "api:project_docs.list", "api:agents.list", "api:skills.list", "api:workflows.list", "lib:api-client-events", "lib:api-client"]
owns: ["apps/desktop/src/features/workspace-settings/api/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 21, 28]
---

# OVE_WSPACE018: Workspace settings data hooks with versioned writes and push refresh

## 1. Summary

Implements the data layer of Workspace settings: typed hooks for the Workspace, its permission policy and run grants, approval overrides, Owner Rules and proposals, Project Docs and the private-items usage, with optimistic-concurrency writes and push-event refresh. Sections consume these hooks and never call the gateway themselves.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Sources: `GET /v1/workspaces/{id}` (DATA011), `GET /v1/permissions/policies?scope=workspace&subjectId=` (PERM026), `GET /v1/access-requests?workspaceId=&status=` (PERM028), `GET /v1/permissions/approval-overrides?workspaceId=` (PERM026), `GET /v1/owner-rules?workspaceId=` and `.../proposals?status=pending` (DATA015), `GET /v1/workspaces/{id}/project-docs` (DATA017), agents/skills/workflows lists (AGENT005, SKILL, WFRT) for private items.

## 3. Scope (in)

- `api/useWorkspace.ts`, `usePolicy.ts`, `useRunGrants.ts`, `useApprovalOverrides.ts`, `useOwnerRules.ts`, `useRuleProposals.ts`, `useProjectDocs.ts`, `usePrivateItems.ts`.
- `api/mutation.ts`: shared `useVersionedMutation` (expectedVersion, conflict handling, cache update, toast).
- Push invalidation map.
- Contract types only, no re-declaration.

## 4. Out of scope

- Rendering (sections), Local Approval wiring (each section calls `useLocalApproval` itself).

## 5. Detailed requirements

1. Each hook returns `{ data, status:'loading'|'ready'|'error'|'stale', error?, refetch }` like OVE_WSPACE002 (same cache module pattern: if SHELL provides a query library use it; else import the small cache from the dashboard feature is NOT allowed (feature isolation): this feature carries its own `api/query-cache.ts` identical in behaviour; ASSUMPTION: SETUP may later extract it to `shared/`).
2. Versioned writes: mutation functions take the entity `version` read from the cache and send `expectedVersion`; on `409 data.version_conflict | perm.policy_conflict | agent.version_conflict` they refetch, set `conflict:true` and surface the 'changed elsewhere' state (OVE_WSPACE031) instead of silently retrying (except the Local Approval flows which re-mint).
3. Policy: `usePolicy(workspaceId)` returns the Workspace-layer `PermissionPolicy` with `directories.entries[]`, `capabilities`, `version`; if `directories.mode==='unrestricted'` (should not occur for Workspace scope) the UI treats it as an error state (deny-by-default display).
4. Run grants: `useRunGrants(workspaceId)` = Access Requests with `status in ('granted_run')` plus recent `expired`, mapped for the table (OVE_WSPACE019): fields `canonicalPath`/display path, rights, `decision.by`, `runId`, `expiresAt`/status.
5. Overrides: `useApprovalOverrides(workspaceId)` -> lifted action classes + `ownerRuleId`; the effective list of actions that STILL require Approval = default list (ADR 0021, `contract:ActionClass` constants) minus overrides (computed in `model/consent.ts` of OVE_WSPACE025, but the raw lists come from here).
6. Owner Rules: list for the Workspace including global ones (`workspaceId` null) flagged `scope:'global'|'workspace'`; history lazily via `GET /v1/owner-rules/{id}/history`.
7. Proposals: pending Chief proposals; refetch on `owner_rule.proposed|proposal_resolved` events.
8. Project docs: list with `status`, `gitCommit`, `taskCount` (ASSUMPTION: provided by DATA017/BOARD aggregation, see section 14), `verify(id)`.
9. Private items: `usePrivateItems(workspaceId)` -> `{ agents, skills, workflows }` filtered `visibility==='private' && ownerWorkspaceId===workspaceId` using the list routes with `workspaceId` (AGENT005 requires it; SKILL `api:skills.list`; workflows route is a gap: `api:workflows.list`).
10. Push topics: `workspace.updated|renamed|deleted`, `policy.changed`, `override.changed`, `access_request.decided`, `run_grant.changed`, `owner_rule.*`, `visibility.changed`, `pause.changed`; invalidate only the matching hook (coalesced 300 ms).
11. No caching to disk; ids and versions in memory only.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:api-client` clients: workspaces, perm (policies, overrides), access-requests, owner-rules, project-docs, agents, skills, visibility; `lib:api-client-events`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: all reads are Workspace-scoped; a policy id returned for another Workspace is rejected client-side (`subjectId !== workspaceId` -> error state, logged). Versions are never guessed.

## 10. Errors and edge cases

- Policy missing (null `policyId`): `usePolicy` returns `{status:'ready', data:null}` and sections show 'no policy yet: no access'.
- Two quick edits: second mutation uses the version from the first response (serialised per entity queue).
- List route 403 for one hook: only that section errors.
- Push event for another Workspace id: ignored.
- Event stream down: stale markers, polling every 30 s.

## 11. Acceptance criteria

- [ ] Given a version conflict on a rule edit, Then the hook refetches, flags `conflict`, and no second request is sent automatically.
- [ ] Given `policy.changed` for this Workspace, Then `usePolicy` refetches once.
- [ ] Given a policy for another Workspace, Then the hook errors and nothing renders.
- [ ] Given two edits in a row, Then the second carries the updated version.
- [ ] Given private-item lists, Then only `private` items owned by this Workspace are returned.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: hook tests with fake api-client/event hub, `useVersionedMutation.test.ts` (conflict, queueing), `scope-guard.test.ts`. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/api`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/api/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: Project Doc list entries carry `taskCount`; if not, the docs section shows no count (OVE_WSPACE026).
- ASSUMPTION: `GET /v1/workflows?workspaceId=&visibility=private` will exist (gap).
