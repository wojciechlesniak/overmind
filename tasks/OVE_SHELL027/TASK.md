---
id: OVE_SHELL027
title: "Provide typed route builders, route links and the navigate helper for cross-feature links"
area: SHELL
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_SHELL009, OVE_SHELL010]
soft_depends_on: ["OVE_SHELL011"]
provides: ["lib:route-builders", "lib:route-links", "lib:shell-navigation", "lib:app-navigation"]
needs: ["lib:nav-model", "lib:route-table", "lib:use-navigate-to-route", "lib:feature-manifest"]
owns: ["apps/desktop/src/app/links/**", "docs/architecture/desktop-route-links.md"]
reads: ["apps/desktop/src/features/*/feature.manifest.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [18]
---

# OVE_SHELL027: Provide typed route builders, route links and the navigate helper for cross-feature links

## 1. Summary

Features must link to each other (Board task to Chief chat, Run pill to Activity, notification to Approvals, agent mention to agent chat) without importing each other. This task provides one typed link registry: features register route builders next to their routes, and every other feature produces URLs and navigates through `routeLinks.*` and `useShellNavigation()`.

## 2. Context

Conventions forbid feature-to-feature imports (CONVENTIONS 6; ARCH002 boundary lint). Several view areas reported the same need under different names: `lib:route-links` (AGUI, BOARDUI), `lib:route-builders` (WSPACE notifications), `lib:shell-navigation` and `lib:app-navigation` (CHATUI, RUNUI, WFED). All four names resolve to this one module, which is the DRY answer. The paths of the product are fixed in SHELL009 (`RAIL_SLOTS` defaults, `docs/architecture/desktop-navigation.md`); routes inside a view (selected Task, selected Run) travel as search params so deep links survive reload and window re-open from the Tray.

## 3. Scope (in)

- `RouteLinkRegistry`: typed registry of named link builders; a feature declares builders in its manifest `links` field (an additive extension of `defineFeature`, proposal to ARCH009 if the field is not yet there) and the shell collects them with the routes.
- Built-in, shell-owned builders for the cross-cutting targets: `home`, `chief`, `agentChat`, `discussion`, `board`, `decisions`, `decision`, `run`, `workflow`, `workflowRun`, `agents`, `agentProfile`, `skills`, `approvals`, `connections`, `ownerRules`, `workspaceSettings`, `workspacePermissions`, `projectDoc`, `artifact`, `settingsApp`.
- `useShellNavigation()` returning `{ navigate(target), hrefOf(target), isKnown(target) }`; `target` is the discriminated union `{ to: 'agentChat', agentId } | { to: 'run', runId, nodeId? } | ...`.
- Pure helpers: `buildHref(target)`, `parseHref(href)` (inverse, used by deep links and the Tray), `sanitiseInternalHref(href)`.
- Documentation `docs/architecture/desktop-route-links.md` (table of targets, how a feature adds one).

## 4. Out of scope

- The router and lazy route table (OVE_SHELL010), nav model (OVE_SHELL009).
- Implementing the target views (their areas).
- Native URL scheme / OS deep links `overmind://` (later; Tauri deep-link plugin is not enabled in MVP).

## 5. Detailed requirements

1. **Target union.** `type RouteTarget = { to: 'home' } | { to: 'chief'; conversationId?: EntityId } | { to: 'agentChat'; agentId: EntityId; messageId?: EntityId } | { to: 'discussion'; discussionId: EntityId } | { to: 'board'; taskId?: EntityId; filter?: string } | { to: 'decisions'; decisionId?: EntityId } | { to: 'workflow'; workflowId?: EntityId; versionId?: EntityId } | { to: 'run'; runId: EntityId; nodeId?: string } | { to: 'agents'; agentId?: EntityId; tab?: 'profile' | 'memory' | 'skills' } | { to: 'skills'; skillId?: EntityId } | { to: 'approvals'; requestId?: EntityId; kind?: 'approval' | 'access' } | { to: 'connections' } | { to: 'ownerRules'; ruleId?: EntityId; proposalId?: EntityId } | { to: 'workspaceSettings' } | { to: 'workspacePermissions' } | { to: 'projectDoc'; refId: EntityId } | { to: 'artifact'; artifactId: EntityId } | { to: 'settingsApp' }`. Ids use the `EntityId` contract; builders validate the shape (ULID with prefix) before producing a URL and throw `RouteLinkError('INVALID_ID')` in dev, return the safe fallback `/` link in production.
2. **Paths** (defaults, ASSUMPTION until the owning area confirms; changing one is a one-line edit in the owning manifest): `home` `/`; `chief` `/chief?c=<id>`; `agentChat` `/chief/agent/<agentId>?m=<id>`; `discussion` `/chief/discussion/<id>`; `board` `/board?task=<id>&filter=<f>`; `decisions` `/decisions?id=<id>`; `workflow` `/workflow?w=<id>&v=<id>`; `run` `/workflow/runs?run=<id>&node=<n>`; `agents` `/agents/<agentId>?tab=`; `skills` `/agents/skills?skill=<id>`; `approvals` `/approvals?id=<id>&kind=`; `connections` `/settings/connections`; `ownerRules` `/settings/workspace/rules?rule=<id>&proposal=<id>`; `workspaceSettings` `/settings/workspace`; `workspacePermissions` `/settings/workspace/permissions`; `projectDoc` `/settings/workspace/docs/<refId>`; `artifact` `/artifact/<id>`; `settingsApp` `/settings/app`.
3. **Ownership of builders.** Each target has exactly one owner: the feature whose route serves it. Shell-owned defaults above exist so features can be built in parallel; when the owner feature registers a builder with the same `to`, it replaces the default (the registry logs the override in dev). Two features registering the same `to` throws `ROUTE_LINK_DUPLICATE`.
4. **`navigate(target)`** uses `useNavigateToRoute`/router `navigate`; `replace?: boolean` option; unknown `to` (feature not installed) falls back to `home` and logs one warning, never throws in production. `hrefOf(target)` returns an app-relative string for `<a href>` so links are real anchors (middle-click, copy link) and the DS `Link` / `NavLink` primitives can be used.
5. **Sanitising.** `sanitiseInternalHref(href)` returns the href only if it starts with a single `/`, has no `//` prefix, no scheme, no backslash, no control characters and its pathname matches a known route pattern; otherwise `null`. Links coming from engine data (`boardUrlPath`, notification `target`, Chief message links) MUST pass through it before use; external URLs go to `desktopShell.openExternal` (SHELL003), never through `navigate`.
6. **Parse.** `parseHref('/board?task=T1')` -> `{ to: 'board', taskId: 'T1' }`; round-trip property: `parseHref(buildHref(t))` equals `t` for every target (property test).
7. **Workspace scope.** Builders never embed the current Workspace id (Workspace is global state, SHELL011); a target for an entity in another Workspace includes `ws=<id>` only when `target.workspaceId` is given, and the shell switches Workspace before rendering (SHELL011 `useSetCurrentWorkspace`).
8. **Typing for features.** `useShellNavigation` is the only navigation API features may import from the shell (lint rule: no `react-router` imports outside `app/` and `shared/`).
9. **Aliases.** The module is exported once; `lib:route-links`, `lib:route-builders`, `lib:shell-navigation`, `lib:app-navigation` are the same barrel (`apps/desktop/src/app/links/index.ts`), documented in the doc file so no area creates a fifth name.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineFeature` / `collectFeatures` (ARCH009), `buildRouteTable` (SHELL009), `useNavigateToRoute` (SHELL010), `EntityId` (contracts), `desktopShell.openExternal` (SHELL003), DS `Link` primitive.

## 8. Architecture and code placement

`apps/desktop/src/app/links/{route-target.ts,route-link-registry.ts,default-links.ts,use-shell-navigation.ts,sanitise-href.ts,parse-href.ts,index.ts}`. Pure TypeScript except the hook (UI infrastructure). Features depend on this barrel, the barrel depends on nothing in `features/`; features register builders through the manifest, so the dependency points inward (DIP).

## 9. Security and safety

- Engine data, agent messages and Telegram-derived text are untrusted: only sanitised internal hrefs are navigated; `javascript:`, `data:`, `file:`, protocol-relative and absolute URLs are rejected.
- Builders URL-encode every id and param; ids are validated, so an id such as `../settings` cannot change the path.
- Navigation never triggers a mutation; approving or deleting is never encoded in a URL (no `?approve=1`).
- On any failure the result is the safe `home` route, not a partially built URL.

## 10. Errors and edge cases

- Missing optional params: omitted from the query string (no `undefined` text).
- Target for a feature whose route is not installed: `isKnown` false; callers render plain text instead of a link.
- Very long ids/param values (> 128 chars): rejected as invalid.
- Link to an entity that was deleted: the destination view shows its own not-found state; the builder does not check existence.
- Duplicate registration in hot reload: registry resets on module replacement.

## 11. Acceptance criteria

- [ ] Given each `RouteTarget` then `buildHref` produces the documented path and `parseHref` round-trips it.
- [ ] Given `sanitiseInternalHref('//evil.example')`, `'https://x'`, `'javascript:1'` then `null`; given `'/board?task=T1'` then the same string.
- [ ] Given a feature manifest registering `board` then it replaces the default builder and the override is logged in dev.
- [ ] Given two manifests with the same `to` then `ROUTE_LINK_DUPLICATE`.
- [ ] Given an id `../x` then dev throws `INVALID_ID` and production returns `/`.
- [ ] Given `useShellNavigation().navigate({to:'run', runId})` then the router location is `/workflow/runs?run=<id>`.
- [ ] Given the barrel then all four capability aliases resolve to it and the doc lists them.

## 12. Test plan

- Vitest unit and property tests (fast-check) for build/parse round trip and sanitiser (table of hostile strings).
- Component test with memory router for `useShellNavigation`.
- Lint fixture: a feature importing `react-router` fails.
- Command: `pnpm --filter @overmind/desktop test links`.

## 13. Parallelization notes

Start right after SHELL009/010; consumers can code against the `RouteTarget` type and stub `useShellNavigation`. Hotspot: `default-links.ts` (only this task edits it; owners override via manifest).

## 14. Open questions and assumptions

- ASSUMPTION: the paths in requirement 2 are defaults; owner areas (WSPACE, CHATUI, RUNUI, AGUI) may register their final builders, which win over the defaults.
- GAP: the manifest `links` field is an additive extension of ARCH009 `defineFeature`; if ARCH009 lacks it, write `tasks/_proposals/OVE_SHELL027-manifest-links.md` and register builders from `app/links/default-links.ts` meanwhile.
