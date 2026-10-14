---
id: OVE_VIS003
title: Provide VisibleInWorkspaceSpecification and the SQLite visibility query helper
area: VIS
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_VIS001]
soft_depends_on: []
provides: ["lib:visible-in-workspace-spec", "lib:visibility-sql", "contract:VisibilityScope"]
needs: []
owns: ["packages/domain/src/visibility/specification/**", "packages/adapters/sqlite/src/vis/visibility-sql.ts", "docs/architecture/visibility-queries.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 8", "SPECIFICATION 16.3"]
adr_refs: [28, 14]
---

# OVE_VIS003: Provide VisibleInWorkspaceSpecification and the SQLite helper

## 1. Summary

The one shared definition of "is this item visible in Workspace W?" as a domain predicate and as an SQL fragment builder, so AGENT, SKILL and WFRT repositories filter identically instead of each inventing a WHERE clause.

## 2. Context

Libraries, lists, search, counts, Chief proposals and assignment lookups must never show a Private item outside its Workspace (acceptance criterion 3). A forgotten filter in one repository would leak client-specific data, so the predicate lives in one place with conformance tests (VIS004).

## 3. Scope (in)

`VisibleInWorkspaceSpecification`, `VisibilityScope`, the SQL builder, DDL snippet constants for entity tables, docs.

## 4. Out of scope

Conformance suite (VIS004), repositories of the areas.

## 5. Detailed requirements

1. `VisibilityScope = { kind:'workspace', workspaceId } | { kind:'owner_management' }`. `owner_management` is used only by Owner library screens that show everything with a Workspace label; Chief suggestions, Agent contexts, Telegram, workflow validation and `use` operations always use the `workspace` scope.
2. `isVisible(item: {visibility, ownerWorkspaceId?}, scope): boolean`: workspace scope: `public` or `ownerWorkspaceId === scope.workspaceId`; owner_management: true.
3. `VisibleInWorkspaceSpecification` class/functions: `isSatisfiedBy(item)`, `and/or` composition-free (KISS), and `toSql(alias, params)`.
4. `visibleInWorkspaceSql({ alias, scope })` returns `{ sql, params }`: `(a.visibility = 'public' OR a.owner_workspace_id = :visWs)` for workspace scope and `1 = 1` for owner_management; parameters bound, alias validated against `/^[a-z_][a-z0-9_]*$/`. Never string-concatenates ids.
5. Column convention (docs and exported constants `VISIBILITY_COLUMNS_DDL`, `VISIBILITY_INDEX_DDL(table)`): `visibility TEXT NOT NULL CHECK (visibility IN ('public','private'))`, `owner_workspace_id TEXT`, `CHECK ((visibility = 'private' AND owner_workspace_id IS NOT NULL) OR (visibility = 'public' AND owner_workspace_id IS NULL))`, index on `(visibility, owner_workspace_id)`.
6. Rules for repositories (documented, enforced by VIS004): the filter applies to every read path: list, get-by-id (a Private item of another Workspace returns the same not-found as a missing id), search/FTS (filter inside the query, not after), counts, pagination totals, suggestions, joins (assignments, node references, lane assignments), exports.
7. A helper `assertScoped(scope)` throws a programmer error when a repository method is called without a scope (a missing scope must not mean "all").

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Visibility*` contracts (VIS001). Repositories of AGENT/SKILL/WFRT/BOARD import this helper; they do not write their own predicate.

## 8. Architecture and code placement

Domain predicate in `packages/domain/src/visibility/specification/`, SQL builder in the SQLite adapter package under `src/vis/` (adapters may not import each other; areas' repositories import this shared helper from the same adapter package).

## 9. Security and safety

Parameterised SQL only; alias whitelist prevents injection; default-deny: scope is mandatory; same response for foreign-private and missing items (no existence oracle); FTS filtering inside the query avoids leaking via ranking or counts.

## 10. Errors and edge cases

Empty Workspace id: programmer error; item with inconsistent fields (private without owner) fails the CHECK constraint; null owner on private in legacy data: treated as not visible anywhere (fail closed).

## 11. Acceptance criteria

- [ ] `isVisible` truth table (public/private x same/other Workspace x owner_management) is tested.
- [ ] SQL builder output is parameterised and rejects a malicious alias.
- [ ] Legacy inconsistent row (private, no owner) is invisible to every workspace scope.
- [ ] Docs describe the nine read paths that must filter.

## 12. Test plan

Unit tests; an in-memory SQLite test executing the fragment against fixtures. `pnpm vitest run packages/domain/src/visibility/specification packages/adapters/sqlite/src/vis`.

## 13. Parallelization notes

Parallel with VIS002. VIS004 builds on it.

## 14. Open questions and assumptions

- ASSUMPTION: shared SQL helper location inside `adapters/sqlite` is acceptable because areas already own subfolders there.
